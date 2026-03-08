import clsx from 'clsx';
import { formatCurrency } from '@/lib/utils';
import type { Card } from '../../../types/Card';
import { Pencil, ReceiptText, CreditCard } from 'lucide-react';
import { FaCcVisa, FaCcMastercard, FaCcAmex } from 'react-icons/fa';

const FLAG_CONFIG: Record<
  string,
  { label: string; gradient: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  VISA: { label: 'Visa', gradient: 'from-blue-600 to-blue-800', Icon: FaCcVisa },
  MASTERCARD: { label: 'Mastercard', gradient: 'from-red-600 to-orange-700', Icon: FaCcMastercard },
  ELO: { label: 'Elo', gradient: 'from-yellow-600 to-amber-700', Icon: CreditCard },
  AMEX: { label: 'Amex', gradient: 'from-cyan-600 to-teal-700', Icon: FaCcAmex },
  HIPERCARD: { label: 'Hipercard', gradient: 'from-orange-600 to-red-700', Icon: CreditCard },
  OTHER: { label: 'Outra', gradient: 'from-gray-600 to-slate-700', Icon: CreditCard },
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

  const config = FLAG_CONFIG[card.flag] || FLAG_CONFIG.OTHER;
  const FlagIcon = config.Icon;

  return (
    <div className="rounded-xl overflow-hidden border border-border/40 bg-card shadow-sm hover:shadow-md transition-all duration-200 group/card">
      {/* Card Header - styled like a physical credit card */}
      <div className={clsx('relative px-4 py-3 bg-gradient-to-r text-white', config.gradient)}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.1)_0%,_transparent_60%)]" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FlagIcon className="h-6 w-6 text-white/80" />
            <span className="text-sm font-bold tracking-wide">{card.name}</span>
          </div>
          <button
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors opacity-0 group-hover/card:opacity-100"
            onClick={onEdit}
          >
            <Pencil className="h-3 w-3" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Invoice Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-0.5">
              Fatura Fechada
            </p>
            <p
              className={clsx(
                'text-sm font-bold font-display',
                Number(card.due_invoice) > 0 ? 'text-red-500' : 'text-muted-foreground/50',
              )}
            >
              {formatCurrency(Number(card.due_invoice || 0))}
            </p>
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-0.5">
              Fatura Aberta
            </p>
            <p className="text-sm font-bold font-display text-foreground">
              {formatCurrency(Number(card.current_invoice || 0))}
            </p>
          </div>
        </div>

        {/* Limit Progress */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60">
              Limite
            </span>
            <span
              className={clsx(
                'text-[10px] font-bold',
                limitUsedPercent > 90
                  ? 'text-red-500'
                  : limitUsedPercent > 70
                    ? 'text-amber-500'
                    : 'text-muted-foreground/60',
              )}
            >
              {limitUsedPercent.toFixed(0)}%
            </span>
          </div>
          <div className="relative w-full h-1.5 rounded-full bg-muted/40 overflow-hidden">
            <div
              className={clsx(
                'absolute inset-y-0 left-0 rounded-full transition-all duration-500',
                limitUsedPercent > 90
                  ? 'bg-gradient-to-r from-red-500 to-red-400'
                  : limitUsedPercent > 70
                    ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-400',
              )}
              style={{ width: `${limitUsedPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-[9px] font-medium text-muted-foreground/50">
            <span>Disp: {formatCurrency(Number(card.available_limit || 0))}</span>
            <span>Total: {formatCurrency(Number(card.card_limit))}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            className="flex-1 text-xs font-semibold py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 transition-colors"
            onClick={onAddExpense}
          >
            Despesa
          </button>
          {hasInvoice && (
            <button
              className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-sm"
              onClick={onPayInvoice}
            >
              <ReceiptText className="h-3.5 w-3.5" />
              Pagar Fatura
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
