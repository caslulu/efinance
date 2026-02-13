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
    // Best Day to Buy: If today is closingDay, it should already belong to the NEXT cycle.
    let openCloseDate = new Date(today.getFullYear(), today.getMonth(), closingDay);
    if (currentDay >= closingDay) {
      openCloseDate = new Date(today.getFullYear(), today.getMonth() + 1, closingDay);
    }
    openCloseDate.setHours(23, 59, 59, 999);

    const openStartDate = new Date(openCloseDate);
    openStartDate.setMonth(openStartDate.getMonth() - 1);
    // openStartDate is the same day as closingDay, but one month before.
    // e.g. if openCloseDate is March 10, openStartDate is Feb 10.
    // Transactions from Feb 10 00:00 to March 10 23:59 go to March invoice.
    openStartDate.setHours(0, 0, 0, 0);

    // 2. Determine "Closed" (Due) Cycle
    const closedCloseDate = new Date(openStartDate);
    closedCloseDate.setMilliseconds(-1); // One millisecond before openStartDate

    const closedStartDate = new Date(closedCloseDate);
    closedStartDate.setMonth(closedStartDate.getMonth() - 1);
    closedStartDate.setMilliseconds(1);
    closedStartDate.setHours(0, 0, 0, 0);

    // 3. Get totals to calculate due and current invoices correctly
    const [
      allPastExpenses,
      allIncomes,
      currentExpenses,
      totalExp,
      totalInc
    ] = await Promise.all([
      // Sum of ALL expenses up to the end of the closed cycle
      this.prisma.transaction.aggregate({
        where: {
          wallet_id: wallet.id,
          transaction_type: 'EXPENSE',
          payment_method: 'CREDIT',
          transaction_date: { lte: closedCloseDate },
        },
        _sum: { value: true },
      }),
      // Sum of ALL incomes (payments) to this day
      this.prisma.transaction.aggregate({
        where: {
          wallet_id: wallet.id,
          transaction_type: 'INCOME',
          payment_method: 'CREDIT',
        },
        _sum: { value: true },
      }),
      // Sum of expenses in the current open cycle
      this.prisma.transaction.aggregate({
        where: {
          wallet_id: wallet.id,
          transaction_type: 'EXPENSE',
          payment_method: 'CREDIT',
          transaction_date: { gte: openStartDate, lte: openCloseDate },
        },
        _sum: { value: true },
      }),
      // For total balance
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

    const pastExp = Number(allPastExpenses._sum.value || 0);
    const incomes = Number(allIncomes._sum.value || 0);
    const currExp = Number(currentExpenses._sum.value || 0);

    // due_invoice: What was owed from past cycles minus what was paid in total
    const dueInvoiceValue = Math.max(0, pastExp - incomes);
    
    // remainingIncomes: What's left of payments after covering past cycles
    const remainingIncomes = Math.max(0, incomes - pastExp);

    // current_invoice: Current cycle expenses minus remaining payments
    const currentInvoiceValue = Math.max(0, currExp - remainingIncomes);

    return {
      ...wallet,
      current_invoice: currentInvoiceValue,
      due_invoice: dueInvoiceValue,
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

  async transfer(userId: number, fromId: number, toId: number, amount: number) {
    if (amount <= 0) throw new BadRequestException('Amount must be positive');
    if (fromId === toId) throw new BadRequestException('Source and destination wallets must be different');

    const [fromWallet, toWallet] = await Promise.all([
      this.prisma.wallet.findUnique({ where: { id: fromId } }),
      this.prisma.wallet.findUnique({ where: { id: toId } }),
    ]);

    if (!fromWallet || fromWallet.user_id !== userId) throw new NotFoundException(`Source wallet #${fromId} not found`);
    if (!toWallet || toWallet.user_id !== userId) throw new NotFoundException(`Destination wallet #${toId} not found`);

    if (new Decimal(fromWallet.actual_cash).lessThan(new Decimal(amount))) {
      throw new BadRequestException('Insufficient funds in source wallet');
    }

    // Default Category for Transfers
    let transferCategory = await this.prisma.transactionCategory.findFirst({
      where: { user_id: userId, name: 'Transferência' }
    });

    if (!transferCategory) {
      transferCategory = await this.prisma.transactionCategory.create({
        data: { name: 'Transferência', user_id: userId }
      });
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Update Balances
      await tx.wallet.update({
        where: { id: fromId },
        data: { actual_cash: { decrement: amount } }
      });

      await tx.wallet.update({
        where: { id: toId },
        data: { actual_cash: { increment: amount } }
      });

      // 2. Create Transactions
      const description = `Transferência de ${fromWallet.name} para ${toWallet.name}`;
      
      await tx.transaction.create({
        data: {
          wallet_id: fromId,
          value: amount,
          transaction_type: 'EXPENSE',
          description,
          category_id: transferCategory.id,
          payment_method: 'TRANSFER',
          transaction_date: new Date(),
          is_recurring: false,
        }
      });

      await tx.transaction.create({
        data: {
          wallet_id: toId,
          value: amount,
          transaction_type: 'INCOME',
          description,
          category_id: transferCategory.id,
          payment_method: 'TRANSFER',
          transaction_date: new Date(),
          is_recurring: false,
        }
      });

      return { message: 'Transfer completed successfully' };
    });
  }
}
