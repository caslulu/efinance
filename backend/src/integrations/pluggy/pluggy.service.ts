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

  async syncAll(): Promise<{
    inserted: number;
    skipped: number;
    accounts: number;
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
      return { inserted: 0, skipped: 0, accounts: 0 };
    }
    const userId = activeUser.id;

    const accounts = await this.client.fetchAccounts(this.itemId);
    let totalInserted = 0;
    let totalSkipped = 0;

    for (const account of accounts.results) {
      const wallet = await this.ensureWallet(account, userId);
      const result = await this.syncAccount(account, wallet.id, userId);
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

  private async ensureWallet(account: Account, userId: number) {
    const externalSource = `pluggy:${account.type.toLowerCase()}`;
    const existing = await this.prisma.wallet.findUnique({
      where: { pluggy_account_id: account.id },
    });
    if (existing) return existing;

    return this.prisma.wallet.create({
      data: {
        user_id: userId,
        name: account.name || account.marketingName || account.type,
        type: account.type === 'CREDIT' ? 'CREDIT_CARD' : 'BANK',
        actual_cash: account.balance ?? 0,
        pluggy_item_id: this.itemId,
        pluggy_account_id: account.id,
        external_source: externalSource,
      },
    });
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
