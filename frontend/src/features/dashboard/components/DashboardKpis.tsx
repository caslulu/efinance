import { useState, useRef, useEffect, type ReactNode } from 'react';
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

// Accent color configs per KPI
const accentMap: Record<string, { bg: string; text: string; border: string; iconBg: string }> = {
  netWorth:       { bg: 'bg-emerald-500/8 dark:bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/20', iconBg: 'bg-emerald-500/10' },
  monthlyIncomes: { bg: 'bg-green-500/8 dark:bg-green-500/10', text: 'text-green-600 dark:text-green-400', border: 'border-green-500/20', iconBg: 'bg-green-500/10' },
  savingsRate:    { bg: 'bg-amber-500/8 dark:bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/20', iconBg: 'bg-amber-500/10' },
  financialAutonomy: { bg: 'bg-cyan-500/8 dark:bg-cyan-500/10', text: 'text-cyan-600 dark:text-cyan-400', border: 'border-cyan-500/20', iconBg: 'bg-cyan-500/10' },
  weeklyBurnRate: { bg: 'bg-red-500/8 dark:bg-red-500/10', text: 'text-red-600 dark:text-red-400', border: 'border-red-500/20', iconBg: 'bg-red-500/10' },
  budgetAdherence:{ bg: 'bg-emerald-500/8 dark:bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/20', iconBg: 'bg-emerald-500/10' },
  fixedVsVariable:{ bg: 'bg-violet-500/8 dark:bg-violet-500/10', text: 'text-violet-600 dark:text-violet-400', border: 'border-violet-500/20', iconBg: 'bg-violet-500/10' },
  variableExpense:{ bg: 'bg-sky-500/8 dark:bg-sky-500/10', text: 'text-sky-600 dark:text-sky-400', border: 'border-sky-500/20', iconBg: 'bg-sky-500/10' },
  recurringMonthly:{ bg: 'bg-purple-500/8 dark:bg-purple-500/10', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-500/20', iconBg: 'bg-purple-500/10' },
  activeSubscriptions:{ bg: 'bg-indigo-500/8 dark:bg-indigo-500/10', text: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-500/20', iconBg: 'bg-indigo-500/10' },
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

  const KpiCard = ({
    kpiKey,
    icon: Icon,
    title,
    value,
    valueClass,
    subtitle,
    badge
  }: {
    kpiKey: string;
    icon: any;
    title: string;
    value: ReactNode;
    valueClass?: string;
    subtitle?: ReactNode;
    badge?: ReactNode;
  }) => {
    const accent = accentMap[kpiKey] || accentMap.netWorth;
    return (
      <div
        className="relative"
        onMouseEnter={() => handleKpiMouseEnter(kpiKey)}
        onMouseLeave={() => handleKpiMouseLeave(kpiKey)}
      >
        <div className="dash-card p-4 flex flex-col gap-3 h-full group cursor-default">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{title}</span>
            <div className={`w-8 h-8 rounded-xl ${accent.iconBg} flex items-center justify-center transition-transform group-hover:scale-110`}>
              <Icon className={`h-4 w-4 ${accent.text}`} />
            </div>
          </div>
          <div className={`text-2xl font-semibold tracking-tight ${valueClass || 'text-foreground'}`}>
            {value}
          </div>
          {subtitle && <div className="text-[11px] text-muted-foreground leading-tight">{subtitle}</div>}
          {badge && <div className="flex gap-1.5 flex-wrap">{badge}</div>}
        </div>

        {activeKpiExplanation === kpiKey && (
          <div className="pointer-events-none absolute left-0 right-0 top-0 z-20 -translate-y-full pb-2">
            <div className="mx-auto max-w-[260px] rounded-xl border border-border/50 bg-card p-3 text-[11px] text-foreground shadow-xl leading-relaxed">
              {kpiExplanations[kpiKey]}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Section: Visão Financeira */}
      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-1 h-4 rounded-full bg-emerald-500" />
          <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">Visão Financeira</h2>
          <span className="text-[10px] text-muted-foreground">Patrimônio e renda</span>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            kpiKey="netWorth"
            icon={Coins}
            title="Patrimônio Total"
            value={formatCurrency(data.netWorth)}
            badge={<>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">Saldo: {formatCurrency(data.totalBalance)}</span>
              {data.totalInvested > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-medium">Inv: {formatCurrency(data.totalInvested)}</span>}
            </>}
          />
          <KpiCard
            kpiKey="monthlyIncomes"
            icon={ArrowUpCircle}
            title="Receitas (30d)"
            value={formatCurrency(data.monthlyIncomes)}
            valueClass="text-green-600 dark:text-green-400"
            subtitle="Total recebido no mês"
          />
          <KpiCard
            kpiKey="savingsRate"
            icon={PiggyBank}
            title="Taxa de Poupança"
            value={`${data.savingsRate}%`}
            valueClass={data.savingsRate > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}
            subtitle="Economia real do mês"
          />
          <KpiCard
            kpiKey="financialAutonomy"
            icon={Wallet}
            title="Autonomia Financeira"
            value={formatDays(data.financialAutonomyDays || 0)}
            valueClass="text-cyan-600 dark:text-cyan-400"
            subtitle="Saldo ÷ gasto médio diário"
          />
        </div>
      </section>

      {/* Section: Consumo & Orçamento */}
      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-1 h-4 rounded-full bg-red-500" />
          <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">Consumo & Orçamento</h2>
          <span className="text-[10px] text-muted-foreground">Gastos e aderência</span>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            kpiKey="weeklyBurnRate"
            icon={ArrowDownCircle}
            title="Burn Rate (7d)"
            value={formatCurrency(data.weeklyBurnRate || 0)}
            valueClass="text-red-600 dark:text-red-400"
            subtitle="Saída total dos últimos 7 dias"
          />
          <KpiCard
            kpiKey="budgetAdherence"
            icon={Target}
            title="Aderência ao Orçamento"
            value={`${(data.budgetAdherencePercent || 0).toFixed(1)}%`}
            valueClass={(data.budgetAdherencePercent || 0) <= 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}
            subtitle={<>{formatCurrency(data.budgetSpent || 0)} de {formatCurrency(data.budgetPlanned || 0)} planejado</>}
          />
          <KpiCard
            kpiKey="fixedVsVariable"
            icon={Repeat}
            title="Fixas x Variáveis"
            value={`${(data.fixedExpenseRatio || 0).toFixed(1)}% fixas`}
            valueClass="text-violet-600 dark:text-violet-400"
            subtitle={`${(data.variableExpenseRatio || 0).toFixed(1)}% variáveis no período`}
          />
          <KpiCard
            kpiKey="variableExpense"
            icon={TrendingUp}
            title="Despesa Variável (30d)"
            value={formatCurrency(data.variableExpensesMonthly || 0)}
            valueClass="text-sky-600 dark:text-sky-400"
            subtitle={`Fixas: ${formatCurrency(data.fixedExpensesMonthly || 0)}`}
          />
        </div>
      </section>

      {/* Section: Assinaturas */}
      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-1 h-4 rounded-full bg-purple-500" />
          <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">Assinaturas</h2>
          <span className="text-[10px] text-muted-foreground">Compromissos recorrentes</span>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <KpiCard
            kpiKey="recurringMonthly"
            icon={Repeat}
            title="Custo Mensal"
            value={formatCurrency(data.recurringMonthly)}
            valueClass="text-purple-600 dark:text-purple-400"
            subtitle="Total recorrente por mês"
          />
          <KpiCard
            kpiKey="activeSubscriptions"
            icon={Bell}
            title="Assinaturas Ativas"
            value={data.activeSubscriptionsCount || 0}
            valueClass="text-indigo-600 dark:text-indigo-400"
            subtitle={`Total ativo • ${formatCurrency(data.recurringMonthly || 0)}/mês`}
          />
        </div>
      </section>
    </div>
  );
}