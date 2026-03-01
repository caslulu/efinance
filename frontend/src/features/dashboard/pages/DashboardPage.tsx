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
  // Set end date to end of day if selected
  const formattedEndDate = dateRange?.to ? (() => {
    const end = new Date(dateRange.to);
    end.setHours(23, 59, 59, 999);
    return end.toISOString();
  })() : formattedStartDate; // if no end date selected, use start date again if it exists

  const { data, isLoading: loading } = useDashboard(formattedStartDate, formattedEndDate);
  const [drilldownCategory, setDrilldownCategory] = useState<string | null>(null);
  const { data: drilldownTransactions = [], isLoading: loadingDrilldown } = useDashboardCategory(drilldownCategory);

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

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }

  return (
    <div className="p-4 space-y-8 md:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <DatePickerWithRange date={dateRange} setDate={setDateRange} />

          <div className="text-sm text-muted-foreground bg-card px-3 py-1 rounded-md border shadow-sm flex items-center gap-2 h-10 w-fit">
            <CalendarDays size={14} />
            {dateRange?.from
              ? `Personalizado`
              : new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
          </div>
        </div>
      </div>

      <DashboardKpis data={data} />

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main flow carousel */}
        <div className="lg:col-span-2 space-y-8">
          <MonthFlowCarousel data={data} />
          <BudgetProgress data={data} />

          <div className="grid gap-8 md:grid-cols-2">
            <ExpensesByCategory data={data} onCategoryClick={setDrilldownCategory} />
            <HistoryProjectionChart data={data} />
          </div>
        </div>

        <div className="lg:col-span-1 space-y-8">
          <UpcomingBills data={data} formatDate={formatDate} />
          <RecentActivity data={data} formatDate={formatDate} />
          <TopGrowingCategories data={data} />
        </div>
      </div>

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
              <TableHeader className="bg-muted">
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