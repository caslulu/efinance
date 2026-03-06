import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useUpdateCard } from '../../../hooks/useCards';
import type { Card } from '../../../types/Card';
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

interface EditCardModalProps {
  isOpen: boolean;
  card: Card | null;
  onClose: () => void;
  onSuccess: () => void;
  onDelete: (id: number) => void;
}

export const EditCardModal = ({
  isOpen,
  card,
  onClose,
  onSuccess,
  onDelete,
}: EditCardModalProps) => {
  const [name, setName] = useState('');
  const [flag, setFlag] = useState('VISA');
  const [closingDay, setClosingDay] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [cardLimit, setCardLimit] = useState('');
  
  const updateCard = useUpdateCard();

  useEffect(() => {
    if (card) {
      setName(card.name);
      setFlag(card.flag);
      setClosingDay(String(card.closing_day));
      setDueDay(String(card.due_day));
      setCardLimit(String(card.card_limit));
    }
  }, [card]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!card) return;
    
    try {
      await updateCard.mutateAsync({
        id: card.id,
        data: {
          name,
          flag,
          closing_day: Number(closingDay),
          due_day: Number(dueDay),
          card_limit: Number(cardLimit),
        }
      });
      toast.success('Cartão atualizado!');
      onSuccess();
      onClose();
    } catch {
      toast.error('Falha ao atualizar cartão');
    }
  };

  if (!card) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Editar Cartão</DialogTitle>
          <DialogDescription>Atualize as informações do cartão.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="editCardName">Nome do Cartão</Label>
            <Input
              id="editCardName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="editFlag">Bandeira</Label>
            <Select value={flag} onValueChange={setFlag}>
              <SelectTrigger id="editFlag">
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
              <Label htmlFor="editClosingDay">Dia Fechamento</Label>
              <Input
                id="editClosingDay"
                type="number"
                min="1"
                max="31"
                value={closingDay}
                onChange={(e) => setClosingDay(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="editDueDay">Dia Vencimento</Label>
              <Input
                id="editDueDay"
                type="number"
                min="1"
                max="31"
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="editCardLimit">Limite do Cartão</Label>
            <CurrencyInput
              id="editCardLimit"
              value={cardLimit}
              onValueChange={setCardLimit}
              required
            />
          </div>
          <DialogFooter className="flex justify-between">
            <Button
              type="button"
              variant="destructive"
              onClick={() => onDelete(card.id)}
            >
              Excluir
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={updateCard.isPending}>
                {updateCard.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
