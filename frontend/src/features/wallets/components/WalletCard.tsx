import { useState } from 'react';
import clsx from 'clsx';
import { formatCurrency } from '@/lib/utils';
import type { Wallet } from '../../../types/Wallet';
import type { Card as CardType } from '../../../types/Card';
import { Button } from '@/components/ui/button';
import {
  Plus,
  Minus,
  Pencil,
  CreditCard,
  FileUp,
  ChevronDown,
  ChevronUp,
  Landmark,
  Banknote,
  UtensilsCrossed,
  TrendingUp,
  Wallet as WalletIcon,
} from 'lucide-react';
import { CardItem } from './CardItem';

interface WalletCardProps {
  wallet: Wallet;
  cards: CardType[];
  onAddFunds: (id: number) => void;
  onAddExpense: (id: number) => void;
  onEdit: () => void;
  onAddCard: () => void;
  onEditCard: (card: CardType) => void;
  onAddCardExpense: (card: CardType) => void;
  onPayCardInvoice: (card: CardType) => void;
  onImportStatement: () => void;
}

const TYPE_CONFIG: Record<
  string,
  {
    accentBar: string;
    gradient: string;
    accent: string;
    accentMuted: string;
    icon: typeof WalletIcon;
    label: string;
    glow: string;
  }
> = {
  BANK: {
    accentBar: 'from-emerald-500 to-teal-400',
    gradient: 'from-emerald-500/15 to-teal-500/5',
    accent: 'text-emerald-600 dark:text-emerald-400',
    accentMuted: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    icon: Landmark,
    label: 'Banco',
    glow: 'hover:shadow-emerald-500/8',
  },
  PHYSICAL: {
    accentBar: 'from-green-500 to-lime-400',
    gradient: 'from-green-500/15 to-lime-500/5',
    accent: 'text-green-600 dark:text-green-400',
    accentMuted: 'bg-green-500/10 text-green-700 dark:text-green-300',
    icon: Banknote,
    label: 'Dinheiro',
    glow: 'hover:shadow-green-500/8',
  },
  MEAL_VOUCHER: {
    accentBar: 'from-amber-500 to-orange-400',
    gradient: 'from-amber-500/15 to-orange-500/5',
    accent: 'text-amber-600 dark:text-amber-400',
    accentMuted: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
    icon: UtensilsCrossed,
    label: 'Vale Refeição',
    glow: 'hover:shadow-amber-500/8',
  },
  INVESTMENT: {
    accentBar: 'from-violet-500 to-purple-400',
    gradient: 'from-violet-500/15 to-purple-500/5',
    accent: 'text-violet-600 dark:text-violet-400',
    accentMuted: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
    icon: TrendingUp,
    label: 'Investimento',
    glow: 'hover:shadow-violet-500/8',
  },
  OTHER: {
    accentBar: 'from-slate-500 to-zinc-400',
    gradient: 'from-slate-500/15 to-zinc-500/5',
    accent: 'text-slate-600 dark:text-slate-400',
    accentMuted: 'bg-slate-500/10 text-slate-700 dark:text-slate-300',
    icon: WalletIcon,
    label: 'Outro',
    glow: 'hover:shadow-slate-500/8',
  },
};

