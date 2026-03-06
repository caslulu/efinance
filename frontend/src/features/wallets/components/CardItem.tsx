import clsx from 'clsx';
import { formatCurrency } from '@/lib/utils';
import type { Card } from '../../../types/Card';
import { Button } from '@/components/ui/button';
import { CreditCard, Pencil, ReceiptText } from 'lucide-react';
import { FaCcVisa, FaCcMastercard, FaCcAmex } from 'react-icons/fa';

const FLAG_LABELS: Record<string, string> = {
  VISA: 'Visa',
  MASTERCARD: 'Mastercard',
  ELO: 'Elo',
  AMEX: 'Amex',
  HIPERCARD: 'Hipercard',
  OTHER: 'Outra',
};

const FLAG_COLORS: Record<string, string> = {
  VISA: 'text-blue-600 dark:text-blue-400',
  MASTERCARD: 'text-red-600 dark:text-red-400',
  ELO: 'text-yellow-600 dark:text-yellow-400',
  AMEX: 'text-cyan-600 dark:text-cyan-400',
  HIPERCARD: 'text-orange-600 dark:text-orange-400',
  OTHER: 'text-gray-500',
};

const FLAG_BG_COLORS: Record<string, string> = {
  VISA: 'bg-blue-600 dark:bg-blue-400',
  MASTERCARD: 'bg-red-600 dark:bg-red-400',
  ELO: 'bg-yellow-600 dark:bg-yellow-400',
  AMEX: 'bg-cyan-600 dark:bg-cyan-400',
  HIPERCARD: 'bg-orange-600 dark:bg-orange-400',
  OTHER: 'bg-gray-500',
};

const FLAG_ICONS: Record<string, any> = {
  VISA: FaCcVisa,
  MASTERCARD: FaCcMastercard,
  AMEX: FaCcAmex,
  ELO: CreditCard,
  HIPERCARD: CreditCard,
  OTHER: CreditCard,
};

interface CardItemProps {
  card: Card;
  onEdit: () => void;
  onAddExpense: () => void;
  onPayInvoice: () => void;
}

export const CardItem = ({ card, onEdit, onAddExpense, onPayInvoice }: CardItemProps) => {
  const hasInvoice = Number(card.due_invoice) > 0 || Number(card.current_invoice) > 0;
  const limitUsedPercent = card.card_limit > 0
    ? Math.min(100, ((Number(card.total_invoice || 0)) / Number(card.card_limit)) * 100)
    : 0;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4 shadow-sm relative overflow-hidden transition-all hover:shadow-md">
      {/* Decorative side border */}
      <div className={clsx("absolute top-0 left-0 w-1 h-full", FLAG_BG_COLORS[card.flag] || 'bg-gray-500')} />

      {/* Header */}
      <div className="flex items-center justify-between pl-1">
        <div className="flex items-center gap-2">
          {(() => {
            const FlagIcon = FLAG_ICONS[card.flag] || CreditCard;
            return <FlagIcon className={clsx('h-6 w-6', FLAG_COLORS[card.flag] || 'text-gray-500')} />;
          })()}
          <span className="text-sm font-bold text-foreground">{card.name}</span>
          <span className={clsx('text-[10px] font-bold uppercase tracking-wider', FLAG_COLORS[card.flag] || 'text-gray-500')}>
            {FLAG_LABELS[card.flag] || card.flag}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={onEdit}
          >
            <Pencil className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Invoice Info */}
      <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-muted/30 border border-muted">
        <div className="space-y-1">
          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wide">Fatura Fechada</p>
          <p
            className={clsx(
              'text-sm font-bold',
              Number(card.due_invoice) > 0
                ? 'text-red-600 dark:text-red-400'
                : 'text-muted-foreground',
            )}
          >
            {formatCurrency(Number(card.due_invoice || 0))}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wide">Fatura Aberta</p>
          <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
            {formatCurrency(Number(card.current_invoice || 0))}
          </p>
        </div>
      </div>

      {/* Limit Bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-[10px] uppercase font-bold text-muted-foreground">
          <span>Limite Usado</span>
          <span className={limitUsedPercent > 90 ? "text-red-500" : ""}>
            {limitUsedPercent.toFixed(0)}%
          </span>
        </div>
        <div className="w-full bg-muted/50 rounded-full h-2 overflow-hidden">
          <div
            className={clsx(
              'h-full transition-all rounded-full',
              limitUsedPercent > 90
                ? 'bg-red-500'
                : limitUsedPercent > 70
                  ? 'bg-yellow-500'
                  : 'bg-emerald-500',
            )}
            style={{ width: `${limitUsedPercent}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] font-medium text-muted-foreground pt-1">
          <span>Disp: {formatCurrency(Number(card.available_limit || 0))}</span>
          <span>Total: {formatCurrency(Number(card.card_limit))}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 text-red-600 dark:text-red-400 border-red-200 hover:bg-red-50 dark:hover:bg-red-900/20 text-xs h-8 font-semibold"
          onClick={onAddExpense}
        >
          Despesa
        </Button>
        {hasInvoice && (
          <Button
            size="sm"
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1.5 text-xs h-8 font-semibold"
            onClick={onPayInvoice}
          >
            <ReceiptText className="h-3.5 w-3.5" />
            Pagar Fatura
          </Button>
        )}
      </div>
    </div>
  );
};
