import { useState, useEffect, useMemo } from 'react';
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
import { ImportStatementModal } from '../components/ImportStatementModal';
import { Button } from '@/components/ui/button';
import {
  ArrowRightLeft,
  Plus,
  Wallet as WalletIcon,
  TrendingUp,
  Landmark,
  Banknote,
  UtensilsCrossed,
} from 'lucide-react';
import { api } from '@/api/api';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { formatCurrency } from '@/lib/utils';
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

const TYPE_ICONS: Record<string, typeof WalletIcon> = {
  BANK: Landmark,
  PHYSICAL: Banknote,
  MEAL_VOUCHER: UtensilsCrossed,
  INVESTMENT: TrendingUp,
  OTHER: WalletIcon,
};

const TYPE_LABELS: Record<string, string> = {
  BANK: 'Bancos',
  PHYSICAL: 'Dinheiro',
  MEAL_VOUCHER: 'Vale Refeição',
  INVESTMENT: 'Investimentos',
  OTHER: 'Outros',
};

function useColumnCount() {
  const [cols, setCols] = useState(() => {
    if (typeof window === 'undefined') return 3;
    if (window.innerWidth >= 1280) return 3;
    if (window.innerWidth >= 768) return 2;
    return 1;
  });
  useEffect(() => {
    const update = () => {
      if (window.innerWidth >= 1280) setCols(3);
      else if (window.innerWidth >= 768) setCols(2);
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

  const [createCardWalletId, setCreateCardWalletId] = useState<number | null>(null);
  const [editCard, setEditCard] = useState<Card | null>(null);
  const [payInvoiceCard, setPayInvoiceCard] = useState<Card | null>(null);
  const [importWallet, setImportWallet] = useState<Wallet | null>(null);

  const [transactionModal, setTransactionModal] = useState<{
    isOpen: boolean;
    type: 'INCOME' | 'EXPENSE' | null;
    walletId: number | null;
    walletType?: string;
    cardId?: number;
  }>({ isOpen: false, type: null, walletId: null });

  const totalBalance = useMemo(
    () =>
      wallets.reduce((sum, wallet) => {
        if (wallet.type === 'INVESTMENT') {
          return sum + Number(wallet.displayValue ?? 0) + Number(wallet.availableCash ?? wallet.actual_cash);
        }

        return sum + Number(wallet.actual_cash);
      }, 0),
    [wallets],
  );

  const walletsByType = useMemo(() => {
    const grouped: Record<string, { count: number; total: number }> = {};
    wallets.forEach((w) => {
      if (!grouped[w.type]) grouped[w.type] = { count: 0, total: 0 };
      grouped[w.type].count++;
      grouped[w.type].total += w.type === 'INVESTMENT'
        ? Number(w.displayValue ?? 0) + Number(w.availableCash ?? w.actual_cash)
        : Number(w.actual_cash);
    });
    return grouped;
  }, [wallets]);

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
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setWallets((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over?.id);
        const reordered = arrayMove(items, oldIndex, newIndex);
        const updatedWallets = reordered.map((w, index) => ({ ...w, order: index }));
        api
          .patch(
            '/wallets/reorder',
            updatedWallets.map((w) => ({ id: w.id, order: w.order })),
          )
          .catch((err) => {
            console.error('Failed to reorder wallets:', err);
            refetchWallets();
          });
        return updatedWallets;
      });
    }
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-900 px-6 sm:px-8 pt-10 pb-14">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(16,185,129,0.15)_0%,_transparent_60%)]" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-64 h-64 bg-teal-500/5 rounded-full blur-3xl" />

        <div className="relative z-10 max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-10">
            <div>
              <p className="text-emerald-300/70 text-xs font-semibold uppercase tracking-[0.2em] mb-2">
                Patrimônio Total
              </p>
              <h1 className="font-display text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
                {formatCurrency(totalBalance)}
              </h1>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setIsTransferOpen(true)}
                className="border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20 hover:text-white backdrop-blur-sm"
              >
                <ArrowRightLeft className="mr-2 h-4 w-4" />
                Transferir
              </Button>
              <Button
                onClick={() => setIsCreateOpen(true)}
                className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-semibold shadow-lg shadow-emerald-500/25"
              >
                <Plus className="mr-2 h-4 w-4" />
                Nova Carteira
              </Button>
            </div>
          </div>

          {Object.keys(walletsByType).length > 0 && (
            <div className="flex flex-wrap gap-3">
              {Object.entries(walletsByType).map(([type, data]) => {
                const Icon = TYPE_ICONS[type] || WalletIcon;
                return (
                  <div
                    key={type}
                    className="flex items-center gap-2.5 rounded-full bg-white/[0.07] backdrop-blur-sm border border-white/[0.08] px-4 py-2"
                  >
                    <Icon className="h-3.5 w-3.5 text-emerald-400/80" />
                    <span className="text-xs font-medium text-emerald-100/80">
                      {TYPE_LABELS[type] || type}
                    </span>
                    <span className="text-xs font-bold text-white">
                      {formatCurrency(data.total)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Wallet Grid */}
      <div className="px-6 sm:px-8 -mt-6 pb-12">
        <div className="max-w-7xl mx-auto">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={wallets.map((w) => w.id)} strategy={rectSortingStrategy}>
              <div className="flex gap-5">
                {Array.from({ length: columnCount }, (_, colIndex) => (
                  <div key={colIndex} className="flex-1 flex flex-col gap-5">
                    {wallets
                      .filter((_, i) => i % columnCount === colIndex)
                      .map((wallet, i) => (
                        <div
                          key={wallet.id}
                          className="animate-wallet-enter"
                          style={{ animationDelay: `${colIndex * 0.08 + i * 0.06}s` }}
                        >
                          <SortableWalletCard
                            wallet={wallet}
                            onAddFunds={() => openTransaction(wallet.id, 'INCOME', wallet.type)}
                            onAddExpense={() => openTransaction(wallet.id, 'EXPENSE', wallet.type)}
                            onEdit={() => setEditWallet(wallet)}
                            onAddCard={() => setCreateCardWalletId(wallet.id)}
                            onEditCard={(card) => setEditCard(card)}
                            onAddCardExpense={(card) => openCardExpense(card, wallet.type)}
                            onPayCardInvoice={(card) => setPayInvoiceCard(card)}
                            onImportStatement={() => setImportWallet(wallet)}
                          />
                        </div>
                      ))}
                  </div>
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {wallets.length === 0 && (
            <div className="mt-16 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-5">
                <WalletIcon className="h-10 w-10 text-emerald-500/50" />
              </div>
              <h3 className="font-display text-lg font-semibold text-foreground mb-2">
                Nenhuma carteira ainda
              </h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                Crie sua primeira carteira para começar a organizar suas finanças.
              </p>
              <Button
                onClick={() => setIsCreateOpen(true)}
                className="mt-6 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Plus className="mr-2 h-4 w-4" />
                Criar Carteira
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <CreateWalletModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} onSuccess={refetchData} />
      <EditWalletModal isOpen={!!editWallet} wallet={editWallet} onClose={() => setEditWallet(null)} onSuccess={refetchData} />
      <TransferModal isOpen={isTransferOpen} onClose={() => setIsTransferOpen(false)} onSuccess={refetchData} />
      <CreateCardModal isOpen={!!createCardWalletId} walletId={createCardWalletId} onClose={() => setCreateCardWalletId(null)} onSuccess={refetchData} />
      <EditCardModal isOpen={!!editCard} card={editCard} onClose={() => setEditCard(null)} onSuccess={refetchData} onDelete={handleDeleteCard} />
      <PayInvoiceModal isOpen={!!payInvoiceCard} card={payInvoiceCard} onClose={() => setPayInvoiceCard(null)} onSuccess={refetchData} />
      <ImportStatementModal wallet={importWallet} open={!!importWallet} onClose={() => setImportWallet(null)} />
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
