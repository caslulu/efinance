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

    for (const sub of dueSubscriptions) {
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
      });

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
    if (!sub || sub.user_id !== userId) throw new NotFoundException('Subscription not found');
    return sub;
  }

  async update(id: number, userId: number, updateSubscriptionDto: UpdateSubscriptionDto) {
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
