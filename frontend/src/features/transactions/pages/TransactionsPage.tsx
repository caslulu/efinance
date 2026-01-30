import { useEffect, useState } from 'react';
import { api } from '../../../api/api';
import type { Transaction } from '../../../types/Transaction';
import { TransactionList } from '../components/TransactionList';

export const TransactionsPage = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const res = await api.get('/transactions');
        setTransactions(res.data);
      } catch (error) {
        console.error('Failed to fetch transactions');
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, []);

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Transactions</h1>
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <TransactionList transactions={transactions} />
      )}
    </div>
  );
};
