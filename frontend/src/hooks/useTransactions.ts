import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/api";
import { queryKeys } from "@/lib/queryClient";
import type {
  StatementImportConfirmResponse,
  StatementImportPreview,
  StatementImportConfirmRow,
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
      cardId,
      file,
    }: {
      walletId: number;
      cardId?: number;
      file: File;
    }) => {
      const formData = new FormData();
      formData.append("file", file);
      const params = cardId ? { cardId } : undefined;

      const res = await api.post<StatementImportPreview>(
        `/transactions/import/${walletId}/preview`,
        formData,
        {
          params,
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
      cardId,
      rows,
    }: {
      walletId: number;
      cardId?: number;
      rows: StatementImportConfirmRow[];
    }) => {
      const res = await api.post<StatementImportConfirmResponse>(
        `/transactions/import/${walletId}/confirm`,
        { cardId, rows },
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

export function useAnalyzeStatementImport() {
  return useMutation({
    mutationFn: async ({
      walletId,
      cardId,
      file,
      message,
      clarification,
      mode,
    }: {
      walletId: number;
      cardId?: number;
      file?: File;
      message?: string;
      clarification?: string;
      mode: "assisted" | "automatic";
    }) => {
      const body = new FormData();
      if (file) body.append("file", file);
      if (message) body.append("message", message);
      if (clarification) body.append("clarification", clarification);
      body.append("mode", mode);
      const result = await api.post<StatementImportPreview>(
        `/transactions/import/${walletId}/analyze`,
        body,
        { params: cardId ? { cardId } : undefined, timeout: 130000 },
      );
      return result.data;
    },
  });
}
