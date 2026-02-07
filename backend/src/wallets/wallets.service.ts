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
      return { ...wallet, current_invoice: 0, total_invoice: 0 };
    }

    const today = new Date();
    // Normalize today to start of day for comparison clarity
    today.setHours(0, 0, 0, 0);
    
    const currentDay = today.getDate();
    const closingDay = wallet.closing_day;
    const dueDay = wallet.due_day;

    // 1. Determine the "Open" cycle close date (Candidate)
    let candidateCloseDate = new Date(today.getFullYear(), today.getMonth(), closingDay);
    if (currentDay > closingDay) {
      candidateCloseDate = new Date(today.getFullYear(), today.getMonth() + 1, closingDay);
    }
    candidateCloseDate.setHours(23, 59, 59, 999);

    let invoiceCloseDate = candidateCloseDate;

    // 2. Check if we are in the "Payment Window" of the previous closed invoice
    if (dueDay) {
      const previousCloseDate = new Date(candidateCloseDate);
      previousCloseDate.setMonth(previousCloseDate.getMonth() - 1);
      // Ensure day is correct (handle month length edge cases automatically by Date, but closingDay is preferred)
      // Actually, since we constructed candidate from closingDay, shifting month is usually safe, 
      // but simpler to reconstruct:
      // previousCloseDate is the Close Date strictly prior to candidate.
      
      let dueDateForPrevious = new Date(previousCloseDate);
      // Set to dueDay
      // If dueDay > closingDay -> Same Month as Close Date
      // If dueDay <= closingDay -> Next Month after Close Date
      if (dueDay > closingDay) {
        dueDateForPrevious.setDate(dueDay);
      } else {
        dueDateForPrevious.setMonth(dueDateForPrevious.getMonth() + 1);
        dueDateForPrevious.setDate(dueDay);
      }
      dueDateForPrevious.setHours(23, 59, 59, 999);

      // Check if Today is within the window (After Prev Close but Before/On Due Date)
      // Since candidate is the *next* close, today is by definition <= candidate.
      // We just need to check if today <= dueDateForPrevious
      if (today <= dueDateForPrevious) {
        invoiceCloseDate = previousCloseDate;
      }
    }

    // 3. Define Cycle Start (1 month before Invoice Close + 1 day)
    const cycleStartDate = new Date(invoiceCloseDate);
    cycleStartDate.setMonth(cycleStartDate.getMonth() - 1);
    cycleStartDate.setDate(cycleStartDate.getDate() + 1);
    cycleStartDate.setHours(0, 0, 0, 0);

    const [currentInvoiceAgg, totalInvoiceAgg] = await Promise.all([
      // Current Invoice: Transactions strictly in the current cycle
      this.prisma.transaction.aggregate({
        where: {
          wallet_id: wallet.id,
          transaction_type: 'EXPENSE',
          payment_method: 'CREDIT',
          transaction_date: {
            gte: cycleStartDate,
            lte: invoiceCloseDate,
          },
        },
        _sum: { value: true },
      }),
      // Total Invoice: Sum of ALL credit transactions (Past + Current + Future)
      this.prisma.transaction.aggregate({
        where: {
          wallet_id: wallet.id,
          transaction_type: 'EXPENSE',
          payment_method: 'CREDIT',
        },
        _sum: { value: true },
      }),
    ]);

    return {
      ...wallet,
      current_invoice: Number(currentInvoiceAgg._sum.value || 0),
      total_invoice: Number(totalInvoiceAgg._sum.value || 0),
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
