import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import {
  TransactionSeriesScope,
  UpdateTransactionDto,
} from './dto/update-transaction.dto';
import { PrismaService } from '../prisma/prisma.service';
import { crypto } from '../utils/crypto-uuid';
import {
  PAYMENT_METHODS,
  TRANSACTION_TYPES,
  WALLET_TYPES,
} from '../common/finance-constants';
import { TransactionImpactService } from './transaction-impact.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly impact: TransactionImpactService,
  ) {}

  private async validateTransactionRelations(
    userId: number,
    walletId: number,
    categoryId: number,
    cardId?: number | null,
    subscriptionId?: number | null,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    if (cardId) {
      const card = await db.card.findUnique({
        where: { id: cardId },
        include: { wallet: true },
      });
      if (
        !card ||
        card.wallet.user_id !== userId ||
        card.wallet_id !== walletId
      ) {
        throw new NotFoundException('Card not found');
      }
    }

    if (subscriptionId) {
      const subscription = await db.subscription.findUnique({
        where: { id: subscriptionId },
      });
      if (
        !subscription ||
        subscription.user_id !== userId ||
        subscription.wallet_id !== walletId ||
        subscription.category_id !== categoryId
      ) {
        throw new NotFoundException('Subscription not found');
      }
    }
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

    let newWalletType = oldTransaction.wallet?.type;

    if (updateTransactionDto.wallet_id) {
      const wallet = await this.prisma.wallet.findUnique({
        where: { id: updateTransactionDto.wallet_id },
      });
      if (!wallet || wallet.user_id !== userId)
        throw new NotFoundException('Wallet not found');
      newWalletType = wallet.type;
    }

    if (updateTransactionDto.category_id) {
      const category = await this.prisma.transactionCategory.findUnique({
        where: { id: updateTransactionDto.category_id },
      });
      if (!category || category.user_id !== userId)
        throw new NotFoundException('Category not found');
    }

    await this.validateTransactionRelations(
      userId,
      updateTransactionDto.wallet_id || oldTransaction.wallet_id,
      updateTransactionDto.category_id || oldTransaction.category_id,
      updateTransactionDto.card_id !== undefined
        ? updateTransactionDto.card_id
        : oldTransaction.card_id,
      updateTransactionDto.subscription_id !== undefined
        ? updateTransactionDto.subscription_id
        : oldTransaction.subscription_id,
    );

    const scope =
      updateTransactionDto.series_scope || TransactionSeriesScope.THIS;
    const { series_scope: _seriesScope, ...requestedData } =
      updateTransactionDto;
    const balanceRelevant =
      requestedData.value !== undefined ||
      requestedData.transaction_type !== undefined ||
      requestedData.wallet_id !== undefined ||
      requestedData.payment_method !== undefined ||
      requestedData.transaction_date !== undefined;

    return this.prisma.$transaction(async (tx) => {
      let affected = [oldTransaction];
      const seriesWhere = oldTransaction.installment_group_id
        ? { installment_group_id: oldTransaction.installment_group_id }
        : oldTransaction.recurrence_id
          ? { recurrence_id: oldTransaction.recurrence_id }
          : null;
      if (seriesWhere && scope !== TransactionSeriesScope.THIS) {
        affected = await tx.transaction.findMany({
          where: {
            ...seriesWhere,
            wallet: { user_id: userId },
            ...(scope === TransactionSeriesScope.THIS_AND_FUTURE
              ? { transaction_date: { gte: oldTransaction.transaction_date } }
              : {}),
          },
          include: { wallet: true },
          orderBy: { transaction_date: 'asc' },
        });
      }

      const results: unknown[] = [];
      for (const current of affected) {
        const updates = { ...requestedData } as Record<string, unknown>;
        if (scope !== TransactionSeriesScope.THIS) {
          delete updates.transaction_date;
        }

        const newValue =
          requestedData.value !== undefined
            ? requestedData.value
            : Number(current.value);
        const newType =
          requestedData.transaction_type || current.transaction_type;
        const newWalletId = requestedData.wallet_id || current.wallet_id;
        const newMethod =
          requestedData.payment_method !== undefined
            ? requestedData.payment_method
            : current.payment_method;
        const newCardId =
          requestedData.card_id !== undefined
            ? requestedData.card_id
            : current.card_id;
        const newDate =
          scope === TransactionSeriesScope.THIS &&
          requestedData.transaction_date
            ? new Date(requestedData.transaction_date)
            : current.transaction_date;
        const willBeFuture = this.impact.isFutureDate(newDate);

        if (balanceRelevant && current.is_processed) {
          await this.impact.applyBalanceImpact({
            walletId: current.wallet_id,
            userId,
            paymentMethod: current.payment_method,
            walletType: current.wallet?.type,
            transactionType: current.transaction_type,
            value: Number(current.value),
            mode: 'revert',
            db: tx,
          });
        }

        if (
          balanceRelevant &&
          newType === TRANSACTION_TYPES.EXPENSE &&
          newMethod === PAYMENT_METHODS.CREDIT &&
          newCardId &&
          newWalletType !== WALLET_TYPES.MEAL_VOUCHER
        ) {
          await this.impact.validateCardLimit(
            newCardId,
            newValue,
            current.id,
            tx,
          );
        }

        if (balanceRelevant && !willBeFuture) {
          await this.impact.applyBalanceImpact({
            walletId: newWalletId,
            userId,
            paymentMethod: newMethod,
            walletType: newWalletType,
            transactionType: newType,
            value: newValue,
            mode: 'apply',
            db: tx,
          });
          updates.is_processed = true;
        } else if (balanceRelevant) {
          updates.is_processed = false;
        }

        results.push(
          await tx.transaction.update({
            where: { id: current.id },
            data: {
              ...updates,
              transaction_date:
                scope === TransactionSeriesScope.THIS &&
                requestedData.transaction_date
                  ? newDate
                  : undefined,
            },
          }),
        );
      }

      return scope === TransactionSeriesScope.THIS
        ? results[0]
        : { count: results.length };
    });
  }

  async create(
    userId: number,
    createTransactionDto: CreateTransactionDto,
    transactionClient?: Prisma.TransactionClient,
  ) {
    const db = transactionClient || this.prisma;
    const wallet = await db.wallet.findUnique({
      where: { id: createTransactionDto.wallet_id },
    });
    if (!wallet || wallet.user_id !== userId)
      throw new NotFoundException('Wallet not found');
    const walletType = wallet.type;

    const categoryId = await this.impact.resolveCategoryId(
      userId,
      createTransactionDto.category_id,
      db,
    );
    createTransactionDto.category_id = categoryId;

    await this.validateTransactionRelations(
      userId,
      createTransactionDto.wallet_id,
      categoryId,
      createTransactionDto.card_id,
      createTransactionDto.subscription_id,
      db,
    );

    const {
      installment_total,
      is_recurring,
      subscription_id,
      card_id,
      ...data
    } = createTransactionDto;

    if (
      data.transaction_type === TRANSACTION_TYPES.EXPENSE &&
      data.payment_method === PAYMENT_METHODS.CREDIT &&
      card_id &&
      walletType !== WALLET_TYPES.MEAL_VOUCHER
    ) {
      const multiplier =
        installment_total && installment_total > 1
          ? installment_total
          : is_recurring && !subscription_id
            ? 12
            : 1;
      await this.impact.validateCardLimit(
        card_id,
        data.value * multiplier,
        undefined,
        db,
      );
    }

    if (installment_total && installment_total > 1) {
      return this.createInstallments(
        userId,
        createTransactionDto,
        categoryId!,
        walletType,
      );
    }

    // If it's recurring but NOT triggered by a subscription engine (no subscription_id), assume manual 12-month generation
    if (is_recurring && !installment_total && !subscription_id) {
      return this.createSubscription(
        userId,
        createTransactionDto,
        categoryId!,
        walletType,
      );
    }

    const transactionDate = new Date(data.transaction_date);
    const isFuture = this.impact.isFutureDate(transactionDate);

    const persist = async (tx: Prisma.TransactionClient) => {
      const transaction = await tx.transaction.create({
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

      if (!isFuture) {
        await this.impact.applyBalanceImpact({
          walletId: data.wallet_id,
          userId,
          paymentMethod: data.payment_method,
          walletType,
          transactionType: data.transaction_type,
          value: data.value,
          mode: 'apply',
          db: tx,
        });
      }

      return transaction;
    };

    return transactionClient
      ? persist(transactionClient)
      : this.prisma.$transaction(persist);
  }

  private async createSubscription(
    userId: number,
    dto: CreateTransactionDto,
    categoryId: number,
    walletType?: string,
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
      const transactionDate = this.impact.addMonthsSafe(startDate, i);

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
        recurrence_id: groupId,
        installment_total: null,
        installment_number: i + 1,
        is_processed: !isFuture,
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.transaction.createMany({
        data: transactionsData,
      });

      if (processedCount > 0) {
        await this.impact.applyBalanceImpact({
          walletId: dto.wallet_id,
          userId,
          paymentMethod: dto.payment_method,
          walletType,
          transactionType: dto.transaction_type,
          value: monthlyValue * processedCount,
          mode: 'apply',
          db: tx,
        });
      }

      return {
        message: `Subscription created (12 months visibility)`,
        recurrence_id: groupId,
        count: created.count,
      };
    });
  }

  private async createInstallments(
    userId: number,
    dto: CreateTransactionDto,
    categoryId: number,
    walletType?: string,
  ) {
    const totalInstallments = dto.installment_total || 1;
    const totalCents = Math.round(dto.value * 100);
    const baseCents = Math.floor(totalCents / totalInstallments);
    const remainder = totalCents % totalInstallments;
    const installmentId = crypto.randomUUID();
    const transactionsData: any[] = [];

    const startDate = new Date(dto.transaction_date);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    let processedValue = 0;

    for (let i = 0; i < totalInstallments; i++) {
      const transactionDate = this.impact.addMonthsSafe(startDate, i);
      const installmentValue = (baseCents + (i < remainder ? 1 : 0)) / 100;

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
        installment_group_id: installmentId,
        installment_total: totalInstallments,
        installment_number: i + 1,
        is_processed: !isFuture,
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.transaction.createMany({
        data: transactionsData,
      });

      if (processedValue > 0) {
        await this.impact.applyBalanceImpact({
          walletId: dto.wallet_id,
          userId,
          paymentMethod: dto.payment_method,
          walletType,
          transactionType: dto.transaction_type,
          value: processedValue,
          mode: 'apply',
          db: tx,
        });
      }

      return {
        message: `${totalInstallments} installments created successfully`,
        installment_group_id: installmentId,
        count: created.count,
      };
    });
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

  async remove(
    id: number,
    userId: number,
    scope: TransactionSeriesScope = TransactionSeriesScope.THIS,
  ) {
    const transaction: any = await this.findOne(id, userId);
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    return this.prisma.$transaction(async (tx) => {
      let affected = [transaction];
      const seriesWhere = transaction.installment_group_id
        ? { installment_group_id: transaction.installment_group_id }
        : transaction.recurrence_id
          ? { recurrence_id: transaction.recurrence_id }
          : null;
      if (seriesWhere && scope !== TransactionSeriesScope.THIS) {
        affected = await tx.transaction.findMany({
          where: {
            ...seriesWhere,
            wallet: { user_id: userId },
            ...(scope === TransactionSeriesScope.THIS_AND_FUTURE
              ? { transaction_date: { gte: transaction.transaction_date } }
              : {}),
          },
          include: { wallet: true },
        });
      }

      for (const current of affected) {
        if (current.is_processed) {
          await this.impact.applyBalanceImpact({
            walletId: current.wallet_id,
            userId,
            paymentMethod: current.payment_method,
            walletType: current.wallet?.type,
            transactionType: current.transaction_type,
            value: Number(current.value),
            mode: 'revert',
            db: tx,
          });
        }
      }

      if (scope === TransactionSeriesScope.THIS) {
        return tx.transaction.delete({ where: { id } });
      }

      return tx.transaction.deleteMany({
        where: {
          id: { in: affected.map((current) => current.id) },
          wallet: { user_id: userId },
        },
      });
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
      try {
        const claimed = await this.prisma.$transaction(async (db) => {
          const claim = await db.transaction.updateMany({
            where: { id: tx.id, is_processed: false },
            data: { is_processed: true },
          });
          if (claim.count === 0) return false;

          await this.impact.applyBalanceImpact({
            walletId: tx.wallet_id,
            userId: tx.wallet.user_id,
            paymentMethod: tx.payment_method,
            walletType: tx.wallet.type,
            transactionType: tx.transaction_type,
            value: Number(tx.value),
            mode: 'apply',
            db,
          });
          return true;
        });

        if (claimed) processedCount++;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Failed to process matured transaction #${tx.id}: ${message}`,
        );
      }
    }

    return processedCount;
  }
}
