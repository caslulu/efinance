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

  // ... create methods ...

  // ... createSubscription ...

  // ... createInstallments ...

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
