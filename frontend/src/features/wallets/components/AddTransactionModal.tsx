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

interface AddTransactionModalProps {
  isOpen: boolean;
  type: 'INCOME' | 'EXPENSE' | null;
  walletId: number | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddTransactionModal = ({ isOpen, type, walletId, onClose, onSuccess }: AddTransactionModalProps) => {
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [installments, setInstallments] = useState('');
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      api.get('/categories').then(res => {
        if (Array.isArray(res.data)) setCategories(res.data);
      });
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryId || !amount) {
      alert('Please fill all fields');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        wallet_id: walletId,
        value: Number(amount),
        transaction_type: type,
        category_id: Number(categoryId),
        transaction_date: new Date(date).toISOString(),
        is_recurring: false,
        installment_total: installments ? Number(installments) : undefined,
      };
      
      await api.post('/transactions', payload);
      onSuccess();
      onClose();
      setAmount('');
      setCategoryId('');
      setInstallments('');
    } catch (error) {
      alert('Failed to process transaction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {type === 'INCOME' ? 'Add Funds' : 'Record Expense'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="amount">Amount</Label>
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
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="category">Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger id="category">
                <SelectValue placeholder="Select Category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {type === 'EXPENSE' && (
            <div className="grid gap-2">
              <Label htmlFor="installments">Installments (Optional)</Label>
              <Input
                id="installments"
                type="number"
                value={installments}
                onChange={e => setInstallments(e.target.value)}
                placeholder="1 (Single)"
                min="1"
              />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Processing...' : 'Confirm'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};