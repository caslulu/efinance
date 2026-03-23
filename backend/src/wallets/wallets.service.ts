import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { UpdateWalletDto } from './dto/update-wallet.dto';
import { PrismaService } from '../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { InvestmentPortfolioService } from '../investments/investment-portfolio.service';

@Injectable()
export class WalletsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly investmentPortfolioService: InvestmentPortfolioService,
  ) { }

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
      orderBy: { order: 'asc' },
      include: { cards: true },
    });

    return this.enrichWalletsWithInvestmentMetrics(userId, wallets);
  }

  async findOne(id: number, userId: number) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id },
      include: { cards: true },
    });

    if (!wallet || wallet.user_id !== userId) {
      throw new NotFoundException(`Wallet #${id} not found`);
    }

    const [enrichedWallet] = await this.enrichWalletsWithInvestmentMetrics(userId, [wallet]);
    return enrichedWallet;
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

  async reorder(userId: number, wallets: { id: number; order: number }[]) {
    if (!Array.isArray(wallets)) {
      throw new BadRequestException('Body must be an array of { id, order }');
    }

    const walletIds = wallets.map((w) => w.id);
    const existingWallets = await this.prisma.wallet.findMany({
      where: {
        id: { in: walletIds },
        user_id: userId,
      },
    });

    if (existingWallets.length !== walletIds.length) {
      throw new BadRequestException('Um ou mais wallets não encontrados ou não pertencem ao usuário.');
    }

    await this.prisma.$transaction(
      wallets.map((w) =>
        this.prisma.wallet.update({
          where: { id: w.id },
          data: { order: w.order },
        })
      )
    );

    return { message: 'Wallets reordenados com sucesso' };
  }

  private async enrichWalletsWithInvestmentMetrics<T extends {
    id: number;
    type: string;
    actual_cash: Decimal;
  }>(userId: number, wallets: T[]): Promise<Array<T & {
    portfolioValue?: number;
    availableCash?: number;
    positionsCount?: number;
    displayValue?: number;
  }>> {
    if (!wallets.some((wallet) => wallet.type === 'INVESTMENT')) {
      return wallets;
    }

    const walletSummaries = await this.investmentPortfolioService.getWalletDisplaySummaries(userId);

    return wallets.map((wallet) => {
      if (wallet.type !== 'INVESTMENT') {
        return wallet;
      }

      const summary = walletSummaries.get(wallet.id);

      return {
        ...wallet,
        portfolioValue: summary?.portfolioValue ?? 0,
        availableCash: summary?.availableCash ?? Number(wallet.actual_cash),
        positionsCount: summary?.positionsCount ?? 0,
        displayValue: summary?.displayValue ?? 0,
      };
    });
  }
}
