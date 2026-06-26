import type { Card } from './Card';

export interface Wallet {
  id: number;
  name: string;
  type:
    | 'BANK'
    | 'PHYSICAL'
    | 'MEAL_VOUCHER'
    | 'INVESTMENT'
    | 'CREDIT_CARD'
    | 'OTHER';
  user_id: number;
  actual_cash: number;
  pluggy_item_id?: string | null;
  pluggy_account_id?: string | null;
  external_source?: string | null;
  pluggy_last_sync_at?: string | null;
  portfolioValue?: number;
  availableCash?: number;
  positionsCount?: number;
  displayValue?: number;
  is_transfer_only?: boolean;
  order?: number;
  cards?: Card[];
}
