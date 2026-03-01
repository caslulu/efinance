import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell, Wallet as WalletIcon } from 'lucide-react';
import { CategoryIcon } from '@/components/IconPicker';
import { formatCurrency } from '@/lib/utils';

export function UpcomingBills({ data, formatDate }: { data: any, formatDate: (dateStr: string) => string }) {
  return (
    <Card className="border-t-4 border-t-orange-500">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Bell size={18} className="text-orange-500" />
          Próximas Contas (7 dias)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.upcomingTransactions && data.upcomingTransactions.length > 0 ? (
            data.upcomingTransactions.map((tx: any) => (
              <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/50 hover:bg-accent hover:text-accent-foreground transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded bg-orange-100 text-orange-600">
                    <CategoryIcon name={tx.TransactionCategory?.icon} className="h-4 w-4" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-foreground line-clamp-1">{tx.description || tx.TransactionCategory?.name || 'Sem nome'}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <WalletIcon size={10} /> {tx.wallet?.name}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">{formatDate(tx.transaction_date)}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-xs font-bold ${tx.transaction_type === 'EXPENSE' ? 'text-red-600' : 'text-green-600'}`}>
                    {tx.transaction_type === 'EXPENSE' ? '-' : '+'} {formatCurrency(Number(tx.value))}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-4 text-muted-foreground text-xs italic">Nenhuma conta em breve.</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}