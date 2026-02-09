import { useEffect, useState } from 'react';
import { api } from '../../../api/api';
import type { Wallet } from '../../../types/Wallet';
import type { Subscription } from '../../../types/Subscription';
import { WalletCard } from '../components/WalletCard';
import { CreateWalletModal } from '../components/CreateWalletModal';
import { AddTransactionModal } from '../components/AddTransactionModal';
import { EditWalletModal } from '../components/EditWalletModal';
import { PayInvoiceModal } from '../components/PayInvoiceModal';

export const WalletsPage = () => {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editWallet, setEditWallet] = useState<Wallet | null>(null);
  const [payInvoiceWallet, setPayInvoiceWallet] = useState<Wallet | null>(null);
  const [transactionModal, setTransactionModal] = useState<{
    isOpen: boolean;
    type: 'INCOME' | 'EXPENSE' | null;
    walletId: number | null;
    walletType?: string;
  }>({ isOpen: false, type: null, walletId: null });

  const fetchData = async () => {
    try {
      const [walletsRes, subsRes] = await Promise.all([
        api.get('/wallets'),
        api.get('/subscriptions')
      ]);

      if (Array.isArray(walletsRes.data)) {
        setWallets(walletsRes.data);
      }
      if (Array.isArray(subsRes.data)) {
        setSubscriptions(subsRes.data);
      }
    } catch (error) {
      console.error('Failed to fetch data');
    }
  };

  useEffect(() => {
    fetchData();
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
        {wallets.map((wallet) => {
          // Calculate projected total including 12 months of active subscriptions
          let projectedTotal = Number(wallet.total_invoice || 0);
          
          const walletSubs = subscriptions.filter(
            s => s.wallet_id === wallet.id && s.status === 'ACTIVE'
          );
          
          walletSubs.forEach(sub => {
            // Add 12 months of future value
            projectedTotal += Number(sub.value) * 12;
          });

          const walletWithProjection = {
            ...wallet,
            total_invoice: projectedTotal
          };

          return (
            <WalletCard
              key={wallet.id}
              wallet={walletWithProjection}
              onAddFunds={() => openTransaction(wallet.id, 'INCOME', wallet.type)}
              onAddExpense={() => openTransaction(wallet.id, 'EXPENSE', wallet.type)}
              onEdit={() => setEditWallet(wallet)}
              onPayInvoice={() => setPayInvoiceWallet(wallet)}
            />
          );
        })}
      </div>

      {wallets.length === 0 && (
        <div className="mt-10 text-center text-gray-500">
          Nenhuma carteira encontrada. Crie uma para começar!
        </div>
      )}

      <CreateWalletModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={fetchData}
      />

      <EditWalletModal
        isOpen={!!editWallet}
        wallet={editWallet}
        onClose={() => setEditWallet(null)}
        onSuccess={fetchData}
      />

      <PayInvoiceModal
        isOpen={!!payInvoiceWallet}
        wallet={payInvoiceWallet}
        onClose={() => setPayInvoiceWallet(null)}
        onSuccess={fetchData}
      />

      <AddTransactionModal
        isOpen={transactionModal.isOpen}
        type={transactionModal.type}
        walletId={transactionModal.walletId}
        walletType={transactionModal.walletType}
        onClose={() => setTransactionModal({ ...transactionModal, isOpen: false })}
        onSuccess={fetchData}
      />
    </div>
  );
};