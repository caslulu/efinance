import { useState, useEffect } from 'react';
import { api } from '../../../api/api';
import { getErrorMessage } from '@/lib/utils';
import type { Wallet } from '../../../types/Wallet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CurrencyInput } from '@/components/CurrencyInput';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRightLeft } from 'lucide-react';

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const TransferModal = ({ isOpen, onClose, onSuccess }: TransferModalProps) => {
  const [amount, setAmount] = useState('');
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      api.get('/wallets').then(res => setWallets(res.data));
      setError('');
      setAmount('');
      setFromId('');
      setToId('');
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromId || !toId || !amount) return;

    const val = Number(amount);
    if (val <= 0) {
      setError('Valor inválido');
      return;
    }

    if (fromId === toId) {
      setError('A carteira de origem e destino devem ser diferentes.');
      return;
    }

    const sourceWallet = wallets.find(w => String(w.id) === fromId);
    if (sourceWallet && val > Number(sourceWallet.actual_cash)) {
      setError('Saldo insuficiente na carteira de origem.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.post('/wallets/transfer', {
        fromId: Number(fromId),
        toId: Number(toId),
        amount: val
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, 'Falha ao processar transferência.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="text-blue-600" />
            Transferência entre Carteiras
          </DialogTitle>
          <DialogDescription>
            Mova dinheiro de uma carteira para outra de forma instantânea.
          </DialogDescription>
        </DialogHeader>
        {error && <div className="mb-2 rounded bg-red-100 p-2 text-sm text-red-600">{error}</div>}
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Origem (Sai o dinheiro)</Label>
            <Select value={fromId} onValueChange={setFromId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a origem" />
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
            <Label>Destino (Entra o dinheiro)</Label>
            <Select value={toId} onValueChange={setToId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o destino" />
              </SelectTrigger>
              <SelectContent>
                {wallets.map(w => (
                  <SelectItem key={w.id} value={String(w.id)}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="amount">Valor (R$)</Label>
            <CurrencyInput
              id="amount"
              value={amount}
              onValueChange={setAmount}
              placeholder="0.00"
              required
              />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading || !fromId || !toId}>
              {loading ? 'Processando...' : 'Confirmar Transferência'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
