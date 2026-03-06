import { useState, useEffect } from 'react';
import type { Wallet } from '../../../types/Wallet';
import type { Card } from '../../../types/Card';
import { useWallets, useSubscriptions } from '@/hooks';
import { useDeleteCard } from '../../../hooks/useCards';
import { AddTransactionModal } from '../components/AddTransactionModal';
import { CreateWalletModal } from '../components/CreateWalletModal';
import { EditWalletModal } from '../components/EditWalletModal';
import { PayInvoiceModal } from '../components/PayInvoiceModal';
import { TransferModal } from '../components/TransferModal';
import { CreateCardModal } from '../components/CreateCardModal';
import { EditCardModal } from '../components/EditCardModal';
import { Button } from '@/components/ui/button';
import { ArrowRightLeft } from 'lucide-react';
import { api } from '@/api/api';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
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

function useColumnCount() {
  const [cols, setCols] = useState(() => {
    if (typeof window === 'undefined') return 3;
    if (window.innerWidth >= 1024) return 3;
    if (window.innerWidth >= 640) return 2;
    return 1;
  });
  useEffect(() => {
    const update = () => {
      if (window.innerWidth >= 1024) setCols(3);
      else if (window.innerWidth >= 640) setCols(2);
      else setCols(1);
    };
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return cols;
}

export const WalletsPage = () => {
  const queryClient = useQueryClient();
  const columnCount = useColumnCount();
  const { data: initialWallets = [], refetch: refetchWallets } = useWallets();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const { refetch: refetchSubscriptions } = useSubscriptions();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [editWallet, setEditWallet] = useState<Wallet | null>(null);

  // Card modals state
  const [createCardWalletId, setCreateCardWalletId] = useState<number | null>(null);
  const [editCard, setEditCard] = useState<Card | null>(null);
  const [payInvoiceCard, setPayInvoiceCard] = useState<Card | null>(null);

  const [transactionModal, setTransactionModal] = useState<{
    isOpen: boolean;
    type: 'INCOME' | 'EXPENSE' | null;
    walletId: number | null;
    walletType?: string;
    cardId?: number;
  }>({ isOpen: false, type: null, walletId: null });

  const refetchData = () => {
    refetchWallets();
    refetchSubscriptions();
    queryClient.invalidateQueries({ queryKey: queryKeys.cards });
    queryClient.invalidateQueries({ queryKey: queryKeys.transactions });
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    queryClient.invalidateQueries({ queryKey: queryKeys.wallets });
  };

  const openTransaction = (walletId: number, type: 'INCOME' | 'EXPENSE', walletType: string) => {
    setTransactionModal({ isOpen: true, type, walletId, walletType });
  };

  const openCardExpense = (card: Card, walletType: string) => {
    setTransactionModal({
      isOpen: true,
      type: 'EXPENSE',
      walletId: card.wallet_id,
      walletType,
      cardId: card.id,
    });
  };

  // Sync state with fetched data
  useEffect(() => {
    setWallets(initialWallets);
  }, [initialWallets]);

  const deleteCard = useDeleteCard();

  const handleDeleteCard = async (id: number) => {
    try {
      await deleteCard.mutateAsync(id);
      toast.success('Cartão excluído!');
      setEditCard(null);
      refetchData();
    } catch {
      toast.error('Falha ao excluir cartão');
    }
  };

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

        const updatedWallets = reordered.map((w, index) => ({
          ...w,
          order: index,
        }));

        api.patch('/wallets/reorder', updatedWallets.map(w => ({ id: w.id, order: w.order })))
          .catch((err) => {
            console.error('Failed to reorder wallets:', err);
            refetchWallets();
          });

        return updatedWallets;
      });
    }
  };

  return (
    <div className="p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <h1 className="text-3xl font-bold text-foreground">Minhas Carteiras</h1>
        <div className="flex gap-4 w-full sm:w-auto">
          <Button
            variant="outline"
            onClick={() => setIsTransferOpen(true)}
            className="flex items-center gap-2 border-emerald-200 text-emerald-600 hover:bg-emerald-900/30"
          >
            <ArrowRightLeft size={18} />
            Transferir
          </Button>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-emerald-700"
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
        <SortableContext
          items={wallets.map(w => w.id)}
          strategy={rectSortingStrategy}
        >
          <div className="flex gap-6">
            {Array.from({ length: columnCount }, (_, colIndex) => (
              <div key={colIndex} className="flex-1 flex flex-col gap-6">
                {wallets
                  .filter((_, i) => i % columnCount === colIndex)
                  .map((wallet) => (
                    <SortableWalletCard
                      key={wallet.id}
                      wallet={wallet}
                      onAddFunds={() => openTransaction(wallet.id, 'INCOME', wallet.type)}
                      onAddExpense={() => openTransaction(wallet.id, 'EXPENSE', wallet.type)}
                      onEdit={() => setEditWallet(wallet)}
                      onAddCard={() => setCreateCardWalletId(wallet.id)}
                      onEditCard={(card) => setEditCard(card)}
                      onAddCardExpense={(card) => openCardExpense(card, wallet.type)}
                      onPayCardInvoice={(card) => setPayInvoiceCard(card)}
                    />
                  ))}
              </div>
            ))}
          </div>
        </SortableContext>
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

      <TransferModal
        isOpen={isTransferOpen}
        onClose={() => setIsTransferOpen(false)}
        onSuccess={refetchData}
      />

      <CreateCardModal
        isOpen={!!createCardWalletId}
        walletId={createCardWalletId}
        onClose={() => setCreateCardWalletId(null)}
        onSuccess={refetchData}
      />

      <EditCardModal
        isOpen={!!editCard}
        card={editCard}
        onClose={() => setEditCard(null)}
        onSuccess={refetchData}
        onDelete={handleDeleteCard}
      />

      <PayInvoiceModal
        isOpen={!!payInvoiceCard}
        card={payInvoiceCard}
        onClose={() => setPayInvoiceCard(null)}
        onSuccess={refetchData}
      />

      <AddTransactionModal
        isOpen={transactionModal.isOpen}
        type={transactionModal.type}
        walletId={transactionModal.walletId}
        walletType={transactionModal.walletType}
        cardId={transactionModal.cardId}
        onClose={() => setTransactionModal({ ...transactionModal, isOpen: false })}
        onSuccess={refetchData}
      />
    </div>
  );
};