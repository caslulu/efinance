import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BudgetsService } from '../budgets/budgets.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly budgetsService: BudgetsService
  ) {}

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
        payment_method: { not: 'TRANSFER' },
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
        payment_method: { not: 'TRANSFER' },
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
        isProjected: i > 0 || (i === 0 && d > today)
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

    // 3. Upcoming Transactions (Next 7 days)
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(today.getDate() + 7);

    const upcomingTransactions = await this.prisma.transaction.findMany({
      where: {
        wallet: { user_id: userId },
        transaction_date: {
          gte: today,
          lte: sevenDaysFromNow,
        },
      },
      include: { 
        TransactionCategory: true,
        wallet: true
      },
      orderBy: { transaction_date: 'asc' },
      take: 5,
    });

    // 4. Recent Transactions
    const recentTransactions = await this.prisma.transaction.findMany({
      where: {
        wallet: { user_id: userId },
        transaction_date: { lte: new Date() }
      },
      include: { 
        TransactionCategory: true,
        wallet: true
      },
      orderBy: { transaction_date: 'desc' },
      take: 5,
    });

    // 5. Recurring Payments KPI
    const activeSubscriptions = await this.prisma.subscription.aggregate({
      where: {
        user_id: userId,
        status: 'ACTIVE',
      },
      _sum: { value: true },
    });

    // 6. Totals, Savings Rate & Net Worth
    const [totalWallets, totalInvestments, totalExpensesMonth, totalIncomesMonth] = await Promise.all([
      this.prisma.wallet.aggregate({
        where: { user_id: userId },
        _sum: { actual_cash: true },
      }),
      this.prisma.investment.aggregate({
        where: { wallet: { user_id: userId } },
        _sum: { current_amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: {
          wallet: { user_id: userId },
          transaction_type: 'EXPENSE',
          payment_method: { not: 'TRANSFER' },
          transaction_date: { gte: oneMonthAgo, lte: new Date() },
        },
        _sum: { value: true },
      }),
      this.prisma.transaction.aggregate({
        where: {
          wallet: { user_id: userId },
          transaction_type: 'INCOME',
          payment_method: { not: 'TRANSFER' },
          transaction_date: { gte: oneMonthAgo, lte: new Date() },
        },
        _sum: { value: true },
      }),
    ]);

    const income = Number(totalIncomesMonth._sum.value || 0);
    const expense = Number(totalExpensesMonth._sum.value || 0);
    const savingsRate = income > 0 ? ((income - expense) / income) * 100 : 0;
    
    const cash = Number(totalWallets._sum.actual_cash || 0);
    const invested = Number(totalInvestments._sum.current_amount || 0);

    const budgetSummary = await this.budgetsService.getBudgetStatus(userId);

    return {
      totalBalance: cash,
      totalInvested: invested,
      netWorth: cash + invested,
      monthlyExpenses: expense,
      monthlyIncomes: income,
      savingsRate: Number(savingsRate.toFixed(1)),
      recurringMonthly: Number(activeSubscriptions._sum.value || 0),
      expensesByCategory,
      monthFlow,
      upcomingTransactions,
      recentTransactions,
      budgetSummary
    };
  }

  async getCategoryTransactions(userId: number, categoryName: string) {
    const today = new Date();
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(today.getMonth() - 1);

    console.log(`[DashboardService] Fetching transactions for User: ${userId}, Category: "${categoryName}"`);

    const txs = await this.prisma.transaction.findMany({
      where: {
        wallet: { user_id: userId },
        TransactionCategory: { 
          name: {
            equals: categoryName,
            mode: 'insensitive'
          }
        },
        transaction_type: 'EXPENSE',
        transaction_date: { gte: oneMonthAgo, lte: today }
      },
      include: {
        wallet: { select: { name: true } },
        TransactionCategory: true
      },
      orderBy: { transaction_date: 'desc' },
      take: 20
    });

    console.log(`[DashboardService] Found ${txs.length} transactions for "${categoryName}"`);
    return txs;
  }
}
