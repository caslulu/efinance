import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache data for 5 minutes
      staleTime: 5 * 60 * 1000,
      // Keep cached data for 30 minutes
      gcTime: 30 * 60 * 1000,
      // Retry failed requests up to 3 times
      retry: 3,
      // Don't refetch on window focus by default
      refetchOnWindowFocus: false,
      // Don't refetch on reconnect
      refetchOnReconnect: false,
    },
  },
});

// Query keys for cache management
export const queryKeys = {
  wallets: ['wallets'] as const,
  wallet: (id: number) => ['wallets', id] as const,
  
  transactions: ['transactions'] as const,
  transaction: (id: number) => ['transactions', id] as const,
  
  categories: ['categories'] as const,
  category: (id: number) => ['categories', id] as const,
  
  subscriptions: ['subscriptions'] as const,
  subscription: (id: number) => ['subscriptions', id] as const,

  wishlists: ['wishlists'] as const,
  wishlist: (id: number) => ['wishlists', id] as const,
  
  budgets: ['budgets'] as const,
  budgetStatus: ['budgets', 'status'] as const,
  
  dashboard: ['dashboard'] as const,
  dashboardCategory: (category: string) => ['dashboard', 'category', category] as const,
};
