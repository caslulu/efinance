import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/api';
import { queryKeys } from '@/lib/queryClient';

export function useDashboard() {
  return useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: async () => {
      const res = await api.get('/dashboard');
      return res.data;
    },
  });
}

export function useDashboardCategory(category: string | null) {
  return useQuery({
    queryKey: queryKeys.dashboardCategory(category || ''),
    queryFn: async () => {
      if (!category) return [];
      const res = await api.get(`/dashboard/category/${encodeURIComponent(category)}`);
      return res.data;
    },
    enabled: !!category,
  });
}
