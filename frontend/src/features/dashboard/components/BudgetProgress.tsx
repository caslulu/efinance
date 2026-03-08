import { Target } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { CategoryIcon } from '@/components/IconPicker';

export function BudgetProgress({ data }: { data: any }) {
  if (!data.budgetSummary || data.budgetSummary.length === 0) return null;

  return (
    <div className="dash-card overflow-hidden">
      <div className="px-5 pt-5 pb-4 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center">
          <Target size={15} className="text-emerald-600 dark:text-emerald-400" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">Orçamento por Categoria</h3>
      </div>
      <div className="px-5 pb-5 space-y-5">
        {data.budgetSummary.map((budget: any) => {
          const overBudget = budget.percentage >= 100;
          const warning = budget.percentage >= 80 && !overBudget;
          return (
            <div key={budget.id} className="space-y-2.5">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-muted/60 flex items-center justify-center">
                    <CategoryIcon name={budget.categoryIcon} className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <span className="text-xs font-semibold text-foreground">{budget.categoryName}</span>
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatCurrency(budget.spent)}{' '}
                  <span className="text-foreground/40">/</span>{' '}
                  <span className="font-semibold text-foreground">{formatCurrency(budget.limit)}</span>
                </span>
              </div>
              <div className="h-1.5 w-full bg-muted/60 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${overBudget ? 'bg-red-500' : warning ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  style={{ width: `${Math.min(100, budget.percentage)}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-medium">
                <span className={overBudget ? 'text-red-500' : warning ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}>
                  {budget.percentage}% utilizado
                </span>
                <span className={budget.remaining > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}>
                  {budget.remaining > 0 ? `${formatCurrency(budget.remaining)} restante` : 'Limite excedido'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}