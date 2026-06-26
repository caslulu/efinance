export interface Card {
  id: number;
  wallet_id: number;
  name: string;
  flag: string;
  closing_day: number;
  due_day: number;
  card_limit: number;
  current_invoice?: number;
  due_invoice?: number;
  total_invoice?: number;
  available_limit?: number;
  external_id?: string | null;
  external_source?: string | null;
  pluggy_account_id?: string | null;
  pluggy_card_number?: string | null;
}
