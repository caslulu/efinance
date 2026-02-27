import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BudgetsService } from '../budgets/budgets.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly budgetsService: BudgetsService
  ) { }

  async getOverview(userId: number, startDateStr?: string, endDateStr?: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(today.getMonth() - 1);
    oneMonthAgo.setHours(0, 0, 0, 0);

    const periodStart = startDateStr ? new Date(startDateStr) : oneMonthAgo;
    const periodEnd = endDateStr ? new Date(endDateStr) : endOfToday;

    // Ensure period dates have start/end of day
    if (startDateStr) periodStart.setHours(0, 0, 0, 0);
    if (endDateStr) periodEnd.setHours(23, 59, 59, 999);

    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(today.getMonth() - 12);
    twelveMonthsAgo.setDate(1);
    twelveMonthsAgo.setHours(0, 0, 0, 0);

    const oneYearFuture = new Date();
    oneYearFuture.setFullYear(today.getFullYear() + 1);

    const startOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfCurrentMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
    const startOfPreviousMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const endOfPreviousMonth = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);

    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);

    // 1. Period Expenses by Category (Custom Date Range)
    const periodTransactions = await this.prisma.transaction.findMany({
      where: {
        wallet: { user_id: userId },
        transaction_type: 'EXPENSE',
        payment_method: { not: 'TRANSFER' },
        transaction_date: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
      include: { TransactionCategory: true },
    });

    const categoriesMap = new Map<string, { value: number; icon?: string }>();
    periodTransactions.forEach((t) => {
      const catName = t.TransactionCategory?.name || 'Outro';
      const catIcon = t.TransactionCategory?.icon;
      const current = categoriesMap.get(catName) || { value: 0 };
      categoriesMap.set(catName, {
        value: current.value + Number(t.value),
        icon: catIcon,
      });
    });

    const expensesByCategory = Array.from(categoriesMap.entries()).map(([name, data]) => ({
      name,
      value: Number(data.value.toFixed(2)),
      icon: data.icon,
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
      _count: { id: true },
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
          transaction_date: { gte: periodStart, lte: periodEnd },
        },
        _sum: { value: true },
      }),
      this.prisma.transaction.aggregate({
        where: {
          wallet: { user_id: userId },
          transaction_type: 'INCOME',
          payment_method: { not: 'TRANSFER' },
          transaction_date: { gte: periodStart, lte: periodEnd },
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

    const fixedVariableExpenses = await this.prisma.transaction.findMany({
      where: {
        wallet: { user_id: userId },
        transaction_type: 'EXPENSE',
        payment_method: { not: 'TRANSFER' },
        transaction_date: { gte: periodStart, lte: periodEnd },
      },
      select: {
        value: true,
        is_recurring: true,
        subscription_id: true,
      },
    });

    let fixedExpensesMonthly = 0;
    let variableExpensesMonthly = 0;

    fixedVariableExpenses.forEach((transaction) => {
      const amount = Number(transaction.value);
      const isFixed = transaction.is_recurring || !!transaction.subscription_id;

      if (isFixed) {
        fixedExpensesMonthly += amount;
      } else {
        variableExpensesMonthly += amount;
      }
    });

    const totalExpenseBase = fixedExpensesMonthly + variableExpensesMonthly;
    const fixedExpenseRatio = totalExpenseBase > 0 ? (fixedExpensesMonthly / totalExpenseBase) * 100 : 0;
    const variableExpenseRatio = totalExpenseBase > 0 ? (variableExpensesMonthly / totalExpenseBase) * 100 : 0;

    const budgetPlanned = budgetSummary.reduce((acc, item) => acc + Number(item.limit || 0), 0);
    const budgetSpent = budgetSummary.reduce((acc, item) => acc + Number(item.spent || 0), 0);
    const budgetAdherencePercent = budgetPlanned > 0 ? (budgetSpent / budgetPlanned) * 100 : 0;

    const averageDailyExpense = expense / 30;
    const financialAutonomyDays = averageDailyExpense > 0 ? cash / averageDailyExpense : 0;

    const weeklyExpensesAgg = await this.prisma.transaction.aggregate({
      where: {
        wallet: { user_id: userId },
        transaction_type: 'EXPENSE',
        payment_method: { not: 'TRANSFER' },
        transaction_date: { gte: sevenDaysAgo, lte: new Date() },
      },
      _sum: { value: true },
    });

    const weeklyBurnRate = Number(weeklyExpensesAgg._sum.value || 0);

    const expensesForGrowth = await this.prisma.transaction.findMany({
      where: {
        wallet: { user_id: userId },
        transaction_type: 'EXPENSE',
        payment_method: { not: 'TRANSFER' },
        transaction_date: {
          gte: startOfPreviousMonth,
          lte: endOfCurrentMonth,
        },
      },
      include: {
        TransactionCategory: true,
      },
    });

    const categoryGrowthMap = new Map<
      string,
      { name: string; icon?: string; currentMonth: number; previousMonth: number }
    >();

    expensesForGrowth.forEach((transaction) => {
      const categoryName = transaction.TransactionCategory?.name || 'Outro';
      const categoryIcon = transaction.TransactionCategory?.icon;
      const categoryItem = categoryGrowthMap.get(categoryName) || {
        name: categoryName,
        icon: categoryIcon,
        currentMonth: 0,
        previousMonth: 0,
      };

      const date = transaction.transaction_date;
      const value = Number(transaction.value);

      if (date >= startOfCurrentMonth && date <= endOfCurrentMonth) {
        categoryItem.currentMonth += value;
      } else if (date >= startOfPreviousMonth && date <= endOfPreviousMonth) {
        categoryItem.previousMonth += value;
      }

      categoryGrowthMap.set(categoryName, categoryItem);
    });

    const topGrowingCategories = Array.from(categoryGrowthMap.values())
      .map((item) => {
        const growth = item.currentMonth - item.previousMonth;
        const growthPercent = item.previousMonth > 0 ? (growth / item.previousMonth) * 100 : item.currentMonth > 0 ? 100 : 0;

        return {
          name: item.name,
          icon: item.icon,
          currentMonth: Number(item.currentMonth.toFixed(2)),
          previousMonth: Number(item.previousMonth.toFixed(2)),
          growth: Number(growth.toFixed(2)),
          growthPercent: Number(growthPercent.toFixed(1)),
        };
      })
      .filter((item) => item.growth > 0)
      .sort((a, b) => b.growth - a.growth)
      .slice(0, 3);

    return {
      totalBalance: cash,
      totalInvested: invested,
      netWorth: cash + invested,
      monthlyExpenses: expense,
      monthlyIncomes: income,
      savingsRate: Number(savingsRate.toFixed(1)),
      recurringMonthly: Number(activeSubscriptions._sum.value || 0),
      activeSubscriptionsCount: activeSubscriptions._count.id,
      fixedExpensesMonthly: Number(fixedExpensesMonthly.toFixed(2)),
      variableExpensesMonthly: Number(variableExpensesMonthly.toFixed(2)),
      fixedExpenseRatio: Number(fixedExpenseRatio.toFixed(1)),
      variableExpenseRatio: Number(variableExpenseRatio.toFixed(1)),
      budgetPlanned: Number(budgetPlanned.toFixed(2)),
      budgetSpent: Number(budgetSpent.toFixed(2)),
      budgetAdherencePercent: Number(budgetAdherencePercent.toFixed(1)),
      financialAutonomyDays: Number(financialAutonomyDays.toFixed(1)),
      weeklyBurnRate: Number(weeklyBurnRate.toFixed(2)),
      topGrowingCategories,
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
