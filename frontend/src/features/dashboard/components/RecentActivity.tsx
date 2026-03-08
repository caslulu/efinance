import { History, ArrowRight } from 'lucide-react';
import { CategoryIcon } from '@/components/IconPicker';
import { formatCurrency } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

export function RecentActivity({ data, formatDate }: { data: any, formatDate: (dateStr: string) => string }) {
  const navigate = useNavigate();
  return (
    <div className="dash-card overflow-hidden">
      <div className="px-5 pt-5 pb-4 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center">
          <History size={15} className="text-emerald-500" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">Atividade Recente</h3>
      </div>
      <div className="px-5 pb-5 space-y-2.5">
        {data.recentTransactions && data.recentTransactions.length > 0 ? (
          data.recentTransactions.map((tx: any) => (
            <div key={tx.id} className="flex items-center justify-between p-3 rounded-xl bg-card border border-border/30 hover:border-border/60 transition-all group">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <CategoryIcon name={tx.TransactionCategory?.icon} className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground line-clamp-1">{tx.description || tx.TransactionCategory?.name || 'Sem nome'}</p>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider mt-0.5">{formatDate(tx.transaction_date)} • {tx.wallet?.name}</p>
                </div>
              </div>
              <p className={`text-xs font-bold tabular-nums ${tx.transaction_type === 'EXPENSE' ? 'text-red-500' : 'text-emerald-500'}`}>
                {tx.transaction_type === 'EXPENSE' ? '-' : '+'}{formatCurrency(Number(tx.value))}
              </p>
            </div>
          ))
        ) : (
          <div className="text-center py-6 text-muted-foreground text-xs">Nenhuma atividade recente.</div>
        )}
        <button
          onClick={() => navigate('/transactions')}
          className="w-full py-2.5 rounded-xl text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/5 transition-colors flex items-center justify-center gap-1.5"
        >
          Ver histórico completo
          <ArrowRight size={12} />
        </button>
      </div>
    </div>
  );
}