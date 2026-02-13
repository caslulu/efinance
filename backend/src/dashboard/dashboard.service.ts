import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(userId: number) {
    const today = new Date();
    const lastMonth = new Date();
    lastMonth.setMonth(today.getMonth() - 1);

    const nextYear = new Date();
    nextYear.setFullYear(today.getFullYear() + 1);

    // 1. Last Month Expenses by Category
    const lastMonthTransactions = await this.prisma.transaction.findMany({
      where: {
        wallet: { user_id: userId },
        transaction_type: 'EXPENSE',
        transaction_date: {
          gte: lastMonth,
          lte: today,
        },
      },
      include: { TransactionCategory: true },
    });

    const categoriesMap = new Map<string, number>();
    lastMonthTransactions.forEach((t) => {
      const catName = t.TransactionCategory?.name || 'Outro';
      const current = categoriesMap.get(catName) || 0;
      categoriesMap.set(catName, current + Number(t.value));
    });

    const expensesByCategory = Array.from(categoriesMap.entries()).map(([name, value]) => ({
      name,
      value: Number(value.toFixed(2)),
    }));

    // 2. Future Expenses (Next 12 Months)
    const futureTransactions = await this.prisma.transaction.findMany({
      where: {
        wallet: { user_id: userId },
        transaction_type: 'EXPENSE',
        transaction_date: {
          gt: today,
          lte: nextYear,
        },
      },
    });

    const futureMap = new Map<string, number>();
    // Initialize next 12 months
    for (let i = 1; i <= 12; i++) {
      const d = new Date();
      d.setMonth(today.getMonth() + i);
      const monthLabel = d.toLocaleString('pt-BR', { month: 'short', year: '2-digit' });
      futureMap.set(monthLabel, 0);
    }

    futureTransactions.forEach((t) => {
      const monthLabel = t.transaction_date.toLocaleString('pt-BR', { month: 'short', year: '2-digit' });
      if (futureMap.has(monthLabel)) {
        futureMap.set(monthLabel, (futureMap.get(monthLabel) || 0) + Number(t.value));
      }
    });

    const futureExpenses = Array.from(futureMap.entries()).map(([name, value]) => ({
      name,
      value: Number(value.toFixed(2)),
    }));

    // 3. Totals
    const [totalWallets, totalExpensesMonth, totalIncomesMonth] = await Promise.all([
      this.prisma.wallet.aggregate({
        where: { user_id: userId },
        _sum: { actual_cash: true },
      }),
      this.prisma.transaction.aggregate({
        where: {
          wallet: { user_id: userId },
          transaction_type: 'EXPENSE',
          transaction_date: { gte: lastMonth, lte: today },
        },
        _sum: { value: true },
      }),
      this.prisma.transaction.aggregate({
        where: {
          wallet: { user_id: userId },
          transaction_type: 'INCOME',
          transaction_date: { gte: lastMonth, lte: today },
        },
        _sum: { value: true },
      }),
    ]);

    return {
      totalBalance: Number(totalWallets._sum.actual_cash || 0),
      monthlyExpenses: Number(totalExpensesMonth._sum.value || 0),
      monthlyIncomes: Number(totalIncomesMonth._sum.value || 0),
      expensesByCategory,
      futureExpenses,
    };
  }
}
