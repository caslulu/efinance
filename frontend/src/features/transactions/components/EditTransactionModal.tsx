import { useState, useEffect } from 'react';
import { api } from '../../../api/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Transaction } from '../../../types/Transaction';

interface EditTransactionModalProps {
  isOpen: boolean;
  transaction: Transaction | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const EditTransactionModal = ({ isOpen, transaction, onClose, onSuccess }: EditTransactionModalProps) => {
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState('');
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setError('');
      api.get('/categories').then(res => {
        if (Array.isArray(res.data)) setCategories(res.data);
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (transaction) {
      setAmount(String(transaction.value));
      setCategoryId(String(transaction.category_id));
      // Format date to YYYY-MM-DD for input
      const dateObj = new Date(transaction.transaction_date);
      setDate(dateObj.toISOString().split('T')[0]);
    }
  }, [transaction]);

  const handleDelete = async () => {
    if (!transaction) return;
    
    let message = 'Tem certeza que deseja excluir esta transação?';
    if (transaction.is_recurring) {
      message = 'Esta é uma transação recorrente. Excluir apagará todas as recorrências desta série. Confirmar?';
    } else if (transaction.installment_total && transaction.installment_total > 1) {
      message = 'Esta é uma compra parcelada. Excluir apagará todas as parcelas. Confirmar?';
    }

    if (!window.confirm(message)) return;

    setLoading(true);
    try {
      await api.delete(`/transactions/${transaction.id}`);
      onSuccess();
      onClose();
    } catch (err) {
      setError('Falha ao excluir transação.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !transaction) return;

    setLoading(true);
    setError('');
    
    try {
      const payload = {
        value: Number(amount),
        category_id: categoryId ? Number(categoryId) : undefined,
        transaction_date: new Date(date).toISOString(),
      };
      
      await api.patch(`/transactions/${transaction.id}`, payload);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError('Falha ao atualizar transação.');
    } finally {
      setLoading(false);
    }
  };

  if (!transaction) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Editar Transação</DialogTitle>
        </DialogHeader>
        {error && <div className="mb-2 rounded bg-red-100 p-2 text-sm text-red-600">{error}</div>}
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="amount">Valor</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              required
              min="0.01"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="date">Data</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="category">Categoria</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger id="category">
                <SelectValue placeholder="Selecione (Padrão: Outro)" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="sm:justify-between">
            <Button type="button" variant="destructive" onClick={handleDelete} disabled={loading}>
              Excluir
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
