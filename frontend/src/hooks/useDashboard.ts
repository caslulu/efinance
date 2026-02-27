import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/api';
import { queryKeys } from '@/lib/queryClient';

export function useDashboard(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: [...queryKeys.dashboard, { startDate, endDate }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const queryString = params.toString() ? `?${params.toString()}` : '';
      const res = await api.get(`/dashboard${queryString}`);
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
