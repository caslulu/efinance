import clsx from 'clsx';
import { formatCurrency } from '@/lib/utils';
import type { Card } from '../../../types/Card';
import { Button } from '@/components/ui/button';
import { CreditCard, Pencil, ReceiptText } from 'lucide-react';

const FLAG_LABELS: Record<string, string> = {
  VISA: 'Visa',
  MASTERCARD: 'Mastercard',
  ELO: 'Elo',
  AMEX: 'Amex',
  HIPERCARD: 'Hipercard',
  OTHER: 'Outra',
};

const FLAG_COLORS: Record<string, string> = {
  VISA: 'text-emerald-600 dark:text-emerald-400',
  MASTERCARD: 'text-red-600 dark:text-red-400',
  ELO: 'text-yellow-600 dark:text-yellow-400',
  AMEX: 'text-cyan-600 dark:text-cyan-400',
  HIPERCARD: 'text-orange-600 dark:text-orange-400',
  OTHER: 'text-gray-500',
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
    <div className="rounded-lg border border-border bg-card p-3 space-y-3 group relative">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CreditCard className={clsx('h-4 w-4', FLAG_COLORS[card.flag] || 'text-gray-500')} />
          <span className="text-sm font-semibold">{card.name}</span>
          <span className={clsx('text-[10px] font-bold uppercase', FLAG_COLORS[card.flag] || 'text-gray-500')}>
            {FLAG_LABELS[card.flag] || card.flag}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={onEdit}
          >
            <Pencil className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Invoice Info */}
      <div className="grid grid-cols-2 gap-3 p-2 rounded-md bg-muted/50">
        <div className="space-y-0.5">
          <p className="text-[9px] uppercase font-bold text-muted-foreground">Fatura Fechada</p>
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
        <div className="space-y-0.5">
          <p className="text-[9px] uppercase font-bold text-muted-foreground">Fatura Aberta</p>
          <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
            {formatCurrency(Number(card.current_invoice || 0))}
          </p>
        </div>
      </div>

      {/* Limit Bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-[9px] uppercase font-bold text-muted-foreground">
          <span>Limite Disponível</span>
          <span>{formatCurrency(Number(card.available_limit || 0))} / {formatCurrency(Number(card.card_limit))}</span>
        </div>
        <div className="w-full bg-muted rounded-full h-1.5">
          <div
            className={clsx(
              'h-1.5 rounded-full transition-all',
              limitUsedPercent > 90
                ? 'bg-red-500'
                : limitUsedPercent > 70
                  ? 'bg-yellow-500'
                  : 'bg-green-500',
            )}
            style={{ width: `${Math.max(0, 100 - limitUsedPercent)}%` }}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 text-red-600 dark:text-red-400 border-red-200 hover:bg-red-50 dark:hover:bg-red-900/20 text-xs h-7"
          onClick={onAddExpense}
        >
          + Despesa
        </Button>
        {hasInvoice && (
          <Button
            size="sm"
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1 text-xs h-7"
            onClick={onPayInvoice}
          >
            <ReceiptText className="h-3 w-3" />
            Pagar Fatura
          </Button>
        )}
      </div>
    </div>
  );
};
