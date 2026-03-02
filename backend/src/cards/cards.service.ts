import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CreateCardDto } from './dto/create-card.dto';
import { UpdateCardDto } from './dto/update-card.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CardsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: number, createCardDto: CreateCardDto) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id: createCardDto.wallet_id },
    });
    if (!wallet || wallet.user_id !== userId) {
      throw new NotFoundException('Wallet not found');
    }

    return this.prisma.card.create({
      data: {
        wallet_id: createCardDto.wallet_id,
        name: createCardDto.name,
        flag: createCardDto.flag,
        closing_day: createCardDto.closing_day,
        due_day: createCardDto.due_day,
        card_limit: createCardDto.card_limit,
      },
    });
  }

  async findAllByWallet(walletId: number, userId: number) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id: walletId },
    });
    if (!wallet || wallet.user_id !== userId) {
      throw new NotFoundException('Wallet not found');
    }

    const cards = await this.prisma.card.findMany({
      where: { wallet_id: walletId },
    });

    return Promise.all(cards.map((c) => this.enrichCardWithInvoice(c)));
  }

  async findOne(id: number, userId: number) {
    const card = await this.prisma.card.findUnique({
      where: { id },
      include: { wallet: true },
    });
    if (!card || card.wallet.user_id !== userId) {
      throw new NotFoundException(`Card #${id} not found`);
    }
    return this.enrichCardWithInvoice(card);
  }

  async update(id: number, userId: number, updateCardDto: UpdateCardDto) {
    const card = await this.prisma.card.findUnique({
      where: { id },
      include: { wallet: true },
    });
    if (!card || card.wallet.user_id !== userId) {
      throw new NotFoundException(`Card #${id} not found`);
    }

    // If changing wallet, verify ownership
    if (updateCardDto.wallet_id && updateCardDto.wallet_id !== card.wallet_id) {
      const newWallet = await this.prisma.wallet.findUnique({
        where: { id: updateCardDto.wallet_id },
      });
      if (!newWallet || newWallet.user_id !== userId) {
        throw new ForbiddenException('Target wallet not found');
      }
    }

    return this.prisma.card.update({
      where: { id },
      data: updateCardDto as any,
    });
  }

  async remove(id: number, userId: number) {
    const card = await this.prisma.card.findUnique({
      where: { id },
      include: { wallet: true },
    });
    if (!card || card.wallet.user_id !== userId) {
      throw new NotFoundException(`Card #${id} not found`);
    }

    return this.prisma.card.delete({ where: { id } });
  }

  /**
   * Computes the current and due invoices for a card based on its closing_day,
   * as well as the used limit (total unpaid credit expenses).
   */
  private async enrichCardWithInvoice(card: any) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentDay = today.getDate();
    const closingDay = card.closing_day;

    // 1. Open (Accumulating) Cycle
    let openCloseDate = new Date(today.getFullYear(), today.getMonth(), closingDay);
    if (currentDay >= closingDay) {
      openCloseDate = new Date(today.getFullYear(), today.getMonth() + 1, closingDay);
    }
    openCloseDate.setHours(23, 59, 59, 999);

    const openStartDate = new Date(openCloseDate);
    openStartDate.setMonth(openStartDate.getMonth() - 1);
    openStartDate.setHours(0, 0, 0, 0);

    // 2. Closed (Due) Cycle
    const closedCloseDate = new Date(openStartDate);
    closedCloseDate.setMilliseconds(-1);

    // 3. Aggregation queries
    const [allPastExpenses, allIncomes, currentExpenses, totalExp, totalInc] =
      await Promise.all([
        this.prisma.transaction.aggregate({
          where: {
            card_id: card.id,
            transaction_type: 'EXPENSE',
            payment_method: 'CREDIT',
            transaction_date: { lte: closedCloseDate },
          },
          _sum: { value: true },
        }),
        this.prisma.transaction.aggregate({
          where: {
            card_id: card.id,
            transaction_type: 'INCOME',
            payment_method: 'CREDIT',
          },
          _sum: { value: true },
        }),
        this.prisma.transaction.aggregate({
          where: {
            card_id: card.id,
            transaction_type: 'EXPENSE',
            payment_method: 'CREDIT',
            transaction_date: { gte: openStartDate, lte: openCloseDate },
          },
          _sum: { value: true },
        }),
        this.prisma.transaction.aggregate({
          where: { card_id: card.id, transaction_type: 'EXPENSE', payment_method: 'CREDIT' },
          _sum: { value: true },
        }),
        this.prisma.transaction.aggregate({
          where: { card_id: card.id, transaction_type: 'INCOME', payment_method: 'CREDIT' },
          _sum: { value: true },
        }),
      ]);

    const pastExp = Number(allPastExpenses._sum.value || 0);
    const incomes = Number(allIncomes._sum.value || 0);
    const currExp = Number(currentExpenses._sum.value || 0);

    const dueInvoiceValue = Math.max(0, pastExp - incomes);
    const remainingIncomes = Math.max(0, incomes - pastExp);
    const currentInvoiceValue = Math.max(0, currExp - remainingIncomes);

    const totalInvoice = Number(totalExp._sum.value || 0) - Number(totalInc._sum.value || 0);
    const availableLimit = Number(card.card_limit) - Math.max(0, totalInvoice);

    // Remove wallet relation if it was included
    const { wallet, ...cardData } = card;

    return {
      ...cardData,
      current_invoice: currentInvoiceValue,
      due_invoice: dueInvoiceValue,
      total_invoice: totalInvoice,
      available_limit: Math.max(0, availableLimit),
    };
  }
}
