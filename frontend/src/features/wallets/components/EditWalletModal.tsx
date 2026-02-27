import { useState, useEffect } from 'react';
import { toast } from 'sonner';
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
import type { Wallet } from '../../../types/Wallet';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Trash2 } from 'lucide-react';

interface EditWalletModalProps {
  isOpen: boolean;
  wallet: Wallet | null;
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

export const EditWalletModal = ({ isOpen, wallet, onClose, onSuccess }: EditWalletModalProps) => {
  const [name, setName] = useState('');
  const [type, setType] = useState('BANK');
  const [closingDay, setClosingDay] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (wallet) {
      setName(wallet.name);
      setType(wallet.type);
      setClosingDay(wallet.closing_day ? String(wallet.closing_day) : '');
      setDueDay(wallet.due_day ? String(wallet.due_day) : '');
    }
  }, [wallet]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet) return;

    setLoading(true);
    try {
      await api.patch(`/wallets/${wallet.id}`, {
        name,
        type,
        closing_day: closingDay ? Number(closingDay) : null,
        due_day: dueDay ? Number(dueDay) : null,
      });
      onSuccess();
      onClose();
    } catch (error) {
      toast.error('Falha ao atualizar carteira');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!wallet) return;
    try {
      await api.delete(`/wallets/${wallet.id}`);
      toast.success('Carteira excluída com sucesso');
      onSuccess();
      onClose();
    } catch (error) {
      toast.error('Falha ao excluir carteira');
    }
  };

  if (!wallet) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Carteira</DialogTitle>
            <DialogDescription>
              Atualize os dados da sua carteira.
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

            <DialogFooter className="flex !justify-between">
              <Button
                type="button"
                variant="ghost"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => setConfirmDelete(true)}
                disabled={loading}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        title="Excluir Carteira"
        description={`Tem certeza que deseja excluir a carteira "${wallet.name}"? Todas as transações associadas também serão removidas. Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir Carteira"
        destructive
        onConfirm={() => {
          setConfirmDelete(false);
          handleDelete();
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
};