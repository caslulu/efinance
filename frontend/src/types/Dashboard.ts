import type { Transaction } from './Transaction';

export interface ExpenseByCategory {
  name: string;
  value: number;
  icon?: string;
}

export interface MonthFlowEntry {
  name: string;
  value: number;
  isProjected: boolean;
}

export interface BudgetSummaryItem {
  id: number;
  categoryName: string;
  categoryIcon?: string;
  limit: number;
  spent: number;
  remaining: number;
  percentage: number;
}

export interface TopGrowingCategory {
  name: string;
  icon?: string;
  growth: number;
  growthPercent: number;
}

export interface DashboardTransaction extends Transaction {
  wallet?: { id: number; name: string };
}

export interface DashboardOverview {
  netWorth: number;
  totalBalance: number;
  monthlyIncomes: number;
  savingsRate: number;
  financialAutonomyDays?: number;
  weeklyBurnRate?: number;
  budgetAdherencePercent?: number;
  budgetSpent?: number;
  budgetPlanned?: number;
  fixedExpenseRatio?: number;
  variableExpenseRatio?: number;
  fixedExpensesMonthly?: number;
  variableExpensesMonthly?: number;
  recurringMonthly: number;
  activeSubscriptionsCount?: number;
  expensesByCategory: ExpenseByCategory[];
  monthFlow: MonthFlowEntry[];
  budgetSummary?: BudgetSummaryItem[];
  topGrowingCategories?: TopGrowingCategory[];
  recentTransactions?: DashboardTransaction[];
  upcomingTransactions?: DashboardTransaction[];
}
