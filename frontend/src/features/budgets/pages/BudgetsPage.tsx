import { useState } from 'react';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { useBudgetStatus, useDeleteBudget } from '@/hooks';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Target, Pencil, Trash2, TrendingDown, TrendingUp, AlertTriangle } from 'lucide-react';
import { UpsertBudgetModal } from '../components/UpsertBudgetModal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { CategoryIcon } from '@/components/IconPicker';

export const BudgetsPage = () => {
  const { data: budgets = [], isLoading: loading, refetch: refetchBudgets } = useBudgetStatus();
  const deleteBudget = useDeleteBudget();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<any>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const handleDelete = async (id: number) => {
    try {
      await deleteBudget.mutateAsync(id);
    } catch {
      toast.error('Falha ao excluir meta');
    }
  };

  const onTrack = budgets.filter(b => b.percentage < 80).length;
  const warning = budgets.filter(b => b.percentage >= 80 && b.percentage < 100).length;
  const overBudget = budgets.filter(b => b.percentage >= 100).length;

  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25">
            <Target className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Metas de Gastos</h1>
            <p className="text-sm text-muted-foreground">Controle seus limites por categoria</p>
          </div>
        </div>
        <Button
          onClick={() => { setEditingBudget(null); setIsModalOpen(true); }}
          className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-lg shadow-emerald-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-emerald-500/30"
        >
          <Plus className="mr-2 h-4 w-4" /> Nova Meta
        </Button>
      </div>

      {/* Summary Stats */}
      {budgets.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="flex items-center gap-4 rounded-2xl border bg-card p-5 transition-all duration-300 hover:shadow-md">
            <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
              <TrendingDown className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">No controle</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{onTrack}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-2xl border bg-card p-5 transition-all duration-300 hover:shadow-md">
            <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-900/30">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Atenção</p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{warning}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-2xl border bg-card p-5 transition-all duration-300 hover:shadow-md">
            <div className="p-2.5 rounded-xl bg-red-100 dark:bg-red-900/30">
              <TrendingUp className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Estouradas</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{overBudget}</p>
            </div>
          </div>
        </div>
      )}

      {/* Budget Cards */}
      {loading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-[300px] w-full rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {budgets.map((budget) => {
            const radius = 42;
            const circumference = 2 * Math.PI * radius;
            const progress = Math.min(100, budget.percentage);
            const dashOffset = circumference - (progress / 100) * circumference;
            const progressColor = budget.percentage >= 100 ? '#ef4444' : budget.percentage >= 80 ? '#f59e0b' : '#10b981';
            const cardGradient = budget.percentage >= 100
              ? 'from-red-500/8 to-red-500/3 dark:from-red-500/10 dark:to-red-500/5'
              : budget.percentage >= 80
                ? 'from-amber-500/8 to-amber-500/3 dark:from-amber-500/10 dark:to-amber-500/5'
                : 'from-emerald-500/8 to-emerald-500/3 dark:from-emerald-500/10 dark:to-emerald-500/5';

            return (
              <Card
                key={budget.id}
                className={`group relative overflow-hidden rounded-2xl border shadow-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-1 bg-gradient-to-br ${cardGradient}`}
              >
                <CardContent className="p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-white/80 dark:bg-white/10 shadow-sm backdrop-blur-sm">
                        <CategoryIcon name={budget.categoryIcon} className="h-5 w-5 text-slate-700 dark:text-slate-300" />
                      </div>
                      <div>
                        <h3 className="font-bold text-foreground leading-tight">{budget.categoryName}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Limite: {formatCurrency(budget.limit)}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl hover:bg-white/50 dark:hover:bg-white/10" onClick={() => { setEditingBudget(budget); setIsModalOpen(true); }}>
                        <Pencil className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => setConfirmDeleteId(budget.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    </div>
                  </div>

                  {/* Circular Progress */}
                  <div className="flex items-center justify-center mb-6">
                    <div className="relative">
                      <svg width="108" height="108" className="-rotate-90">
                        <circle cx="54" cy="54" r={radius} fill="none" stroke="currentColor" strokeWidth="7" className="text-black/5 dark:text-white/10" />
                        <circle
                          cx="54" cy="54" r={radius} fill="none"
                          stroke={progressColor} strokeWidth="7" strokeLinecap="round"
                          strokeDasharray={circumference} strokeDashoffset={dashOffset}
                          className="transition-all duration-1000 ease-out"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl font-extrabold tabular-nums" style={{ color: progressColor }}>
                          {budget.percentage}%
                        </span>
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">usado</span>
                      </div>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="space-y-3 rounded-xl bg-white/40 dark:bg-white/5 p-3 backdrop-blur-sm">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Gasto atual</span>
                      <span className="font-semibold tabular-nums">{formatCurrency(budget.limit - budget.remaining)}</span>
                    </div>
                    <div className="h-px bg-border/60" />
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Disponível</span>
                      <span className={`font-bold tabular-nums ${budget.remaining > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {formatCurrency(budget.remaining)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {budgets.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-24 border-2 border-dashed rounded-2xl text-muted-foreground">
              <div className="p-4 rounded-2xl bg-muted/50 mb-4">
                <Target className="h-10 w-10 text-muted-foreground/40" />
              </div>
              <p className="font-semibold text-lg mb-1">Nenhuma meta definida</p>
              <p className="text-sm">Comece criando uma para controlar seus gastos por categoria!</p>
            </div>
          )}
        </div>
      )}

      <UpsertBudgetModal
        isOpen={isModalOpen}
        budget={editingBudget}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => refetchBudgets()}
      />

      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="Excluir Meta"
        description="Deseja excluir esta meta de gasto?"
        confirmLabel="Excluir"
        destructive
        onConfirm={() => {
          if (confirmDeleteId !== null) handleDelete(confirmDeleteId);
          setConfirmDeleteId(null);
        }}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
};
