import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { useUpdateCard } from '../../../hooks/useCards';
import type { Card } from '../../../types/Card';
import { formatCurrency, getErrorMessage } from '@/lib/utils';
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
  const [usableLimit, setUsableLimit] = useState('');
  
  const updateCard = useUpdateCard();

  useEffect(() => {
    if (card) {
      setName(card.name);
      setFlag(card.flag);
      setClosingDay(String(card.closing_day));
      setDueDay(String(card.due_day));
      setCardLimit(String(card.card_limit));
      setUsableLimit(String(card.usable_limit ?? card.card_limit));
    }
  }, [card]);

  const approvedLimit = Number(cardLimit || 0);
  const committedLimit = useMemo(
    () => Math.max(0, Number(card?.committed_limit ?? card?.total_invoice ?? 0)),
    [card],
  );
  const activeLimit = Number(usableLimit || 0);
  const sliderMax = Math.max(0, approvedLimit);
  const sliderMin = Math.min(committedLimit, sliderMax);
  const isLimitLocked = committedLimit > approvedLimit;
  const remainingLimit = Math.max(0, activeLimit - committedLimit);

  const updateApprovedLimit = (value: string) => {
    setCardLimit(value);
    const nextApproved = Number(value || 0);
    const currentUsable = Number(usableLimit || 0);
    if (currentUsable > nextApproved) {
      setUsableLimit(String(nextApproved));
    }
  };

  const updateUsableLimit = (value: string) => {
    const parsed = Number(value || 0);
    const clamped = Math.min(Math.max(parsed, committedLimit), approvedLimit);
    setUsableLimit(String(Number.isFinite(clamped) ? clamped : 0));
  };

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
          usable_limit: Number(usableLimit),
        }
      });
      toast.success('Cartão atualizado!');
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Falha ao atualizar cartão'));
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
              onValueChange={updateApprovedLimit}
              required
            />
          </div>
          <div className="rounded-lg border border-border/70 bg-muted/30 p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <Label htmlFor="editUsableLimit">Limite disponível para uso</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Ajuste quanto deste cartão pode ficar liberado agora.
                </p>
              </div>
              <span className="text-sm font-bold text-foreground">
                {formatCurrency(activeLimit)}
              </span>
            </div>

            <input
              id="editUsableLimit"
              type="range"
              min={sliderMin}
              max={sliderMax}
              step="10"
              value={Math.min(Math.max(activeLimit, sliderMin), sliderMax)}
              disabled={isLimitLocked || sliderMax <= 0}
              onChange={(event) => updateUsableLimit(event.target.value)}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
            />

            <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
              <div>
                <p className="font-semibold uppercase tracking-wide text-muted-foreground/70">Comprometido</p>
                <p className="font-bold text-foreground">{formatCurrency(committedLimit)}</p>
              </div>
              <div>
                <p className="font-semibold uppercase tracking-wide text-muted-foreground/70">Restante</p>
                <p className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(remainingLimit)}</p>
              </div>
              <div>
                <p className="font-semibold uppercase tracking-wide text-muted-foreground/70">Aprovado</p>
                <p className="font-bold text-foreground">{formatCurrency(approvedLimit)}</p>
              </div>
            </div>

            {isLimitLocked && (
              <p className="mt-3 rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                O valor já comprometido está acima do limite aprovado. Aumente o limite aprovado para salvar novos ajustes.
              </p>
            )}
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
