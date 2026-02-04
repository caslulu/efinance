import { Injectable } from '@nestjs/common';
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

  async create(userId: number, createTransactionDto: CreateTransactionDto) {
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
    }

    const { installment_total, is_recurring, ...data } = createTransactionDto;

    if (installment_total && installment_total > 1) {
      return this.createInstallments(userId, createTransactionDto, categoryId!);
    }

    if (is_recurring && !installment_total) {
      return this.createSubscription(userId, createTransactionDto, categoryId!);
    }

    const transaction = await this.prisma.transaction.create({
      data: {
        ...data,
        category_id: categoryId!,
        is_recurring: is_recurring || false,
        installment_total: 1,
        installment_number: 1,
        transaction_date: new Date(data.transaction_date),
      },
    });

    if (data.transaction_type === 'EXPENSE') {
      await this.walletsService.addExpense(data.wallet_id, userId, data.value);
    } else {
      await this.walletsService.addIncoming(data.wallet_id, userId, data.value);
    }

    return transaction;
  }

  private async createSubscription(userId: number, dto: CreateTransactionDto, categoryId: number) {
    const PREDICTION_MONTHS = 12;
    const monthlyValue = dto.value;
    const groupId = crypto.randomUUID();
    const transactionsData: any[] = [];

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
        category_id: categoryId,
        installment_id: groupId,
        installment_total: null,
        installment_number: i + 1,
      });
    }

    const created = await this.prisma.transaction.createMany({
      data: transactionsData,
    });

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

  private async createInstallments(userId: number, dto: CreateTransactionDto, categoryId: number) {
    const totalInstallments = dto.installment_total || 1;
    const installmentValue = Number((dto.value / totalInstallments).toFixed(2));
    const installmentId = crypto.randomUUID();
    const transactionsData: any[] = [];

    const startDate = new Date(dto.transaction_date);

    for (let i = 0; i < totalInstallments; i++) {
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
        is_recurring: dto.is_recurring,
        value: installmentValue,
        category_id: categoryId,
        installment_id: installmentId,
        installment_total: totalInstallments,
        installment_number: i + 1,
      });
    }

    const created = await this.prisma.transaction.createMany({
      data: transactionsData,
    });

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
    return this.prisma.transaction.delete({
      where: { id },
    });
  }
}
