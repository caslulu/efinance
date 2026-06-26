import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PluggyClient, type Account } from 'pluggy-sdk';
import { PrismaService } from '../../prisma/prisma.service';
import { mapPluggyTransaction } from './mappers/transaction.mapper';

const FALLBACK_CATEGORY = 'Sem categoria';
const DEFAULT_CLOSING_DAY = 1;
const DEFAULT_DUE_DAY = 10;

const PLUGGY_CARD_SOURCE = 'pluggy:credit';

function dayFromPluggyDate(
  date: Date | string | null | undefined,
  fallback: number,
): number {
  if (!date) return fallback;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return Math.min(31, Math.max(1, parsed.getUTCDate()));
}

function inferCardFlag(account: Account): string {
  const brand = account.creditData?.brand?.toUpperCase() ?? '';
  if (brand.includes('MASTERCARD')) return 'MASTERCARD';
  if (brand.includes('VISA')) return 'VISA';
  if (brand.includes('AMEX') || brand.includes('AMERICAN')) return 'AMEX';
  if (brand.includes('ELO')) return 'ELO';
  if (brand.includes('HIPERCARD')) return 'HIPERCARD';
  return 'OTHER';
}

function normalizePluggyCardNumber(
  cardNumber: string | null | undefined,
): string | null {
  const clean = cardNumber?.trim();
  return clean || null;
}

function lastDigits(maskedCardNumber: string): string | null {
  const match = maskedCardNumber.match(/(\d{4})\D*$/);
  return match?.[1] ?? null;
}

@Injectable()
export class PluggyService implements OnModuleInit {
  private readonly logger = new Logger(PluggyService.name);
  private client: PluggyClient | null = null;
  private itemId: string | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    const clientId = this.config.get<string>('PLUGGY_CLIENT_ID');
    const clientSecret = this.config.get<string>('PLUGGY_CLIENT_SECRET');
    const itemId = this.config.get<string>('PLUGGY_NUBANK_ITEM_ID');

