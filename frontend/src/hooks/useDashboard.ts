import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/api';
import { queryKeys } from '@/lib/queryClient';
import type { DashboardOverview, DashboardTransaction } from '@/types/Dashboard';

export function useDashboard(startDate?: string, endDate?: string) {
  return useQuery<DashboardOverview>({
    queryKey: [...queryKeys.dashboard, { startDate, endDate }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const queryString = params.toString() ? `?${params.toString()}` : '';
      const res = await api.get<DashboardOverview>(`/dashboard${queryString}`);
      return res.data;
    },
  });
}

export function useDashboardCategory(category: string | null) {
  return useQuery<DashboardTransaction[]>({
    queryKey: queryKeys.dashboardCategory(category || ''),
    queryFn: async () => {
      if (!category) return [];
      const res = await api.get<DashboardTransaction[]>(
        `/dashboard/category/${encodeURIComponent(category)}`,
      );
      return res.data;
    },
    enabled: !!category,
  });
}
