import { useState } from 'react';
import { toast } from 'sonner';
import { useCreateCard } from '../../../hooks/useCards';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
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
} from '@/components/ui/select';

const CARD_FLAGS = [
  { value: 'VISA', label: 'Visa' },
  { value: 'MASTERCARD', label: 'Mastercard' },
  { value: 'ELO', label: 'Elo' },
  { value: 'AMEX', label: 'American Express' },
  { value: 'HIPERCARD', label: 'Hipercard' },
  { value: 'OTHER', label: 'Outra' },
];

interface CreateCardModalProps {
  isOpen: boolean;
  walletId: number | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateCardModal = ({
  isOpen,
  walletId,
  onClose,
  onSuccess,
}: CreateCardModalProps) => {
  const [name, setName] = useState('');
  const [flag, setFlag] = useState('VISA');
  const [closingDay, setClosingDay] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [cardLimit, setCardLimit] = useState('');
  
  const createCard = useCreateCard();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletId) return;
    
    try {
      await createCard.mutateAsync({
        wallet_id: walletId,
        name,
        flag,
        closing_day: Number(closingDay),
        due_day: Number(dueDay),
        card_limit: Number(cardLimit),
      });
      toast.success('Cartão criado com sucesso!');
      onSuccess();
      onClose();
      setName('');
      setFlag('VISA');
      setClosingDay('');
      setDueDay('');
      setCardLimit('');
    } catch {
      toast.error('Falha ao criar cartão');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Novo Cartão</DialogTitle>
          <DialogDescription>
            Adicione um cartão de crédito à sua carteira.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="cardName">Nome do Cartão</Label>
            <Input
              id="cardName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Nubank Gold"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="flag">Bandeira</Label>
            <Select value={flag} onValueChange={setFlag}>
              <SelectTrigger id="flag">
                <SelectValue placeholder="Selecione a bandeira" />
              </SelectTrigger>
              <SelectContent>
                {CARD_FLAGS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
                onChange={(e) => setClosingDay(e.target.value)}
                required
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
                onChange={(e) => setDueDay(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="cardLimit">Limite do Cartão</Label>
            <CurrencyInput
              id="cardLimit"
              value={cardLimit}
              onValueChange={setCardLimit}
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createCard.isPending}>
              {createCard.isPending ? 'Criando...' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
