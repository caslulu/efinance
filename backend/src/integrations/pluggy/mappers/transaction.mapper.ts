import type { Account, Transaction as PluggyTransaction } from 'pluggy-sdk';

export type MappedTransaction = {
  external_id: string;
  external_source: string;
  transaction_date: Date;
  transaction_type: 'INCOME' | 'EXPENSE';
  value: number;
  description: string | null;
  payment_method: string | null;
  installment_id: string | null;
  installment_total: number | null;
  installment_number: number | null;
  category_name: string | null;
};

const PAYMENT_METHOD_MAP: Record<string, string> = {
  PIX: 'PIX',
  TED: 'TED',
  DOC: 'TED',
  TEF: 'TED',
  BOLETO: 'BOLETO',
};

function normalizePaymentMethod(
  account: Account,
  tx: PluggyTransaction,
): string | null {
  if (account.type === 'CREDIT') return 'CREDIT';
  const raw =
    tx.paymentData?.paymentMethod ??
    tx.providerCode ??
    tx.operationType ??
    null;
  if (!raw) return account.type === 'BANK' ? 'DEBIT' : null;
  const upper = raw.toUpperCase();
  return PAYMENT_METHOD_MAP[upper] ?? upper;
}

export function mapPluggyTransaction(
  account: Account,
  tx: PluggyTransaction,
  externalSource: string,
): MappedTransaction {
  const isCredit = account.type === 'CREDIT';

  // For BANK accounts: Pluggy sends signed amounts (negative = expense, positive = income).
  // For CREDIT accounts: positive = purchase (expense), negative = payment/refund (income).
  let transactionType: 'INCOME' | 'EXPENSE';
  if (isCredit) {
    transactionType = tx.amount >= 0 ? 'EXPENSE' : 'INCOME';
  } else {
    transactionType = tx.amount >= 0 ? 'INCOME' : 'EXPENSE';
  }
  const value = Math.abs(tx.amount);

  const ccm = tx.creditCardMetadata;
  const installmentTotal = ccm?.totalInstallments ?? null;
  const installmentNumber = ccm?.installmentNumber ?? null;
  const installmentId =
    installmentTotal && installmentTotal > 1
      ? `pluggy:${ccm?.billId ?? 'inst'}:${tx.description}`
      : null;

  return {
    external_id: tx.id,
    external_source: externalSource,
    transaction_date: new Date(tx.date),
    transaction_type: transactionType,
    value,
    description: tx.description ?? null,
    payment_method: normalizePaymentMethod(account, tx),
    installment_id: installmentId,
    installment_total: installmentTotal,
    installment_number: installmentNumber,
    category_name: tx.category ?? null,
  };
}
