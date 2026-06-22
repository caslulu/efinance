import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { crypto } from '../utils/crypto-uuid';
import { ConfirmStatementImportRowDto } from './dto/confirm-statement-import.dto';
import { TransactionImpactService } from './transaction-impact.service';

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
export class StatementImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly impact: TransactionImpactService,
  ) {}

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
    const categoryId = await this.impact.resolveCategoryId(userId, row.category_id);
    const transactionDate = new Date(row.transaction_date);
    const isFuture = this.impact.isFutureDate(transactionDate);
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
      await this.impact.applyBalanceImpact({
        walletId: wallet.id,
        userId,
        paymentMethod: null,
        walletType: wallet.type,
        transactionType: row.transaction_type,
        value: row.value,
        mode: 'apply',
      });
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
}
