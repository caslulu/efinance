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

// ...

  const openTransaction = (walletId: number, type: 'INCOME' | 'EXPENSE', walletType: string) => {
    setTransactionModal({ isOpen: true, type, walletId, walletType });
  };

  return (
    <div className="p-8">
// ...
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
// ...
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
