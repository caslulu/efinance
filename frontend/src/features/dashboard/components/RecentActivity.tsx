import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { History } from 'lucide-react';
import { CategoryIcon } from '@/components/IconPicker';
import { formatCurrency } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

export function RecentActivity({ data, formatDate }: { data: any, formatDate: (dateStr: string) => string }) {
  const navigate = useNavigate();
  return (
    <Card className="border-t-4 border-t-blue-500">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <History size={18} className="text-blue-500" />
          Atividade Recente
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.recentTransactions && data.recentTransactions.length > 0 ? (
            data.recentTransactions.map((tx: any) => (
              <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg border bg-card shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded bg-blue-100 text-blue-600">
                    <CategoryIcon name={tx.TransactionCategory?.icon} className="h-4 w-4" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-foreground line-clamp-1">{tx.description || tx.TransactionCategory?.name || 'Sem nome'}</p>
                    <p className="text-[9px] text-muted-foreground uppercase">{formatDate(tx.transaction_date)} • {tx.wallet?.name}</p>
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
            <div className="text-center py-4 text-muted-foreground text-xs italic">Nenhuma atividade recente.</div>
          )}
          <Button variant="ghost" className="w-full text-xs text-blue-600" onClick={() => navigate('/transactions')}>
            Ver histórico completo
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}