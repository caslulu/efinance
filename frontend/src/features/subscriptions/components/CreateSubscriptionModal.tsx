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
  
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      api.get('/wallets').then(res => setWallets(res.data));
      api.get('/categories').then(res => setCategories(res.data));
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      });
      onSuccess();
      onClose();
      setName('');
      setValue('');
    } catch (error) {
      alert('Failed to create subscription');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>New Recurring Item</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="type">Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EXPENSE">Expense</SelectItem>
                <SelectItem value="INCOME">Income (Salary)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="value">Value</Label>
              <Input id="value" type="number" step="0.01" value={value} onChange={e => setValue(e.target.value)} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="frequency">Frequency</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger id="frequency">
                  <SelectValue placeholder="Select frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WEEKLY">Weekly</SelectItem>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                  <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                  <SelectItem value="YEARLY">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="startDate">Start Date</Label>
            <Input id="startDate" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="wallet">Wallet</Label>
            <Select value={walletId} onValueChange={setWalletId}>
              <SelectTrigger id="wallet">
                <SelectValue placeholder="Select Wallet" />
              </SelectTrigger>
              <SelectContent>
                {wallets.map(w => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="category">Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger id="category">
                <SelectValue placeholder="Select Category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Creating...' : 'Create'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
