import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChatContextService {
  constructor(private readonly prisma: PrismaService) {}

  async buildFinancialContext(userId: number): Promise<string> {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

    const [
      wallets,
      recentExpenses,
      recentIncomes,
      activeSubscriptions,
      investments,
      wishlists,
      budgets,
      totalExpenseAgg,
      totalIncomeAgg,
    ] = await Promise.all([
      // 1. Wallets with balances
      this.prisma.wallet.findMany({
        where: { user_id: userId },
        select: { name: true, actual_cash: true, type: true, is_transfer_only: true },
      }),

      // 2. Recent expenses by category (last 30 days)
      this.prisma.transaction.findMany({
        where: {
          wallet: { user_id: userId },
          transaction_type: 'EXPENSE',
          payment_method: { not: 'TRANSFER' },
          transaction_date: { gte: thirtyDaysAgo, lte: today },
        },
        include: { TransactionCategory: true, wallet: { select: { name: true } } },
        orderBy: { transaction_date: 'desc' },
        take: 50,
      }),

      // 3. Recent incomes (last 30 days)
      this.prisma.transaction.findMany({
        where: {
          wallet: { user_id: userId },
          transaction_type: 'INCOME',
          payment_method: { not: 'TRANSFER' },
          transaction_date: { gte: thirtyDaysAgo, lte: today },
        },
        include: { TransactionCategory: true },
        orderBy: { transaction_date: 'desc' },
        take: 20,
      }),

      // 4. Active subscriptions
      this.prisma.subscription.findMany({
        where: { user_id: userId, status: 'ACTIVE' },
        select: { name: true, value: true, frequency: true, next_billing_date: true },
      }),

      // 5. Investments
      this.prisma.investment.findMany({
        where: { wallet: { user_id: userId } },
        include: { typeInvestment: true, economicIndicator: true },
      }),

      // 6. Wishlists with products
      this.prisma.wishlist.findMany({
        where: { user_id: userId },
        include: {
          products: {
            include: {
              history: { orderBy: { created_at: 'desc' }, take: 3 },
            },
          },
        },
      }),

      // 7. Budgets with current spending
      this.prisma.budget.findMany({
        where: { user_id: userId },
        include: { category: true },
      }),

      // 8. Total expenses this month
      this.prisma.transaction.aggregate({
        where: {
          wallet: { user_id: userId },
          transaction_type: 'EXPENSE',
          payment_method: { not: 'TRANSFER' },
          transaction_date: { gte: startOfMonth, lte: endOfMonth },
        },
        _sum: { value: true },
      }),

      // 9. Total income this month
      this.prisma.transaction.aggregate({
        where: {
          wallet: { user_id: userId },
          transaction_type: 'INCOME',
          payment_method: { not: 'TRANSFER' },
          transaction_date: { gte: startOfMonth, lte: endOfMonth },
        },
        _sum: { value: true },
      }),
    ]);

    // Calculate budget status
    const budgetStatus = await Promise.all(
      budgets.map(async (budget) => {
        const expenses = await this.prisma.transaction.aggregate({
          where: {
            wallet: { user_id: userId },
            category_id: budget.category_id,
            transaction_type: 'EXPENSE',
            transaction_date: { gte: startOfMonth, lte: endOfMonth },
          },
          _sum: { value: true },
        });
        const spent = Number(expenses._sum.value || 0);
        return {
          category: budget.category.name,
          limit: Number(budget.limit),
          spent,
          remaining: Math.max(0, Number(budget.limit) - spent),
          percentage: Number(budget.limit) > 0 ? ((spent / Number(budget.limit)) * 100).toFixed(1) : '0',
        };
      }),
    );

    // Build expense by category summary
    const categoryExpenses = new Map<string, number>();
    recentExpenses.forEach((t) => {
      const cat = t.TransactionCategory?.name || 'Outro';
      categoryExpenses.set(cat, (categoryExpenses.get(cat) || 0) + Number(t.value));
    });
    const topCategories = Array.from(categoryExpenses.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    // KPIs
    const totalCash = wallets.reduce((sum, w) => sum + Number(w.actual_cash), 0);
    const totalInvested = investments.reduce((sum, i) => sum + Number(i.current_amount), 0);
    const netWorth = totalCash + totalInvested;
    const monthIncome = Number(totalIncomeAgg._sum.value || 0);
    const monthExpense = Number(totalExpenseAgg._sum.value || 0);
    const savingsRate = monthIncome > 0 ? ((monthIncome - monthExpense) / monthIncome) * 100 : 0;
    const avgDailyExpense = monthExpense / Math.max(today.getDate(), 1);
    const autonomyDays = avgDailyExpense > 0 ? totalCash / avgDailyExpense : 0;

    const recurringTotal = activeSubscriptions.reduce((sum, s) => sum + Number(s.value), 0);

    // Build context string
    const sections: string[] = [];

    sections.push(`## Dados Financeiros do Usuário (${today.toLocaleDateString('pt-BR')})`);

    // KPIs
    sections.push(`\n### Resumo Geral
- Patrimônio Líquido: R$ ${netWorth.toFixed(2)}
- Dinheiro em Carteiras: R$ ${totalCash.toFixed(2)}
- Total Investido: R$ ${totalInvested.toFixed(2)}
- Receitas do Mês: R$ ${monthIncome.toFixed(2)}
- Despesas do Mês: R$ ${monthExpense.toFixed(2)}
- Taxa de Poupança: ${savingsRate.toFixed(1)}%
- Dias de Autonomia Financeira: ${autonomyDays.toFixed(0)} dias
- Gasto Médio Diário: R$ ${avgDailyExpense.toFixed(2)}
- Total Assinaturas/Recorrências: R$ ${recurringTotal.toFixed(2)}/mês`);

    // Wallets
    if (wallets.length > 0) {
      sections.push(`\n### Carteiras`);
      wallets.forEach((w) => {
        sections.push(`- ${w.name} (${w.type}): R$ ${Number(w.actual_cash).toFixed(2)}${w.is_transfer_only ? ' [só transferência]' : ''}`);
      });
    }

    // Top spending categories
    if (topCategories.length > 0) {
      sections.push(`\n### Top Gastos por Categoria (últimos 30 dias)`);
      topCategories.forEach(([name, value]) => {
        sections.push(`- ${name}: R$ ${value.toFixed(2)}`);
      });
    }

    // Budget status
    if (budgetStatus.length > 0) {
      sections.push(`\n### Orçamentos (mês atual)`);
      budgetStatus.forEach((b) => {
        const status = Number(b.percentage) > 100 ? '⚠️ ESTOURADO' : Number(b.percentage) > 80 ? '⚠️ QUASE NO LIMITE' : '✅';
        sections.push(`- ${b.category}: R$ ${b.spent.toFixed(2)} / R$ ${b.limit.toFixed(2)} (${b.percentage}%) ${status}`);
      });
    }

    // Subscriptions
    if (activeSubscriptions.length > 0) {
      sections.push(`\n### Assinaturas Ativas`);
      activeSubscriptions.forEach((s) => {
        sections.push(`- ${s.name}: R$ ${Number(s.value).toFixed(2)} (${s.frequency})`);
      });
    }

    // Investments
    if (investments.length > 0) {
      sections.push(`\n### Investimentos`);
      investments.forEach((i) => {
        const returnPct = Number(i.investment_amount) > 0
          ? (((Number(i.current_amount) - Number(i.investment_amount)) / Number(i.investment_amount)) * 100).toFixed(2)
          : '0.00';
        sections.push(`- ${i.name} (${i.typeInvestment?.name || 'N/A'}): Investido R$ ${Number(i.investment_amount).toFixed(2)} → Atual R$ ${Number(i.current_amount).toFixed(2)} (${returnPct}% rentabilidade)`);
      });
    }

    // Wishlist
    const allProducts = wishlists.flatMap((w) =>
      w.products.map((p) => ({ wishlistName: w.name, ...p })),
    );
    if (allProducts.length > 0) {
      sections.push(`\n### Lista de Desejos`);
      allProducts.forEach((p) => {
        const priceHistory = p.history.map((h) => `R$ ${Number(h.price).toFixed(2)}`).join(' → ');
        sections.push(`- ${p.name_product} (${p.wishlistName}): R$ ${Number(p.price).toFixed(2)}${priceHistory ? ` | Histórico: ${priceHistory}` : ''}`);
      });
    }

    // Recent transactions (last 10)
    const recentTxs = recentExpenses.slice(0, 10);
    if (recentTxs.length > 0) {
      sections.push(`\n### Últimas Transações`);
      recentTxs.forEach((t) => {
        sections.push(`- ${t.transaction_date.toLocaleDateString('pt-BR')} | ${t.description || 'Sem descrição'} | R$ ${Number(t.value).toFixed(2)} | ${t.TransactionCategory?.name || 'Outro'} | ${t.wallet?.name || ''}`);
      });
    }

    return sections.join('\n');
  }
}
