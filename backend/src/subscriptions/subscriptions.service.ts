import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionsService } from '../transactions/transactions.service';
import { Frequency, SubscriptionStatus } from '@prisma/client';

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

  /**
   * Safely advance a date by N months, clamping to the last valid day.
   * E.g. Jan 31 + 1 month → Feb 28 (not Mar 3).
   */
  private addMonthsSafe(date: Date, months: number): Date {
    const result = new Date(date);
    const targetDay = result.getDate();
    result.setMonth(result.getMonth() + months);
    // If the day shifted (e.g. 31 → 3 because month has fewer days), clamp
    if (result.getDate() !== targetDay) {
      result.setDate(0); // Go back to last day of previous month
    }
    return result;
  }

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

    await this.triggerCheck();

    return sub;
  }

  async triggerCheck() {
    const today = new Date();

    const dueSubscriptions = await this.prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        next_billing_date: {
          lte: today,
        },
      },
    });

    const results: string[] = [];

    for (const sub of dueSubscriptions as SubscriptionBillingRecord[]) {
      await this.transactionsService.create(sub.user_id, {
        transaction_date: sub.next_billing_date.toISOString(),
        wallet_id: sub.wallet_id,
        category_id: sub.category_id,
        value: Number(sub.value),
        description: sub.description || sub.name,
        transaction_type: sub.transaction_type,
        is_recurring: true,
        subscription_id: sub.id,
        payment_method: sub.payment_method || undefined,
        card_id: sub.card_id || undefined,
      });

      let nextDate: Date;
      switch (sub.frequency) {
        case Frequency.WEEKLY:
          nextDate = new Date(sub.next_billing_date);
          nextDate.setDate(nextDate.getDate() + 7);
          break;
        case Frequency.MONTHLY:
          nextDate = this.addMonthsSafe(sub.next_billing_date, 1);
          break;
        case Frequency.QUARTERLY:
          nextDate = this.addMonthsSafe(sub.next_billing_date, 3);
          break;
        case Frequency.YEARLY:
          nextDate = new Date(sub.next_billing_date);
          nextDate.setFullYear(nextDate.getFullYear() + 1);
          break;
        default:
          nextDate = new Date(sub.next_billing_date);
      }

      await this.prisma.subscription.update({
        where: { id: sub.id },
        data: { next_billing_date: nextDate },
      });

      results.push(`Processed ${sub.name}: New date ${nextDate.toISOString()}`);
    }

    return { processed: dueSubscriptions.length, details: results };
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

  async remove(id: number, userId: number) {
    await this.findOne(id, userId);

    // Delete all associated transactions first
    await this.prisma.transaction.deleteMany({
      where: { subscription_id: id },
    });

    return this.prisma.subscription.delete({ where: { id } });
  }
}
