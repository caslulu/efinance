import { Bell, Wallet as WalletIcon } from 'lucide-react';
import { CategoryIcon } from '@/components/IconPicker';
import { formatCurrency } from '@/lib/utils';

export function UpcomingBills({ data, formatDate }: { data: any, formatDate: (dateStr: string) => string }) {
  return (
    <div className="dash-card overflow-hidden">
      <div className="px-5 pt-5 pb-4 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center">
          <Bell size={15} className="text-amber-500" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Próximas Contas</h3>
          <p className="text-[10px] text-muted-foreground">Próximos 7 dias</p>
        </div>
      </div>
      <div className="px-5 pb-5 space-y-2.5">
        {data.upcomingTransactions && data.upcomingTransactions.length > 0 ? (
          data.upcomingTransactions.map((tx: any) => (
            <div key={tx.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/30 hover:bg-muted/50 transition-colors group">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <CategoryIcon name={tx.TransactionCategory?.icon} className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground line-clamp-1">{tx.description || tx.TransactionCategory?.name || 'Sem nome'}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <WalletIcon size={9} /> {tx.wallet?.name}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium">{formatDate(tx.transaction_date)}</span>
                  </div>
                </div>
              </div>
              <p className={`text-xs font-bold tabular-nums ${tx.transaction_type === 'EXPENSE' ? 'text-red-500' : 'text-emerald-500'}`}>
                {tx.transaction_type === 'EXPENSE' ? '-' : '+'}{formatCurrency(Number(tx.value))}
              </p>
            </div>
          ))
        ) : (
          <div className="text-center py-6 text-muted-foreground text-xs">Nenhuma conta em breve.</div>
        )}
      </div>
    </div>
  );
}