import { useState, useEffect } from 'react';
import { api } from '../../../api/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ALLOWED_METHODS, PAYMENT_METHODS, WALLET_TYPES } from '../../../constants/paymentMethods';

interface AddTransactionModalProps {
  isOpen: boolean;
  type: 'INCOME' | 'EXPENSE' | null;
  walletId: number | null;
  walletType?: string;
  hasClosingDay?: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddTransactionModal = ({ isOpen, type, walletId, walletType, hasClosingDay, onClose, onSuccess }: AddTransactionModalProps) => {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [installments, setInstallments] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setError('');
      setPaymentMethod(hasClosingDay ? 'CREDIT' : '');
      setDescription('');
      api.get('/categories').then(res => {
        if (Array.isArray(res.data)) setCategories(res.data);
      });
    }
  }, [isOpen, hasClosingDay]);

  const getAvailableMethods = () => {
    if (!walletType) return [];
    
    // Normalize legacy types
    let normalizedType = walletType;
    if (walletType === 'BANK') normalizedType = WALLET_TYPES.BANK_ACCOUNT;
    if (walletType === 'PHYSICAL') normalizedType = WALLET_TYPES.PHYSICAL;
    if (walletType === 'MEAL_VOUCHER') normalizedType = WALLET_TYPES.MEAL_VOUCHER;
    if (walletType === 'INVESTMENT') normalizedType = WALLET_TYPES.INVESTMENT;
    if (walletType === 'OTHER') normalizedType = WALLET_TYPES.OTHER;

    return ALLOWED_METHODS[normalizedType] || [];
  };

  const availableMethods = getAvailableMethods();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount) {
      setError('Por favor informe o valor');
      return;
    }
    
    if (availableMethods.length > 0 && !paymentMethod) {
      setError('Selecione um método de pagamento');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const payload = {
        wallet_id: walletId,
        value: Number(amount),
        description: description || undefined,
        transaction_type: type,
        category_id: categoryId ? Number(categoryId) : undefined,
        payment_method: paymentMethod || undefined,
        // Use T12:00:00 to prevent timezone shifts (e.g. UTC midnight shifting to previous day in local time)
        transaction_date: new Date(date + 'T12:00:00').toISOString(),
        is_recurring: isRecurring,
        installment_total: (installments && !isRecurring) ? Number(installments) : undefined,
      };
      
      await api.post('/transactions', payload);
      onSuccess();
      onClose();
      setAmount('');
      setDescription('');
      setCategoryId('');
      setInstallments('');
      setPaymentMethod('');
      setIsRecurring(false);
    } catch (err: any) {
      const msg = err.response?.data?.message;
      if (msg === 'Insufficient funds in wallet') {
        setError('Você não tem saldo suficiente.');
      } else {
        setError(Array.isArray(msg) ? msg.join(', ') : msg || 'Falha ao processar transação');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {type === 'INCOME' ? 'Adicionar Saldo' : 'Registrar Despesa'}
          </DialogTitle>
          <DialogDescription>
            Preencha os dados abaixo para registrar uma nova transação.
          </DialogDescription>
        </DialogHeader>
        {error && <div className="mb-2 rounded bg-red-100 p-2 text-sm text-red-600">{error}</div>}
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="description">Nome / Descrição (Opcional)</Label>
            <Input
              id="description"
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Ex: Aluguel, Supermercado..."
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="amount">Valor</Label>
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
            <Label htmlFor="date">Data</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="category">Categoria</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger id="category">
                <SelectValue placeholder="Selecione (Padrão: Outro)" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox 
              id="recurring" 
              checked={isRecurring}
              onCheckedChange={(checked) => setIsRecurring(checked as boolean)}
            />
            <Label htmlFor="recurring">Transação Recorrente (Assinatura)</Label>
          </div>
          
          {type === 'EXPENSE' && !isRecurring && (
            <div className="grid gap-2">
              <Label htmlFor="installments">Parcelas (Opcional)</Label>
              <Input
                id="installments"
                type="number"
                value={installments}
                onChange={e => setInstallments(e.target.value)}
                placeholder="1 (À vista)"
                min="1"
              />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Processando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};