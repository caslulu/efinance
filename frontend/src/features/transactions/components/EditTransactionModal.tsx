import { useState, useEffect } from 'react';
import { api } from '../../../api/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/CurrencyInput';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Transaction } from '../../../types/Transaction';
import { CategoryIcon } from '@/components/IconPicker';
import { ConfirmDialog } from '@/components/ConfirmDialog';

interface EditTransactionModalProps {
  isOpen: boolean;
  transaction: Transaction | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const EditTransactionModal = ({ isOpen, transaction, onClose, onSuccess }: EditTransactionModalProps) => {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState('');
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState('');

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
      setDescription(transaction.description || '');
      setCategoryId(String(transaction.category_id));
      // Format date to YYYY-MM-DD for input
      const dateObj = new Date(transaction.transaction_date);
      setDate(dateObj.toISOString().split('T')[0]);
    }
  }, [transaction]);

  const handleDeleteClick = () => {
    if (!transaction) return;

    let message = 'Tem certeza que deseja excluir esta transação?';

    if (transaction.is_recurring && transaction.installment_id) {
      message = 'Esta é uma transação recorrente (Série). Excluir apagará todas as recorrências desta série. Confirmar?';
    } else if (transaction.is_recurring) {
      message = 'Esta é uma transação recorrente avulsa. Confirmar exclusão?';
    } else if (transaction.installment_total && transaction.installment_total > 1) {
      message = 'Esta é uma compra parcelada. Excluir apagará todas as parcelas. Confirmar?';
    }

    setDeleteMessage(message);
    setShowDeleteConfirm(true);
  };

  const handleDelete = async () => {
    if (!transaction) return;

    setShowDeleteConfirm(false);
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
        description: description || undefined,
        category_id: categoryId ? Number(categoryId) : undefined,
        transaction_date: new Date(date).toISOString(),
      };

      await api.patch(`/transactions/${transaction.id}`, payload);
      onSuccess();
      onClose();
    } catch (err) {
      setError('Falha ao atualizar transação.');
    } finally {
      setLoading(false);
    }
  };

  if (!transaction) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Transação</DialogTitle>
            <DialogDescription>
              Atualize os detalhes desta transação abaixo.
            </DialogDescription>
          </DialogHeader>
          {error && <div className="mb-2 rounded bg-red-100 p-2 text-sm text-red-600">{error}</div>}
          <form onSubmit={handleSubmit} className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="description">Nome / Descrição (Opcional)</Label>
              <Input
                id="description"
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Ex: Aluguel, Supermercado..."
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="amount">Valor</Label>
              <CurrencyInput
                id="amount"
                value={amount}
                onValueChange={setAmount}
                required
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
                    <SelectItem key={c.id} value={String(c.id)}>
                      <div className="flex items-center gap-2">
                        <CategoryIcon name={c.icon} className="h-4 w-4" />
                        <span>{c.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="sm:justify-between">
              <Button type="button" variant="destructive" onClick={handleDeleteClick} disabled={loading}>
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

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Excluir Transação"
        description={deleteMessage}
        confirmLabel="Excluir"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  );
};
