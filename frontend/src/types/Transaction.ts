import type { Category } from "./Category";
import type { Card } from "./Card";

export interface Transaction {
  id: number;
  transaction_date: string;
  wallet_id: number;
  card_id?: number;
  card?: Card;
  transaction_type: "INCOME" | "EXPENSE";
  description?: string;
  is_recurring: boolean;
  value: number;
  category_id: number;
  payment_method?: string;
  installment_total?: number;
  installment_number?: number;
  installment_id?: string;
  subscription_id?: number;
  is_processed?: boolean;
  TransactionCategory?: Category;
}

export interface StatementImportDuplicateMatch {
  id: number;
  description: string | null;
  transaction_date: string;
  value: number;
  transaction_type: "INCOME" | "EXPENSE";
  payment_method?: string | null;
}

export interface StatementImportPreviewRow {
  source_id: string;
  transaction_date: string;
  value: number;
  transaction_type: "INCOME" | "EXPENSE";
  description: string | null;
  is_recurring?: boolean;
  installment_total?: number;
  installment_number?: number;
  duplicateMatches: StatementImportDuplicateMatch[];
}

export interface StatementImportPreview {
  walletId: number;
  walletName: string;
  fileName: string;
  format: "OFX" | "CSV";
  summary: {
    totalRows: number;
    duplicateRows: number;
    incomeCount: number;
    expenseCount: number;
  };
  rows: StatementImportPreviewRow[];
}

export interface StatementImportConfirmResponse {
  importedCount: number;
  failedCount: number;
  failures: Array<{
    row: {
      transaction_date: string;
      value: number;
      transaction_type: "INCOME" | "EXPENSE";
      description?: string;
      category_id?: number;
      is_recurring?: boolean;
      installment_total?: number;
      installment_number?: number;
    };
    error: string;
  }>;
}
