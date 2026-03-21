import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { PrismaService } from '../prisma/prisma.service';
import { WalletsService } from '../wallets/wallets.service';
import { crypto } from '../utils/crypto-uuid';
import { ConfirmStatementImportRowDto } from './dto/confirm-statement-import.dto';

type ImportedStatementRow = {
  source_id: string;
  transaction_date: string;
  value: number;
  transaction_type: 'INCOME' | 'EXPENSE';
  description: string | null;
  is_recurring?: boolean;
  installment_total?: number;
  installment_number?: number;
};

type PreviewDuplicateMatch = {
  id: number;
  description: string | null;
  transaction_date: string;
  value: number;
  transaction_type: 'INCOME' | 'EXPENSE';
  payment_method?: string | null;
};

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletsService: WalletsService,
  ) {}

  /**
   * Returns true if the given date is in the future (after end of today).
   */
  private isFutureDate(date: Date): boolean {
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    return date > endOfToday;
  }

  /**
   * Safely compute a date that is `monthsToAdd` months after `startDate`,
   * preserving the original day and clamping to the last valid day of the target month.
   * E.g. Jan 31 + 1 month → Feb 28 (not Mar 3).
   */
  private addMonthsSafe(startDate: Date, monthsToAdd: number): Date {
    const result = new Date(startDate);
    const originalDay = startDate.getDate();
    result.setMonth(startDate.getMonth() + monthsToAdd);
    // If the day shifted (month overflow), clamp to last valid day
    if (result.getDate() !== originalDay) {
      result.setDate(0); // last day of previous month
    }
    return result;
  }

  private async validateCardLimit(
    cardId: number,
    incomingExpenseValue: number,
    currentTransactionIdToExclude?: number,
  ) {
    const card = await this.prisma.card.findUnique({ where: { id: cardId } });
    if (!card) return;

    const totalExp = await this.prisma.transaction.aggregate({
      where: {
        card_id: cardId,
        transaction_type: 'EXPENSE',
        payment_method: 'CREDIT',
        ...(currentTransactionIdToExclude
          ? { id: { not: currentTransactionIdToExclude } }
          : {}),
      },
      _sum: { value: true },
    });

    const totalInc = await this.prisma.transaction.aggregate({
      where: {
        card_id: cardId,
        transaction_type: 'INCOME',
        payment_method: 'CREDIT',
        ...(currentTransactionIdToExclude
          ? { id: { not: currentTransactionIdToExclude } }
          : {}),
      },
      _sum: { value: true },
    });

    const used =
      Number(totalExp._sum.value || 0) - Number(totalInc._sum.value || 0);
    if (used + incomingExpenseValue > Number(card.card_limit)) {
      throw new BadRequestException(
        `Limite do cartão excedido. Limite disponível: R$ ${(Number(card.card_limit) - used).toFixed(2)}`,
      );
    }
  }

  private decodeStatementBuffer(file: Express.Multer.File): string {
    const utf8 = file.buffer.toString('utf8');
    return utf8.includes('\uFFFD') ? file.buffer.toString('latin1') : utf8;
  }

  private normalizeStatementDescription(
    value: string | null | undefined,
  ): string | null {
    if (!value) return null;
    const normalized = value
      .replace(/^<!\[CDATA\[/i, '')
      .replace(/\]\]>$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    return normalized.length > 0 ? normalized.slice(0, 255) : null;
  }

  private parseImportedNumber(value: string | null | undefined): number | null {
    if (!value) return null;

    const trimmed = value.trim();
    if (!trimmed) return null;

    const sanitized = trimmed.replace(/[^\d,.-]/g, '');
    if (!sanitized) return null;

    const hasComma = sanitized.includes(',');
    const hasDot = sanitized.includes('.');

    let normalized = sanitized;
    if (hasComma && hasDot) {
      normalized = sanitized.replace(/\./g, '').replace(',', '.');
    } else if (hasComma) {
      normalized = sanitized.replace(',', '.');
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private parseImportedDate(value: string | null | undefined): string | null {
    if (!value) return null;

    const raw = value.trim();
    if (!raw) return null;

    const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    }

    const compactMatch = raw.match(/^(\d{4})(\d{2})(\d{2})/);
    if (compactMatch) {
      return `${compactMatch[1]}-${compactMatch[2]}-${compactMatch[3]}`;
    }

    const brMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (brMatch) {
      return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
    }

    const fallback = new Date(raw);
    if (Number.isNaN(fallback.getTime())) {
      return null;
    }

    return fallback.toISOString().slice(0, 10);
  }

  private parseOfxStatement(content: string): ImportedStatementRow[] {
    const blocks = content.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) || [];
    const rows: ImportedStatementRow[] = [];

    for (const [index, block] of blocks.entries()) {
      const amountRaw = this.extractOfxTag(block, 'TRNAMT');
      const postedRaw = this.extractOfxTag(block, 'DTPOSTED');
      const typeRaw = (
        this.extractOfxTag(block, 'TRNTYPE') || ''
      ).toUpperCase();
      const amount = this.parseImportedNumber(amountRaw);
      const transactionDate = this.parseImportedDate(postedRaw);

      if (!amount || !transactionDate) continue;

      const description = this.normalizeStatementDescription(
        this.extractOfxTag(block, 'MEMO') ||
          this.extractOfxTag(block, 'NAME') ||
          this.extractOfxTag(block, 'FITID'),
      );

      rows.push({
        source_id: `ofx-${index}`,
        transaction_date: transactionDate,
        value: Math.abs(amount),
        transaction_type:
          amount < 0 || ['DEBIT', 'PAYMENT', 'DIRECTDEBIT'].includes(typeRaw)
            ? 'EXPENSE'
            : 'INCOME',
        description,
      });
    }

    return rows;
  }

  private detectInstallmentMetadata(
    description: string | null,
  ): { installment_total: number; installment_number: number } | null {
    if (!description) return null;

    const patterns = [
      /(?:parc(?:ela)?\s*)?(\d{1,2})\s*\/\s*(\d{1,2})(?!\d)/i,
      /parc(?:ela)?\s*(\d{1,2})\s*de\s*(\d{1,2})/i,
      /installment\s*(\d{1,2})\s*of\s*(\d{1,2})/i,
    ];

    for (const pattern of patterns) {
      const match = description.match(pattern);
      if (!match) continue;

      const installmentNumber = Number(match[1]);
      const installmentTotal = Number(match[2]);

      if (
        Number.isInteger(installmentNumber) &&
        Number.isInteger(installmentTotal) &&
        installmentNumber >= 1 &&
        installmentTotal >= 2 &&
        installmentNumber <= installmentTotal
      ) {
        return {
          installment_total: installmentTotal,
          installment_number: installmentNumber,
        };
      }
    }

    return null;
  }

  private buildRecurringFingerprint(row: ImportedStatementRow): string | null {
    if (!row.description) return null;

    const normalizedDescription = row.description
      .toLowerCase()
      .replace(/(?:parc(?:ela)?\s*)?\d{1,2}\s*\/\s*\d{1,2}(?!\d)/gi, ' ')
      .replace(/parc(?:ela)?\s*\d{1,2}\s*de\s*\d{1,2}/gi, ' ')
      .replace(/installment\s*\d{1,2}\s*of\s*\d{1,2}/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!normalizedDescription) return null;

    return `${normalizedDescription}|${row.value.toFixed(2)}|${row.transaction_type}`;
  }

  private inferStatementPatterns(
    rows: ImportedStatementRow[],
  ): ImportedStatementRow[] {
    const rowsWithInstallments = rows.map((row) => ({
      ...row,
      ...this.detectInstallmentMetadata(row.description),
    }));

    const groups = new Map<string, ImportedStatementRow[]>();

    for (const row of rowsWithInstallments) {
      if (row.installment_total && row.installment_total > 1) {
        continue;
      }

      const fingerprint = this.buildRecurringFingerprint(row);
      if (!fingerprint) continue;

      const current = groups.get(fingerprint) || [];
      current.push(row);
      groups.set(fingerprint, current);
    }

    const recurringIds = new Set<string>();

    for (const groupedRows of groups.values()) {
      const distinctMonths = new Set(
        groupedRows.map((row) => row.transaction_date.slice(0, 7)),
      );

      if (distinctMonths.size < 2) continue;

      for (const row of groupedRows) {
        recurringIds.add(row.source_id);
      }
    }

    return rowsWithInstallments.map((row) => ({
      ...row,
      is_recurring: recurringIds.has(row.source_id),
    }));
  }

  private extractOfxTag(block: string, tag: string): string | null {
    const withCloseTag = block.match(
      new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i'),
    )?.[1];
    if (withCloseTag) {
      return withCloseTag.trim();
    }

    const singleLine = block.match(
      new RegExp(`<${tag}>([^\\r\\n<]+)`, 'i'),
    )?.[1];
    return singleLine?.trim() || null;
  }

  private detectCsvDelimiter(line: string): string {
    const candidates = [';', ',', '\t'];
    return (
      candidates
        .map((delimiter) => ({
          delimiter,
          hits: line.split(delimiter).length,
        }))
        .sort((a, b) => b.hits - a.hits)[0]?.delimiter || ','
    );
  }

  private splitCsvLine(line: string, delimiter: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const next = line[i + 1];

      if (char === '"') {
        if (inQuotes && next === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (char === delimiter && !inQuotes) {
        values.push(current.trim());
        current = '';
        continue;
      }

      current += char;
    }

    values.push(current.trim());
    return values;
  }

  private normalizeCsvHeader(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  private findCsvColumn(headers: string[], aliases: string[]): number {
    return headers.findIndex((header) => aliases.includes(header));
  }

  private parseCsvStatement(content: string): ImportedStatementRow[] {
    const lines = content
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0);

    if (lines.length < 2) {
      throw new BadRequestException(
        'CSV sem linhas suficientes para importação.',
      );
    }

    const delimiter = this.detectCsvDelimiter(lines[0]);
    const headers = this.splitCsvLine(lines[0], delimiter).map((header) =>
      this.normalizeCsvHeader(header),
    );

    const dateIndex = this.findCsvColumn(headers, [
      'data',
      'date',
      'transaction date',
      'transaction_date',
      'posted date',
      'booking date',
    ]);
    const descriptionIndex = this.findCsvColumn(headers, [
      'descricao',
      'descricao',
      'description',
      'memo',
      'historico',
      'histórico',
      'lancamento',
      'lançamento',
      'detalhes',
      'details',
    ]);
    const amountIndex = this.findCsvColumn(headers, [
      'valor',
      'amount',
      'value',
      'transaction amount',
      'quantia',
    ]);
    const creditIndex = this.findCsvColumn(headers, [
      'credito',
      'crédito',
      'credit',
      'entrada',
      'income',
    ]);
    const debitIndex = this.findCsvColumn(headers, [
      'debito',
      'débito',
      'debit',
      'saida',
      'saída',
      'expense',
    ]);
    const typeIndex = this.findCsvColumn(headers, [
      'tipo',
      'type',
      'transaction type',
      'transaction_type',
    ]);

    if (
      dateIndex === -1 ||
      (amountIndex === -1 && creditIndex === -1 && debitIndex === -1)
    ) {
      throw new BadRequestException(
        'CSV sem colunas reconhecidas. Use colunas de data e valor, ou débito/crédito.',
      );
    }

    const rows: ImportedStatementRow[] = [];

    for (let index = 1; index < lines.length; index++) {
      const columns = this.splitCsvLine(lines[index], delimiter);
      const transactionDate = this.parseImportedDate(columns[dateIndex]);
      if (!transactionDate) continue;

      const description = this.normalizeStatementDescription(
        descriptionIndex >= 0 ? columns[descriptionIndex] : null,
      );

      let amount: number | null = null;
      let transactionType: 'INCOME' | 'EXPENSE' | null = null;

      if (amountIndex >= 0) {
        amount = this.parseImportedNumber(columns[amountIndex]);
        const typeHint = (
          typeIndex >= 0 ? columns[typeIndex] : ''
        ).toLowerCase();
        if (amount !== null) {
          transactionType =
            amount < 0 ||
            /debit|debito|débito|expense|saida|saída|payment/.test(typeHint)
              ? 'EXPENSE'
              : 'INCOME';
          amount = Math.abs(amount);
        }
      } else {
        const creditAmount =
          creditIndex >= 0
            ? this.parseImportedNumber(columns[creditIndex])
            : null;
        const debitAmount =
          debitIndex >= 0
            ? this.parseImportedNumber(columns[debitIndex])
            : null;

        if (creditAmount && creditAmount > 0) {
          amount = creditAmount;
          transactionType = 'INCOME';
        } else if (debitAmount && debitAmount > 0) {
          amount = debitAmount;
          transactionType = 'EXPENSE';
        }
      }

      if (!amount || !transactionType) continue;

      rows.push({
        source_id: `csv-${index}`,
        transaction_date: transactionDate,
        value: amount,
        transaction_type: transactionType,
        description,
      });
    }

    return rows;
  }

  private async findImportDuplicates(
    userId: number,
    walletId: number,
    rows: ImportedStatementRow[],
  ): Promise<Map<string, PreviewDuplicateMatch[]>> {
    if (rows.length === 0) {
      return new Map();
    }

    const sortedDates = rows
      .map((row) => row.transaction_date)
      .sort((a, b) => a.localeCompare(b));
    const minDate = `${sortedDates[0]}T00:00:00.000Z`;
    const maxDate = `${sortedDates[sortedDates.length - 1]}T23:59:59.999Z`;

    const existingTransactions = await this.prisma.transaction.findMany({
      where: {
        wallet_id: walletId,
        wallet: { user_id: userId },
        transaction_date: {
          gte: new Date(minDate),
          lte: new Date(maxDate),
        },
      },
      select: {
        id: true,
        description: true,
        transaction_date: true,
        value: true,
        transaction_type: true,
        payment_method: true,
      },
      orderBy: [{ transaction_date: 'desc' }, { id: 'desc' }],
    });

    const matchesByKey = new Map<string, PreviewDuplicateMatch[]>();

    for (const transaction of existingTransactions) {
      const key = this.buildImportDuplicateKey(
        transaction.transaction_date.toISOString().slice(0, 10),
        Number(transaction.value),
        transaction.transaction_type as 'INCOME' | 'EXPENSE',
      );

      const current = matchesByKey.get(key) || [];
      current.push({
        id: transaction.id,
        description: transaction.description,
        transaction_date: transaction.transaction_date
          .toISOString()
          .slice(0, 10),
        value: Number(transaction.value),
        transaction_type: transaction.transaction_type as 'INCOME' | 'EXPENSE',
        payment_method: transaction.payment_method,
      });
      matchesByKey.set(key, current);
    }

    return matchesByKey;
  }

  private buildImportDuplicateKey(
    transactionDate: string,
    value: number,
    transactionType: 'INCOME' | 'EXPENSE',
  ): string {
    return `${transactionDate}|${value.toFixed(2)}|${transactionType}`;
  }

  private async resolveCategoryId(
    userId: number,
    categoryId?: number,
  ): Promise<number> {
    if (!categoryId) {
      const defaultCategory = await this.prisma.transactionCategory.findFirst({
        where: { user_id: userId, name: 'Outro' },
      });

      if (defaultCategory) {
        return defaultCategory.id;
      }

      const newCategory = await this.prisma.transactionCategory.create({
        data: { name: 'Outro', user_id: userId },
      });

      return newCategory.id;
    }

    const category = await this.prisma.transactionCategory.findUnique({
      where: { id: categoryId },
    });
    if (!category || category.user_id !== userId) {
      throw new NotFoundException('Category not found');
    }

    return categoryId;
  }

  private buildImportedInstallmentGroupKey(
    row: ConfirmStatementImportRowDto,
  ): string {
    const normalizedDescription = (row.description || '')
      .toLowerCase()
      .replace(/(?:parc(?:ela)?\s*)?\d{1,2}\s*\/\s*\d{1,2}(?!\d)/gi, ' ')
      .replace(/parc(?:ela)?\s*\d{1,2}\s*de\s*\d{1,2}/gi, ' ')
      .replace(/installment\s*\d{1,2}\s*of\s*\d{1,2}/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return [
      normalizedDescription,
      row.installment_total || 1,
      row.value.toFixed(2),
      row.transaction_type,
    ].join('|');
  }

  private async createImportedStatementTransaction(
    userId: number,
    wallet: { id: number; type: string },
    row: ConfirmStatementImportRowDto,
    installmentGroupIds: Map<string, string>,
  ) {
    const categoryId = await this.resolveCategoryId(userId, row.category_id);
    const transactionDate = new Date(row.transaction_date);
    const isFuture = this.isFutureDate(transactionDate);
    const installmentTotal =
      row.installment_total && row.installment_total > 1
        ? row.installment_total
        : 1;

    let installmentId: string | null = null;
    if (installmentTotal > 1) {
      const groupKey = this.buildImportedInstallmentGroupKey(row);
      installmentId = installmentGroupIds.get(groupKey) || crypto.randomUUID();
      installmentGroupIds.set(groupKey, installmentId);
    }

    const transaction = await this.prisma.transaction.create({
      data: {
        wallet_id: wallet.id,
        transaction_date: transactionDate,
        transaction_type: row.transaction_type,
        is_recurring: row.is_recurring || false,
        value: row.value,
        description: row.description || null,
        category_id: categoryId,
        installment_id: installmentId,
        installment_total: installmentTotal,
        installment_number: row.installment_number || 1,
        is_processed: !isFuture,
      },
    });

    if (!isFuture) {
      if (row.transaction_type === 'EXPENSE') {
        await this.walletsService.addExpense(wallet.id, userId, row.value);
      } else {
        await this.walletsService.addIncoming(wallet.id, userId, row.value);
      }
    }

    return transaction;
  }

  async previewStatementImport(
    userId: number,
    walletId: number,
    file: Express.Multer.File,
  ) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id: walletId },
      select: { id: true, user_id: true, name: true },
    });

    if (!wallet || wallet.user_id !== userId) {
      throw new NotFoundException('Wallet not found');
    }

    const fileName = file.originalname || 'statement';
    const lowerFileName = fileName.toLowerCase();
    const isOfx = lowerFileName.endsWith('.ofx');
    const isCsv = lowerFileName.endsWith('.csv');

    if (!isOfx && !isCsv) {
      throw new BadRequestException('Use um arquivo OFX ou CSV.');
    }

    const content = this.decodeStatementBuffer(file);
    const parsedRows = isOfx
      ? this.parseOfxStatement(content)
      : this.parseCsvStatement(content);
    const inferredRows = this.inferStatementPatterns(parsedRows);
    const validRows = inferredRows.filter(
      (row) => row.value > 0 && row.transaction_date,
    );
    if (validRows.length === 0) {
      throw new BadRequestException(
        'Nenhuma transação válida encontrada no arquivo.',
      );
    }

    const duplicateMap = await this.findImportDuplicates(
      userId,
      walletId,
      validRows,
    );

    const rows = validRows.map((row) => {
      const key = this.buildImportDuplicateKey(
        row.transaction_date,
        row.value,
        row.transaction_type,
      );
      const duplicateMatches = duplicateMap.get(key) || [];

      return {
        ...row,
        duplicateMatches,
      };
    });

    return {
      walletId,
      walletName: wallet.name,
      fileName,
      format: isOfx ? 'OFX' : 'CSV',
      summary: {
        totalRows: rows.length,
        duplicateRows: rows.filter((row) => row.duplicateMatches.length > 0)
          .length,
        incomeCount: rows.filter((row) => row.transaction_type === 'INCOME')
          .length,
        expenseCount: rows.filter((row) => row.transaction_type === 'EXPENSE')
          .length,
      },
      rows,
    };
  }

  async confirmStatementImport(
    userId: number,
    walletId: number,
    rows: ConfirmStatementImportRowDto[],
  ) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id: walletId },
      select: { id: true, user_id: true, type: true },
    });

    if (!wallet || wallet.user_id !== userId) {
      throw new NotFoundException('Wallet not found');
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return { importedCount: 0, failedCount: 0, failures: [] };
    }

    let importedCount = 0;
    const failures: { row: ConfirmStatementImportRowDto; error: string }[] = [];
    const installmentGroupIds = new Map<string, string>();

    for (const row of rows) {
      try {
        await this.createImportedStatementTransaction(
          userId,
          { id: wallet.id, type: wallet.type },
          row,
          installmentGroupIds,
        );
        importedCount++;
      } catch (error) {
        failures.push({
          row,
          error:
            error instanceof Error
              ? error.message
              : 'Falha ao importar transação.',
        });
      }
    }

    return {
      importedCount,
      failedCount: failures.length,
      failures,
    };
  }

  async update(
    id: number,
    userId: number,
    updateTransactionDto: UpdateTransactionDto,
  ) {
    const oldTransaction: any = await this.findOne(id, userId);
    if (!oldTransaction) {
      throw new NotFoundException('Transaction not found');
    }

    let isOldMealVoucher = oldTransaction.wallet?.type === 'MEAL_VOUCHER';
    let isNewMealVoucher = isOldMealVoucher;

    if (updateTransactionDto.wallet_id) {
      const wallet = await this.prisma.wallet.findUnique({
        where: { id: updateTransactionDto.wallet_id },
      });
      if (!wallet || wallet.user_id !== userId)
        throw new NotFoundException('Wallet not found');
      isNewMealVoucher = wallet.type === 'MEAL_VOUCHER';
    }

    if (updateTransactionDto.category_id) {
      const category = await this.prisma.transactionCategory.findUnique({
        where: { id: updateTransactionDto.category_id },
      });
      if (!category || category.user_id !== userId)
        throw new NotFoundException('Category not found');
    }

    // Check if balance update is needed
    if (
      updateTransactionDto.value !== undefined ||
      updateTransactionDto.transaction_type !== undefined ||
      updateTransactionDto.wallet_id !== undefined ||
      updateTransactionDto.payment_method !== undefined ||
      updateTransactionDto.transaction_date !== undefined
    ) {
      const multiplier = oldTransaction.installment_id
        ? oldTransaction.installment_total || 12
        : 1;

      // Revert old transaction impact ONLY if it was processed (balance was applied)
      if (oldTransaction.is_processed) {
        if (oldTransaction.transaction_type === 'EXPENSE') {
          if (oldTransaction.payment_method !== 'CREDIT' || isOldMealVoucher) {
            await this.walletsService.addIncoming(
              oldTransaction.wallet_id,
              userId,
              Number(oldTransaction.value) * multiplier,
            );
          }
        } else {
          // INCOME
          if (oldTransaction.payment_method !== 'CREDIT' || isOldMealVoucher) {
            await this.walletsService.addExpense(
              oldTransaction.wallet_id,
              userId,
              Number(oldTransaction.value) * multiplier,
            );
          }
        }
      }

      // Apply new transaction impact only if the new date is NOT in the future
      const newValue =
        updateTransactionDto.value !== undefined
          ? updateTransactionDto.value
          : Number(oldTransaction.value);
      const newType =
        updateTransactionDto.transaction_type ||
        oldTransaction.transaction_type;
      const newWalletId =
        updateTransactionDto.wallet_id || oldTransaction.wallet_id;
      const newMethod =
        updateTransactionDto.payment_method !== undefined
          ? updateTransactionDto.payment_method
          : oldTransaction.payment_method;
      const newCardId =
        updateTransactionDto.card_id !== undefined
          ? updateTransactionDto.card_id
          : oldTransaction.card_id;
      const newDate = updateTransactionDto.transaction_date
        ? new Date(updateTransactionDto.transaction_date)
        : oldTransaction.transaction_date;
      const willBeFuture = this.isFutureDate(newDate);

      const newMultiplier = oldTransaction.installment_id
        ? updateTransactionDto.installment_total ||
          oldTransaction.installment_total ||
          12
        : 1;

      if (
        newType === 'EXPENSE' &&
        newMethod === 'CREDIT' &&
        newCardId &&
        !isNewMealVoucher
      ) {
        await this.validateCardLimit(newCardId, newValue * newMultiplier, id);
      }

      if (!willBeFuture) {
        if (newType === 'EXPENSE') {
          if (newMethod !== 'CREDIT' || isNewMealVoucher) {
            await this.walletsService.addExpense(
              newWalletId,
              userId,
              newValue * newMultiplier,
            );
          }
        } else {
          // INCOME
          if (newMethod !== 'CREDIT' || isNewMealVoucher) {
            await this.walletsService.addIncoming(
              newWalletId,
              userId,
              newValue * newMultiplier,
            );
          }
        }
      }

      // Update is_processed flag based on the new date
      updateTransactionDto = {
        ...updateTransactionDto,
        is_processed: !willBeFuture,
      } as any;
    }

    if (oldTransaction.installment_id) {
      // For recurring/installments, update ALL related transactions
      // But EXCLUDE date, as that would collapse the series to a single day
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { transaction_date, ...bulkData } = updateTransactionDto;

      return this.prisma.transaction.updateMany({
        where: { installment_id: oldTransaction.installment_id },
        data: bulkData,
      });
    }

    return this.prisma.transaction.update({
      where: { id },
      data: {
        ...updateTransactionDto,
        transaction_date: updateTransactionDto.transaction_date
          ? new Date(updateTransactionDto.transaction_date)
          : undefined,
      },
    });
  }

  async create(userId: number, createTransactionDto: CreateTransactionDto) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id: createTransactionDto.wallet_id },
    });
    if (!wallet || wallet.user_id !== userId)
      throw new NotFoundException('Wallet not found');
    const isMealVoucher = wallet.type === 'MEAL_VOUCHER';

    const categoryId = await this.resolveCategoryId(
      userId,
      createTransactionDto.category_id,
    );
    createTransactionDto.category_id = categoryId;

    const {
      installment_total,
      is_recurring,
      subscription_id,
      card_id,
      ...data
    } = createTransactionDto;

    if (
      data.transaction_type === 'EXPENSE' &&
      data.payment_method === 'CREDIT' &&
      card_id &&
      !isMealVoucher
    ) {
      const multiplier =
        installment_total && installment_total > 1
          ? installment_total
          : is_recurring && !subscription_id
            ? 12
            : 1;
      await this.validateCardLimit(card_id, data.value * multiplier);
    }

    if (installment_total && installment_total > 1) {
      return this.createInstallments(
        userId,
        createTransactionDto,
        categoryId!,
        isMealVoucher,
      );
    }

    // If it's recurring but NOT triggered by a subscription engine (no subscription_id), assume manual 12-month generation
    if (is_recurring && !installment_total && !subscription_id) {
      return this.createSubscription(
        userId,
        createTransactionDto,
        categoryId!,
        isMealVoucher,
      );
    }

    const transactionDate = new Date(data.transaction_date);
    const isFuture = this.isFutureDate(transactionDate);

    const transaction = await this.prisma.transaction.create({
      data: {
        ...data,
        category_id: categoryId!,
        is_recurring: is_recurring || false,
        subscription_id: subscription_id,
        card_id: card_id || null,
        installment_total: 1,
        installment_number: 1,
        is_processed: !isFuture,
        transaction_date: transactionDate,
      },
    });

    // Only update wallet balance if the transaction date is today or in the past
    if (!isFuture) {
      if (data.transaction_type === 'EXPENSE') {
        if (data.payment_method !== 'CREDIT' || isMealVoucher) {
          await this.walletsService.addExpense(
            data.wallet_id,
            userId,
            data.value,
          );
        }
      } else {
        if (data.payment_method !== 'CREDIT' || isMealVoucher) {
          await this.walletsService.addIncoming(
            data.wallet_id,
            userId,
            data.value,
          );
        }
      }
    }

    return transaction;
  }

  private async createSubscription(
    userId: number,
    dto: CreateTransactionDto,
    categoryId: number,
    isMealVoucher: boolean = false,
  ) {
    const PREDICTION_MONTHS = 12;
    const monthlyValue = dto.value;
    const groupId = crypto.randomUUID();
    const transactionsData: any[] = [];

    const startDate = new Date(dto.transaction_date);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    let processedCount = 0;

    for (let i = 0; i < PREDICTION_MONTHS; i++) {
      const transactionDate = this.addMonthsSafe(startDate, i);

      const isFuture = transactionDate > endOfToday;
      if (!isFuture) processedCount++;

      transactionsData.push({
        transaction_date: transactionDate,
        wallet_id: dto.wallet_id,
        transaction_type: dto.transaction_type,
        is_recurring: true,
        value: monthlyValue,
        description: dto.description || null,
        category_id: categoryId,
        payment_method: dto.payment_method,
        card_id: dto.card_id || null,
        installment_id: groupId,
        installment_total: null,
        installment_number: i + 1,
        is_processed: !isFuture,
      });
    }

    const created = await this.prisma.transaction.createMany({
      data: transactionsData,
    });

    // Only apply balance for transactions that are not in the future
    if (processedCount > 0) {
      if (dto.transaction_type === 'EXPENSE') {
        if (dto.payment_method !== 'CREDIT' || isMealVoucher) {
          await this.walletsService.addExpense(
            dto.wallet_id,
            userId,
            monthlyValue * processedCount,
          );
        }
      } else {
        if (dto.payment_method !== 'CREDIT' || isMealVoucher) {
          await this.walletsService.addIncoming(
            dto.wallet_id,
            userId,
            monthlyValue * processedCount,
          );
        }
      }
    }

    return {
      message: `Subscription created (12 months visibility)`,
      subscription_group_id: groupId,
      count: created.count,
    };
  }

  private async createInstallments(
    userId: number,
    dto: CreateTransactionDto,
    categoryId: number,
    isMealVoucher: boolean = false,
  ) {
    const totalInstallments = dto.installment_total || 1;
    const installmentValue = Number((dto.value / totalInstallments).toFixed(2));
    const installmentId = crypto.randomUUID();
    const transactionsData: any[] = [];

    const startDate = new Date(dto.transaction_date);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    let processedValue = 0;

    for (let i = 0; i < totalInstallments; i++) {
      const transactionDate = this.addMonthsSafe(startDate, i);

      const isFuture = transactionDate > endOfToday;
      if (!isFuture) processedValue += installmentValue;

      transactionsData.push({
        transaction_date: transactionDate,
        wallet_id: dto.wallet_id,
        transaction_type: dto.transaction_type,
        is_recurring: dto.is_recurring,
        value: installmentValue,
        description: dto.description || null,
        category_id: categoryId,
        payment_method: dto.payment_method,
        card_id: dto.card_id || null,
        installment_id: installmentId,
        installment_total: totalInstallments,
        installment_number: i + 1,
        is_processed: !isFuture,
      });
    }

    const created = await this.prisma.transaction.createMany({
      data: transactionsData,
    });

    // Only apply balance for installments that are not in the future
    if (processedValue > 0) {
      if (dto.transaction_type === 'EXPENSE') {
        if (dto.payment_method !== 'CREDIT' || isMealVoucher) {
          await this.walletsService.addExpense(
            dto.wallet_id,
            userId,
            processedValue,
          );
        }
      } else {
        if (dto.payment_method !== 'CREDIT' || isMealVoucher) {
          await this.walletsService.addIncoming(
            dto.wallet_id,
            userId,
            processedValue,
          );
        }
      }
    }

    return {
      message: `${totalInstallments} installments created successfully`,
      installment_id: installmentId,
      count: created.count,
    };
  }

  findAll(userId: number) {
    return this.prisma.transaction.findMany({
      where: {
        wallet: { user_id: userId },
      },
      include: { TransactionCategory: true, card: true },
      orderBy: [{ transaction_date: 'desc' }, { id: 'desc' }],
    });
  }

  findOne(id: number, userId: number) {
    return this.prisma.transaction.findFirst({
      where: {
        id,
        wallet: { user_id: userId },
      },
      include: { wallet: true },
    });
  }

  async remove(id: number, userId: number) {
    const transaction: any = await this.findOne(id, userId);
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    const isMealVoucher = transaction.wallet?.type === 'MEAL_VOUCHER';

    // For installment/recurring series, revert only the processed (non-future) transactions
    if (transaction.installment_id) {
      const allInSeries = await this.prisma.transaction.findMany({
        where: { installment_id: transaction.installment_id },
      });

      const processedInSeries = allInSeries.filter((t) => t.is_processed);
      const processedTotal = processedInSeries.reduce(
        (sum, t) => sum + Number(t.value),
        0,
      );

      if (processedTotal > 0) {
        if (transaction.transaction_type === 'EXPENSE') {
          if (transaction.payment_method !== 'CREDIT' || isMealVoucher) {
            await this.walletsService.addIncoming(
              transaction.wallet_id,
              userId,
              processedTotal,
            );
          }
        } else {
          if (transaction.payment_method !== 'CREDIT' || isMealVoucher) {
            await this.walletsService.addExpense(
              transaction.wallet_id,
              userId,
              processedTotal,
            );
          }
        }
      }

      return this.prisma.transaction.deleteMany({
        where: { installment_id: transaction.installment_id },
      });
    }

    // Single transaction: only revert if it was processed
    if (transaction.is_processed) {
      if (transaction.transaction_type === 'EXPENSE') {
        if (transaction.payment_method !== 'CREDIT' || isMealVoucher) {
          await this.walletsService.addIncoming(
            transaction.wallet_id,
            userId,
            Number(transaction.value),
          );
        }
      } else {
        if (transaction.payment_method !== 'CREDIT' || isMealVoucher) {
          await this.walletsService.addExpense(
            transaction.wallet_id,
            userId,
            Number(transaction.value),
          );
        }
      }
    }

    return this.prisma.transaction.delete({
      where: { id },
    });
  }

  /**
   * Process all unprocessed transactions whose date has arrived (today or past).
   * Called by the cron scheduler to apply balance impacts for future-dated transactions.
   */
  async processMaturedTransactions(): Promise<number> {
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const unprocessed = await this.prisma.transaction.findMany({
      where: {
        is_processed: false,
        transaction_date: { lte: endOfToday },
      },
      include: { wallet: true },
    });

    let processedCount = 0;

    for (const tx of unprocessed) {
      const userId = tx.wallet.user_id;
      const isMealVoucher = tx.wallet.type === 'MEAL_VOUCHER';

      try {
        if (tx.transaction_type === 'EXPENSE') {
          if (tx.payment_method !== 'CREDIT' || isMealVoucher) {
            await this.walletsService.addExpense(
              tx.wallet_id,
              userId,
              Number(tx.value),
            );
          }
        } else {
          if (tx.payment_method !== 'CREDIT' || isMealVoucher) {
            await this.walletsService.addIncoming(
              tx.wallet_id,
              userId,
              Number(tx.value),
            );
          }
        }

        await this.prisma.transaction.update({
          where: { id: tx.id },
          data: { is_processed: true },
        });

        processedCount++;
      } catch (error) {
        // Log but continue processing other transactions
        console.error(
          `Failed to process matured transaction #${tx.id}:`,
          error.message,
        );
      }
    }

    return processedCount;
  }
}
