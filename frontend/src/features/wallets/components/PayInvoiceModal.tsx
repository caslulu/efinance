import { useState, useEffect } from 'react';
import { api } from '../../../api/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Wallet } from '../../../types/Wallet';

interface PayInvoiceModalProps {
  isOpen: boolean;
  wallet: Wallet | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const PayInvoiceModal = ({ isOpen, wallet, onClose, onSuccess }: PayInvoiceModalProps) => {
  const [amount, setAmount] = useState('');
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [sourceWalletId, setSourceWalletId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      api.get('/wallets').then(res => {
        setWallets(res.data);
        // Default to first bank account or first wallet that is not the current one
        const defaultSource = res.data.find((w: Wallet) => w.id !== wallet?.id && w.type === 'BANK') 
          || res.data.find((w: Wallet) => w.id !== wallet?.id);
        if (defaultSource) setSourceWalletId(String(defaultSource.id));
      });
    }
  }, [isOpen, wallet]);

  useEffect(() => {
    if (wallet && isOpen) {
      const due = Number(wallet.due_invoice || 0);
      const current = Number(wallet.current_invoice || 0);
      setAmount(due > 0 ? String(due) : String(current));
      setError('');
    }
  }, [wallet, isOpen]);

  const sourceWallet = wallets.find(w => String(w.id) === sourceWalletId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet || !amount || !sourceWalletId) return;

    const val = Number(amount);
    if (val <= 0) {
      setError('Valor inválido');
      return;
    }

    if (sourceWallet && val > Number(sourceWallet.actual_cash)) {
      setError('Saldo insuficiente na carteira de origem.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 1. Create Expense (Debit) in the Source Wallet
      await api.post('/transactions', {
        wallet_id: Number(sourceWalletId),
        value: val,
        transaction_type: 'EXPENSE',
        payment_method: 'DEBIT',
        transaction_date: new Date().toISOString(),
        is_recurring: false,
      });

      // 2. Create Income (Credit) in the Target Credit Wallet to reduce its invoice
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
            Escolha de onde sairá o dinheiro para pagar esta fatura.
          </DialogDescription>
        </DialogHeader>
        {error && <div className="mb-2 rounded bg-red-100 p-2 text-sm text-red-600">{error}</div>}
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="sourceWallet">Carteira de Origem (Onde sai o dinheiro)</Label>
            <Select value={sourceWalletId} onValueChange={setSourceWalletId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma carteira" />
              </SelectTrigger>
              <SelectContent>
                {wallets.map(w => (
                  <SelectItem key={w.id} value={String(w.id)}>
                    {w.name} (R$ {Number(w.actual_cash).toFixed(2)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading || !sourceWalletId}>
              {loading ? 'Processando...' : 'Confirmar Pagamento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};