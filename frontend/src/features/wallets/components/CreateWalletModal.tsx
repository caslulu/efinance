import { useState } from 'react';
import { api } from '../../../api/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
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
import { WALLET_TYPES } from '../../../constants/paymentMethods';

interface CreateWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const WALLET_TYPE_OPTIONS = [
  { value: 'BANK', label: WALLET_TYPES.BANK_ACCOUNT },
  { value: 'PHYSICAL', label: WALLET_TYPES.PHYSICAL },
  { value: 'MEAL_VOUCHER', label: WALLET_TYPES.MEAL_VOUCHER },
  { value: 'INVESTMENT', label: WALLET_TYPES.INVESTMENT },
  { value: 'OTHER', label: WALLET_TYPES.OTHER },
];

export const CreateWalletModal = ({ isOpen, onClose, onSuccess }: CreateWalletModalProps) => {
  const [name, setName] = useState('');
  const [type, setType] = useState('BANK');
  const [balance, setBalance] = useState('');
  const [closingDay, setClosingDay] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/wallets', {
        name,
        type,
        actual_cash: Number(balance),
        closing_day: closingDay ? Number(closingDay) : undefined,
        due_day: dueDay ? Number(dueDay) : undefined,
      });
      onSuccess();
      onClose();
      setName('');
      setBalance('');
      setType('BANK');
      setClosingDay('');
      setDueDay('');
    } catch (error) {
      alert('Falha ao criar carteira');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Nova Carteira</DialogTitle>
          <DialogDescription>
            Crie uma nova carteira para organizar suas finanças.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="type">Tipo</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="type">
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {WALLET_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="balance">Saldo Inicial</Label>
            <Input
              id="balance"
              type="number"
              step="0.01"
              value={balance}
              onChange={e => setBalance(e.target.value)}
              required
            />
          </div>
          
          {type === 'BANK' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="closingDay">Dia Fechamento</Label>
                <Input
                  id="closingDay"
                  type="number"
                  min="1"
                  max="31"
                  placeholder="Ex: 10"
                  value={closingDay}
                  onChange={e => setClosingDay(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="dueDay">Dia Vencimento</Label>
                <Input
                  id="dueDay"
                  type="number"
                  min="1"
                  max="31"
                  placeholder="Ex: 17"
                  value={dueDay}
                  onChange={e => setDueDay(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Criando...' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
