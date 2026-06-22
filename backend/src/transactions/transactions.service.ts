import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { PrismaService } from '../prisma/prisma.service';
import { crypto } from '../utils/crypto-uuid';
import {
  PAYMENT_METHODS,
  TRANSACTION_TYPES,
  WALLET_TYPES,
} from '../common/finance-constants';
import { TransactionImpactService } from './transaction-impact.service';

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly impact: TransactionImpactService,
  ) {}

  async update(
    id: number,
    userId: number,
    updateTransactionDto: UpdateTransactionDto,
  ) {
    const oldTransaction: any = await this.findOne(id, userId);
    if (!oldTransaction) {
      throw new NotFoundException('Transaction not found');
    }

    const oldWalletType = oldTransaction.wallet?.type;
    let newWalletType = oldWalletType;

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
        await this.impact.applyBalanceImpact({
          walletId: oldTransaction.wallet_id,
          userId,
          paymentMethod: oldTransaction.payment_method,
          walletType: oldWalletType,
          transactionType: oldTransaction.transaction_type,
          value: Number(oldTransaction.value) * multiplier,
          mode: 'revert',
        });
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
      const willBeFuture = this.impact.isFutureDate(newDate);

      const newMultiplier = oldTransaction.installment_id
        ? updateTransactionDto.installment_total ||
          oldTransaction.installment_total ||
          12
        : 1;

      if (
        newType === TRANSACTION_TYPES.EXPENSE &&
        newMethod === PAYMENT_METHODS.CREDIT &&
        newCardId &&
        newWalletType !== WALLET_TYPES.MEAL_VOUCHER
      ) {
        await this.impact.validateCardLimit(newCardId, newValue * newMultiplier, id);
      }

      if (!willBeFuture) {
        await this.impact.applyBalanceImpact({
          walletId: newWalletId,
          userId,
          paymentMethod: newMethod,
          walletType: newWalletType,
          transactionType: newType,
          value: newValue * newMultiplier,
          mode: 'apply',
        });
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
    const walletType = wallet.type;

    const categoryId = await this.impact.resolveCategoryId(
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
      await this.impact.validateCardLimit(card_id, data.value * multiplier);
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
      await this.impact.applyBalanceImpact({
        walletId: data.wallet_id,
        userId,
        paymentMethod: data.payment_method,
        walletType,
        transactionType: data.transaction_type,
        value: data.value,
        mode: 'apply',
      });
    }

    return transaction;
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
      await this.impact.applyBalanceImpact({
        walletId: dto.wallet_id,
        userId,
        paymentMethod: dto.payment_method,
        walletType,
        transactionType: dto.transaction_type,
        value: monthlyValue * processedCount,
        mode: 'apply',
      });
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
    walletType?: string,
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
      const transactionDate = this.impact.addMonthsSafe(startDate, i);

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
      await this.impact.applyBalanceImpact({
        walletId: dto.wallet_id,
        userId,
        paymentMethod: dto.payment_method,
        walletType,
        transactionType: dto.transaction_type,
        value: processedValue,
        mode: 'apply',
      });
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

    const walletType = transaction.wallet?.type;

    // For installment/recurring series, revert only the processed (non-future) transactions
    if (transaction.installment_id) {
      const allInSeries = await this.prisma.transaction.findMany({
        where: { installment_id: transaction.installment_id },
      });

      const processedTotal = allInSeries
        .filter((t) => t.is_processed)
        .reduce((sum, t) => sum + Number(t.value), 0);

      if (processedTotal > 0) {
        await this.impact.applyBalanceImpact({
          walletId: transaction.wallet_id,
          userId,
          paymentMethod: transaction.payment_method,
          walletType,
          transactionType: transaction.transaction_type,
          value: processedTotal,
          mode: 'revert',
        });
      }

      return this.prisma.transaction.deleteMany({
        where: { installment_id: transaction.installment_id },
      });
    }

    // Single transaction: only revert if it was processed
    if (transaction.is_processed) {
      await this.impact.applyBalanceImpact({
        walletId: transaction.wallet_id,
        userId,
        paymentMethod: transaction.payment_method,
        walletType,
        transactionType: transaction.transaction_type,
        value: Number(transaction.value),
        mode: 'revert',
      });
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
      try {
        await this.impact.applyBalanceImpact({
          walletId: tx.wallet_id,
          userId: tx.wallet.user_id,
          paymentMethod: tx.payment_method,
          walletType: tx.wallet.type,
          transactionType: tx.transaction_type,
          value: Number(tx.value),
          mode: 'apply',
        });

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
