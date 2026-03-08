import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useDashboard, useDashboardCategory } from '@/hooks';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import type { DateRange } from 'react-day-picker';
import { CalendarDays, Search } from 'lucide-react';

import { DashboardKpis } from '../components/DashboardKpis';
import { MonthFlowCarousel } from '../components/MonthFlowCarousel';
import { BudgetProgress } from '../components/BudgetProgress';
import { ExpensesByCategory } from '../components/ExpensesByCategory';
import { HistoryProjectionChart } from '../components/HistoryProjectionChart';
import { UpcomingBills } from '../components/UpcomingBills';
import { RecentActivity } from '../components/RecentActivity';
import { TopGrowingCategories } from '../components/TopGrowingCategories';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/lib/utils';

export const DashboardPage = () => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  const formattedStartDate = dateRange?.from ? dateRange.from.toISOString() : undefined;
  const formattedEndDate = dateRange?.to ? (() => {
    const end = new Date(dateRange.to);
    end.setHours(23, 59, 59, 999);
    return end.toISOString();
  })() : formattedStartDate;

  const { data, isLoading: loading } = useDashboard(formattedStartDate, formattedEndDate);
  const [drilldownCategory, setDrilldownCategory] = useState<string | null>(null);
  const { data: drilldownTransactions = [], isLoading: loadingDrilldown } = useDashboardCategory(drilldownCategory);

  if (loading) return (
    <div className="dash-page p-5 space-y-8 md:p-8">
      <style>{dashboardStyles}</style>
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-48 rounded-xl" />
        <Skeleton className="h-8 w-40 rounded-full" />
      </div>
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Skeleton className="col-span-4 h-[400px] w-full rounded-2xl" />
          <Skeleton className="col-span-3 h-[400px] w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );

  if (!data || !data.monthFlow) return <div className="p-8 text-center text-red-500">Falha ao carregar dados do dashboard.</div>;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }

  return (
    <div className="dash-page p-5 space-y-8 md:p-8">
      <style>{dashboardStyles}</style>

      {/* ── Header ── */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between dash-slide-up">
        <div>
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-[0.2em] mb-1">Visão Geral</p>
          <h1 className="dash-display text-3xl md:text-4xl font-normal text-foreground">Dashboard</h1>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <DatePickerWithRange date={dateRange} setDate={setDateRange} />
          <div className="text-xs text-muted-foreground bg-card/60 backdrop-blur-sm px-3.5 py-2 rounded-xl border border-border/50 flex items-center gap-2 h-9 w-fit">
            <CalendarDays size={13} className="text-emerald-500" />
            {dateRange?.from
              ? 'Personalizado'
              : new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
          </div>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="dash-slide-up-d1">
        <DashboardKpis data={data} />
      </div>

      {/* ── Main grid ── */}
      <div className="grid gap-6 lg:grid-cols-3 dash-slide-up-d2">
        <div className="lg:col-span-2 space-y-6">
          <MonthFlowCarousel data={data} />
          <BudgetProgress data={data} />

          <div className="grid gap-6 md:grid-cols-2">
            <ExpensesByCategory data={data} onCategoryClick={setDrilldownCategory} />
            <HistoryProjectionChart data={data} />
          </div>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <UpcomingBills data={data} formatDate={formatDate} />
          <RecentActivity data={data} formatDate={formatDate} />
          <TopGrowingCategories data={data} />
        </div>
      </div>

      {/* ── Drill-down Dialog ── */}
      <Dialog open={!!drilldownCategory} onOpenChange={() => setDrilldownCategory(null)}>
        <DialogContent className="max-w-2xl rounded-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-2">
              <Search size={18} />
              <DialogTitle className="text-base">Detalhamento: {drilldownCategory}</DialogTitle>
            </div>
            <DialogDescription className="text-xs">Transações nesta categoria nos últimos 30 dias.</DialogDescription>
          </DialogHeader>
          <div className="mt-4 border border-border/50 rounded-xl overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 border-b border-border/50">
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider">Data</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider">Nome / Descrição</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider">Carteira</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingDrilldown ? (
                  <TableRow><TableCell colSpan={4} className="py-4">
                    <div className="space-y-3">
                      <Skeleton className="h-10 w-full rounded-lg" />
                      <Skeleton className="h-10 w-full rounded-lg" />
                      <Skeleton className="h-10 w-full rounded-lg" />
                    </div>
                  </TableCell></TableRow>
                ) : drilldownTransactions.length > 0 ? (
                  drilldownTransactions.map((tx: any) => (
                    <TableRow key={tx.id} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                      <TableCell className="text-xs">{formatDate(tx.transaction_date)}</TableCell>
                      <TableCell className="text-xs font-medium">{tx.description || drilldownCategory}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{tx.wallet?.name}</TableCell>
                      <TableCell className="text-xs font-bold text-right text-red-600 dark:text-red-400">{formatCurrency(Number(tx.value))}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={4} className="text-center py-6 text-xs text-muted-foreground">Nenhuma transação.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const dashboardStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');

  .dash-page { font-family: 'DM Sans', system-ui, sans-serif; }
  .dash-display { font-family: 'Instrument Serif', 'Georgia', serif; }

  @keyframes dash-slide-up {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .dash-slide-up { animation: dash-slide-up 0.5s ease-out forwards; }
  .dash-slide-up-d1 { animation: dash-slide-up 0.5s ease-out 0.08s forwards; opacity: 0; }
  .dash-slide-up-d2 { animation: dash-slide-up 0.5s ease-out 0.16s forwards; opacity: 0; }

  .dash-card {
    border-radius: 16px;
    border: 1px solid hsl(var(--border) / 0.5);
    background: hsl(var(--card));
    transition: box-shadow 0.3s ease, transform 0.3s ease;
  }
  .dash-card:hover {
    box-shadow: 0 8px 30px -8px hsl(var(--foreground) / 0.06);
  }
`;