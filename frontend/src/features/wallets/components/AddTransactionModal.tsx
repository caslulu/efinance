import { useState } from 'react';
import { api } from '../../../api/api';

interface AddTransactionModalProps {
  isOpen: boolean;
  type: 'INCOME' | 'EXPENSE' | null;
  walletId: number | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddTransactionModal = ({ isOpen, type, walletId, onClose, onSuccess }: AddTransactionModalProps) => {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen || !type || !walletId) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const endpoint = type === 'INCOME' 
        ? `/wallets/${walletId}/add-incoming`
        : `/wallets/${walletId}/add-expense`;
        
      await api.patch(endpoint, {
        amount: Number(amount),
      });
      onSuccess();
      onClose();
      setAmount('');
    } catch (error) {
      alert('Failed to process transaction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-sm">
        <h2 className="text-xl font-bold mb-4">
          {type === 'INCOME' ? 'Add Funds' : 'Record Expense'}
        </h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700">Amount</label>
            <input
              type="number"
              step="0.01"
              className="mt-1 block w-full rounded border p-2"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              required
              min="0.01"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded px-4 py-2 text-gray-600 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`rounded px-4 py-2 text-white disabled:opacity-50 ${
                type === 'INCOME' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {loading ? 'Processing...' : 'Confirm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
