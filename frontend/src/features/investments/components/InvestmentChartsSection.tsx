import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, PieChart as PieChartIcon, Wallet2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { InvestmentMarketItem } from '@/types/InvestmentMarket';
import type { InvestmentPortfolio } from '@/types/InvestmentPortfolio';

const CHART_COLORS = ['#10b981', '#0f766e', '#14b8a6', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const formatMoney = (value: number, currency = 'BRL') =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);

const formatCompactMoney = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);

const formatDateLabel = (value: string) =>
  new Date(value).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });

type Props = {
  portfolio: InvestmentPortfolio | undefined;
  marketData: InvestmentMarketItem[];
  isMarketLoading: boolean;
};

export function InvestmentChartsSection({
  portfolio,
  marketData,
  isMarketLoading,
}: Props) {
  const chartableAssets = useMemo(
    () => marketData.filter((item) => item.priceHistory.length > 1),
    [marketData],
  );

  const [selectedAssetSymbol, setSelectedAssetSymbol] = useState<string | null>(null);

  useEffect(() => {
    if (chartableAssets.length === 0) {
      setSelectedAssetSymbol(null);
      return;
    }

    const existing = chartableAssets.some((item) => item.symbol === selectedAssetSymbol);
    if (!existing) {
      setSelectedAssetSymbol(chartableAssets[0].symbol);
    }
  }, [chartableAssets, selectedAssetSymbol]);

  const selectedAsset =
    chartableAssets.find((item) => item.symbol === selectedAssetSymbol) ?? null;

  const priceHistoryData = useMemo(
    () =>
      (selectedAsset?.priceHistory ?? []).map((point) => ({
        ...point,
        label: formatDateLabel(point.date),
      })),
    [selectedAsset],
  );

  const allocationData = useMemo(() => {
    if (!portfolio?.positions.length) {
      return [];
    }

    const sorted = [...portfolio.positions]
      .sort((left, right) => right.currentValueBrl - left.currentValueBrl);
    const visible = sorted.slice(0, 5).map((position, index) => ({
      name: position.symbol,
      walletName: position.walletName,
      value: position.currentValueBrl,
      allocation: portfolio.summary.totalPortfolioValue > 0
        ? (position.currentValueBrl / portfolio.summary.totalPortfolioValue) * 100
        : 0,
      fill: CHART_COLORS[index % CHART_COLORS.length],
    }));
    const remaining = sorted.slice(5).reduce((sum, position) => sum + position.currentValueBrl, 0);

    return remaining > 0
      ? [
          ...visible,
          {
            name: 'Outros',
            walletName: `${sorted.length - 5} ativos`,
            value: remaining,
            allocation: portfolio.summary.totalPortfolioValue > 0
              ? (remaining / portfolio.summary.totalPortfolioValue) * 100
              : 0,
            fill: '#94a3b8',
          },
        ]
      : visible;
  }, [portfolio]);

  const walletCompositionData = useMemo(
    () =>
      (portfolio?.wallets ?? [])
        .map((wallet) => ({
          name: wallet.walletName,
          invested: wallet.portfolioValue,
          cash: wallet.availableCash,
          total: wallet.portfolioValue + wallet.availableCash,
          gainLoss: wallet.totalGainLoss,
        }))
        .sort((left, right) => right.total - left.total),
    [portfolio],
  );

  return (
    <div className="grid gap-4 xl:grid-cols-[1.35fr_0.95fr]">
      <Card className="overflow-hidden border-border/50 bg-card/90 shadow-sm backdrop-blur">
        <CardHeader className="border-b border-border/50 bg-muted/20">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Activity className="h-5 w-5 text-emerald-500" />
                Preço do ativo
              </CardTitle>
              <CardDescription>
                Série histórica recente para acompanhar a direção da cotação.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {chartableAssets.slice(0, 6).map((item) => (
                <Button
                  key={item.symbol}
                  type="button"
                  variant="outline"
                  size="sm"
                  className={selectedAssetSymbol === item.symbol ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700' : ''}
                  onClick={() => setSelectedAssetSymbol(item.symbol)}
                >
                  {item.symbol}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {isMarketLoading ? (
            <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">
              Carregando histórico...
            </div>
          ) : selectedAsset && priceHistoryData.length > 1 ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-2xl font-black text-foreground">{selectedAsset.symbol}</p>
                    <Badge variant="outline" className="tracking-[0.18em] uppercase">
                      {selectedAsset.marketSymbol}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {selectedAsset.shortName || selectedAsset.longName || 'Ativo monitorado'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    Último preço
                  </p>
                  <p className="text-2xl font-black text-foreground">
                    {formatMoney(selectedAsset.price, selectedAsset.currency)}
                  </p>
                </div>
              </div>

              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={priceHistoryData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="investment-price-gradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border) / 0.5)" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tickFormatter={(value) => formatMoney(Number(value), selectedAsset.currency)}
                      tick={{ fontSize: 12 }}
                      width={88}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      formatter={(value) => [
                        formatMoney(Number(value ?? 0), selectedAsset.currency),
                        'Fechamento',
                      ]}
                      labelFormatter={(_label, payload) =>
                        payload?.[0]?.payload?.date
                          ? new Date(payload[0].payload.date).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: 'long',
                              year: 'numeric',
                            })
                          : ''
                      }
                      contentStyle={{
                        borderRadius: '16px',
                        border: '1px solid hsl(var(--border) / 0.7)',
                        background: 'hsl(var(--card))',
                        boxShadow: '0 20px 40px -24px rgba(15, 23, 42, 0.45)',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="close"
                      stroke="#10b981"
                      strokeWidth={3}
                      fill="url(#investment-price-gradient)"
                      activeDot={{ r: 6, strokeWidth: 0, fill: '#10b981' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="flex h-[320px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/60 bg-muted/20 text-center">
              <Activity className="h-8 w-8 text-muted-foreground/40" />
              <div className="space-y-1">
                <p className="font-semibold text-foreground">Sem histórico suficiente para montar o gráfico</p>
                <p className="max-w-md text-sm text-muted-foreground">
                  Consulte ativos com série histórica disponível para visualizar a evolução do preço.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4">
        <Card className="overflow-hidden border-border/50 bg-card/90 shadow-sm backdrop-blur">
          <CardHeader className="border-b border-border/50 bg-muted/20">
            <CardTitle className="flex items-center gap-2 text-lg">
              <PieChartIcon className="h-5 w-5 text-teal-500" />
              Distribuição da carteira
            </CardTitle>
            <CardDescription>
              Como o valor investido está dividido entre seus ativos.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5">
            {allocationData.length > 0 ? (
              <div className="grid gap-4 lg:grid-cols-[210px_1fr] lg:items-center">
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={allocationData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={55}
                        outerRadius={82}
                        paddingAngle={3}
                        stroke="none"
                      >
                        {allocationData.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => formatMoney(Number(value ?? 0), 'BRL')}
                        contentStyle={{
                          borderRadius: '16px',
                          border: '1px solid hsl(var(--border) / 0.7)',
                          background: 'hsl(var(--card))',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-3">
                  {allocationData.map((entry) => (
                    <div key={entry.name} className="flex items-center justify-between gap-3 rounded-2xl border border-border/50 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: entry.fill }} />
                        <div>
                          <p className="text-sm font-semibold text-foreground">{entry.name}</p>
                          <p className="text-xs text-muted-foreground">{entry.walletName}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-foreground">{formatMoney(entry.value, 'BRL')}</p>
                        <p className="text-xs text-muted-foreground">{entry.allocation.toFixed(1)}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex h-[220px] items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/20 text-sm text-muted-foreground">
                Registre posições para visualizar a distribuição da carteira.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border/50 bg-card/90 shadow-sm backdrop-blur">
          <CardHeader className="border-b border-border/50 bg-muted/20">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Wallet2 className="h-5 w-5 text-blue-500" />
              Composição por carteira
            </CardTitle>
            <CardDescription>
              Relação entre valor investido e caixa livre em cada carteira.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5">
            {walletCompositionData.length > 0 ? (
              <div className="space-y-4">
                <div className="h-[240px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={walletCompositionData} layout="vertical" margin={{ left: 8, right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border) / 0.5)" />
                      <XAxis
                        type="number"
                        tickFormatter={(value) => formatCompactMoney(Number(value))}
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={110}
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        formatter={(value, name) => [
                          formatMoney(Number(value ?? 0), 'BRL'),
                          name === 'invested' ? 'Investido' : 'Caixa',
                        ]}
                        contentStyle={{
                          borderRadius: '16px',
                          border: '1px solid hsl(var(--border) / 0.7)',
                          background: 'hsl(var(--card))',
                        }}
                      />
                      <Bar dataKey="invested" stackId="wallet" fill="#10b981" radius={[0, 6, 6, 0]} />
                      <Bar dataKey="cash" stackId="wallet" fill="#38bdf8" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {walletCompositionData.map((wallet) => (
                    <div key={wallet.name} className="rounded-2xl border border-border/50 bg-muted/20 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-foreground">{wallet.name}</p>
                        <span className={`text-sm font-semibold ${wallet.gainLoss >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {formatMoney(wallet.gainLoss, 'BRL')}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                        <span className="text-muted-foreground">Investido</span>
                        <span className="font-medium text-foreground">{formatMoney(wallet.invested, 'BRL')}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-3 text-sm">
                        <span className="text-muted-foreground">Caixa livre</span>
                        <span className="font-medium text-foreground">{formatMoney(wallet.cash, 'BRL')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex h-[220px] items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/20 text-sm text-muted-foreground">
                Crie ao menos uma carteira de investimento para montar este gráfico.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
