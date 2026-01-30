import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionsService } from '../transactions/transactions.service';
import { Frequency, SubscriptionStatus } from '@prisma/client';

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionsService: TransactionsService,
  ) {}

  async create(userId: number, createSubscriptionDto: CreateSubscriptionDto) {
    const nextDate = new Date(createSubscriptionDto.start_date);
    
    return this.prisma.subscription.create({
      data: {
        ...createSubscriptionDto,
        user_id: userId,
        frequency: createSubscriptionDto.frequency as Frequency,
        status: SubscriptionStatus.ACTIVE,
        next_billing_date: nextDate,
      },
    });
  }

  async triggerCheck() {
    const today = new Date();
    
    // Find all ACTIVE subscriptions due today or in the past
    const dueSubscriptions = await this.prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        next_billing_date: {
          lte: today,
        },
      },
    });

    const results = [];

    for (const sub of dueSubscriptions) {
      // 1. Create Transaction
      await this.transactionsService.create(sub.user_id, {
        transaction_date: sub.next_billing_date.toISOString(),
        wallet_id: sub.wallet_id,
        category_id: sub.category_id,
        transaction_type: 'EXPENSE', // Subscriptions are expenses
        value: Number(sub.value),
        is_recurring: true,
      });

      // 2. Calculate Next Date
      const nextDate = new Date(sub.next_billing_date);
      switch (sub.frequency) {
        case Frequency.WEEKLY:
          nextDate.setDate(nextDate.getDate() + 7);
          break;
        case Frequency.MONTHLY:
          nextDate.setMonth(nextDate.getMonth() + 1);
          break;
        case Frequency.QUARTERLY:
          nextDate.setMonth(nextDate.getMonth() + 3);
          break;
        case Frequency.YEARLY:
          nextDate.setFullYear(nextDate.getFullYear() + 1);
          break;
      }

      // 3. Update Subscription
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
    });
  }

  async findOne(id: number, userId: number) {
    const sub = await this.prisma.subscription.findUnique({ where: { id } });
    if (!sub || sub.user_id !== userId) throw new NotFoundException('Subscription not found');
    return sub;
  }

  async update(id: number, userId: number, updateSubscriptionDto: UpdateSubscriptionDto) {
    await this.findOne(id, userId);
    return this.prisma.subscription.update({
      where: { id },
      data: updateSubscriptionDto,
    });
  }

  async remove(id: number, userId: number) {
    await this.findOne(id, userId);
    return this.prisma.subscription.delete({ where: { id } });
  }
}
