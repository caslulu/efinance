import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/api';
import { queryKeys } from '@/lib/queryClient';
import type {
  InvestmentMarketItem,
  InvestmentMarketQueryParams,
} from '@/types/InvestmentMarket';

const normalizeList = (values: string[]) =>
  Array.from(
    new Set(
      values
        .map((value) => value.trim().toUpperCase())
        .filter(Boolean),
    ),
  );

const normalizePeriods = (periods: number[]) =>
  Array.from(
    new Set(
      periods
        .map((period) => Number(period))
        .filter((period) => Number.isFinite(period) && period > 0),
    ),
  ).sort((a, b) => a - b);

export function useInvestmentMarketData(
  params: InvestmentMarketQueryParams,
  enabled = true,
) {
  const symbols = normalizeList(params.symbols);
  const periods = normalizePeriods(params.periods);
  const market = (params.market || 'BR').trim().toUpperCase() || 'BR';

  return useQuery({
    queryKey: queryKeys.investmentMarketData(symbols, periods, market),
    queryFn: async () => {
      const res = await api.get<InvestmentMarketItem[]>('/investments/market-data', {
        params: {
          symbols: symbols.join(','),
          periods: periods.join(','),
          market,
        },
      });

      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: enabled && symbols.length > 0 && periods.length > 0,
    staleTime: 60_000,
  });
}
