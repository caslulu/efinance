import clsx from 'clsx';
import type { Wallet } from '../../../types/Wallet';

interface WalletCardProps {
  wallet: Wallet;
  onAddFunds: (id: number) => void;
  onAddExpense: (id: number) => void;
}

export const WalletCard = ({ wallet, onAddFunds, onAddExpense }: WalletCardProps) => {
  const typeColors = {
    BANK: 'bg-blue-500',
    PHYSICAL: 'bg-green-500',
    MEAL_VOUCHER: 'bg-orange-500',
    INVESTMENT: 'bg-purple-500',
  };

  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between mb-4">
        <span className={clsx('rounded-full px-3 py-1 text-xs font-bold text-white', typeColors[wallet.type] || 'bg-gray-500')}>
          {wallet.type.replace('_', ' ')}
        </span>
        <span className="text-gray-400 text-sm">#{wallet.id}</span>
      </div>
      
      <h3 className="text-lg font-semibold text-gray-800">{wallet.name}</h3>
      <p className="mt-2 text-2xl font-bold text-gray-900">
        R$ {Number(wallet.actual_cash).toFixed(2)}
      </p>

      <div className="mt-6 flex gap-2">
        <button 
          onClick={() => onAddFunds(wallet.id)}
          className="flex-1 rounded-lg bg-green-50 px-3 py-2 text-sm font-semibold text-green-600 hover:bg-green-100"
        >
          + Add Funds
        </button>
        <button 
          onClick={() => onAddExpense(wallet.id)}
          className="flex-1 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-100"
        >
          - Expense
        </button>
      </div>
    </div>
  );
};
