import { useState } from 'react';
import clsx from 'clsx';
import type { Transaction } from '../../../types/Transaction';
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Edit2, Clock, ArrowUpRight, ArrowDownRight, Repeat, CreditCard } from 'lucide-react';
import { EditTransactionModal } from './EditTransactionModal';
import { PAYMENT_METHODS } from '../../../constants/paymentMethods';
import { CategoryIcon } from '@/components/IconPicker';
import { formatCurrency } from '@/lib/utils';

interface TransactionListProps {
  transactions: Transaction[];
  onTransactionUpdated: () => void;
  selectedIds?: Set<number>;
  onToggleSelect?: (id: number) => void;
}

export const TransactionList = ({
  transactions,
  onTransactionUpdated,
  selectedIds = new Set(),
  onToggleSelect
}: TransactionListProps) => {
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  if (transactions.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        Nenhuma transação encontrada.
      </div>
    );
  }

  // Group transactions by date
  const byDate: Record<string, Transaction[]> = {};
  transactions.forEach(tx => {
    const dateKey = new Date(tx.transaction_date).toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
    });
    if (!byDate[dateKey]) byDate[dateKey] = [];
    byDate[dateKey].push(tx);
  });

  return (
    <>
      <div className="space-y-5 tx-stagger">
        {Object.entries(byDate).map(([dateLabel, dateTxs]) => (
          <div key={dateLabel}>
            {/* Date sub-header */}
            <div className="flex items-center gap-3 mb-2.5 px-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground capitalize">
                {dateLabel}
              </span>
              <div className="h-px flex-1 bg-border/50" />
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {dateTxs.length} item{dateTxs.length > 1 ? 's' : ''}
              </span>
            </div>

            {/* Transaction cards */}
            <div className="space-y-1.5">
              {dateTxs.map(tx => {
                const isFutureTransaction = tx.is_processed === false || new Date(tx.transaction_date) > new Date();
                const isIncome = tx.transaction_type === 'INCOME';
                const isSelected = selectedIds.has(tx.id);
                const isVirtual = tx.id < 0;

                return (
                  <div
                    key={tx.id}
                    className={clsx(
                      'tx-row group relative flex items-center gap-3 p-3 md:p-4 rounded-xl border transition-all cursor-pointer',
                      isSelected
                        ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40'
                        : 'bg-card border-transparent hover:border-border/80 hover:bg-accent/30',
                      isFutureTransaction && tx.id > 0 && 'opacity-65',
                      isVirtual && 'opacity-50 border-dashed border-border/40'
                    )}
                    onClick={() => !isVirtual && setEditingTransaction(tx)}
                  >
                    {/* Checkbox */}
                    {onToggleSelect && (
                      <div
                        className="shrink-0"
                        onClick={e => { e.stopPropagation(); onToggleSelect(tx.id); }}
                        title={isVirtual ? 'Transações projetadas não podem ser apagadas.' : ''}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => onToggleSelect(tx.id)}
                          disabled={isVirtual}
                          className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                        />
                      </div>
                    )}

                    {/* Type icon */}
                    <div className={clsx(
                      'shrink-0 w-9 h-9 rounded-xl flex items-center justify-center',
                      isIncome
                        ? 'bg-emerald-100 dark:bg-emerald-900/30'
                        : 'bg-red-100 dark:bg-red-900/20'
                    )}>
                      {isVirtual ? (
                        <Repeat size={14} className="text-violet-500" />
                      ) : isIncome ? (
                        <ArrowDownRight size={14} className="text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <ArrowUpRight size={14} className="text-red-500 dark:text-red-400" />
                      )}
                    </div>

                    {/* Main content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground truncate">
                          {tx.description || 'Sem descrição'}
                        </span>
                        {isFutureTransaction && tx.id > 0 && (
                          <Badge variant="outline" className="shrink-0 border-amber-400/50 text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-900/15 text-[9px] px-1.5 py-0 gap-0.5 font-bold">
                            <Clock className="h-2.5 w-2.5" />
                            Futura
                          </Badge>
                        )}
                        {isVirtual && (
                          <Badge variant="outline" className="shrink-0 border-violet-400/50 text-violet-600 dark:text-violet-400 bg-violet-50/50 dark:bg-violet-900/15 text-[9px] px-1.5 py-0 gap-0.5 font-bold">
                            <Repeat className="h-2.5 w-2.5" />
                            Projeção
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        {/* Category */}
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <CategoryIcon name={tx.TransactionCategory?.icon} className="h-3 w-3" />
                          <span className="truncate max-w-[100px]">{tx.TransactionCategory?.name || 'Outros'}</span>
                        </div>
                        {/* Payment method */}
                        {tx.payment_method && (
                          <>
                            <span className="text-border">·</span>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <CreditCard size={10} />
                              <span>{PAYMENT_METHODS[tx.payment_method as keyof typeof PAYMENT_METHODS] || tx.payment_method}</span>
                            </div>
                          </>
                        )}
                        {/* Installment */}
                        {tx.installment_total && tx.installment_total > 1 && (
                          <>
                            <span className="text-border">·</span>
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {tx.installment_number}/{tx.installment_total}x
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Amount */}
                    <div className="shrink-0 text-right">
                      <p className={clsx(
                        'text-sm font-bold tabular-nums',
                        isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
                      )}>
                        {isIncome ? '+' : '-'} {formatCurrency(Number(tx.value))}
                      </p>
                    </div>

                    {/* Edit button (appears on hover) */}
                    {!isVirtual && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 w-8 h-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => { e.stopPropagation(); setEditingTransaction(tx); }}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <EditTransactionModal
        isOpen={!!editingTransaction}
        transaction={editingTransaction}
        onClose={() => setEditingTransaction(null)}
        onSuccess={onTransactionUpdated}
      />
    </>
  );
};
