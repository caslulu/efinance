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
    const currentDay = today.getDate();
    const closingDay = wallet.closing_day;

    let invoiceCloseDate = new Date(today.getFullYear(), today.getMonth(), closingDay);
    // Set time to end of day to be inclusive
    invoiceCloseDate.setHours(23, 59, 59, 999);

    // If today is past the closing day, the current open invoice closes next month
    if (currentDay > closingDay) {
      invoiceCloseDate = new Date(today.getFullYear(), today.getMonth() + 1, closingDay);
      invoiceCloseDate.setHours(23, 59, 59, 999);
    }

    // Start date is 1 month prior to close date, plus 1 day (conceptually)
    // Actually simpler: The previous close date was 1 month before invoiceCloseDate.
    // So current cycle starts the day AFTER that.
    const previousCloseDate = new Date(invoiceCloseDate);
    previousCloseDate.setMonth(previousCloseDate.getMonth() - 1);
    // previousCloseDate is the closing day of last month.
    // Cycle starts on previousCloseDate + 1 day? 
    // Usually: Close 10. Cycle: 11th prev month -> 10th curr month.
    const cycleStartDate = new Date(previousCloseDate);
    cycleStartDate.setDate(previousCloseDate.getDate() + 1);
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
      // Total Invoice: Transactions from start of current cycle onwards (Current + Future)
      this.prisma.transaction.aggregate({
        where: {
          wallet_id: wallet.id,
          transaction_type: 'EXPENSE',
          payment_method: 'CREDIT',
          transaction_date: {
            gte: cycleStartDate,
          },
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
