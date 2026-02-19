import type { Category } from './Category';

export type Frequency = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
export type SubscriptionStatus = 'ACTIVE' | 'PAUSED' | 'CANCELLED';

export interface Subscription {
  id: number;
  name: string;
  description?: string;
  value: string;
  transaction_type: 'INCOME' | 'EXPENSE';
  frequency: Frequency;
  status: SubscriptionStatus;
  start_date: string;
  next_billing_date: string;
  wallet_id: number;
  category_id: number;
  category?: Category;
}
