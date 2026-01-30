export interface Transaction {
  id: number;
  transaction_date: string;
  wallet_id: number;
  transaction_type: 'INCOME' | 'EXPENSE';
  value: string;
  category_id: number;
  is_recurring: boolean;
  installment_number?: number;
  installment_total?: number;
  TransactionCategory?: {
    name: string;
  };
}
