export interface Transaction {
  id: number;
  transaction_date: string;
  wallet_id: number;
  transaction_type: 'INCOME' | 'EXPENSE';
  is_recurring: boolean;
  value: number;
  category_id: number;
  payment_method?: string;
  installment_total?: number;
  installment_number?: number;
  TransactionCategory?: {
    id: number;
    name: string;
  };
}
