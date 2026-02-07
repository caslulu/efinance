import { useState, useEffect } from 'react';
import { api } from '../../../api/api';
import type { Wallet } from '../../../types/Wallet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
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
import { ALLOWED_METHODS, PAYMENT_METHODS, WALLET_TYPES } from '../../../constants/paymentMethods';

interface CreateSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateSubscriptionModal = ({ isOpen, onClose, onSuccess }: CreateSubscriptionModalProps) => {
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [type, setType] = useState('EXPENSE');
  const [frequency, setFrequency] = useState('MONTHLY');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [walletId, setWalletId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPaymentMethod('');
      api.get('/wallets').then(res => setWallets(res.data));
      api.get('/categories').then(res => setCategories(res.data));
    }
  }, [isOpen]);

  const getAvailableMethods = () => {
    const selectedWallet = wallets.find(w => String(w.id) === walletId);
    if (!selectedWallet) return [];
    
    let normalizedType = selectedWallet.type;
    // Assuming backend returns ENUM keys (BANK, PHYSICAL...), map to constants if needed
    // But WALLET_TYPES constants ARE the labels (Conta Bancária).
    // The backend returns 'BANK'.
    // So we need to map 'BANK' -> 'Conta Bancária'.
    
    if (selectedWallet.type === 'BANK') normalizedType = WALLET_TYPES.BANK_ACCOUNT;
    if (selectedWallet.type === 'PHYSICAL') normalizedType = WALLET_TYPES.PHYSICAL;
    if (selectedWallet.type === 'MEAL_VOUCHER') normalizedType = WALLET_TYPES.MEAL_VOUCHER;
    if (selectedWallet.type === 'INVESTMENT') normalizedType = WALLET_TYPES.INVESTMENT;
    if (selectedWallet.type === 'OTHER') normalizedType = WALLET_TYPES.OTHER;

    return ALLOWED_METHODS[normalizedType] || [];
  };

  const availableMethods = getAvailableMethods();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (availableMethods.length > 0 && !paymentMethod) {
      alert('Selecione um método de pagamento');
      return;
    }

    setLoading(true);
    try {
      await api.post('/subscriptions', {
        name,
        value: Number(value),
        transaction_type: type,
        frequency,
        start_date: new Date(startDate).toISOString(),
        wallet_id: Number(walletId),
        category_id: Number(categoryId),
        payment_method: paymentMethod || undefined,
      });
      onSuccess();
      onClose();
      setName('');
      setValue('');
      setPaymentMethod('');
    } catch (error) {
      alert('Falha ao criar item recorrente');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Novo Item Recorrente</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="type">Tipo</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="type">
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EXPENSE">Despesa</SelectItem>
                <SelectItem value="INCOME">Receita (Salário)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="value">Valor</Label>
              <Input id="value" type="number" step="0.01" value={value} onChange={e => setValue(e.target.value)} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="frequency">Frequência</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger id="frequency">
                  <SelectValue placeholder="Selecione a frequência" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WEEKLY">Semanal</SelectItem>
                  <SelectItem value="MONTHLY">Mensal</SelectItem>
                  <SelectItem value="QUARTERLY">Trimestral</SelectItem>
                  <SelectItem value="YEARLY">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="startDate">Data de Início</Label>
            <Input id="startDate" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="wallet">Carteira</Label>
            <Select value={walletId} onValueChange={setWalletId}>
              <SelectTrigger id="wallet">
                <SelectValue placeholder="Selecione a Carteira" />
              </SelectTrigger>
              <SelectContent>
                {wallets.map(w => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          
          {availableMethods.length > 0 && (
            <div className="grid gap-2">
              <Label htmlFor="method">Método de Pagamento</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger id="method">
                  <SelectValue placeholder="Selecione o método" />
                </SelectTrigger>
                <SelectContent>
                  {availableMethods.map(methodKey => (
                    <SelectItem key={methodKey} value={methodKey}>
                      {PAYMENT_METHODS[methodKey as keyof typeof PAYMENT_METHODS]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="category">Categoria</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger id="category">
                <SelectValue placeholder="Selecione a Categoria" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Criando...' : 'Criar'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
