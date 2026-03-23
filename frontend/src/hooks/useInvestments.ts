import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/api';
import { queryKeys } from '@/lib/queryClient';
import type {
  InvestmentMarketItem,
  InvestmentMarketQueryParams,
} from '@/types/InvestmentMarket';
import type {
  CreateInvestmentOperationPayload,
  InvestmentPortfolio,
} from '@/types/InvestmentPortfolio';

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

export function useInvestmentPortfolio(enabled = true) {
  return useQuery({
    queryKey: queryKeys.investmentPortfolio,
    queryFn: async () => {
      const res = await api.get<InvestmentPortfolio>('/investments/portfolio');
      return res.data;
    },
    enabled,
    staleTime: 30_000,
  });
}

export function useCreateInvestmentOperation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateInvestmentOperationPayload) => {
      const res = await api.post('/investments/operations', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.investmentPortfolio });
      queryClient.invalidateQueries({ queryKey: queryKeys.wallets });
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}
