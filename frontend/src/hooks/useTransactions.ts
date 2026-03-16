import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/api";
import { queryKeys } from "@/lib/queryClient";
import type {
  StatementImportConfirmResponse,
  StatementImportPreview,
  StatementImportPreviewRow,
  Transaction,
} from "@/types/Transaction";

export function useTransactions() {
  return useQuery({
    queryKey: queryKeys.transactions,
    queryFn: async () => {
      const res = await api.get<Transaction[]>("/transactions");
      return Array.isArray(res.data) ? res.data : [];
    },
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<Transaction>) => {
      const res = await api.post("/transactions", data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions });
      queryClient.invalidateQueries({ queryKey: queryKeys.wallets });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      queryClient.invalidateQueries({ queryKey: queryKeys.budgetStatus });
    },
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: Partial<Transaction>;
    }) => {
      const res = await api.patch(`/transactions/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions });
      queryClient.invalidateQueries({ queryKey: queryKeys.wallets });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      queryClient.invalidateQueries({ queryKey: queryKeys.budgetStatus });
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/transactions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions });
      queryClient.invalidateQueries({ queryKey: queryKeys.wallets });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      queryClient.invalidateQueries({ queryKey: queryKeys.budgetStatus });
    },
  });
}

export function usePreviewStatementImport() {
  return useMutation({
    mutationFn: async ({
      walletId,
      file,
    }: {
      walletId: number;
      file: File;
    }) => {
      const formData = new FormData();
      formData.append("file", file);

      const res = await api.post<StatementImportPreview>(
        `/transactions/import/${walletId}/preview`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        },
      );

      return res.data;
    },
  });
}

export function useConfirmStatementImport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      walletId,
      rows,
    }: {
      walletId: number;
      rows: Array<
        Pick<
          StatementImportPreviewRow,
          | "transaction_date"
          | "value"
          | "transaction_type"
          | "description"
          | "is_recurring"
          | "installment_total"
          | "installment_number"
        > & { category_id?: number | null }
      >;
    }) => {
      const res = await api.post<StatementImportConfirmResponse>(
        `/transactions/import/${walletId}/confirm`,
        { rows },
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions });
      queryClient.invalidateQueries({ queryKey: queryKeys.wallets });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      queryClient.invalidateQueries({ queryKey: queryKeys.budgetStatus });
    },
  });
}
