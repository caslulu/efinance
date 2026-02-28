import * as React from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
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
} from "@/components/ui/select"
import { ALLOWED_METHODS, PAYMENT_METHODS, WALLET_TYPES } from '../../../constants/paymentMethods';
import { CategoryIcon } from '@/components/IconPicker';
import { api } from '@/api/api';
import type { Wallet } from '@/types/Wallet';
import type { Subscription } from '@/types/Subscription';
import { useUpdateSubscription } from '@/hooks';

interface EditSubscriptionModalProps {
    isOpen: boolean;
    subscription: Subscription | null;
    onClose: () => void;
    onSuccess: () => void;
}

export const EditSubscriptionModal = ({ isOpen, subscription, onClose, onSuccess }: EditSubscriptionModalProps) => {
    const [name, setName] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [value, setValue] = React.useState('');
    const [type, setType] = React.useState('EXPENSE');
    const [frequency, setFrequency] = React.useState('MONTHLY');
    const [startDate, setStartDate] = React.useState('');
    const [walletId, setWalletId] = React.useState('');
    const [categoryId, setCategoryId] = React.useState('');
    const [paymentMethod, setPaymentMethod] = React.useState<Subscription['payment_method'] | ''>('');

    const [wallets, setWallets] = React.useState<Wallet[]>([]);
    const [categories, setCategories] = React.useState<any[]>([]);

    const updateMutation = useUpdateSubscription();

    React.useEffect(() => {
        if (isOpen) {
            api.get('/wallets').then(res => setWallets(res.data));
            api.get('/categories').then(res => setCategories(res.data));
        }
    }, [isOpen]);

    React.useEffect(() => {
        if (subscription && isOpen) {
            setName(subscription.name || '');
            setDescription(subscription.description || '');
            setValue(String(subscription.value || ''));
            setType(subscription.transaction_type || 'EXPENSE');
            setFrequency(subscription.frequency || 'MONTHLY');
            if (subscription.start_date) {
                setStartDate(new Date(subscription.start_date).toISOString().split('T')[0]);
            } else {
                setStartDate('');
            }
            setWalletId(String(subscription.wallet_id || ''));
            setCategoryId(String(subscription.category_id || ''));
            setPaymentMethod(subscription.payment_method || '');
        }
    }, [subscription, isOpen]);

    const getAvailableMethods = () => {
        const selectedWallet = wallets.find(w => String(w.id) === walletId);
        if (!selectedWallet) return [];

        let normalizedType: string = selectedWallet.type;

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
            toast.warning('Selecione um método de pagamento');
            return;
        }

        if (!subscription) return;

        try {
            await updateMutation.mutateAsync({
                id: subscription.id,
                data: {
                    name,
                    description: description || undefined,
                    value: Number(value),
                    transaction_type: type as any,
                    frequency: frequency as any,
                    start_date: new Date(startDate).toISOString(),
                    wallet_id: Number(walletId),
                    category_id: Number(categoryId),
                    payment_method: paymentMethod || undefined,
                }
            });
            onSuccess();
            onClose();
        } catch (error) {
            toast.error('Falha ao atualizar item recorrente');
        }
    };

    if (!subscription) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Editar Item Recorrente</DialogTitle>
                    <DialogDescription>
                        Atualize os dados desta recorrência abaixo. Alterações afetarão apenas transações futuras não geradas ainda.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid gap-4 py-4 max-h-[80vh] overflow-y-auto pr-2">
                    <div className="grid gap-2">
                        <Label htmlFor="edit-name">Nome / Título</Label>
                        <Input id="edit-name" value={name} onChange={e => setName(e.target.value)} required />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="edit-desc">Descrição (Opcional)</Label>
                        <Input id="edit-desc" value={description} onChange={e => setDescription(e.target.value)} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="edit-type">Tipo</Label>
                        <Select value={type} onValueChange={setType}>
                            <SelectTrigger id="edit-type">
                                <SelectValue placeholder="Selecione o tipo" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="EXPENSE">Despesa</SelectItem>
                                <SelectItem value="INCOME">Receita</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="edit-value">Valor</Label>
                            <CurrencyInput id="edit-value" value={value} onValueChange={setValue} required />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="edit-freq">Frequência</Label>
                            <Select value={frequency} onValueChange={setFrequency}>
                                <SelectTrigger id="edit-freq">
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
                        <Label htmlFor="edit-start">Data Base (Início)</Label>
                        <Input id="edit-start" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="edit-wallet">Carteira</Label>
                        <Select value={walletId} onValueChange={setWalletId}>
                            <SelectTrigger id="edit-wallet">
                                <SelectValue placeholder="Selecione a Carteira" />
                            </SelectTrigger>
                            <SelectContent>
                                {wallets.map(w => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

                    {availableMethods.length > 0 && (
                        <div className="grid gap-2">
                            <Label htmlFor="edit-method">Método de Pagamento</Label>
                            <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as Subscription['payment_method'])}>
                                <SelectTrigger id="edit-method">
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
                        <Label htmlFor="edit-category">Categoria</Label>
                        <Select value={categoryId} onValueChange={setCategoryId}>
                            <SelectTrigger id="edit-category">
                                <SelectValue placeholder="Selecione a Categoria" />
                            </SelectTrigger>
                            <SelectContent>
                                {categories.map(c => (
                                    <SelectItem key={c.id} value={String(c.id)}>
                                        <div className="flex items-center gap-2">
                                            <CategoryIcon name={c.icon} className="h-4 w-4" />
                                            <span>{c.name}</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
                        <Button type="submit" disabled={updateMutation.isPending}>{updateMutation.isPending ? 'Salvando...' : 'Salvar'}</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
