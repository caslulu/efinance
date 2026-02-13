import { useEffect, useState } from 'react';
import { api } from '../../../api/api';
import type { Transaction } from '../../../types/Transaction';
import type { Subscription } from '../../../types/Subscription';
import { TransactionList } from '../components/TransactionList';

export const TransactionsPage = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [txRes, subRes] = await Promise.all([
        api.get('/transactions'),
        api.get('/subscriptions')
      ]);
      
      if (Array.isArray(txRes.data)) {
        setTransactions(txRes.data);
      }
      if (Array.isArray(subRes.data)) {
        setSubscriptions(subRes.data);
      }
    } catch (error) {
      console.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const pastTransactions = transactions.filter(t => new Date(t.transaction_date) <= today);
  
  // Generate Virtual Future Transactions from Subscriptions
  const virtualTransactions: Transaction[] = [];
  subscriptions.forEach(sub => {
    if (sub.status !== 'ACTIVE') return;
    
    let currentDate = new Date(sub.next_billing_date);
    // Adjust to noon to match fixed transaction date logic
    currentDate.setHours(12, 0, 0, 0);

    for (let i = 0; i < 12; i++) {
      // Only add if it's in the future (though next_billing_date should be future/today)
      if (currentDate > today) {
        virtualTransactions.push({
          id: -1 * (sub.id * 1000 + i), // Temporary negative ID
          transaction_date: currentDate.toISOString(),
          wallet_id: sub.wallet_id,
          description: sub.name,
          transaction_type: sub.transaction_type as 'INCOME' | 'EXPENSE',
          is_recurring: true,
          value: Number(sub.value),
          category_id: sub.category_id,
          payment_method: 'Recorrente', // Label
          installment_total: undefined,
          installment_number: undefined,
          TransactionCategory: sub.category ? { id: sub.category.id, name: sub.category.name } : undefined
        } as any);
      }

      // Increment Date
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

  const realFutureTransactions = transactions.filter(t => new Date(t.transaction_date) > today);
  
  const futureTransactions = [...realFutureTransactions, ...virtualTransactions]
    .sort((a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime());

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Transações</h1>
      </div>

      {loading ? (
        <div>Carregando...</div>
      ) : (
        <>
          <TransactionList transactions={pastTransactions} onTransactionUpdated={fetchData} />
          
          {futureTransactions.length > 0 && (
            <div className="pt-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Lançamentos Futuros (Previsão)</h2>
              <TransactionList transactions={futureTransactions} onTransactionUpdated={fetchData} />
            </div>
          )}
        </>
      )}
    </div>
  );
};
