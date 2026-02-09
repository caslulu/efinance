import { useState, useEffect } from 'react';
import { api } from '../../../api/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Wallet } from '../../../types/Wallet';

interface PayInvoiceModalProps {
  isOpen: boolean;
  wallet: Wallet | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const PayInvoiceModal = ({ isOpen, wallet, onClose, onSuccess }: PayInvoiceModalProps) => {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (wallet && isOpen) {
      // Default to paying the Closed Invoice if available, else Current Invoice
      const due = Number(wallet.due_invoice || 0);
      const current = Number(wallet.current_invoice || 0);
      setAmount(due > 0 ? String(due) : String(current));
      setError('');
    }
  }, [wallet, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet || !amount) return;

    const val = Number(amount);
    if (val <= 0) {
      setError('Valor inválido');
      return;
    }

    if (val > wallet.actual_cash) {
      setError('Saldo insuficiente na carteira para realizar o pagamento.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 1. Create Expense (Debit) to reduce Wallet Balance
      await api.post('/transactions', {
        wallet_id: wallet.id,
        value: val,
        transaction_type: 'EXPENSE',
        payment_method: 'DEBIT', // Or Transfer/Money
        transaction_date: new Date().toISOString(),
        is_recurring: false,
        // Category? Maybe "Pagamento de Fatura" needs a category?
        // Let's leave undefined (default "Outro") or we should fetch categories.
        // For simplicity, let it default.
      });

      // 2. Create Income (Credit) to reduce Invoice Debt
      await api.post('/transactions', {
        wallet_id: wallet.id,
        value: val,
        transaction_type: 'INCOME',
        payment_method: 'CREDIT',
        transaction_date: new Date().toISOString(),
        is_recurring: false,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError('Falha ao processar pagamento.');
    } finally {
      setLoading(false);
    }
  };

  if (!wallet) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Pagar Fatura: {wallet.name}</DialogTitle>
          <DialogDescription>
            Isso debitará do saldo da carteira e abaterá da fatura do cartão.
          </DialogDescription>
        </DialogHeader>
        {error && <div className="mb-2 rounded bg-red-100 p-2 text-sm text-red-600">{error}</div>}
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="amount">Valor do Pagamento</Label>
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
          <div className="text-sm text-muted-foreground">
            Saldo Disponível: R$ {Number(wallet.actual_cash).toFixed(2)}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Processando...' : 'Confirmar Pagamento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};