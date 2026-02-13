import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(userId: number) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(today.getMonth() - 1);

    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(today.getMonth() - 12);
    twelveMonthsAgo.setDate(1);
    twelveMonthsAgo.setHours(0, 0, 0, 0);

    const oneYearFuture = new Date();
    oneYearFuture.setFullYear(today.getFullYear() + 1);

    // 1. Last Month Expenses by Category
    const lastMonthTransactions = await this.prisma.transaction.findMany({
      where: {
        wallet: { user_id: userId },
        transaction_type: 'EXPENSE',
        transaction_date: {
          gte: oneMonthAgo,
          lte: new Date(),
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

    // 2. 24-Month Invoice/Expense Flow (Past 12 + Future 12)
    const allTransactions24m = await this.prisma.transaction.findMany({
      where: {
        wallet: { user_id: userId },
        transaction_type: 'EXPENSE',
        transaction_date: {
          gte: twelveMonthsAgo,
          lte: oneYearFuture,
        },
      },
    });

    const flowMap = new Map<string, { name: string; value: number; isProjected: boolean }>();
    
    // Initialize 24 months
    for (let i = -11; i <= 12; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const monthLabel = d.toLocaleString('pt-BR', { month: 'short', year: '2-digit' });
      flowMap.set(monthLabel, { 
        name: monthLabel, 
        value: 0, 
        isProjected: i > 0 || (i === 0 && d > today) // Simplistic projection check
      });
    }

    allTransactions24m.forEach((t) => {
      const monthLabel = t.transaction_date.toLocaleString('pt-BR', { month: 'short', year: '2-digit' });
      const current = flowMap.get(monthLabel);
      if (current) {
        current.value += Number(t.value);
      }
    });

    const monthFlow = Array.from(flowMap.values());

    // 3. Recurring Payments KPI
    const activeSubscriptions = await this.prisma.subscription.aggregate({
      where: {
        user_id: userId,
        status: 'ACTIVE',
      },
      _sum: { value: true },
    });

    // 4. Totals & Savings Rate
    const [totalWallets, totalExpensesMonth, totalIncomesMonth] = await Promise.all([
      this.prisma.wallet.aggregate({
        where: { user_id: userId },
        _sum: { actual_cash: true },
      }),
      this.prisma.transaction.aggregate({
        where: {
          wallet: { user_id: userId },
          transaction_type: 'EXPENSE',
          transaction_date: { gte: oneMonthAgo, lte: new Date() },
        },
        _sum: { value: true },
      }),
      this.prisma.transaction.aggregate({
        where: {
          wallet: { user_id: userId },
          transaction_type: 'INCOME',
          transaction_date: { gte: oneMonthAgo, lte: new Date() },
        },
        _sum: { value: true },
      }),
    ]);

    const income = Number(totalIncomesMonth._sum.value || 0);
    const expense = Number(totalExpensesMonth._sum.value || 0);
    const savingsRate = income > 0 ? ((income - expense) / income) * 100 : 0;

    return {
      totalBalance: Number(totalWallets._sum.actual_cash || 0),
      monthlyExpenses: expense,
      monthlyIncomes: income,
      savingsRate: Number(savingsRate.toFixed(1)),
      recurringMonthly: Number(activeSubscriptions._sum.value || 0),
      expensesByCategory,
      monthFlow,
    };
  }
}