    if (!clientId || !clientSecret || !itemId) {
      this.logger.warn(
        'Pluggy integration credentials missing — sync disabled (need PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET, PLUGGY_NUBANK_ITEM_ID)',
      );
      return;
    }
    this.client = new PluggyClient({ clientId, clientSecret });
    this.itemId = itemId;
  }

  /** Credentials are configured (does NOT mean any user opted in). */
  isConfigured(): boolean {
    return this.client !== null;
  }

  /**
   * Enables Pluggy sync for the given user. Effective only if credentials
   * are configured. Only one user can have it enabled at a time (since
   * itemId is shared via env); enabling for a new user disables previous ones.
   */
  async enableForUser(userId: number): Promise<{ enabled: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    await this.prisma.user.updateMany({
      where: { pluggy_enabled: true, NOT: { id: userId } },
      data: { pluggy_enabled: false },
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: { pluggy_enabled: true },
    });
    return { enabled: true };
  }

  async disableForUser(userId: number): Promise<{ enabled: boolean }> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { pluggy_enabled: false },
    });
    return { enabled: false };
  }

  async isEnabledForUser(userId: number): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { pluggy_enabled: true },
    });
    return user?.pluggy_enabled ?? false;
  }

  async getCreditCardMonthlyFlow(params: {
    userId: number;
    startDate: Date;
    endDate: Date;
    currentMonth: Date;
  }): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    if (!this.client || !this.itemId) return result;

    const enabled = await this.isEnabledForUser(params.userId);
    if (!enabled) return result;

    const currentMonthKey = this.monthKey(params.currentMonth);
    const accounts = await this.client.fetchAccounts(this.itemId, 'CREDIT');

    for (const account of accounts.results) {
      const [bills, txs] = await Promise.all([
        this.client.fetchCreditCardBills(account.id, { pageSize: 50 }),
        this.client.fetchAllTransactions(account.id, {
          dateFrom: params.startDate.toISOString().slice(0, 10),
          dateTo: params.endDate.toISOString().slice(0, 10),
        }),
      ]);

      for (const bill of bills.results) {
        const billDate = new Date(bill.dueDate);
        if (billDate < params.startDate || billDate > params.endDate) continue;

        const key = this.monthKey(billDate);
        if (key >= currentMonthKey) continue;
        result.set(key, (result.get(key) ?? 0) + Number(bill.totalAmount || 0));
      }

      for (const tx of txs) {
        if (tx.amount <= 0 || tx.creditCardMetadata?.billId) continue;

        const key = this.monthKey(new Date(tx.date));
        if (key < currentMonthKey) continue;
        result.set(key, (result.get(key) ?? 0) + Number(tx.amount || 0));
      }
    }

    return result;
  }

  private monthKey(date: Date): string {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  async syncAll(): Promise<{
    inserted: number;
    skipped: number;
    accounts: number;
    cards: number;
  }> {
    if (!this.client || !this.itemId) {
      throw new Error('Pluggy credentials not configured');
    }

    const activeUser = await this.prisma.user.findFirst({
      where: { pluggy_enabled: true },
      select: { id: true },
    });
    if (!activeUser) {
      this.logger.debug('No user has Pluggy enabled — skipping sync');
      return { inserted: 0, skipped: 0, accounts: 0, cards: 0 };
    }
    const userId = activeUser.id;

    const accounts = await this.client.fetchAccounts(this.itemId);
    let totalInserted = 0;
    let totalSkipped = 0;
    let totalCards = 0;

    for (const account of accounts.results) {
      const wallet = await this.ensureWallet(account, userId);
      await this.refreshCreditCardLimits(account);
      const result = await this.syncAccount(account, wallet.id, userId);
      totalInserted += result.inserted;
      totalSkipped += result.skipped;
      totalCards += result.cards;
      await this.prisma.wallet.update({
        where: { id: wallet.id },
        data: { pluggy_last_sync_at: new Date() },
      });
    }

    return {
      inserted: totalInserted,
      skipped: totalSkipped,
      accounts: accounts.results.length,
      cards: totalCards,
    };
  }

  private getActualCashFromPluggyAccount(account: Account): number {
    if (account.type !== 'CREDIT') return account.balance ?? 0;
    return account.creditData?.availableCreditLimit ?? 0;
  }

  private getCreditLimitFromPluggyAccount(account: Account): number {
    const creditData = account.creditData;
    if (!creditData) return 0;

    if (creditData.creditLimit !== null) return creditData.creditLimit;

    const available = creditData.availableCreditLimit ?? 0;
    const used = account.balance ?? 0;
    return Math.max(0, available + Math.max(0, used));
  }

  private getCreditLimitForPluggyCard(
    account: Account,
    cardNumber?: string | null,
  ): number {
    const normalizedCardNumber = normalizePluggyCardNumber(cardNumber);
    if (!normalizedCardNumber) return this.getCreditLimitFromPluggyAccount(account);

    const matchingLimit = account.creditData?.disaggregatedCreditLimits?.find(
      (limit) =>
        limit.identificationNumber === normalizedCardNumber &&
        limit.lineName === 'CREDITO_A_VISTA' &&
        limit.customizedLimitAmount !== undefined,
    );
    if (matchingLimit?.customizedLimitAmount !== undefined) {
      return matchingLimit.customizedLimitAmount;
    }

    const matchingFallback = account.creditData?.disaggregatedCreditLimits?.find(
      (limit) =>
        limit.identificationNumber === normalizedCardNumber &&
        limit.lineName === 'CREDITO_A_VISTA' &&
        limit.limitAmount !== undefined,
    );
    if (matchingFallback?.limitAmount !== undefined) {
      return matchingFallback.limitAmount;
    }

    return this.getCreditLimitFromPluggyAccount(account);
  }

  private async ensureWallet(account: Account, userId: number) {
    const externalSource = `pluggy:${account.type.toLowerCase()}`;
    const actualCash = this.getActualCashFromPluggyAccount(account);
    const isCredit = account.type === 'CREDIT';

    const existing = await this.prisma.wallet.findUnique({
      where: { pluggy_account_id: account.id },
    });
    if (existing) {
      return this.prisma.wallet.update({
        where: { id: existing.id },
        data: {
          actual_cash: actualCash,
          external_source: externalSource,
          pluggy_item_id: this.itemId,
        },
      });
    }

    return this.prisma.wallet.create({
      data: {
        user_id: userId,
        name: account.name || account.marketingName || account.type,
        type: isCredit ? 'CREDIT_CARD' : 'BANK',
        actual_cash: actualCash,
        pluggy_item_id: this.itemId,
        pluggy_account_id: account.id,
        external_source: externalSource,
      },
    });
  }

  private buildCardExternalId(
    account: Account,
    cardNumber?: string | null,
  ): string {
    const normalized = normalizePluggyCardNumber(cardNumber) ?? 'account';
    return `pluggy:${account.id}:card:${normalized}`;
  }

  private getCardName(account: Account, cardNumber?: string | null): string {
    const baseName =
      account.marketingName ||
      account.name ||
      account.creditData?.brand ||
      'Cartao Pluggy';
    const normalized = normalizePluggyCardNumber(cardNumber);
    if (!normalized) return baseName;

    const last = lastDigits(normalized);
    return last ? `${baseName} final ${last}` : `${baseName} ${normalized}`;
  }

  private async ensureCreditCard(
    account: Account,
    walletId: number,
    cardNumber?: string | null,
  ) {
    if (account.type !== 'CREDIT') return null;

    const normalizedCardNumber = normalizePluggyCardNumber(cardNumber);
    const externalId = this.buildCardExternalId(account, normalizedCardNumber);
    const cardData = {
      wallet_id: walletId,
      flag: inferCardFlag(account),
      closing_day: dayFromPluggyDate(
        account.creditData?.balanceCloseDate,
        DEFAULT_CLOSING_DAY,
      ),
      due_day: dayFromPluggyDate(
        account.creditData?.balanceDueDate,
        DEFAULT_DUE_DAY,
      ),
      card_limit: this.getCreditLimitForPluggyCard(
        account,
        normalizedCardNumber,
      ),
      external_source: PLUGGY_CARD_SOURCE,
      pluggy_account_id: account.id,
      pluggy_card_number: normalizedCardNumber,
    };

    const existing = await this.prisma.card.findUnique({
      where: { external_id: externalId },
    });
    if (existing) {
      return this.prisma.card.update({
        where: { id: existing.id },
        data: cardData,
      });
    }

    return this.prisma.card.create({
      data: {
        ...cardData,
        external_id: externalId,
        name: this.getCardName(account, normalizedCardNumber),
      },
    });
  }

  private async refreshCreditCardLimits(account: Account) {
    if (account.type !== 'CREDIT') return;

    const cards = await this.prisma.card.findMany({
      where: {
        external_source: PLUGGY_CARD_SOURCE,
        pluggy_account_id: account.id,
      },
      select: { id: true, pluggy_card_number: true },
    });

    await Promise.all(
      cards.map((card) =>
        this.prisma.card.update({
          where: { id: card.id },
          data: {
            card_limit: this.getCreditLimitForPluggyCard(
              account,
              card.pluggy_card_number,
            ),
          },
        }),
      ),
    );
  }

  private async ensureCategory(userId: number, name: string): Promise<number> {
    const clean = name?.trim() || FALLBACK_CATEGORY;
    const existing = await this.prisma.transactionCategory.findFirst({
      where: { user_id: userId, name: clean },
    });
    if (existing) return existing.id;
    const created = await this.prisma.transactionCategory.create({
      data: { user_id: userId, name: clean },
    });
    return created.id;
  }

  private async syncAccount(
    account: Account,
    walletId: number,
    userId: number,
  ): Promise<{ inserted: number; skipped: number; cards: number }> {
    if (!this.client) throw new Error('client missing');
    const externalSource = `pluggy:${account.type.toLowerCase()}`;
    const hasCreditTransactionsWithoutCard =
      account.type === 'CREDIT' &&
      (await this.prisma.transaction.count({
        where: {
          wallet_id: walletId,
          external_source: externalSource,
          card_id: null,
        },
      })) > 0;

    const last = await this.prisma.transaction.findFirst({
      where: { wallet_id: walletId, external_source: externalSource },
      orderBy: { transaction_date: 'desc' },
      select: { transaction_date: true },
    });

    const dateFrom = last && !hasCreditTransactionsWithoutCard
      ? new Date(last.transaction_date.getTime() - 7 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10)
      : undefined;

    const txs = await this.client.fetchAllTransactions(account.id, {
      dateFrom,
    });

    let inserted = 0;
    let skipped = 0;
    const touchedCardExternalIds = new Set<string>();

    for (const tx of txs) {
      const mapped = mapPluggyTransaction(account, tx, externalSource);
      const exists = await this.prisma.transaction.findUnique({
        where: { external_id: mapped.external_id },
        select: { id: true, card_id: true },
      });
      if (exists) {
        if (account.type === 'CREDIT' && !exists.card_id) {
          const card = await this.ensureCreditCard(
            account,
            walletId,
            tx.creditCardMetadata?.cardNumber,
          );
          if (card) {
            await this.prisma.transaction.update({
              where: { id: exists.id },
              data: { card_id: card.id },
            });
            if (card.external_id) touchedCardExternalIds.add(card.external_id);
          }
        }
        skipped++;
        continue;
      }

      const card = await this.ensureCreditCard(
        account,
        walletId,
        tx.creditCardMetadata?.cardNumber,
      );
      if (card?.external_id) touchedCardExternalIds.add(card.external_id);

      const categoryId = await this.ensureCategory(
        userId,
        mapped.category_name ?? FALLBACK_CATEGORY,
      );

      await this.prisma.transaction.create({
        data: {
          transaction_date: mapped.transaction_date,
          wallet_id: walletId,
          transaction_type: mapped.transaction_type,
          payment_method: mapped.payment_method,
          description: mapped.description,
          is_recurring: false,
          card_id: card?.id ?? null,
          value: mapped.value,
          installment_id: mapped.installment_id,
          installment_total: mapped.installment_total,
          installment_number: mapped.installment_number,
          is_processed: true,
          category_id: categoryId,
          external_id: mapped.external_id,
          external_source: mapped.external_source,
        },
      });
      inserted++;
    }

    return { inserted, skipped, cards: touchedCardExternalIds.size };
  }
}
