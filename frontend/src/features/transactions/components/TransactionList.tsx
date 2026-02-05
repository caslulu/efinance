import { useState } from 'react';
import clsx from 'clsx';
import type { Transaction } from '../../../types/Transaction';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Edit2 } from 'lucide-react';
import { EditTransactionModal } from './EditTransactionModal';
import { PAYMENT_METHODS } from '../../../../constants/paymentMethods';

interface TransactionListProps {
  transactions: Transaction[];
  onTransactionUpdated: () => void;
}

export const TransactionList = ({ transactions, onTransactionUpdated }: TransactionListProps) => {
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Método</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Parcela</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((tx) => (
              <TableRow key={tx.id}>
                <TableCell>
                  {new Date(tx.transaction_date).toLocaleDateString()}
                </TableCell>
                <TableCell className="font-medium">
                  {tx.TransactionCategory?.name || 'Sem Categoria'}
                </TableCell>
                <TableCell>
                  {tx.payment_method ? PAYMENT_METHODS[tx.payment_method as keyof typeof PAYMENT_METHODS] || tx.payment_method : '-'}
                </TableCell>
                <TableCell>
                  <Badge 
                    variant="outline" 
                    className={clsx(
                      tx.transaction_type === 'INCOME' 
                        ? 'border-green-500 text-green-600 bg-green-50' 
                        : 'border-red-500 text-red-600 bg-red-50'
                    )}
                  >
                    {tx.transaction_type === 'INCOME' ? 'RECEITA' : 'DESPESA'}
                  </Badge>
                </TableCell>
                <TableCell>
                  {tx.installment_total ? `${tx.installment_number}/${tx.installment_total}` : '-'}
                </TableCell>
                <TableCell className={clsx("text-right font-bold", 
                  tx.transaction_type === 'INCOME' ? 'text-green-600' : 'text-red-600'
                )}>
                  {tx.transaction_type === 'EXPENSE' ? '- ' : '+ '}
                  R$ {Number(tx.value).toFixed(2)}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => setEditingTransaction(tx)}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {transactions.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  Nenhuma transação encontrada.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
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
