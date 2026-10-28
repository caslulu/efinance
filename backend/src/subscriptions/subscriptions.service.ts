import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionsService } from '../transactions/transactions.service';
import { Frequency, SubscriptionStatus } from '@prisma/client';
import { addMonthsSafe } from '../common/finance-date';

type SubscriptionBillingRecord = {
  id: number;
  user_id: number;
  wallet_id: number;
  category_id: number;
  name: string;
  description: string | null;
  value: { toNumber?: () => number } | number;
  transaction_type: string;
  frequency: Frequency;
  status: SubscriptionStatus;
  start_date: Date;
  next_billing_date: Date;
  payment_method: string | null;
  card_id?: number | null;
};

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionsService: TransactionsService,
  ) {}

  async create(userId: number, createSubscriptionDto: CreateSubscriptionDto) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id: createSubscriptionDto.wallet_id },
    });
    if (!wallet || wallet.user_id !== userId)
      throw new NotFoundException('Wallet not found');

    const category = await this.prisma.transactionCategory.findUnique({
      where: { id: createSubscriptionDto.category_id },
    });
    if (!category || category.user_id !== userId)
      throw new NotFoundException('Category not found');

    if (createSubscriptionDto.card_id) {
      const card = await this.prisma.card.findUnique({
        where: { id: createSubscriptionDto.card_id },
      });
      if (!card || card.wallet_id !== createSubscriptionDto.wallet_id)
        throw new NotFoundException('Card not found');
    }

    const nextDate = new Date(createSubscriptionDto.start_date);

    const sub = await this.prisma.subscription.create({
      data: {
        ...createSubscriptionDto,
        user_id: userId,
        frequency: createSubscriptionDto.frequency as Frequency,
        status: SubscriptionStatus.ACTIVE,
        next_billing_date: nextDate,
        payment_method: createSubscriptionDto.payment_method,
      },
    });

    await this.triggerCheck(userId, sub.id);

    return sub;
  }

  /**
   * Returns the next billing date according to the subscription frequency.
   */
  private advanceBillingDate(from: Date, frequency: Frequency): Date {
    switch (frequency) {
      case Frequency.WEEKLY: {
        const next = new Date(from);
        next.setDate(next.getDate() + 7);
        return next;
      }
      case Frequency.MONTHLY:
        return addMonthsSafe(from, 1);
      case Frequency.QUARTERLY:
        return addMonthsSafe(from, 3);
      case Frequency.YEARLY: {
        const next = new Date(from);
        next.setFullYear(next.getFullYear() + 1);
        return next;
      }
      default:
        return new Date(from);
    }
  }

  async triggerCheck(userId?: number, subscriptionId?: number) {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const dueSubscriptions = await this.prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        next_billing_date: { lte: today },
        ...(userId !== undefined ? { user_id: userId } : {}),
        ...(subscriptionId !== undefined ? { id: subscriptionId } : {}),
      },
    });

    const details: string[] = [];
    let processedCycles = 0;

    for (const sub of dueSubscriptions as SubscriptionBillingRecord[]) {
      let currentDate = new Date(sub.next_billing_date);

      // Generate one transaction per overdue cycle, each one dated on the
      // cycle it represents (NOT on the day the cron runs). Loop stops when
      // the next scheduled date is past today.
      while (currentDate <= today) {
        const cycleDate = currentDate;
        const nextDate = this.advanceBillingDate(cycleDate, sub.frequency);
        const claimed = await this.prisma.$transaction(async (tx) => {
          const claim = await tx.subscription.updateMany({
            where: {
              id: sub.id,
              status: SubscriptionStatus.ACTIVE,
              next_billing_date: cycleDate,
            },
            data: { next_billing_date: nextDate },
          });
          if (claim.count === 0) return false;

          // Cycles can be materialized ahead of time (for example, a 12-month
          // forecast imported from a statement). The cycle was already claimed
          // above, so advancing the next billing date is enough; creating
          // another transaction here would duplicate the forecast.
          const alreadyMaterialized = await tx.transaction.findFirst({
            where: {
              subscription_id: sub.id,
              transaction_date: cycleDate,
            },
            select: { id: true },
          });
          if (alreadyMaterialized) return false;

          await this.transactionsService.create(
            sub.user_id,
            {
              transaction_date: cycleDate.toISOString(),
              wallet_id: sub.wallet_id,
              category_id: sub.category_id,
              value: Number(sub.value),
              description: sub.description || sub.name,
              transaction_type: sub.transaction_type,
              is_recurring: true,
              subscription_id: sub.id,
              payment_method: sub.payment_method || undefined,
              card_id: sub.card_id || undefined,
            },
            tx,
          );
          return true;
        });

        if (claimed) {
          processedCycles++;
          details.push(
            `Generated "${sub.name}" for ${cycleDate.toISOString().slice(0, 10)}`,
          );
        }
        currentDate = nextDate;
      }
    }

    return { processed: processedCycles, details };
  }

  findAll(userId: number) {
    return this.prisma.subscription.findMany({
      where: { user_id: userId },
      include: { category: true },
    });
  }

  async findOne(id: number, userId: number) {
    const sub = await this.prisma.subscription.findUnique({ where: { id } });
    if (!sub || sub.user_id !== userId)
      throw new NotFoundException('Subscription not found');
    return sub;
  }

  async update(
    id: number,
    userId: number,
    updateSubscriptionDto: UpdateSubscriptionDto,
  ) {
    await this.findOne(id, userId);
    return this.prisma.subscription.update({
      where: { id },
      data: updateSubscriptionDto as any,
    });
  }

  async pause(id: number, userId: number) {
    await this.findOne(id, userId);
    return this.prisma.subscription.update({
      where: { id },
      data: { status: SubscriptionStatus.PAUSED },
    });
  }

  async resume(id: number, userId: number) {
    await this.findOne(id, userId);
    return this.prisma.subscription.update({
      where: { id },
      data: { status: SubscriptionStatus.ACTIVE },
    });
  }

  async remove(id: number, userId: number) {
    await this.findOne(id, userId);

    // Each linked transaction must be deleted through TransactionsService.remove
    // so the wallet balance is reverted. A raw deleteMany would leave the
    // wallet's actual_cash out of sync with the deleted transactions.
    const linkedTransactions = await this.prisma.transaction.findMany({
      where: { subscription_id: id },
      select: { id: true },
    });

    for (const tx of linkedTransactions) {
      await this.transactionsService.remove(tx.id, userId);
    }

    return this.prisma.subscription.delete({ where: { id } });
  }
}
