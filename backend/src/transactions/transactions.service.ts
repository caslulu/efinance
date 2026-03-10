import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { PrismaService } from '../prisma/prisma.service';
import { WalletsService } from '../wallets/wallets.service';
import { crypto } from '../utils/crypto-uuid';

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

  private async validateCardLimit(cardId: number, incomingExpenseValue: number, currentTransactionIdToExclude?: number) {
    const card = await this.prisma.card.findUnique({ where: { id: cardId } });
    if (!card) return;

    const totalExp = await this.prisma.transaction.aggregate({
      where: {
        card_id: cardId,
        transaction_type: 'EXPENSE',
        payment_method: 'CREDIT',
        ...(currentTransactionIdToExclude ? { id: { not: currentTransactionIdToExclude } } : {})
      },
      _sum: { value: true },
    });

    const totalInc = await this.prisma.transaction.aggregate({
      where: {
        card_id: cardId,
        transaction_type: 'INCOME',
        payment_method: 'CREDIT',
        ...(currentTransactionIdToExclude ? { id: { not: currentTransactionIdToExclude } } : {})
      },
      _sum: { value: true },
    });

    const used = Number(totalExp._sum.value || 0) - Number(totalInc._sum.value || 0);
    if (used + incomingExpenseValue > Number(card.card_limit)) {
      throw new BadRequestException(`Limite do cartão excedido. Limite disponível: R$ ${(Number(card.card_limit) - used).toFixed(2)}`);
    }
  }

  async update(id: number, userId: number, updateTransactionDto: UpdateTransactionDto) {
    const oldTransaction: any = await this.findOne(id, userId);
    if (!oldTransaction) {
      throw new NotFoundException('Transaction not found');
    }

    let isOldMealVoucher = oldTransaction.wallet?.type === 'MEAL_VOUCHER';
    let isNewMealVoucher = isOldMealVoucher;

    if (updateTransactionDto.wallet_id) {
      const wallet = await this.prisma.wallet.findUnique({ where: { id: updateTransactionDto.wallet_id } });
      if (!wallet || wallet.user_id !== userId) throw new NotFoundException('Wallet not found');
      isNewMealVoucher = wallet.type === 'MEAL_VOUCHER';
    }

    if (updateTransactionDto.category_id) {
      const category = await this.prisma.transactionCategory.findUnique({ where: { id: updateTransactionDto.category_id } });
      if (!category || category.user_id !== userId) throw new NotFoundException('Category not found');
    }

    // Check if balance update is needed
    if (
      updateTransactionDto.value !== undefined || 
      updateTransactionDto.transaction_type !== undefined ||
      updateTransactionDto.wallet_id !== undefined ||
      updateTransactionDto.payment_method !== undefined ||
      updateTransactionDto.transaction_date !== undefined
    ) {
      const multiplier = oldTransaction.installment_id ? (oldTransaction.installment_total || 12) : 1;

      // Revert old transaction impact ONLY if it was processed (balance was applied)
      if (oldTransaction.is_processed) {
        if (oldTransaction.transaction_type === 'EXPENSE') {
          if (oldTransaction.payment_method !== 'CREDIT' || isOldMealVoucher) {
            await this.walletsService.addIncoming(oldTransaction.wallet_id, userId, Number(oldTransaction.value) * multiplier);
          }
        } else {
          // INCOME
          if (oldTransaction.payment_method !== 'CREDIT' || isOldMealVoucher) {
            await this.walletsService.addExpense(oldTransaction.wallet_id, userId, Number(oldTransaction.value) * multiplier);
          }
        }
      }

      // Apply new transaction impact only if the new date is NOT in the future
      const newValue = updateTransactionDto.value !== undefined ? updateTransactionDto.value : Number(oldTransaction.value);
      const newType = updateTransactionDto.transaction_type || oldTransaction.transaction_type;
      const newWalletId = updateTransactionDto.wallet_id || oldTransaction.wallet_id;
      const newMethod = updateTransactionDto.payment_method !== undefined ? updateTransactionDto.payment_method : oldTransaction.payment_method;
      const newCardId = updateTransactionDto.card_id !== undefined ? updateTransactionDto.card_id : oldTransaction.card_id;
      const newDate = updateTransactionDto.transaction_date ? new Date(updateTransactionDto.transaction_date) : oldTransaction.transaction_date;
      const willBeFuture = this.isFutureDate(newDate);
      
      const newMultiplier = oldTransaction.installment_id ? (updateTransactionDto.installment_total || oldTransaction.installment_total || 12) : 1;

      if (newType === 'EXPENSE' && newMethod === 'CREDIT' && newCardId && !isNewMealVoucher) {
        await this.validateCardLimit(newCardId, newValue * newMultiplier, id);
      }

      if (!willBeFuture) {
        if (newType === 'EXPENSE') {
          if (newMethod !== 'CREDIT' || isNewMealVoucher) {
            await this.walletsService.addExpense(newWalletId, userId, newValue * newMultiplier);
          }
        } else {
          // INCOME
          if (newMethod !== 'CREDIT' || isNewMealVoucher) {
            await this.walletsService.addIncoming(newWalletId, userId, newValue * newMultiplier);
          }
        }
      }

      // Update is_processed flag based on the new date
      updateTransactionDto = { ...updateTransactionDto, is_processed: !willBeFuture } as any;
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
        transaction_date: updateTransactionDto.transaction_date ? new Date(updateTransactionDto.transaction_date) : undefined,
      },
    });
  }

  async create(userId: number, createTransactionDto: CreateTransactionDto) {
    const wallet = await this.prisma.wallet.findUnique({ where: { id: createTransactionDto.wallet_id } });
    if (!wallet || wallet.user_id !== userId) throw new NotFoundException('Wallet not found');
    const isMealVoucher = wallet.type === 'MEAL_VOUCHER';

    let categoryId = createTransactionDto.category_id;

    if (!categoryId) {
      const defaultCategory = await this.prisma.transactionCategory.findFirst({
        where: { user_id: userId, name: 'Outro' },
      });
      
      if (defaultCategory) {
        categoryId = defaultCategory.id;
      } else {
        const newCategory = await this.prisma.transactionCategory.create({
          data: { name: 'Outro', user_id: userId },
        });
        categoryId = newCategory.id;
      }
      createTransactionDto.category_id = categoryId;
    } else {
      const category = await this.prisma.transactionCategory.findUnique({ where: { id: categoryId } });
      if (!category || category.user_id !== userId) throw new NotFoundException('Category not found');
    }

    const { installment_total, is_recurring, subscription_id, card_id, ...data } = createTransactionDto;

    if (data.transaction_type === 'EXPENSE' && data.payment_method === 'CREDIT' && card_id && !isMealVoucher) {
      const multiplier = installment_total && installment_total > 1 ? installment_total : (is_recurring && !subscription_id ? 12 : 1);
      await this.validateCardLimit(card_id, data.value * multiplier);
    }

    if (installment_total && installment_total > 1) {
      return this.createInstallments(userId, createTransactionDto, categoryId!, isMealVoucher);
    }

    // If it's recurring but NOT triggered by a subscription engine (no subscription_id), assume manual 12-month generation
    if (is_recurring && !installment_total && !subscription_id) {
      return this.createSubscription(userId, createTransactionDto, categoryId!, isMealVoucher);
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
          await this.walletsService.addExpense(data.wallet_id, userId, data.value);
        }
      } else {
        if (data.payment_method !== 'CREDIT' || isMealVoucher) {
          await this.walletsService.addIncoming(data.wallet_id, userId, data.value);
        }
      }
    }

    return transaction;
  }

  private async createSubscription(userId: number, dto: CreateTransactionDto, categoryId: number, isMealVoucher: boolean = false) {
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
          await this.walletsService.addExpense(dto.wallet_id, userId, monthlyValue * processedCount);
        }
      } else {
        if (dto.payment_method !== 'CREDIT' || isMealVoucher) {
          await this.walletsService.addIncoming(dto.wallet_id, userId, monthlyValue * processedCount);
        }
      }
    }

    return {
      message: `Subscription created (12 months visibility)`,
      subscription_group_id: groupId,
      count: created.count,
    };
  }

  private async createInstallments(userId: number, dto: CreateTransactionDto, categoryId: number, isMealVoucher: boolean = false) {
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
          await this.walletsService.addExpense(dto.wallet_id, userId, processedValue);
        }
      } else {
        if (dto.payment_method !== 'CREDIT' || isMealVoucher) {
          await this.walletsService.addIncoming(dto.wallet_id, userId, processedValue);
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
      orderBy: [
        { transaction_date: 'desc' },
        { id: 'desc' },
      ],
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

      const processedInSeries = allInSeries.filter(t => t.is_processed);
      const processedTotal = processedInSeries.reduce((sum, t) => sum + Number(t.value), 0);

      if (processedTotal > 0) {
        if (transaction.transaction_type === 'EXPENSE') {
          if (transaction.payment_method !== 'CREDIT' || isMealVoucher) {
            await this.walletsService.addIncoming(transaction.wallet_id, userId, processedTotal);
          }
        } else {
          if (transaction.payment_method !== 'CREDIT' || isMealVoucher) {
            await this.walletsService.addExpense(transaction.wallet_id, userId, processedTotal);
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
          await this.walletsService.addIncoming(transaction.wallet_id, userId, Number(transaction.value));
        }
      } else {
        if (transaction.payment_method !== 'CREDIT' || isMealVoucher) {
          await this.walletsService.addExpense(transaction.wallet_id, userId, Number(transaction.value));
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
            await this.walletsService.addExpense(tx.wallet_id, userId, Number(tx.value));
          }
        } else {
          if (tx.payment_method !== 'CREDIT' || isMealVoucher) {
            await this.walletsService.addIncoming(tx.wallet_id, userId, Number(tx.value));
          }
        }

        await this.prisma.transaction.update({
          where: { id: tx.id },
          data: { is_processed: true },
        });

        processedCount++;
      } catch (error) {
        // Log but continue processing other transactions
        console.error(`Failed to process matured transaction #${tx.id}:`, error.message);
      }
    }

    return processedCount;
  }
}