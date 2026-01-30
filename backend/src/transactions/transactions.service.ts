import { Injectable } from '@nestjs/common';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { PrismaService } from '../prisma/prisma.service';
import { WalletsService } from '../wallets/wallets.service';
import { crypto } from '../utils/crypto-uuid'; // We will create this simple helper

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletsService: WalletsService,
  ) {}

  async create(userId: number, createTransactionDto: CreateTransactionDto) {
    const { installment_total, is_recurring, ...data } = createTransactionDto;

    // Case 1: Fixed Installments (e.g., 10x)
    if (installment_total && installment_total > 1) {
      return this.createInstallments(userId, createTransactionDto);
    }

    // Case 2: Subscription (Recurring infinite) -> Create 12 months view
    if (is_recurring && !installment_total) {
      return this.createSubscription(userId, createTransactionDto);
    }

    // Case 3: Single Transaction
    const transaction = await this.prisma.transaction.create({
      data: {
        ...data,
        is_recurring: is_recurring || false,
        installment_total: 1,
        installment_number: 1,
        transaction_date: new Date(data.transaction_date),
      },
    });

    // Update Wallet Balance
    if (data.transaction_type === 'EXPENSE') {
      await this.walletsService.addExpense(data.wallet_id, userId, data.value);
    } else {
      await this.walletsService.addIncoming(data.wallet_id, userId, data.value);
    }

    return transaction;
  }

  private async createSubscription(userId: number, dto: CreateTransactionDto) {
    const PREDICTION_MONTHS = 12; // 1 Year Visibility
    const monthlyValue = dto.value; // Value is per month, NOT total
    const groupId = crypto.randomUUID();
    const transactionsData = [];

    const startDate = new Date(dto.transaction_date);

    for (let i = 0; i < PREDICTION_MONTHS; i++) {
      const transactionDate = new Date(startDate);
      const targetMonth = startDate.getMonth() + i;
      transactionDate.setMonth(targetMonth);
      
      if (transactionDate.getMonth() !== targetMonth % 12) {
        transactionDate.setDate(0);
      }

      transactionsData.push({
        transaction_date: transactionDate,
        wallet_id: dto.wallet_id,
        transaction_type: dto.transaction_type,
        is_recurring: true,
        value: monthlyValue,
        category_id: dto.category_id,
        installment_id: groupId, // Use this to group the subscription
        installment_total: null, // Null indicates "Infinite" / Subscription
        installment_number: i + 1, // Just for ordering in the view
      });
    }

    const created = await this.prisma.transaction.createMany({
      data: transactionsData,
    });

    // Update Wallet Balance only for the CURRENT month (first record)
    if (dto.transaction_type === 'EXPENSE') {
      await this.walletsService.addExpense(dto.wallet_id, userId, monthlyValue);
    } else {
      await this.walletsService.addIncoming(dto.wallet_id, userId, monthlyValue);
    }

    return {
      message: `Subscription created (12 months visibility)`,
      subscription_group_id: groupId,
      count: created.count,
    };
  }

  private async createInstallments(userId: number, dto: CreateTransactionDto) {
    const totalInstallments = dto.installment_total || 1;
    const installmentValue = Number((dto.value / totalInstallments).toFixed(2));
    const installmentId = crypto.randomUUID();
    const transactionsData = [];

    const startDate = new Date(dto.transaction_date);

    for (let i = 0; i < totalInstallments; i++) {
      const transactionDate = new Date(startDate);
      // Safe month increment: Handles cases like Jan 31st -> Feb 28th instead of March
      const targetMonth = startDate.getMonth() + i;
      transactionDate.setMonth(targetMonth);
      
      // If the month overflowed (e.g., set Feb 31st results in March), snap to last day of previous month
      if (transactionDate.getMonth() !== targetMonth % 12) {
        transactionDate.setDate(0);
      }

      transactionsData.push({
        transaction_date: transactionDate,
        wallet_id: dto.wallet_id,
        transaction_type: dto.transaction_type,
        is_recurring: dto.is_recurring,
        value: installmentValue,
        category_id: dto.category_id,
        installment_id: installmentId,
        installment_total: totalInstallments,
        installment_number: i + 1,
      });
    }

    const created = await this.prisma.transaction.createMany({
      data: transactionsData,
    });

    // Update Wallet Balance only for the FIRST installment (immediate impact)
    if (dto.transaction_type === 'EXPENSE') {
      await this.walletsService.addExpense(dto.wallet_id, userId, installmentValue);
    } else {
      await this.walletsService.addIncoming(dto.wallet_id, userId, installmentValue);
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
      include: { TransactionCategory: true },
    });
  }

  findOne(id: number, userId: number) {
    return this.prisma.transaction.findFirst({
      where: {
        id,
        wallet: { user_id: userId },
      },
    });
  }

  remove(id: number, userId: number) {
    // Note: Deleting an installment might need logic to delete the whole group. 
    // For now, simple delete.
    return this.prisma.transaction.delete({
      where: { id },
    });
  }
}
