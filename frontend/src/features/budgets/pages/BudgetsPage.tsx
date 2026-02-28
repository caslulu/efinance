import { useState } from 'react';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { useBudgetStatus, useDeleteBudget } from '@/hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Target, Pencil, Trash2 } from 'lucide-react';
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
    } catch (error) {
      toast.error('Falha ao excluir meta');
    }
  };

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <Target className="text-blue-600" />
          Metas de Gastos
        </h1>
        <Button onClick={() => { setEditingBudget(null); setIsModalOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Nova Meta
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-[200px] w-full" />
          <Skeleton className="h-[200px] w-full" />
          <Skeleton className="h-[200px] w-full" />
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {budgets.map((budget) => (
            <Card key={budget.id} className="relative group overflow-hidden">
              <div className={budget.percentage >= 100 ? 'h-1 bg-red-500 w-full' : 'h-1 bg-blue-500 w-full'} style={{ width: `${Math.min(100, budget.percentage)}%` }} />
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-slate-100">
                      <CategoryIcon name={budget.categoryIcon} className="h-5 w-5 text-slate-600" />
                    </div>
                    <CardTitle className="text-lg font-bold">{budget.categoryName}</CardTitle>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingBudget(budget); setIsModalOpen(true); }}>
                      <Pencil className="h-4 w-4 text-blue-600" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => setConfirmDeleteId(budget.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Limite Mensal</span>
                  <span className="font-bold">{formatCurrency(budget.limit)}</span>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span>Gasto atual</span>
                    <span className={budget.percentage >= 100 ? 'text-red-600 font-bold' : ''}>
                      {budget.percentage}%
                    </span>
                  </div>
                  <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${budget.percentage >= 100 ? 'bg-red-500' : budget.percentage >= 80 ? 'bg-orange-500' : 'bg-blue-500'
                        }`}
                      style={{ width: `${Math.min(100, budget.percentage)}%` }}
                    />
                  </div>
                </div>

                <div className="flex justify-between text-sm pt-2 border-t">
                  <span className="text-muted-foreground">Disponível</span>
                  <span className={`font-bold ${budget.remaining > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(budget.remaining)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}

          {budgets.length === 0 && (
            <div className="col-span-full py-20 text-center border-2 border-dashed rounded-xl text-muted-foreground">
              Nenhuma meta definida. Comece criando uma para controlar seus gastos por categoria!
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
