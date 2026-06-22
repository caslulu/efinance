/**
 * Domain constants for transactions and wallets.
 * Centralizing these strings makes the semantic rules (especially around
 * meal-voucher cards that report as CREDIT but debit immediately) easy to
 * audit in one place.
 */

export const WALLET_TYPES = {
  BANK: 'BANK',
  PHYSICAL: 'PHYSICAL',
  MEAL_VOUCHER: 'MEAL_VOUCHER',
  INVESTMENT: 'INVESTMENT',
  CREDIT_CARD: 'CREDIT_CARD',
  OTHER: 'OTHER',
} as const;

export const PAYMENT_METHODS = {
  CREDIT: 'CREDIT',
  DEBIT: 'DEBIT',
  PIX: 'PIX',
  TED: 'TED',
  BOLETO: 'BOLETO',
  CASH: 'CASH',
} as const;

export const TRANSACTION_TYPES = {
  INCOME: 'INCOME',
  EXPENSE: 'EXPENSE',
} as const;

/**
 * A payment is settled immediately (impacts wallet balance on the transaction date)
 * if it is NOT a credit-card purchase, OR if it is a meal voucher (Flash/VR/VA),
 * which behaves as a prepaid balance even though the payment method is "CREDIT".
 */
export function isImmediateDebit(
  paymentMethod: string | null | undefined,
  walletType: string | null | undefined,
): boolean {
  if (walletType === WALLET_TYPES.MEAL_VOUCHER) return true;
  return paymentMethod !== PAYMENT_METHODS.CREDIT;
}
