export interface Wallet {
  id: number;
  name: string;
  type: 'BANK' | 'PHYSICAL' | 'MEAL_VOUCHER' | 'INVESTMENT' | 'OTHER';
  user_id: number;
  actual_cash: number;
  closing_day?: number;
  due_day?: number;
  current_invoice?: number;
  total_invoice?: number;
}
