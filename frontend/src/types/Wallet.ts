export interface Wallet {
  id: number;
  name: string;
  type: 'BANK' | 'PHYSICAL' | 'MEAL_VOUCHER' | 'INVESTMENT';
  user_id: number;
}
