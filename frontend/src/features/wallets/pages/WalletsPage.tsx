import { useState, useEffect } from 'react';
import type { Wallet } from '../../../types/Wallet';
import { useWallets, useSubscriptions } from '@/hooks';
import { AddTransactionModal } from '../components/AddTransactionModal';
import { CreateWalletModal } from '../components/CreateWalletModal';
import { EditWalletModal } from '../components/EditWalletModal';
import { PayInvoiceModal } from '../components/PayInvoiceModal';
import { TransferModal } from '../components/TransferModal';
import { Button } from '@/components/ui/button';
import { ArrowRightLeft } from 'lucide-react';
import { api } from '@/api/api';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { SortableWalletCard } from '../components/SortableWalletCard';

export const WalletsPage = () => {
  const { data: initialWallets = [], refetch: refetchWallets } = useWallets();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const { data: subscriptions = [], refetch: refetchSubscriptions } = useSubscriptions();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [editWallet, setEditWallet] = useState<Wallet | null>(null);
  const [payInvoiceWallet, setPayInvoiceWallet] = useState<Wallet | null>(null);
  const [transactionModal, setTransactionModal] = useState<{
    isOpen: boolean;
    type: 'INCOME' | 'EXPENSE' | null;
    walletId: number | null;
    walletType?: string;
    hasClosingDay?: boolean;
  }>({ isOpen: false, type: null, walletId: null });

  const refetchData = () => {
    refetchWallets();
    refetchSubscriptions();
  };

  const openTransaction = (walletId: number, type: 'INCOME' | 'EXPENSE', walletType: string, hasClosingDay: boolean) => {
    setTransactionModal({ isOpen: true, type, walletId, walletType, hasClosingDay });
  };

  // Sync state with fetched data
  useEffect(() => {
    setWallets(initialWallets);
  }, [initialWallets]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      setWallets((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over?.id);

        const reordered = arrayMove(items, oldIndex, newIndex);

        // Update order property
        const updatedWallets = reordered.map((w, index) => ({
          ...w,
          order: index,
        }));

        // Send to API
        api.patch('/wallets/reorder', updatedWallets.map(w => ({ id: w.id, order: w.order })))
          .catch((err) => {
            console.error('Failed to reorder wallets:', err);
            refetchWallets(); // Revert on failure
          });

        return updatedWallets;
      });
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-foreground">Minhas Carteiras</h1>
        <div className="flex gap-4">
          <Button
            variant="outline"
            onClick={() => setIsTransferOpen(true)}
            className="flex items-center gap-2 border-blue-200 text-blue-600 hover:bg-blue-900/30"
          >
            <ArrowRightLeft size={18} />
            Transferir
          </Button>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-blue-700"
          >
            + Nova Carteira
          </button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <SortableContext
            items={wallets.map(w => w.id)}
            strategy={rectSortingStrategy}
          >
            {wallets.map((wallet) => {
              let projectedTotal = Number(wallet.total_invoice || 0);

              const walletSubs = subscriptions.filter(
                s => s.wallet_id === wallet.id && s.status === 'ACTIVE'
              );

              walletSubs.forEach(sub => {
                projectedTotal += Number(sub.value) * 12;
              });

              const walletWithProjection = {
                ...wallet,
                total_invoice: projectedTotal
              };

              return (
                <SortableWalletCard
                  key={wallet.id}
                  wallet={walletWithProjection}
                  onAddFunds={() => openTransaction(wallet.id, 'INCOME', wallet.type, !!wallet.closing_day)}
                  onAddExpense={() => openTransaction(wallet.id, 'EXPENSE', wallet.type, !!wallet.closing_day)}
                  onEdit={() => setEditWallet(wallet)}
                  onPayInvoice={() => setPayInvoiceWallet(wallet)}
                />
              );
            })}
          </SortableContext>
        </div>
      </DndContext>

      {wallets.length === 0 && (
        <div className="mt-10 text-center text-muted-foreground">
          Nenhuma carteira encontrada. Crie uma para começar!
        </div>
      )}

      <CreateWalletModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={refetchData}
      />

      <EditWalletModal
        isOpen={!!editWallet}
        wallet={editWallet}
        onClose={() => setEditWallet(null)}
        onSuccess={refetchData}
      />

      <PayInvoiceModal
        isOpen={!!payInvoiceWallet}
        wallet={payInvoiceWallet}
        onClose={() => setPayInvoiceWallet(null)}
        onSuccess={refetchData}
      />

      <TransferModal
        isOpen={isTransferOpen}
        onClose={() => setIsTransferOpen(false)}
        onSuccess={refetchData}
      />

      <AddTransactionModal
        isOpen={transactionModal.isOpen}
        type={transactionModal.type}
        walletId={transactionModal.walletId}
        walletType={transactionModal.walletType}
        hasClosingDay={transactionModal.hasClosingDay}
        onClose={() => setTransactionModal({ ...transactionModal, isOpen: false })}
        onSuccess={refetchData}
      />
    </div>
  );
};