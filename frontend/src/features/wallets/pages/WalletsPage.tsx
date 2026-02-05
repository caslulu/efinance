import { useEffect, useState } from 'react';
import { api } from '../../../api/api';
import type { Wallet } from '../../../types/Wallet';
import { WalletCard } from '../components/WalletCard';
import { CreateWalletModal } from '../components/CreateWalletModal';
import { AddTransactionModal } from '../components/AddTransactionModal';

export const WalletsPage = () => {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [transactionModal, setTransactionModal] = useState<{
    isOpen: boolean;
    type: 'INCOME' | 'EXPENSE' | null;
    walletId: number | null;
    walletType?: string;
  }>({ isOpen: false, type: null, walletId: null });

  const fetchWallets = async () => {
    try {
      const res = await api.get('/wallets');
      if (Array.isArray(res.data)) {
        setWallets(res.data);
      } else {
        console.error('Invalid wallets data format', res.data);
        setWallets([]);
      }
    } catch (error) {
      console.error('Failed to fetch wallets');
    }
  };

  useEffect(() => {
    fetchWallets();
  }, []);

  const openTransaction = (walletId: number, type: 'INCOME' | 'EXPENSE', walletType: string) => {
    setTransactionModal({ isOpen: true, type, walletId, walletType });
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Minhas Carteiras</h1>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-blue-700"
        >
          + Nova Carteira
        </button>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {wallets.map((wallet) => (
          <WalletCard
            key={wallet.id}
            wallet={wallet}
            onAddFunds={() => openTransaction(wallet.id, 'INCOME', wallet.type)}
            onAddExpense={() => openTransaction(wallet.id, 'EXPENSE', wallet.type)}
          />
        ))}
      </div>

      {wallets.length === 0 && (
        <div className="mt-10 text-center text-gray-500">
          Nenhuma carteira encontrada. Crie uma para começar!
        </div>
      )}

      <CreateWalletModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={fetchWallets}
      />

      <AddTransactionModal
        isOpen={transactionModal.isOpen}
        type={transactionModal.type}
        walletId={transactionModal.walletId}
        walletType={transactionModal.walletType}
        onClose={() => setTransactionModal({ ...transactionModal, isOpen: false })}
        onSuccess={fetchWallets}
      />
    </div>
  );
};