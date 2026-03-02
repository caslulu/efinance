import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/api';
import { queryKeys } from '@/lib/queryClient';
import type { Card } from '@/types/Card';

export function useCardsByWallet(walletId: number | null) {
  return useQuery({
    queryKey: queryKeys.cardsByWallet(walletId ?? 0),
    queryFn: async () => {
      if (!walletId) return [];
      const res = await api.get<Card[]>(`/cards/wallet/${walletId}`);
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: !!walletId,
  });
}

export function useCreateCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<Card, 'id' | 'current_invoice' | 'due_invoice' | 'total_invoice' | 'available_limit'>) => {
      const res = await api.post('/cards', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cards });
      queryClient.invalidateQueries({ queryKey: queryKeys.wallets });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useUpdateCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Card> }) => {
      const res = await api.patch(`/cards/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cards });
      queryClient.invalidateQueries({ queryKey: queryKeys.wallets });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useDeleteCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/cards/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cards });
      queryClient.invalidateQueries({ queryKey: queryKeys.wallets });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}
