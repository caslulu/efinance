import type { Card } from './Card';

export interface Wallet {
  id: number;
  name: string;
  type:
    | 'BANK'
    | 'PHYSICAL'
    | 'MEAL_VOUCHER'
    | 'CREDIT_CARD'
    | 'OTHER';
  user_id: number;
  actual_cash: number;
  is_transfer_only?: boolean;
  order?: number;
  cards?: Card[];
}
