import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getErrorMessage } from '@/lib/utils';
import {
  useInvestmentMarketData,
  useInvestmentPortfolio,
  useWallets,
} from '@/hooks';
import {
  ArrowDownRight,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  CircleDollarSign,
  Globe2,
  Landmark,
  Plus,
  RefreshCcw,
  Search,
  TrendingUp,
} from 'lucide-react';
import type {
  InvestmentDualCurrencyValue,
  InvestmentMarketItem,
} from '@/types/InvestmentMarket';
import type { InvestmentPortfolioPosition } from '@/types/InvestmentPortfolio';
import { CreateWalletModal } from '@/features/wallets/components/CreateWalletModal';
import { InvestmentOperationModal } from '../components/InvestmentOperationModal';
import { InvestmentChartsSection } from '../components/InvestmentChartsSection';

const DEFAULT_SYMBOLS_BY_MARKET = {
  BR: 'MXRF11,HGLG11,PETR4',
  GLOBAL: 'AMZN,TSLA,AAPL',
} as const;
const DEFAULT_PERIODS = [1, 5, 30, 90];
type InvestmentMarketScope = keyof typeof DEFAULT_SYMBOLS_BY_MARKET;

const parseSymbols = (value: string) =>
  Array.from(
    new Set(
      value
        .split(/[\s,;]+/)
        .map((symbol) => symbol.trim().toUpperCase())
        .filter(Boolean),
    ),
  );

const formatDecimal = (value: number, digits = 2) =>
  new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);

const formatPercent = (value: number) =>
  `${value >= 0 ? '+' : ''}${formatDecimal(value, 2)}%`;

const formatMoney = (value: number, currency = 'BRL') =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
  }).format(value);

const getAlternateCurrencyValue = (
  values: InvestmentDualCurrencyValue,
  primaryCurrency: string,
) => {
  if (primaryCurrency === 'USD') return values.brl;
  if (primaryCurrency === 'BRL') return values.usd;
  return null;
};

const getAlternateCurrencyCode = (primaryCurrency: string) =>
  primaryCurrency === 'USD' ? 'BRL' : primaryCurrency === 'BRL' ? 'USD' : null;

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

const formatShortDate = (value: string) =>
  new Date(value).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

const directionClasses: Record<string, string> = {
  UP: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/25 dark:text-emerald-300',
  DOWN: 'text-rose-600 bg-rose-50 dark:bg-rose-900/25 dark:text-rose-300',
  FLAT: 'text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-300',
};

const directionIcon: Record<string, ReactNode> = {
  UP: <ArrowUpRight className="h-3.5 w-3.5" />,
  DOWN: <ArrowDownRight className="h-3.5 w-3.5" />,
  FLAT: <CircleDollarSign className="h-3.5 w-3.5" />,
};

const resolveDirection = (value: number): 'UP' | 'DOWN' | 'FLAT' => {
  if (value > 0) return 'UP';
  if (value < 0) return 'DOWN';
  return 'FLAT';
};

