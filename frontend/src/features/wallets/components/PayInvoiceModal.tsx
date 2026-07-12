import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CurrencyInput } from '@/components/CurrencyInput';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Wallet } from '../../../types/Wallet';
import type { Card } from '../../../types/Card';
import { usePayInvoice, useWallets } from '@/hooks';

interface PayInvoiceModalProps {
  isOpen: boolean;
  card: Card | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const PayInvoiceModal = ({ isOpen, card, onClose, onSuccess }: PayInvoiceModalProps) => {
  const [amount, setAmount] = useState('');
  const { data: wallets = [] } = useWallets();
  const payInvoice = usePayInvoice();
  const [sourceWalletId, setSourceWalletId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || sourceWalletId || wallets.length === 0) return;
    const defaultSource = wallets.find((wallet: Wallet) => wallet.type === 'BANK')
      || wallets[0];
    if (defaultSource) setSourceWalletId(String(defaultSource.id));
  }, [isOpen, sourceWalletId, wallets]);

  useEffect(() => {
    if (card && isOpen) {
      const due = Number(card.due_invoice || 0);
      const current = Number(card.current_invoice || 0);
      setAmount(due > 0 ? String(due) : String(current));
      setError('');
    }
  }, [card, isOpen]);

  const sourceWallet = wallets.find(w => String(w.id) === sourceWalletId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!card || !amount || !sourceWalletId) return;

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
      await payInvoice.mutateAsync({
        cardId: card.id,
        sourceWalletId: Number(sourceWalletId),
        amount: val,
      });

      onSuccess();
      onClose();
    } catch {
      setError('Falha ao processar pagamento.');
    } finally {
      setLoading(false);
    }
  };

  if (!card) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Pagar Fatura: {card.name}</DialogTitle>
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
            <CurrencyInput
              id="amount"
              value={amount}
              onValueChange={setAmount}
              required
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
