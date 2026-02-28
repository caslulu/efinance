import { useState, useRef, useEffect, type ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import {
  Wallet,
  ArrowUpCircle,
  ArrowDownCircle,
  TrendingUp,
  Repeat,
  PiggyBank,
  Target,
  Coins,
  Bell
} from 'lucide-react';

const KPI_TOOLTIP_DELAY_MS = 1000;

const formatDays = (val: number) => `${Math.max(0, Number(val || 0)).toFixed(1)} dias`;

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

export function DashboardKpis({ data }: { data: any }) {
  const [activeKpiExplanation, setActiveKpiExplanation] = useState<string | null>(null);
  const kpiHoverTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (kpiHoverTimeoutRef.current) {
        window.clearTimeout(kpiHoverTimeoutRef.current);
      }
    };
  }, []);

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

  return (
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
  );
}