function ChangePill({
  amount,
  percent,
  direction,
  currency = 'BRL',
}: {
  amount: number;
  percent: number;
  direction: 'UP' | 'DOWN' | 'FLAT';
  currency?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${directionClasses[direction]}`}>
      {directionIcon[direction]}
      {formatPercent(percent)} {formatMoney(Math.abs(amount), currency)}
    </span>
  );
}

function InvestmentRow({ item }: { item: InvestmentMarketItem }) {
  const marketTime = item.marketTime ? formatDateTime(item.marketTime) : '-';
  const alternatePrice = getAlternateCurrencyValue(
    item.currencyValues.price,
    item.currency,
  );
  const alternatePriceCurrency = getAlternateCurrencyCode(item.currency);
  const alternatePreviousClose = getAlternateCurrencyValue(
    item.currencyValues.previousClose,
    item.currency,
  );
  const alternateDividend = item.currencyValues.latestDividend
    ? getAlternateCurrencyValue(item.currencyValues.latestDividend, item.currency)
    : null;

  return (
    <TableRow className="border-b border-border/30 hover:bg-muted/30 transition-colors">
      <TableCell className="min-w-[180px]">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-foreground">{item.symbol}</p>
            <Badge variant="outline" className="text-[10px] uppercase tracking-[0.18em]">
              {item.marketSymbol}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2" title={item.longName || item.shortName || item.symbol}>
            {item.shortName || item.longName || '-'}
          </p>
          <p className="text-[11px] text-muted-foreground">{marketTime}</p>
        </div>
      </TableCell>
      <TableCell className="whitespace-nowrap font-semibold">
        {formatMoney(item.price, item.currency)}
        {alternatePrice !== null && alternatePriceCurrency && (
          <div className="text-[11px] text-muted-foreground font-normal">
            {formatMoney(alternatePrice, alternatePriceCurrency)}
          </div>
        )}
        <div className="text-[11px] text-muted-foreground font-normal">
          {item.currency}
        </div>
      </TableCell>
      <TableCell>
        <div className="space-y-2">
          <ChangePill {...item.dayChange} currency={item.currency} />
          <div className="text-[11px] text-muted-foreground">
            Fechamento anterior: {formatMoney(item.previousClose, item.currency)}
          </div>
          {alternatePreviousClose !== null && alternatePriceCurrency && (
            <div className="text-[11px] text-muted-foreground">
              Equivalente: {formatMoney(alternatePreviousClose, alternatePriceCurrency)}
            </div>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-2">
          {item.periodChanges.length > 0 ? (
            item.periodChanges.map((period) => (
              <div key={`${item.symbol}-${period.days}`} className="space-y-1">
                <div className="text-[11px] font-medium text-muted-foreground">
                  {period.days}d · {formatShortDate(period.referenceDate)}
                </div>
                <ChangePill amount={period.amount} percent={period.percent} direction={period.direction} currency={item.currency} />
              </div>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">Sem histórico.</span>
          )}
        </div>
      </TableCell>
      <TableCell>
        {item.latestDividend ? (
          <div className="space-y-1">
            <div className="font-semibold text-emerald-700 dark:text-emerald-300">
              {formatMoney(item.latestDividend.amount, item.currency)}
            </div>
            {alternateDividend !== null && alternatePriceCurrency && (
              <div className="text-[11px] text-muted-foreground">
                {formatMoney(alternateDividend, alternatePriceCurrency)}
              </div>
            )}
            <div className="text-[11px] text-muted-foreground">
              {formatShortDate(item.latestDividend.date)}
            </div>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Sem dividendo recente</span>
        )}
      </TableCell>
      <TableCell>
        <div className="space-y-1 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">52w alta</span>
            <span className="font-medium">{formatMoney(item.priceRange.high52w, item.currency)}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">52w baixa</span>
            <span className="font-medium">{formatMoney(item.priceRange.low52w, item.currency)}</span>
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
}

function PortfolioPositionRow({ position }: { position: InvestmentPortfolioPosition }) {
  const direction = resolveDirection(position.gainLossBrl);
  const isCdb = position.assetType === 'CDB';
  const quantityLabel = isCdb
    ? formatMoney(position.quantity, 'BRL')
    : formatDecimal(position.quantity, 6);
  const averageCostLabel = isCdb
    ? formatMoney(position.investedAmountBrl, 'BRL')
    : formatMoney(position.averageCost, position.currency);
  const averageCostSecondary = isCdb
    ? position.cdbCdiPercentage !== null && position.cdbCdiRate !== null
      ? `${formatDecimal(position.cdbCdiPercentage, 2)}% do CDI | CDI ${formatDecimal(position.cdbCdiRate, 2)}% a.a.`
      : 'Principal remanescente'
    : formatMoney(position.averageCostBrl, 'BRL');
  const currentPriceLabel = isCdb
    ? formatPercent((position.currentPrice - 1) * 100)
    : formatMoney(position.currentPrice, position.currency);
  const currentPriceSecondary = isCdb
    ? `Fator ${formatDecimal(position.currentPrice, 4)}x`
    : formatMoney(position.currentPriceBrl, 'BRL');

  return (
    <TableRow className="border-b border-border/30 hover:bg-muted/30 transition-colors">
      <TableCell className="min-w-[170px]">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-foreground">{position.symbol}</p>
            <Badge variant="outline" className="text-[10px] uppercase tracking-[0.18em]">
              {isCdb ? 'CDB' : position.market}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">{position.walletName}</p>
          <p className="text-[11px] text-muted-foreground">
            {position.shortName || position.longName || position.marketSymbol}
          </p>
        </div>
      </TableCell>
      <TableCell className="font-medium">
        {quantityLabel}
      </TableCell>
      <TableCell>
        <div className="space-y-1">
          <div className="font-medium">{averageCostLabel}</div>
          <div className="text-[11px] text-muted-foreground">
            {averageCostSecondary}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div className="space-y-1">
          <div className="font-medium">{currentPriceLabel}</div>
          <div className="text-[11px] text-muted-foreground">
            {currentPriceSecondary}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div className="space-y-1">
          <div className="font-medium">{formatMoney(position.currentValue, position.currency)}</div>
          <div className="text-[11px] text-muted-foreground">
            {formatMoney(position.currentValueBrl, 'BRL')}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div className="space-y-2">
          <ChangePill
            amount={position.gainLossBrl}
            percent={position.gainLossPercent}
            direction={direction}
            currency="BRL"
          />
          <div className="text-[11px] text-muted-foreground">
            {formatMoney(position.gainLoss, position.currency)}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div className="space-y-1">
          <div className="font-medium">{formatMoney(position.dividendsReceivedBrl + position.jcpReceivedBrl, 'BRL')}</div>
          <div className="text-[11px] text-muted-foreground">
            Dividendos: {formatMoney(position.dividendsReceived, position.currency)}
          </div>
          <div className="text-[11px] text-muted-foreground">
            JCP: {formatMoney(position.jcpReceived, position.currency)}
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
}

export const InvestmentsPage = () => {
  const [market, setMarket] = useState<InvestmentMarketScope>('BR');
  const [inputValue, setInputValue] = useState<string>(DEFAULT_SYMBOLS_BY_MARKET.BR);
  const [symbols, setSymbols] = useState(() => parseSymbols(DEFAULT_SYMBOLS_BY_MARKET.BR));
  const [submittedAt, setSubmittedAt] = useState<Date | null>(new Date());
  const [isCreateWalletOpen, setIsCreateWalletOpen] = useState(false);
  const [isOperationOpen, setIsOperationOpen] = useState(false);
  const periods = DEFAULT_PERIODS;

  const {
    data: wallets = [],
    refetch: refetchWallets,
  } = useWallets();
  const {
    data: portfolio,
    isLoading: isPortfolioLoading,
    error: portfolioError,
    refetch: refetchPortfolio,
  } = useInvestmentPortfolio();
  const {
    data: data = [],
    isLoading,
    isFetching,
    error,
  } = useInvestmentMarketData({
    symbols,
    periods,
    market,
  });

  useEffect(() => {
    if (error) {
      toast.error(getErrorMessage(error, 'Falha ao consultar mercado de investimentos'));
    }
  }, [error]);

  useEffect(() => {
    if (portfolioError) {
      toast.error(getErrorMessage(portfolioError, 'Falha ao carregar a carteira de investimentos'));
    }
  }, [portfolioError]);

  const investmentWallets = useMemo(
    () => wallets.filter((wallet) => wallet.type === 'INVESTMENT'),
    [wallets],
  );

  const marketSummary = useMemo(() => {
    const consulted = data.length;
    const avgDayChange = consulted
      ? data.reduce((sum, item) => sum + item.dayChange.percent, 0) / consulted
      : 0;
    const latestDividendItem = [...data]
      .filter((item) => item.latestDividend)
      .sort(
        (a, b) =>
          new Date(b.latestDividend!.date).getTime() - new Date(a.latestDividend!.date).getTime(),
      )[0] ?? null;

    const usdBrlRate =
      data.find((item) => item.currencyValues.usdBrlRate !== null)?.currencyValues
        .usdBrlRate ?? null;

    const latestDividendAlternateValue =
      latestDividendItem?.currencyValues.latestDividend
        ? getAlternateCurrencyValue(
            latestDividendItem.currencyValues.latestDividend,
            latestDividendItem.currency,
          )
        : null;
    const latestDividendAlternateCurrency = latestDividendItem
      ? getAlternateCurrencyCode(latestDividendItem.currency)
      : null;

    return {
      consulted,
      avgDayChange,
      latestDividendItem,
      latestDividendAlternateValue,
      latestDividendAlternateCurrency,
      usdBrlRate,
    };
  }, [data]);

  const handleMarketChange = (nextMarket: InvestmentMarketScope) => {
    setMarket(nextMarket);
    const nextSymbolsInput = DEFAULT_SYMBOLS_BY_MARKET[nextMarket];
    setInputValue(nextSymbolsInput);
    setSymbols(parseSymbols(nextSymbolsInput));
    setSubmittedAt(new Date());
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextSymbols = parseSymbols(inputValue);

    if (!nextSymbols.length) {
      toast.error('Digite ao menos um ticker válido.');
      return;
    }

    setSymbols(nextSymbols);
    setSubmittedAt(new Date());
  };

  return (
    <div className="min-h-screen space-y-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-emerald-950 to-teal-900 px-6 py-8 text-white shadow-2xl shadow-emerald-950/20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.18),_transparent_42%)]" />
        <div className="absolute -right-20 top-0 h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 h-56 w-56 rounded-full bg-teal-400/10 blur-3xl" />

        <div className="relative space-y-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-100">
                <TrendingUp className="h-3.5 w-3.5" />
                Market data + carteira
              </div>
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Investimentos</h1>
              <p className="max-w-2xl text-sm text-emerald-100/80 sm:text-base">
                Acompanhe seu portfólio, registre compras e vendas e consulte cotações e dividendos de ativos no Brasil e no exterior.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="outline"
                className="border-white/15 bg-white/10 text-white hover:bg-white/15"
                onClick={() => setIsCreateWalletOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Nova carteira de investimentos
              </Button>
              <Button
                type="button"
                className="bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
                onClick={() => setIsOperationOpen(true)}
              >
                <BriefcaseBusiness className="mr-2 h-4 w-4" />
                Registrar operação
              </Button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="grid gap-3 rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm lg:grid-cols-[1fr_auto]">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100/70">
                Mercado
              </label>
              <div className="flex flex-wrap gap-2">
                {([
                  ['BR', 'Brasil'],
                  ['GLOBAL', 'Internacional (EUA)'],
                ] as const).map(([option, label]) => (
                  <Button
                    key={option}
                    type="button"
                    variant="outline"
                    className={`h-10 border-white/15 text-white hover:bg-white/10 ${
                      market === option ? 'bg-white/15' : 'bg-transparent'
                    }`}
                    onClick={() => handleMarketChange(option)}
                  >
                    {option === 'GLOBAL' ? (
                      <Globe2 className="mr-2 h-4 w-4" />
                    ) : (
                      <TrendingUp className="mr-2 h-4 w-4" />
                    )}
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2 lg:col-span-1">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100/70">
                Tickers
              </label>
              <Input
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                placeholder={market === 'BR' ? 'MXRF11,HGLG11,PETR4' : 'AMZN,TSLA,AAPL'}
                className="h-12 border-white/15 bg-white/10 text-white placeholder:text-emerald-100/40 focus-visible:ring-emerald-400"
              />
            </div>

            <div className="flex items-end gap-3">
              <Button type="submit" className="h-12 bg-emerald-500 text-emerald-950 hover:bg-emerald-400">
                <Search className="mr-2 h-4 w-4" />
                Consultar
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-12 border-white/15 bg-transparent text-white hover:bg-white/10"
                onClick={() => {
                  const nextSymbolsInput = DEFAULT_SYMBOLS_BY_MARKET[market];
                  setInputValue(nextSymbolsInput);
                  setSymbols(parseSymbols(nextSymbolsInput));
                  setSubmittedAt(new Date());
                }}
              >
                <RefreshCcw className="mr-2 h-4 w-4" />
                Exemplo
              </Button>
            </div>
          </form>

          <div className="flex flex-wrap gap-2 text-xs text-emerald-100/80">
            <Badge variant="outline" className="border-white/15 bg-white/10 text-white">
              {market === 'BR' ? 'Mercado BR' : 'Mercado internacional (EUA)'}
            </Badge>
            {marketSummary.usdBrlRate !== null && (
              <Badge variant="outline" className="border-white/15 bg-white/10 text-white">
                USD/BRL {formatDecimal(marketSummary.usdBrlRate, 4)}
              </Badge>
            )}
            {periods.map((period) => (
              <Badge key={period} variant="outline" className="border-white/15 bg-white/10 text-white">
                {period}d
              </Badge>
            ))}
            {submittedAt && (
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1">
                <CalendarDays className="h-3.5 w-3.5" />
                Atualizado em {submittedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-border/50 bg-card/90 shadow-sm backdrop-blur">
          <CardHeader className="pb-3">
            <CardDescription>Patrimônio investido</CardDescription>
            <CardTitle className="text-3xl">
              {isPortfolioLoading
                ? '...'
                : formatMoney(portfolio?.summary.totalPortfolioValue || 0, 'BRL')}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-border/50 bg-card/90 shadow-sm backdrop-blur">
          <CardHeader className="pb-3">
            <CardDescription>Ganho / perda total</CardDescription>
            <CardTitle className={`text-3xl ${(portfolio?.summary.totalGainLoss || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {portfolio ? formatPercent(portfolio.summary.totalGainLossPercent) : '0,00%'}
            </CardTitle>
            <CardDescription>
              {formatMoney(portfolio?.summary.totalGainLoss || 0, 'BRL')}
            </CardDescription>
          </CardHeader>
        </Card>
        <Card className="border-border/50 bg-card/90 shadow-sm backdrop-blur">
          <CardHeader className="pb-3">
            <CardDescription>Proventos acumulados</CardDescription>
            <CardTitle className="text-3xl">
              {formatMoney(
                (portfolio?.summary.totalDividends || 0) + (portfolio?.summary.totalJcp || 0),
                'BRL',
              )}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-border/50 bg-card/90 shadow-sm backdrop-blur">
          <CardHeader className="pb-3">
            <CardDescription>Carteiras de investimento</CardDescription>
            <CardTitle className="text-3xl">{investmentWallets.length}</CardTitle>
            <CardDescription>
              {portfolio?.summary.totalPositions || 0} posiç{(portfolio?.summary.totalPositions || 0) === 1 ? 'ão' : 'ões'}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      <InvestmentChartsSection
        portfolio={portfolio}
        marketData={data}
        isMarketLoading={isLoading || isFetching}
      />

      <Card className="overflow-hidden border-border/50 bg-card/90 shadow-sm backdrop-blur">
        <CardHeader className="border-b border-border/50 bg-muted/30">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Landmark className="h-5 w-5 text-emerald-500" />
            Minha carteira
          </CardTitle>
          <CardDescription>
            Resumo das carteiras de investimento e das posições do seu usuário.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 p-6">
          {isPortfolioLoading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-36 rounded-2xl" />
              ))}
            </div>
          ) : portfolio && portfolio.wallets.length > 0 ? (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {portfolio.wallets.map((wallet) => (
                  <div
                    key={wallet.walletId}
                    className="rounded-2xl border border-border/50 bg-gradient-to-br from-card via-card to-muted/30 p-5 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{wallet.walletName}</p>
                        <p className="text-xs text-muted-foreground">
                          {wallet.positionsCount} posiç{wallet.positionsCount === 1 ? 'ão' : 'ões'}
                        </p>
                      </div>
                      <Badge variant="outline" className="uppercase tracking-[0.18em]">
                        INVEST
                      </Badge>
                    </div>

                    <div className="mt-5 space-y-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                          Valor investido
                        </p>
                        <p className="text-2xl font-black text-foreground">
                          {formatMoney(wallet.displayValue, 'BRL')}
                        </p>
                      </div>
                      <div className="grid gap-2 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Caixa disponível</span>
                          <span className="font-medium">{formatMoney(wallet.availableCash, 'BRL')}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Ganho / perda</span>
                          <span className={wallet.totalGainLoss >= 0 ? 'text-emerald-600 font-semibold' : 'text-rose-600 font-semibold'}>
                            {formatMoney(wallet.totalGainLoss, 'BRL')}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Rentabilidade</span>
                          <span className={wallet.totalGainLossPercent >= 0 ? 'text-emerald-600 font-semibold' : 'text-rose-600 font-semibold'}>
                            {formatPercent(wallet.totalGainLossPercent)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Proventos</span>
                          <span className="font-medium">{formatMoney(wallet.totalDividends, 'BRL')}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="overflow-x-auto rounded-2xl border border-border/50">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead>Ativo</TableHead>
                      <TableHead>Quantidade</TableHead>
                      <TableHead>Preço médio</TableHead>
                      <TableHead>Preço atual</TableHead>
                      <TableHead>Valor atual</TableHead>
                      <TableHead>P/L</TableHead>
                      <TableHead>Proventos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {portfolio.positions.length > 0 ? (
                      portfolio.positions.map((position) => (
                        <PortfolioPositionRow key={position.positionId} position={position} />
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="py-12 text-center">
                          <div className="mx-auto max-w-md space-y-2">
                            <p className="font-semibold text-foreground">
                              Você ainda não tem posições abertas
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Crie uma carteira de investimento, transfira saldo e registre sua primeira compra.
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-border/60 bg-muted/30 px-6 py-12 text-center">
              <div className="mx-auto flex max-w-lg flex-col items-center gap-4">
                <div className="rounded-2xl bg-emerald-500/10 p-4 text-emerald-600">
                  <BriefcaseBusiness className="h-8 w-8" />
                </div>
                <div className="space-y-2">
                  <p className="text-lg font-semibold text-foreground">
                    Nenhuma carteira de investimento criada ainda
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Crie uma carteira do tipo investimento para começar a montar seu portfólio e acompanhar posições, ganhos e proventos.
                  </p>
                </div>
                <Button onClick={() => setIsCreateWalletOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Criar carteira de investimentos
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/50 bg-card/90 shadow-sm backdrop-blur">
          <CardHeader className="pb-3">
            <CardDescription>Ativos consultados</CardDescription>
            <CardTitle className="text-3xl">{marketSummary.consulted}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-border/50 bg-card/90 shadow-sm backdrop-blur">
          <CardHeader className="pb-3">
            <CardDescription>Variação média do dia</CardDescription>
            <CardTitle className={`text-3xl ${marketSummary.avgDayChange >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {formatPercent(marketSummary.avgDayChange)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-border/50 bg-card/90 shadow-sm backdrop-blur">
          <CardHeader className="pb-3">
            <CardDescription>Último dividendo encontrado</CardDescription>
            <CardTitle className="text-2xl">
              {marketSummary.latestDividendItem?.latestDividend
                ? formatMoney(marketSummary.latestDividendItem.latestDividend.amount, marketSummary.latestDividendItem.currency)
                : '—'}
            </CardTitle>
            {marketSummary.latestDividendAlternateValue !== null &&
              marketSummary.latestDividendAlternateCurrency && (
              <CardDescription>
                {formatMoney(
                  marketSummary.latestDividendAlternateValue,
                  marketSummary.latestDividendAlternateCurrency,
                )}
              </CardDescription>
            )}
          </CardHeader>
        </Card>
      </div>

      <Card className="overflow-hidden border-border/50 bg-card/90 shadow-sm backdrop-blur">
        <CardHeader className="border-b border-border/50 bg-muted/30">
          <CardTitle className="flex items-center gap-2 text-xl">
            <CircleDollarSign className="h-5 w-5 text-emerald-500" />
            Cotações e dividendos do mercado
          </CardTitle>
          <CardDescription>
            Comparativo de preço, fechamento anterior, períodos e faixa de 52 semanas.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Ativo</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Dia</TableHead>
                  <TableHead>Períodos</TableHead>
                  <TableHead>Dividendo</TableHead>
                  <TableHead>Faixa 52w</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(isLoading || isFetching) ? (
                  Array.from({ length: 3 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell colSpan={6} className="py-5">
                        <Skeleton className="h-10 w-full rounded-xl" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : data.length > 0 ? (
                  data.map((item) => <InvestmentRow key={`${item.marketSymbol}-${item.symbol}`} item={item} />)
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="py-14 text-center">
                      <div className="mx-auto flex max-w-md flex-col items-center gap-3">
                        <div className="rounded-2xl bg-muted p-4">
                          <TrendingUp className="h-7 w-7 text-muted-foreground/50" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">Nenhum dado retornado</p>
                          <p className="text-sm text-muted-foreground">
                            Tente outra lista de tickers ou confirme se o backend já está entregando dados para o mercado selecionado.
                          </p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <CreateWalletModal
        isOpen={isCreateWalletOpen}
        onClose={() => setIsCreateWalletOpen(false)}
        onSuccess={() => {
          refetchWallets();
          refetchPortfolio();
        }}
        defaultType="INVESTMENT"
        lockType
        title="Nova carteira de investimentos"
        description="Crie uma carteira dedicada para registrar compras, vendas e acompanhar suas posições."
      />

      <InvestmentOperationModal
        isOpen={isOperationOpen}
        onClose={() => setIsOperationOpen(false)}
        wallets={wallets}
      />
    </div>
  );
};
