import { useEffect, useState, useMemo } from 'react';
import { api } from '../../../api/api';
import type { Transaction } from '../../../types/Transaction';
import type { Subscription } from '../../../types/Subscription';
import { TransactionList } from '../components/TransactionList';
import { ChevronDown, ChevronRight, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const TransactionsPage = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedMonths, setExpandedMonths] = useState<string[]>([]);

  const fetchData = async () => {
    try {
      const [txRes, subRes] = await Promise.all([
        api.get('/transactions'),
        api.get('/subscriptions')
      ]);
      
      if (Array.isArray(txRes.data)) setTransactions(txRes.data);
      if (Array.isArray(subRes.data)) setSubscriptions(subRes.data);
    } catch (error) {
      console.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const groupedData = useMemo(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    // 1. Generate Virtual Future Transactions from Subscriptions
    const virtualTransactions: Transaction[] = [];
    subscriptions.forEach(sub => {
      if (sub.status !== 'ACTIVE') return;
      let currentDate = new Date(sub.next_billing_date);
      currentDate.setHours(12, 0, 0, 0);

      for (let i = 0; i < 12; i++) {
        if (currentDate > today) {
          virtualTransactions.push({
            id: -1 * (sub.id * 1000 + i),
            transaction_date: currentDate.toISOString(),
            wallet_id: sub.wallet_id,
            description: sub.name,
            transaction_type: sub.transaction_type as 'INCOME' | 'EXPENSE',
            is_recurring: true,
            value: Number(sub.value),
            category_id: sub.category_id,
            payment_method: 'Recorrente',
            TransactionCategory: (sub as any).category ? { id: (sub as any).category.id, name: (sub as any).category.name } : undefined
          } as any);
        }
        const nextDate = new Date(currentDate);
        switch (sub.frequency) {
          case 'WEEKLY': nextDate.setDate(nextDate.getDate() + 7); break;
          case 'MONTHLY': nextDate.setMonth(nextDate.getMonth() + 1); break;
          case 'QUARTERLY': nextDate.setMonth(nextDate.getMonth() + 3); break;
          case 'YEARLY': nextDate.setFullYear(nextDate.getFullYear() + 1); break;
        }
        currentDate = nextDate;
      }
    });

    const allTx = [...transactions, ...virtualTransactions];
    
    // 2. Group by Month/Year
    const groups: Record<string, { label: string; transactions: Transaction[]; totalExpense: number; totalIncome: number; orderKey: number }> = {};

    allTx.forEach(tx => {
      const d = new Date(tx.transaction_date);
      const monthLabel = d.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
      const orderKey = d.getFullYear() * 100 + d.getMonth(); // e.g. 202511 for Nov 2025

      if (!groups[monthLabel]) {
        groups[monthLabel] = { 
          label: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1), 
          transactions: [], 
          totalExpense: 0, 
          totalIncome: 0,
          orderKey 
        };
      }

      groups[monthLabel].transactions.push(tx);
      const val = Number(tx.value);
      if (tx.transaction_type === 'EXPENSE') {
        groups[monthLabel].totalExpense += val;
      } else {
        groups[monthLabel].totalIncome += val;
      }
    });

    // 3. Sort groups (latest first) and transactions within groups
    return Object.values(groups)
      .sort((a, b) => b.orderKey - a.orderKey)
      .map(group => ({
        ...group,
        transactions: group.transactions.sort((a, b) => 
          new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime()
        )
      }));
  }, [transactions, subscriptions]);

  // Expand current month by default
  useEffect(() => {
    if (groupedData.length > 0 && expandedMonths.length === 0) {
      const currentMonth = new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
      const currentLabel = currentMonth.charAt(0).toUpperCase() + currentMonth.slice(1);
      setExpandedMonths([currentLabel]);
    }
  }, [groupedData, expandedMonths.length]);

  const toggleMonth = (label: string) => {
    setExpandedMonths(prev => 
      prev.includes(label) ? prev.filter(m => m !== label) : [...prev, label]
    );
  };

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Histórico de Transações</h1>
      </div>

      {loading ? (
        <div className="text-center py-10 text-muted-foreground">Carregando transações...</div>
      ) : (
        <div className="space-y-4">
          {groupedData.map((group) => {
            const isExpanded = expandedMonths.includes(group.label);
            const isFuture = group.orderKey > (new Date().getFullYear() * 100 + new Date().getMonth());

            return (
              <div key={group.label} className="border rounded-xl bg-white overflow-hidden shadow-sm transition-all hover:shadow-md">
                <button 
                  onClick={() => toggleMonth(group.label)}
                  className="w-full flex items-center justify-between p-4 bg-gray-50/50 hover:bg-gray-50 transition-colors border-b"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isFuture ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}`}>
                      <Calendar size={18} />
                    </div>
                    <div className="text-left">
                      <h3 className="font-bold text-gray-900 capitalize">{group.label}</h3>
                      {isFuture && <span className="text-[10px] bg-blue-500 text-white px-1.5 py-0.5 rounded uppercase font-bold">Projeção</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="hidden md:flex gap-4 text-sm">
                      <div className="text-right">
                        <p className="text-[10px] text-muted-foreground uppercase">Receitas</p>
                        <p className="font-bold text-green-600">{formatCurrency(group.totalIncome)}</p>
                      </div>
                      <div className="text-right border-l pl-4">
                        <p className="text-[10px] text-muted-foreground uppercase">Gastos</p>
                        <p className="font-bold text-red-600">{formatCurrency(group.totalExpense)}</p>
                      </div>
                    </div>
                    {isExpanded ? <ChevronDown className="text-gray-400" /> : <ChevronRight className="text-gray-400" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="p-2 animate-in fade-in slide-in-from-top-1 duration-200">
                    <TransactionList transactions={group.transactions} onTransactionUpdated={fetchData} />
                  </div>
                )}
              </div>
            );
          })}

          {groupedData.length === 0 && (
            <div className="text-center py-20 border-2 border-dashed rounded-xl text-muted-foreground">
              Nenhuma transação encontrada para este período.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
