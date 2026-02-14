import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BudgetsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: number) {
    const budgets = await this.prisma.budget.findMany({
      where: { user_id: userId },
      include: { category: true },
    });
    return budgets.map(b => ({
      ...b,
      limit: Number(b.limit)
    }));
  }

  async upsert(userId: number, categoryId: number, limit: number) {
    const category = await this.prisma.transactionCategory.findUnique({ where: { id: categoryId } });
    if (!category || category.user_id !== userId) throw new NotFoundException('Category not found');

    const budget = await this.prisma.budget.upsert({
      where: {
        user_id_category_id: {
          user_id: userId,
          category_id: categoryId,
        }
      },
      update: { limit },
      create: {
        user_id: userId,
        category_id: categoryId,
        limit,
      },
      include: { category: true }
    });
    return { ...budget, limit: Number(budget.limit) };
  }

  async remove(userId: number, id: number) {
    const budget = await this.prisma.budget.findUnique({ where: { id } });
    if (!budget || budget.user_id !== userId) throw new NotFoundException('Budget not found');
    
    return this.prisma.budget.delete({ where: { id } });
  }

  async getBudgetStatus(userId: number) {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

    const budgets = await this.findAll(userId);
    
    const status = await Promise.all(budgets.map(async (budget) => {
      const expenses = await this.prisma.transaction.aggregate({
        where: {
          wallet: { user_id: userId },
          category_id: budget.category_id,
          transaction_type: 'EXPENSE',
          transaction_date: {
            gte: startOfMonth,
            lte: endOfMonth,
          }
        },
        _sum: { value: true }
      });

      const spent = Number(expenses._sum.value || 0);
      return {
        id: budget.id,
        category_id: budget.category_id,
        categoryName: budget.category.name,
        limit: budget.limit,
        spent,
        remaining: Math.max(0, budget.limit - spent),
        percentage: budget.limit > 0 ? Number(((spent / budget.limit) * 100).toFixed(1)) : 0
      };
    }));

    return status;
  }
}
