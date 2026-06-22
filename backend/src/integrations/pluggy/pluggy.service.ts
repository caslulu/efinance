import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PluggyClient, type Account } from 'pluggy-sdk';
import { PrismaService } from '../../prisma/prisma.service';
import { mapPluggyTransaction } from './mappers/transaction.mapper';

const FALLBACK_CATEGORY = 'Sem categoria';

@Injectable()
export class PluggyService implements OnModuleInit {
  private readonly logger = new Logger(PluggyService.name);
  private client: PluggyClient | null = null;
  private itemId: string | null = null;
  private userId: number | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    const clientId = this.config.get<string>('PLUGGY_CLIENT_ID');
    const clientSecret = this.config.get<string>('PLUGGY_CLIENT_SECRET');
    const itemId = this.config.get<string>('PLUGGY_NUBANK_ITEM_ID');
    const userIdRaw = this.config.get<string>('PLUGGY_USER_ID');

    if (!clientId || !clientSecret || !itemId || !userIdRaw) {
      this.logger.warn(
        'Pluggy integration disabled — missing PLUGGY_CLIENT_ID / PLUGGY_CLIENT_SECRET / PLUGGY_NUBANK_ITEM_ID / PLUGGY_USER_ID',
      );
      return;
    }
    this.client = new PluggyClient({ clientId, clientSecret });
    this.itemId = itemId;
    this.userId = Number(userIdRaw);
  }

  isEnabled(): boolean {
    return this.client !== null;
  }

  async syncAll(): Promise<{ inserted: number; skipped: number; accounts: number }> {
    if (!this.client || !this.itemId || this.userId === null) {
      throw new Error('Pluggy not configured');
    }

    const accounts = await this.client.fetchAccounts(this.itemId);
    let totalInserted = 0;
    let totalSkipped = 0;

    for (const account of accounts.results) {
      const wallet = await this.ensureWallet(account);
      const result = await this.syncAccount(account, wallet.id);
      totalInserted += result.inserted;
      totalSkipped += result.skipped;
      await this.prisma.wallet.update({
        where: { id: wallet.id },
        data: { pluggy_last_sync_at: new Date() },
      });
    }

    return {
      inserted: totalInserted,
      skipped: totalSkipped,
      accounts: accounts.results.length,
    };
  }

  private async ensureWallet(account: Account) {
    if (this.userId === null) throw new Error('userId missing');
    const externalSource = `pluggy:${account.type.toLowerCase()}`;
    const existing = await this.prisma.wallet.findUnique({
      where: { pluggy_account_id: account.id },
    });
    if (existing) return existing;

    return this.prisma.wallet.create({
      data: {
        user_id: this.userId,
        name: account.name || account.marketingName || account.type,
        type: account.type === 'CREDIT' ? 'CREDIT_CARD' : 'BANK',
        actual_cash: account.balance ?? 0,
        pluggy_item_id: this.itemId,
        pluggy_account_id: account.id,
        external_source: externalSource,
      },
    });
  }

  private async ensureCategory(name: string): Promise<number> {
    if (this.userId === null) throw new Error('userId missing');
    const clean = name?.trim() || FALLBACK_CATEGORY;
    const existing = await this.prisma.transactionCategory.findFirst({
      where: { user_id: this.userId, name: clean },
    });
    if (existing) return existing.id;
    const created = await this.prisma.transactionCategory.create({
      data: { user_id: this.userId, name: clean },
    });
    return created.id;
  }

  private async syncAccount(
    account: Account,
    walletId: number,
  ): Promise<{ inserted: number; skipped: number }> {
    if (!this.client) throw new Error('client missing');
    const externalSource = `pluggy:${account.type.toLowerCase()}`;

    const last = await this.prisma.transaction.findFirst({
      where: { wallet_id: walletId, external_source: externalSource },
      orderBy: { transaction_date: 'desc' },
      select: { transaction_date: true },
    });

    const dateFrom = last
      ? new Date(last.transaction_date.getTime() - 7 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10)
      : undefined;

    const txs = await this.client.fetchAllTransactions(account.id, { dateFrom });

    let inserted = 0;
    let skipped = 0;

    for (const tx of txs) {
      const mapped = mapPluggyTransaction(account, tx, externalSource);
      const exists = await this.prisma.transaction.findUnique({
        where: { external_id: mapped.external_id },
        select: { id: true },
      });
      if (exists) {
        skipped++;
        continue;
      }

      const categoryId = await this.ensureCategory(
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

    return { inserted, skipped };
  }
}
