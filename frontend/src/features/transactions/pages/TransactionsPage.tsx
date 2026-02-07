import { useEffect, useState } from 'react';
import { api } from '../../../api/api';
import type { Transaction } from '../../../types/Transaction';
import { TransactionList } from '../components/TransactionList';

export const TransactionsPage = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTransactions = async () => {
    try {
      const res = await api.get('/transactions');
      if (Array.isArray(res.data)) {
        setTransactions(res.data);
      } else {
        setTransactions([]);
      }
    } catch (error) {
      console.error('Failed to fetch transactions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const pastTransactions = transactions.filter(t => new Date(t.transaction_date) <= today);
  const futureTransactions = transactions
    .filter(t => new Date(t.transaction_date) > today)
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
          <TransactionList transactions={pastTransactions} onTransactionUpdated={fetchTransactions} />
          
          {futureTransactions.length > 0 && (
            <div className="pt-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Lançamentos Futuros</h2>
              <TransactionList transactions={futureTransactions} onTransactionUpdated={fetchTransactions} />
            </div>
          )}
        </>
      )}
    </div>
  );
};