export const WalletCard = ({
  wallet,
  cards,
  onAddFunds,
  onAddExpense,
  onEdit,
  onAddCard,
  onEditCard,
  onAddCardExpense,
  onPayCardInvoice,
  onImportStatement,
}: WalletCardProps) => {
  const [isCardsExpanded, setIsCardsExpanded] = useState(false);
  const config = TYPE_CONFIG[wallet.type] || TYPE_CONFIG.OTHER;
  const TypeIcon = config.icon;
  const isInvestmentWallet = wallet.type === 'INVESTMENT';
  const headlineValue = isInvestmentWallet
    ? Number(wallet.displayValue ?? 0)
    : Number(wallet.actual_cash);
  const availableCash = Number(wallet.availableCash ?? wallet.actual_cash);

  return (
    <div
      className={clsx(
        'group relative rounded-2xl border border-border/60 bg-card overflow-hidden',
        'transition-all duration-300 hover:shadow-xl hover:border-border',
        'hover:-translate-y-0.5',
        config.glow,
      )}
    >
      {/* Gradient accent top bar */}
      <div className={clsx('h-1 w-full bg-gradient-to-r', config.accentBar)} />

      {/* Background gradient overlay */}
      <div className={clsx('absolute inset-0 bg-gradient-to-br opacity-40 pointer-events-none', config.gradient)} />

      <div className="relative p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center', config.accentMuted)}>
              <TypeIcon className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-foreground leading-tight">
                {wallet.name}
              </h3>
              <span className={clsx('text-[10px] font-semibold uppercase tracking-wider', config.accent)}>
                {config.label}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 opacity-0 transition-all duration-200 group-hover:opacity-100">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-emerald-500"
              onClick={onImportStatement}
              title="Importar extrato"
            >
              <FileUp className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={onEdit}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Balance */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              {isInvestmentWallet ? 'Valor Investido' : 'Saldo Disponível'}
            </p>
            {wallet.is_transfer_only && (
              <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                Só Transferência
              </span>
            )}
          </div>
          <p className="font-display text-3xl font-extrabold tracking-tight text-foreground">
            {formatCurrency(headlineValue)}
          </p>
          {isInvestmentWallet && (
            <div className="mt-2 space-y-1">
              <p className="text-[11px] text-muted-foreground">
                Caixa disponível: <span className="font-medium text-foreground">{formatCurrency(availableCash)}</span>
              </p>
              <p className="text-[11px] text-muted-foreground">
                Posições: <span className="font-medium text-foreground">{wallet.positionsCount ?? 0}</span>
              </p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {!wallet.is_transfer_only && (
          <div className="flex gap-2">
            <button
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-semibold py-2.5 transition-colors"
              onClick={() => onAddFunds(wallet.id)}
            >
              <Plus className="h-3.5 w-3.5" />
              Receita
            </button>
            <button
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-700 dark:text-red-300 text-xs font-semibold py-2.5 transition-colors"
              onClick={() => onAddExpense(wallet.id)}
            >
              <Minus className="h-3.5 w-3.5" />
              Despesa
            </button>
          </div>
        )}

        {/* Credit Cards Section */}
        {(cards.length > 0 || wallet.type === 'BANK') && (
          <div className="pt-3 border-t border-border/50 space-y-3">
            <div className="flex items-center justify-between">
              <button
                className={clsx(
                  'flex items-center gap-2',
                  cards.length > 0 && 'cursor-pointer hover:opacity-80 transition-opacity',
                )}
                onClick={() => cards.length > 0 && setIsCardsExpanded(!isCardsExpanded)}
              >
                <CreditCard className="h-3.5 w-3.5 text-muted-foreground/60" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                  Cartões
                </span>
                {cards.length > 0 && (
                  <span className="text-[10px] font-bold text-muted-foreground/40 bg-muted/50 rounded-full px-1.5 py-0.5">
                    {cards.length}
                  </span>
                )}
                {cards.length > 0 &&
                  (isCardsExpanded ? (
                    <ChevronUp className="h-3 w-3 text-muted-foreground/40" />
                  ) : (
                    <ChevronDown className="h-3 w-3 text-muted-foreground/40" />
                  ))}
              </button>
              {wallet.type === 'BANK' && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 hover:bg-emerald-500/10"
                  onClick={onAddCard}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Novo Cartão
                </Button>
              )}
            </div>

            <div
              className={clsx(
                'space-y-3 overflow-hidden transition-all duration-300',
                isCardsExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0',
              )}
            >
              {cards.map((card) => (
                <CardItem
                  key={card.id}
                  card={card}
                  onEdit={() => onEditCard(card)}
                  onAddExpense={() => onAddCardExpense(card)}
                  onPayInvoice={() => onPayCardInvoice(card)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
