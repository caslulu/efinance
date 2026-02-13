import { useState, useEffect } from 'react';
import { api } from '../../../api/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface UpsertBudgetModalProps {
  isOpen: boolean;
  budget: any | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const UpsertBudgetModal = ({ isOpen, budget, onClose, onSuccess }: UpsertBudgetModalProps) => {
  const [categoryId, setCategoryId] = useState('');
  const [limit, setLimit] = useState('');
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      api.get('/categories').then(res => setCategories(res.data));
      if (budget) {
        // Need to find category id by name or pass it in budget object
        // For now let's assume we fetch category_id in budget
        setCategoryId(String(budget.category_id || ''));
        setLimit(String(budget.limit));
      } else {
        setCategoryId('');
        setLimit('');
      }
    }
  }, [isOpen, budget]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryId || !limit) return;

    setLoading(true);
    try {
      await api.post('/budgets', {
        category_id: Number(categoryId),
        limit: Number(limit)
      });
      onSuccess();
      onClose();
    } catch (error) {
      alert('Falha ao salvar meta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{budget ? 'Editar Meta' : 'Nova Meta de Gasto'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="category">Categoria</Label>
            <Select 
              value={categoryId} 
              onValueChange={setCategoryId}
              disabled={!!budget} // Cannot change category of existing budget, must delete and recreate
            >
              <SelectTrigger id="category">
                <SelectValue placeholder="Selecione a Categoria" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="limit">Limite Mensal (R$)</Label>
            <Input 
              id="limit" 
              type="number" 
              step="0.01" 
              value={limit} 
              onChange={e => setLimit(e.target.value)} 
              placeholder="Ex: 500.00"
              required 
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar Meta'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
