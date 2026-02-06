import { Injectable, NotFoundException } from '@nestjs/common';
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

  async update(id: number, userId: number, updateTransactionDto: UpdateTransactionDto) {
    const oldTransaction = await this.findOne(id, userId);
    if (!oldTransaction) {
      throw new NotFoundException('Transaction not found');
    }

    // Check if balance update is needed
    if (
      updateTransactionDto.value !== undefined || 
      updateTransactionDto.transaction_type !== undefined ||
      updateTransactionDto.wallet_id !== undefined ||
      updateTransactionDto.payment_method !== undefined
    ) {
      // Revert old transaction impact
      if (oldTransaction.transaction_type === 'EXPENSE') {
        if (oldTransaction.payment_method !== 'CREDIT') {
          await this.walletsService.addIncoming(oldTransaction.wallet_id, userId, Number(oldTransaction.value));
        }
      } else {
        await this.walletsService.addExpense(oldTransaction.wallet_id, userId, Number(oldTransaction.value));
      }

      // Apply new transaction impact
      const newValue = updateTransactionDto.value !== undefined ? updateTransactionDto.value : Number(oldTransaction.value);
      const newType = updateTransactionDto.transaction_type || oldTransaction.transaction_type;
      const newWalletId = updateTransactionDto.wallet_id || oldTransaction.wallet_id;
      const newMethod = updateTransactionDto.payment_method !== undefined ? updateTransactionDto.payment_method : oldTransaction.payment_method;

      if (newType === 'EXPENSE') {
        if (newMethod !== 'CREDIT') {
          await this.walletsService.addExpense(newWalletId, userId, newValue);
        }
      } else {
        await this.walletsService.addIncoming(newWalletId, userId, newValue);
      }
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

    const { installment_total, is_recurring, subscription_id, ...data } = createTransactionDto;

    if (installment_total && installment_total > 1) {
      return this.createInstallments(userId, createTransactionDto, categoryId!);
    }

    // If it's recurring but NOT triggered by a subscription engine (no subscription_id), assume manual 12-month generation
    if (is_recurring && !installment_total && !subscription_id) {
      return this.createSubscription(userId, createTransactionDto, categoryId!);
    }

    const transaction = await this.prisma.transaction.create({
      data: {
        ...data,
        category_id: categoryId!,
        is_recurring: is_recurring || false,
        subscription_id: subscription_id,
        installment_total: 1,
        installment_number: 1,
        transaction_date: new Date(data.transaction_date),
      },
    });

    if (data.transaction_type === 'EXPENSE') {
      if (data.payment_method !== 'CREDIT') {
        await this.walletsService.addExpense(data.wallet_id, userId, data.value);
      }
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
        payment_method: dto.payment_method,
        installment_id: groupId,
        installment_total: null,
        installment_number: i + 1,
      });
    }

    const created = await this.prisma.transaction.createMany({
      data: transactionsData,
    });

    if (dto.transaction_type === 'EXPENSE') {
      if (dto.payment_method !== 'CREDIT') {
        await this.walletsService.addExpense(dto.wallet_id, userId, monthlyValue);
      }
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
        payment_method: dto.payment_method,
        installment_id: installmentId,
        installment_total: totalInstallments,
        installment_number: i + 1,
      });
    }

    const created = await this.prisma.transaction.createMany({
      data: transactionsData,
    });

    if (dto.transaction_type === 'EXPENSE') {
      if (dto.payment_method !== 'CREDIT') {
        await this.walletsService.addExpense(dto.wallet_id, userId, installmentValue);
      }
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
    });
  }

  async remove(id: number, userId: number) {
    const transaction = await this.findOne(id, userId);
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    // Revert balance impact
    if (transaction.transaction_type === 'EXPENSE') {
      if (transaction.payment_method !== 'CREDIT') {
        await this.walletsService.addIncoming(transaction.wallet_id, userId, Number(transaction.value));
      }
    } else {
      await this.walletsService.addExpense(transaction.wallet_id, userId, Number(transaction.value));
    }

    if (transaction.installment_id) {
      return this.prisma.transaction.deleteMany({
        where: { installment_id: transaction.installment_id },
      });
    }

    return this.prisma.transaction.delete({
      where: { id },
    });
  }
}
