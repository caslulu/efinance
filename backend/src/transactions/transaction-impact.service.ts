import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WalletsService } from '../wallets/wallets.service';
import {
  isImmediateDebit,
  PAYMENT_METHODS,
  TRANSACTION_TYPES,
} from '../common/finance-constants';

/**
 * Shared helpers used by TransactionsService and StatementImportService.
 *
 * Centralizing these here is what lets the import flow stay independent of
 * the CRUD service while still applying the same domain rules (card limit,
 * meal-voucher immediate-debit semantics, month-safe date math, etc.).
 */
@Injectable()
export class TransactionImpactService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletsService: WalletsService,
  ) {}

  isFutureDate(date: Date): boolean {
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    return date > endOfToday;
  }

  /**
   * Add `monthsToAdd` months to `startDate`, clamping to the last valid day
   * of the target month (Jan 31 + 1 month → Feb 28, not Mar 3).
   */
  addMonthsSafe(startDate: Date, monthsToAdd: number): Date {
    const result = new Date(startDate);
    const originalDay = startDate.getDate();
    result.setMonth(startDate.getMonth() + monthsToAdd);
    if (result.getDate() !== originalDay) {
      result.setDate(0);
    }
    return result;
  }

  async validateCardLimit(
    cardId: number,
    incomingExpenseValue: number,
    currentTransactionIdToExclude?: number,
  ) {
    const card = await this.prisma.card.findUnique({ where: { id: cardId } });
    if (!card) return;

    const exclude = currentTransactionIdToExclude
      ? { id: { not: currentTransactionIdToExclude } }
      : {};

    const totalExp = await this.prisma.transaction.aggregate({
      where: {
        card_id: cardId,
        transaction_type: TRANSACTION_TYPES.EXPENSE,
        payment_method: PAYMENT_METHODS.CREDIT,
        ...exclude,
      },
      _sum: { value: true },
    });

    const totalInc = await this.prisma.transaction.aggregate({
      where: {
        card_id: cardId,
        transaction_type: TRANSACTION_TYPES.INCOME,
        payment_method: PAYMENT_METHODS.CREDIT,
        ...exclude,
      },
      _sum: { value: true },
    });

    const used =
      Number(totalExp._sum.value || 0) - Number(totalInc._sum.value || 0);
    const activeLimit = Number(card.usable_limit ?? card.card_limit);
    if (used + incomingExpenseValue > activeLimit) {
      throw new BadRequestException(
        `Limite do cartão excedido. Limite disponível: R$ ${(activeLimit - used).toFixed(2)}`,
      );
    }
  }

  /**
   * Returns the category id to use for a new transaction. If `categoryId` is
   * provided it is validated (must belong to the user); otherwise the default
   * "Outro" category is found or created.
   */
  async resolveCategoryId(
    userId: number,
    categoryId?: number,
  ): Promise<number> {
    if (!categoryId) {
      const defaultCategory = await this.prisma.transactionCategory.findFirst({
        where: { user_id: userId, name: 'Outro' },
      });
      if (defaultCategory) return defaultCategory.id;

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

  /**
   * Apply (or revert) a transaction's impact on the wallet balance.
   * No-op when payment is deferred (regular credit card). Meal vouchers
   * always settle immediately regardless of payment_method.
   */
  async applyBalanceImpact(params: {
    walletId: number;
    userId: number;
    paymentMethod: string | null | undefined;
    walletType: string | null | undefined;
    transactionType: string;
    value: number;
    mode: 'apply' | 'revert';
  }): Promise<void> {
    if (!isImmediateDebit(params.paymentMethod, params.walletType)) return;
    const addsToWallet =
      (params.mode === 'apply' &&
        params.transactionType === TRANSACTION_TYPES.INCOME) ||
      (params.mode === 'revert' &&
        params.transactionType === TRANSACTION_TYPES.EXPENSE);
    if (addsToWallet) {
      await this.walletsService.addIncoming(
        params.walletId,
        params.userId,
        params.value,
      );
    } else {
      await this.walletsService.addExpense(
        params.walletId,
        params.userId,
        params.value,
      );
    }
  }
}
