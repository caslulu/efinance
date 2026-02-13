import { useState, useEffect } from 'react';
import { api } from '../../../api/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Target, Pencil, Trash2 } from 'lucide-react';
import { UpsertBudgetModal } from '../components/UpsertBudgetModal';

export const BudgetsPage = () => {
  const [budgets, setBudgets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<any>(null);

  const fetchData = async () => {
    try {
      const res = await api.get('/budgets/status');
      setBudgets(res.data);
    } catch (error) {
      console.error('Failed to fetch budgets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm('Deseja excluir esta meta?')) return;
    try {
      await api.delete(`/budgets/${id}`);
      fetchData();
    } catch (error) {
      alert('Falha ao excluir meta');
    }
  };

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

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
        <div className="text-center py-10">Carregando metas...</div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {budgets.map((budget) => (
            <Card key={budget.id} className="relative group">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg font-bold">{budget.categoryName}</CardTitle>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingBudget(budget); setIsModalOpen(true); }}>
                      <Pencil className="h-4 w-4 text-blue-600" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => handleDelete(budget.id)}>
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
                      className={`h-full transition-all ${
                        budget.percentage >= 100 ? 'bg-red-500' : budget.percentage >= 80 ? 'bg-orange-500' : 'bg-blue-500'
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
        onSuccess={fetchData}
      />
    </div>
  );
};
