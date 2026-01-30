import clsx from 'clsx';
import type { Transaction } from '../../../types/Transaction';

interface TransactionListProps {
  transactions: Transaction[];
}

export const TransactionList = ({ transactions }: TransactionListProps) => {
  return (
    <div className="overflow-hidden rounded-lg border bg-white shadow">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Date</th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Category</th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Type</th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Installment</th>
            <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Value</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {transactions.map((tx) => (
            <tr key={tx.id} className="hover:bg-gray-50">
              <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                {new Date(tx.transaction_date).toLocaleDateString()}
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                {tx.TransactionCategory?.name || 'Uncategorized'}
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                <span
                  className={clsx(
                    'inline-flex rounded-full px-2 text-xs font-semibold leading-5',
                    tx.transaction_type === 'INCOME' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  )}
                >
                  {tx.transaction_type}
                </span>
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                {tx.installment_total ? `${tx.installment_number}/${tx.installment_total}` : '-'}
              </td>
              <td className={clsx("whitespace-nowrap px-6 py-4 text-right text-sm font-bold", 
                tx.transaction_type === 'INCOME' ? 'text-green-600' : 'text-red-600'
              )}>
                {tx.transaction_type === 'EXPENSE' ? '- ' : '+ '}
                R$ {Number(tx.value).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {transactions.length === 0 && (
        <div className="p-6 text-center text-gray-500">No transactions found.</div>
      )}
    </div>
  );
};
