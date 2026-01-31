import { useState, useEffect } from 'react';
import { api } from '../../../api/api';
import type { Wallet } from '../../../types/Wallet';

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

  if (!isOpen) return null;

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
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">New Recurring Item</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700">Name</label>
            <input className="mt-1 block w-full rounded border p-2" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700">Type</label>
            <select className="mt-1 block w-full rounded border p-2" value={type} onChange={e => setType(e.target.value)}>
              <option value="EXPENSE">Expense</option>
              <option value="INCOME">Income (Salary)</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Value (Monthly)</label>
              <input type="number" step="0.01" className="mt-1 block w-full rounded border p-2" value={value} onChange={e => setValue(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Frequency</label>
              <select className="mt-1 block w-full rounded border p-2" value={frequency} onChange={e => setFrequency(e.target.value)}>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
                <option value="QUARTERLY">Quarterly</option>
                <option value="YEARLY">Yearly</option>
              </select>
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700">Start Date</label>
            <input type="date" className="mt-1 block w-full rounded border p-2" value={startDate} onChange={e => setStartDate(e.target.value)} required />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700">Wallet</label>
            <select className="mt-1 block w-full rounded border p-2" value={walletId} onChange={e => setWalletId(e.target.value)} required>
              <option value="">Select Wallet</option>
              {wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700">Category</label>
            <select className="mt-1 block w-full rounded border p-2" value={categoryId} onChange={e => setCategoryId(e.target.value)} required>
              <option value="">Select Category</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded px-4 py-2 text-gray-600 hover:bg-gray-100">Cancel</button>
            <button type="submit" disabled={loading} className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
