import { useState } from 'react';
import { toast } from 'sonner';
import { api } from '../../../api/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/CurrencyInput';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { WALLET_TYPES } from '../../../constants/paymentMethods';
import { Wallet as WalletIcon } from 'lucide-react';

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
  const [isTransferOnly, setIsTransferOnly] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/wallets', {
        name,
        type,
        actual_cash: Number(balance),
        is_transfer_only: isTransferOnly,
      });
      onSuccess();
      onClose();
      setName('');
      setBalance('');
      setType('BANK');
      setIsTransferOnly(false);
    } catch {
      toast.error('Falha ao criar carteira');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25">
              <WalletIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl">Nova Carteira</DialogTitle>
              <DialogDescription className="mt-1">
                Crie uma nova carteira para organizar suas finanças.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent -mx-6 my-1" />
        <form onSubmit={handleSubmit} className="grid gap-5 pt-2">
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
            <CurrencyInput
              id="balance"
              value={balance}
              onValueChange={setBalance}
              required
            />
          </div>
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-muted/50 border border-border/50">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Apenas Transferências</Label>
              <p className="text-xs text-muted-foreground">
                Desabilita lançamentos manuais (útil para contas correntes onde só entra o salário).
              </p>
            </div>
            <Switch
              checked={isTransferOnly}
              onCheckedChange={setIsTransferOnly}
            />
          </div>

          <DialogFooter className="pt-2">
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
