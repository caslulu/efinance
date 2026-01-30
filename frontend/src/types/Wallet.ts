export interface Wallet {
  id: number;
  name: string;
  type: 'BANK' | 'PHYSICAL' | 'MEAL_VOUCHER' | 'INVESTMENT';
  actual_cash: string; // Decimal comes as string from JSON often
  user_id: number;
}
