import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/api';
import { queryKeys } from '@/lib/queryClient';
import type { Wallet } from '@/types/Wallet';

export function useWallets() {
  return useQuery({
    queryKey: queryKeys.wallets,
    queryFn: async () => {
      const res = await api.get<Wallet[]>('/wallets');
      return Array.isArray(res.data) ? res.data : [];
    },
  });
}

export function useCreateWallet() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: Partial<Wallet>) => {
      const res = await api.post('/wallets', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.wallets });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useUpdateWallet() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Wallet> }) => {
      const res = await api.patch(`/wallets/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.wallets });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useDeleteWallet() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/wallets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.wallets });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function usePayInvoice() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ walletId, sourceWalletId }: { walletId: number; sourceWalletId: number }) => {
      const res = await api.post(`/wallets/${walletId}/pay-invoice`, { sourceWalletId });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.wallets });
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useTransferBetweenWallets() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { fromWalletId: number; toWalletId: number; amount: number }) => {
      const res = await api.post('/wallets/transfer', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.wallets });
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}
