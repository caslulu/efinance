import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { UpdateWalletDto } from './dto/update-wallet.dto';
import { PrismaService } from '../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class WalletsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: number, createWalletDto: CreateWalletDto) {
    return this.prisma.wallet.create({
      data: {
        ...createWalletDto,
        user_id: userId,
      },
    });
  }

  async findAll(userId: number) {
    const wallets = await this.prisma.wallet.findMany({
      where: { user_id: userId },
    });

    return Promise.all(wallets.map(w => this.enrichWalletWithInvoice(w)));
  }

  async findOne(id: number, userId: number) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id },
    });
    
    if (!wallet || wallet.user_id !== userId) {
      throw new NotFoundException(`Wallet #${id} not found`);
    }
    
    return this.enrichWalletWithInvoice(wallet);
  }

  private async enrichWalletWithInvoice(wallet: any) {
    if (!wallet.closing_day) {
      return { ...wallet, current_invoice: 0, due_invoice: 0, total_invoice: 0 };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const currentDay = today.getDate();
    const closingDay = wallet.closing_day;
    const dueDay = wallet.due_day;

    // 1. Determine "Open" (Accumulating) Cycle
    let openCloseDate = new Date(today.getFullYear(), today.getMonth(), closingDay);
    if (currentDay > closingDay) {
      openCloseDate = new Date(today.getFullYear(), today.getMonth() + 1, closingDay);
    }
    openCloseDate.setHours(23, 59, 59, 999);

    const openStartDate = new Date(openCloseDate);
    openStartDate.setMonth(openStartDate.getMonth() - 1);
    openStartDate.setDate(openStartDate.getDate() + 1);
    openStartDate.setHours(0, 0, 0, 0);

    // 2. Determine "Closed" (Due) Cycle (if applicable)
    let closedInvoiceValue = 0;
    if (dueDay) {
      const closedCloseDate = new Date(openCloseDate);
      closedCloseDate.setMonth(closedCloseDate.getMonth() - 1);
      closedCloseDate.setHours(23, 59, 59, 999);

      const closedStartDate = new Date(closedCloseDate);
      closedStartDate.setMonth(closedStartDate.getMonth() - 1);
      closedStartDate.setDate(closedStartDate.getDate() + 1);
      closedStartDate.setHours(0, 0, 0, 0);

      let dueDate = new Date(closedCloseDate);
      if (dueDay > closingDay) {
        dueDate.setDate(dueDay);
      } else {
        dueDate.setMonth(dueDate.getMonth() + 1);
        dueDate.setDate(dueDay);
      }
      dueDate.setHours(23, 59, 59, 999);

      if (today <= dueDate) {
        const [exp, inc] = await Promise.all([
          this.prisma.transaction.aggregate({
            where: {
              wallet_id: wallet.id,
              transaction_type: 'EXPENSE',
              payment_method: 'CREDIT',
              transaction_date: { gte: closedStartDate, lte: closedCloseDate },
            },
            _sum: { value: true },
          }),
          this.prisma.transaction.aggregate({
            where: {
              wallet_id: wallet.id,
              transaction_type: 'INCOME',
              payment_method: 'CREDIT',
              transaction_date: { gte: closedStartDate, lte: closedCloseDate },
            },
            _sum: { value: true },
          }),
        ]);
        closedInvoiceValue = Number(exp._sum.value || 0) - Number(inc._sum.value || 0);
      }
    }

    const [openExp, openInc, totalExp, totalInc] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: {
          wallet_id: wallet.id,
          transaction_type: 'EXPENSE',
          payment_method: 'CREDIT',
          transaction_date: { gte: openStartDate, lte: openCloseDate },
        },
        _sum: { value: true },
      }),
      this.prisma.transaction.aggregate({
        where: {
          wallet_id: wallet.id,
          transaction_type: 'INCOME',
          payment_method: 'CREDIT',
          transaction_date: { gte: openStartDate, lte: openCloseDate },
        },
        _sum: { value: true },
      }),
      this.prisma.transaction.aggregate({
        where: {
          wallet_id: wallet.id,
          transaction_type: 'EXPENSE',
          payment_method: 'CREDIT',
        },
        _sum: { value: true },
      }),
      this.prisma.transaction.aggregate({
        where: {
          wallet_id: wallet.id,
          transaction_type: 'INCOME',
          payment_method: 'CREDIT',
        },
        _sum: { value: true },
      }),
    ]);

    return {
      ...wallet,
      current_invoice: Number(openExp._sum.value || 0) - Number(openInc._sum.value || 0),
      due_invoice: closedInvoiceValue,
      total_invoice: Number(totalExp._sum.value || 0) - Number(totalInc._sum.value || 0),
    };
  }

  async addIncoming(id: number, userId: number, amount: number) {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }
    
    await this.findOne(id, userId);

    return this.prisma.wallet.update({
      where: { id },
      data: {
        actual_cash: {
          increment: amount,
        },
      },
    });
  }

  async addExpense(id: number, userId: number, amount: number) {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    // Use raw findOne to avoid recursion/overhead in internal call, 
    // but check balance logic manually if needed.
    // Actually, simply using prisma.wallet.findUnique is enough as validation is simple.
    const wallet = await this.prisma.wallet.findUnique({ where: { id } });
    if (!wallet || wallet.user_id !== userId) throw new NotFoundException(`Wallet #${id} not found`);

    const currentBalance = new Decimal(wallet.actual_cash);
    const expenseAmount = new Decimal(amount);

    if (currentBalance.lessThan(expenseAmount)) {
      throw new BadRequestException('Insufficient funds in wallet');
    }

    return this.prisma.wallet.update({
      where: { id },
      data: {
        actual_cash: {
          decrement: amount,
        },
      },
    });
  }

  async update(id: number, userId: number, updateWalletDto: UpdateWalletDto) {
    await this.findOne(id, userId);
    return this.prisma.wallet.update({
      where: { id },
      data: updateWalletDto as any,
    });
  }

  async remove(id: number, userId: number) {
    await this.findOne(id, userId);
    return this.prisma.wallet.delete({ where: { id } });
  }
}
