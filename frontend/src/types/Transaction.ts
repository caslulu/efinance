export interface Transaction {
  id: number;
  transaction_date: string;
  wallet_id: number;
  transaction_type: 'INCOME' | 'EXPENSE';
  description?: string;
  is_recurring: boolean;
  value: number;
  category_id: number;
  payment_method?: string;
  installment_total?: number;
  installment_number?: number;
  installment_id?: string;
  subscription_id?: number;
  TransactionCategory?: {
    id: number;
    name: string;
  };
}
