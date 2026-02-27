import { useState, useEffect, useRef, type ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import { useDashboard, useDashboardCategory } from '@/hooks';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import type { DateRange } from 'react-day-picker';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import {
  Wallet,
  ArrowUpCircle,
  ArrowDownCircle,
  TrendingUp,
  Repeat,
  PiggyBank,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Bell,
  Search,
  Target,
  History,
  Coins,
  Wallet as WalletIcon
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CategoryIcon } from '@/components/IconPicker';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
const KPI_TOOLTIP_DELAY_MS = 1000;

export const DashboardPage = () => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  const formattedStartDate = dateRange?.from ? dateRange.from.toISOString() : undefined;
  // Set end date to end of day if selected
  const formattedEndDate = dateRange?.to ? (() => {
    const end = new Date(dateRange.to);
    end.setHours(23, 59, 59, 999);
    return end.toISOString();
  })() : formattedStartDate; // if no end date selected, use start date again if it exists

  const { data, isLoading: loading } = useDashboard(formattedStartDate, formattedEndDate);
  const navigate = useNavigate();
  const [drilldownCategory, setDrilldownCategory] = useState<string | null>(null);
  const { data: drilldownTransactions = [], isLoading: loadingDrilldown } = useDashboardCategory(drilldownCategory);
  const [activeKpiExplanation, setActiveKpiExplanation] = useState<string | null>(null);

  const carouselRef = useRef<HTMLDivElement>(null);
  const kpiHoverTimeoutRef = useRef<number | null>(null);

  const kpiExplanations: Record<string, string> = {
    netWorth: 'Soma do saldo em carteiras com o valor investido. Representa seu patrimônio financeiro atual.',
    monthlyIncomes: 'Total de receitas registradas nos últimos 30 dias, desconsiderando transferências internas.',
    savingsRate: 'Percentual economizado no período: (receitas - despesas) / receitas.',
    financialAutonomy: 'Estimativa de quantos dias você consegue se manter com o saldo atual, no ritmo médio de gastos.',
    weeklyBurnRate: 'Total gasto nos últimos 7 dias. Ajuda a enxergar aceleração recente de consumo.',
    budgetAdherence: 'Mostra quanto do orçamento planejado já foi utilizado no período.',
    fixedVsVariable: 'Compara despesas fixas (recorrentes/assinaturas) com despesas variáveis do período.',
    variableExpense: 'Total de gastos variáveis dos últimos 30 dias, com referência ao valor de gastos fixos.',
    recurringMonthly: 'Soma dos custos recorrentes de assinaturas ativas por mês.',
    activeSubscriptions: 'Quantidade de assinaturas com status ativo no momento.',
  };

  const handleKpiMouseEnter = (kpiKey: string) => {
    if (kpiHoverTimeoutRef.current) {
      window.clearTimeout(kpiHoverTimeoutRef.current);
    }

    kpiHoverTimeoutRef.current = window.setTimeout(() => {
      setActiveKpiExplanation(kpiKey);
    }, KPI_TOOLTIP_DELAY_MS);
  };

  const handleKpiMouseLeave = (kpiKey: string) => {
    if (kpiHoverTimeoutRef.current) {
      window.clearTimeout(kpiHoverTimeoutRef.current);
      kpiHoverTimeoutRef.current = null;
    }

    setActiveKpiExplanation((current) => (current === kpiKey ? null : current));
  };

  const renderKpiCard = (kpiKey: string, content: ReactNode) => (
    <div
      className="relative"
      onMouseEnter={() => handleKpiMouseEnter(kpiKey)}
      onMouseLeave={() => handleKpiMouseLeave(kpiKey)}
    >
      {content}
      {activeKpiExplanation === kpiKey && (
        <div className="pointer-events-none absolute left-0 right-0 top-0 z-20 -translate-y-full pb-1">
          <div className="mx-auto max-w-[260px] rounded-md border bg-white p-2 text-xs text-gray-700 shadow-lg">
            {kpiExplanations[kpiKey]}
          </div>
        </div>
      )}
    </div>
  );

  useEffect(() => {
    return () => {
      if (kpiHoverTimeoutRef.current) {
        window.clearTimeout(kpiHoverTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (data?.monthFlow && carouselRef.current) {
      const currentMonthIndex = data.monthFlow.findIndex((m: any) => !m.isProjected);
      if (currentMonthIndex === -1) return;

      setTimeout(() => {
        if (carouselRef.current) {
          const scrollPos = (currentMonthIndex * 160) - (carouselRef.current.offsetWidth / 2) + 80;
          carouselRef.current.scrollTo({ left: scrollPos, behavior: 'smooth' });
        }
      }, 100);
    }
  }, [data]);

  const scroll = (direction: 'left' | 'right') => {
    if (carouselRef.current) {
      const amt = direction === 'left' ? -320 : 320;
      carouselRef.current.scrollBy({ left: amt, behavior: 'smooth' });
    }
  };

  const onPieClick = (eventData: any) => {
    const categoryName = eventData.payload?.name || eventData.name;
    if (!categoryName) return;
    setDrilldownCategory(categoryName);
  };

  if (loading) return (
    <div className="p-4 space-y-8 md:p-8">
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-8 w-40 rounded-full" />
      </div>
      <div className="space-y-6">
        <section className="space-y-3">
          <Skeleton className="h-5 w-32" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        </section>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Skeleton className="col-span-4 h-[400px] w-full" />
          <Skeleton className="col-span-3 h-[400px] w-full" />
        </div>
      </div>
    </div>
  );
  if (!data || !data.monthFlow) return <div className="p-8 text-center text-red-500">Falha ao carregar dados do dashboard.</div>;

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }

  const formatDays = (val: number) => `${Math.max(0, Number(val || 0)).toFixed(1)} dias`;

  return (
    <div className="p-4 space-y-8 md:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <DatePickerWithRange date={dateRange} setDate={setDateRange} />

          <div className="text-sm text-muted-foreground bg-white px-3 py-1 rounded-md border shadow-sm flex items-center gap-2 h-10 w-fit">
            <CalendarDays size={14} />
            {dateRange?.from
              ? `Personalizado`
              : new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-900">Visão Financeira</h2>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Patrimônio e renda</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {renderKpiCard('netWorth', (
              <Card className="border-l-4 border-l-blue-500 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium">Patrimônio Total</CardTitle>
                  <Coins className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900">{formatCurrency(data.netWorth)}</div>
                  <div className="text-[10px] text-muted-foreground flex gap-2 mt-1">
                    <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">Saldo: {formatCurrency(data.totalBalance)}</span>
                    {data.totalInvested > 0 && <span className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded">Inv: {formatCurrency(data.totalInvested)}</span>}
                  </div>
                </CardContent>
              </Card>
            ))}

            {renderKpiCard('monthlyIncomes', (
              <Card className="border-l-4 border-l-green-500 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium">Receitas (30d)</CardTitle>
                  <ArrowUpCircle className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{formatCurrency(data.monthlyIncomes)}</div>
                  <p className="text-xs text-muted-foreground">Total recebido no mês</p>
                </CardContent>
              </Card>
            ))}

            {renderKpiCard('savingsRate', (
              <Card className="border-l-4 border-l-orange-500 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium">Taxa de Poupança</CardTitle>
                  <PiggyBank className="h-4 w-4 text-orange-500" />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${data.savingsRate > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {data.savingsRate}%
                  </div>
                  <p className="text-xs text-muted-foreground">Economia real do mês</p>
                </CardContent>
              </Card>
            ))}

            {renderKpiCard('financialAutonomy', (
              <Card className="border-l-4 border-l-cyan-500 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium">Autonomia Financeira</CardTitle>
                  <Wallet className="h-4 w-4 text-cyan-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-cyan-700">{formatDays(data.financialAutonomyDays || 0)}</div>
                  <p className="text-xs text-muted-foreground">Saldo atual dividido pela média de gasto diário</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-900">Consumo & Orçamento</h2>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Gastos e aderência</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {renderKpiCard('weeklyBurnRate', (
              <Card className="border-l-4 border-l-red-500 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium">Burn Rate (7d)</CardTitle>
                  <ArrowDownCircle className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{formatCurrency(data.weeklyBurnRate || 0)}</div>
                  <p className="text-xs text-muted-foreground">Saída total dos últimos 7 dias</p>
                </CardContent>
              </Card>
            ))}

            {renderKpiCard('budgetAdherence', (
              <Card className="border-l-4 border-l-emerald-500 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium">Aderência ao Orçamento</CardTitle>
                  <Target className="h-4 w-4 text-emerald-500" />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${(data.budgetAdherencePercent || 0) <= 100 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {(data.budgetAdherencePercent || 0).toFixed(1)}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(data.budgetSpent || 0)} de {formatCurrency(data.budgetPlanned || 0)} planejado
                  </p>
                </CardContent>
              </Card>
            ))}

            {renderKpiCard('fixedVsVariable', (
              <Card className="border-l-4 border-l-violet-500 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium">Despesas Fixas x Variáveis</CardTitle>
                  <Repeat className="h-4 w-4 text-violet-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-violet-700">{(data.fixedExpenseRatio || 0).toFixed(1)}% fixas</div>
                  <p className="text-xs text-muted-foreground">
                    {(data.variableExpenseRatio || 0).toFixed(1)}% variáveis no período
                  </p>
                </CardContent>
              </Card>
            ))}

            {renderKpiCard('variableExpense', (
              <Card className="border-l-4 border-l-sky-500 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium">Despesa Variável (30d)</CardTitle>
                  <TrendingUp className="h-4 w-4 text-sky-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-sky-700">{formatCurrency(data.variableExpensesMonthly || 0)}</div>
                  <p className="text-xs text-muted-foreground">Fixas: {formatCurrency(data.fixedExpensesMonthly || 0)}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-900">Assinaturas</h2>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Compromissos recorrentes</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {renderKpiCard('recurringMonthly', (
              <Card className="border-l-4 border-l-purple-500 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium">Custo Mensal</CardTitle>
                  <Repeat className="h-4 w-4 text-purple-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-600">{formatCurrency(data.recurringMonthly)}</div>
                  <p className="text-xs text-muted-foreground">Total recorrente por mês</p>
                </CardContent>
              </Card>
            ))}

            {renderKpiCard('activeSubscriptions', (
              <Card className="border-l-4 border-l-indigo-500 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium">Assinaturas Ativas</CardTitle>
                  <Bell className="h-4 w-4 text-indigo-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-indigo-700">{data.activeSubscriptionsCount || 0}</div>
                  <p className="text-xs text-muted-foreground">Total ativo • {formatCurrency(data.recurringMonthly || 0)}/mês</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main flow carousel */}
        <div className="lg:col-span-2 space-y-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <TrendingUp size={18} className="text-blue-500" />
                Fluxo de Despesas (24 meses)
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => scroll('left')}>
                  <ChevronLeft size={16} />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => scroll('right')}>
                  <ChevronRight size={16} />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div ref={carouselRef} className="flex gap-4 overflow-x-hidden py-2 px-1">
                {data.monthFlow.map((month: any, i: number) => (
                  <div key={i} className={`min-w-[140px] p-3 rounded-lg border flex flex-col items-center justify-center transition-all ${month.isProjected ? 'bg-blue-50/50 border-blue-100 border-dashed' : 'bg-white shadow-sm border-gray-200'
                    } ${!month.isProjected && data.monthFlow[i + 1]?.isProjected ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">{month.name}</span>
                    <span className={`text-base font-bold ${month.isProjected ? 'text-blue-500' : 'text-gray-900'}`}>{formatCurrency(month.value)}</span>
                    <span className="text-[9px] text-muted-foreground">{month.isProjected ? 'Projetado' : 'Realizado'}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Budget Progress Bars */}
          {data.budgetSummary && data.budgetSummary.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Target size={18} className="text-blue-600" />
                  Orçamento por Categoria
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {data.budgetSummary.map((budget: any) => (
                  <div key={budget.id} className="space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-2">
                        <CategoryIcon name={budget.categoryIcon} className="h-4 w-4 text-slate-500" />
                        <span className="font-medium text-gray-700">{budget.categoryName}</span>
                      </div>
                      <span className="text-muted-foreground">
                        {formatCurrency(budget.spent)} / <span className="font-bold text-gray-900">{formatCurrency(budget.limit)}</span>
                      </span>
                    </div>
                    <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${budget.percentage >= 100 ? 'bg-red-500' : budget.percentage >= 80 ? 'bg-orange-500' : 'bg-blue-500'
                          }`}
                        style={{ width: `${Math.min(100, budget.percentage)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] uppercase font-bold">
                      <span className={budget.percentage >= 100 ? 'text-red-600' : 'text-muted-foreground'}>
                        {budget.percentage}% utilizado
                      </span>
                      <span className={budget.remaining > 0 ? 'text-green-600' : 'text-red-600'}>
                        {budget.remaining > 0 ? `${formatCurrency(budget.remaining)} restante` : 'Limite excedido'}
                      </span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="grid gap-8 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-0">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                  Gastos por Categoria (30d)
                </CardTitle>
                <p className="text-[11px] text-muted-foreground italic">Dica: clique para ver detalhes</p>
              </CardHeader>
              <CardContent className="h-[300px]">
                {data.expensesByCategory.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.expensesByCategory}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        onClick={onPieClick}
                        className="cursor-pointer"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {data.expensesByCategory.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Legend iconSize={10} wrapperStyle={{ fontSize: '12px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Nenhuma despesa.</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Histórico & Projeção</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.monthFlow}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis hide />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      cursor={{ fill: '#f1f5f9' }}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]} fill="#3b82f6">
                      {data.monthFlow.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.isProjected ? '#93c5fd' : '#3b82f6'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="lg:col-span-1 space-y-8">
          <Card className="border-t-4 border-t-orange-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Bell size={18} className="text-orange-500" />
                Próximas Contas (7 dias)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.upcomingTransactions && data.upcomingTransactions.length > 0 ? (
                  data.upcomingTransactions.map((tx: any) => (
                    <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg border bg-gray-50/50 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded bg-orange-100 text-orange-600">
                          <CategoryIcon name={tx.TransactionCategory?.icon} className="h-4 w-4" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-gray-900 line-clamp-1">{tx.description || tx.TransactionCategory?.name || 'Sem nome'}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <WalletIcon size={10} /> {tx.wallet?.name}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">{formatDate(tx.transaction_date)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-xs font-bold ${tx.transaction_type === 'EXPENSE' ? 'text-red-600' : 'text-green-600'}`}>
                          {tx.transaction_type === 'EXPENSE' ? '-' : '+'} {formatCurrency(Number(tx.value))}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-muted-foreground text-xs italic">Nenhuma conta em breve.</div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-t-4 border-t-blue-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <History size={18} className="text-blue-500" />
                Atividade Recente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.recentTransactions && data.recentTransactions.length > 0 ? (
                  data.recentTransactions.map((tx: any) => (
                    <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg border bg-white shadow-sm hover:shadow-md transition-all">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded bg-blue-100 text-blue-600">
                          <CategoryIcon name={tx.TransactionCategory?.icon} className="h-4 w-4" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-gray-900 line-clamp-1">{tx.description || tx.TransactionCategory?.name || 'Sem nome'}</p>
                          <p className="text-[9px] text-muted-foreground uppercase">{formatDate(tx.transaction_date)} • {tx.wallet?.name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-xs font-bold ${tx.transaction_type === 'EXPENSE' ? 'text-red-600' : 'text-green-600'}`}>
                          {tx.transaction_type === 'EXPENSE' ? '-' : '+'} {formatCurrency(Number(tx.value))}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-muted-foreground text-xs italic">Nenhuma atividade recente.</div>
                )}
                <Button variant="ghost" className="w-full text-xs text-blue-600" onClick={() => navigate('/transactions')}>
                  Ver histórico completo
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-t-4 border-t-violet-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <TrendingUp size={18} className="text-violet-500" />
                Categorias em Alta
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.topGrowingCategories && data.topGrowingCategories.length > 0 ? (
                  data.topGrowingCategories.map((item: any) => (
                    <div key={item.name} className="p-3 rounded-lg border bg-violet-50/50">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <CategoryIcon name={item.icon} className="h-4 w-4 text-violet-600" />
                          <p className="text-xs font-bold text-gray-900 truncate">{item.name}</p>
                        </div>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">
                          +{item.growthPercent}%
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        +{formatCurrency(item.growth)} vs mês anterior
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-muted-foreground text-xs italic">Sem crescimento relevante nas categorias.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ... rest of the component */}

      {/* Flexible Drill-down Dialog */}
      <Dialog open={!!drilldownCategory} onOpenChange={() => setDrilldownCategory(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2 text-blue-600 mb-2">
              <Search size={20} />
              <DialogTitle>Detalhamento: {drilldownCategory}</DialogTitle>
            </div>
            <DialogDescription>Transações nesta categoria nos últimos 30 dias.</DialogDescription>
          </DialogHeader>
          <div className="mt-4 border rounded-md overflow-hidden">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead className="text-[11px] font-bold">Data</TableHead>
                  <TableHead className="text-[11px] font-bold">Nome / Descrição</TableHead>
                  <TableHead className="text-[11px] font-bold">Carteira</TableHead>
                  <TableHead className="text-[11px] font-bold text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingDrilldown ? (
                  <TableRow><TableCell colSpan={4} className="py-4">
                    <div className="space-y-3">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  </TableCell></TableRow>
                ) : drilldownTransactions.length > 0 ? (
                  drilldownTransactions.map((tx: any) => (
                    <TableRow key={tx.id}>
                      <TableCell className="text-xs">{formatDate(tx.transaction_date)}</TableCell>
                      <TableCell className="text-xs font-medium">{tx.description || drilldownCategory}</TableCell>
                      <TableCell className="text-xs">{tx.wallet?.name}</TableCell>
                      <TableCell className="text-xs font-bold text-right text-red-600">{formatCurrency(Number(tx.value))}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={4} className="text-center py-4 text-xs">Nenhuma transação.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
