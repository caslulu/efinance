import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Target } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { CategoryIcon } from '@/components/IconPicker';

export function BudgetProgress({ data }: { data: any }) {
  if (!data.budgetSummary || data.budgetSummary.length === 0) return null;

  return (
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
  );
}