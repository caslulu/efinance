import {
  BadGatewayException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { execFile } from 'child_process';
import { promisify } from 'util';
import {
  InvestmentChangeDirection,
  InvestmentMarket,
  InvestmentMarketData,
  InvestmentPeriodChange,
  InvestmentPriceChange,
} from './investment-market-data.types';

type YahooChartResponse = {
  chart?: {
    result?: YahooChartResult[] | null;
    error?: { code?: string; description?: string } | null;
  };
};

type YahooChartResult = {
  meta?: {
    currency?: string;
    symbol?: string;
    shortName?: string;
    longName?: string;
    exchangeTimezoneName?: string;
    regularMarketPrice?: number;
    regularMarketTime?: number;
    chartPreviousClose?: number;
    fiftyTwoWeekHigh?: number;
    fiftyTwoWeekLow?: number;
  };
  timestamp?: number[];
  indicators?: {
    quote?: Array<{
      close?: Array<number | null>;
    }>;
  };
  events?: {
    dividends?: Record<
      string,
      {
        amount?: number;
        date?: number;
      }
    >;
  };
};

type PricePoint = {
  timestamp: number;
  close: number;
};

type CachedMarketDataEntry = {
  expiresAt: number;
  data: InvestmentMarketData;
};

type CachedFxRateEntry = {
  expiresAt: number;
  usdBrlRate: number | null;
};

const execFileAsync = promisify(execFile);

@Injectable()
export class InvestmentMarketDataService {
  private readonly yahooBaseUrl =
    'https://query1.finance.yahoo.com/v8/finance/chart';
  private readonly fundamentusBaseUrl = 'https://www.fundamentus.com.br';
  private readonly defaultTimeoutMs = 12000;
  private readonly cacheTtlMs = 60_000;
  private readonly cache = new Map<string, CachedMarketDataEntry>();
  private fxRateCache: CachedFxRateEntry | null = null;

  async getMany(params: {
    symbols: string[];
    periods: number[];
    market: InvestmentMarket;
  }): Promise<InvestmentMarketData[]> {
    const uniqueSymbols = Array.from(
      new Set(
        params.symbols
          .map((symbol) => symbol.trim().toUpperCase())
          .filter(Boolean),
      ),
    );
    const uniquePeriods = Array.from(
      new Set(
        params.periods.filter(
          (period) => Number.isInteger(period) && period > 0,
        ),
      ),
    ).sort((left, right) => left - right);
    const usdBrlRate = await this.getUsdBrlRate();

    const results: InvestmentMarketData[] = [];

    for (const symbol of uniqueSymbols) {
      results.push(
        await this.getSingle(symbol, uniquePeriods, params.market, usdBrlRate),
      );
    }

    return results;
  }

  private async getSingle(
    symbol: string,
    periods: number[],
    market: InvestmentMarket,
    usdBrlRate: number | null,
  ): Promise<InvestmentMarketData> {
    const cacheKey = `${market}:${symbol}:${periods.join(',')}`;
    const cached = this.cache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    const primaryResolver =
      market === 'BR'
        ? () => this.getBrazilianMarketData(symbol, periods, usdBrlRate)
        : () => this.getInternationalMarketData(symbol, periods, usdBrlRate);
    const fallbackResolver =
      market === 'BR'
        ? () => this.getInternationalMarketData(symbol, periods, usdBrlRate)
        : () => this.getBrazilianMarketData(symbol, periods, usdBrlRate);

    let data: InvestmentMarketData;

    try {
      data = await primaryResolver();
    } catch (error) {
      if (!this.isNotFoundError(error)) {
        throw error;
      }

      data = await fallbackResolver();
    }

    this.cache.set(cacheKey, {
      expiresAt: Date.now() + this.cacheTtlMs,
      data,
    });

    return data;
  }

  private async getBrazilianMarketData(
    symbol: string,
    periods: number[],
    usdBrlRate: number | null,
  ): Promise<InvestmentMarketData> {
    const normalizedSymbol = symbol.trim().toUpperCase();
    const detailsUrl =
      `${this.fundamentusBaseUrl}/detalhes.php?papel=` +
      encodeURIComponent(normalizedSymbol);
    const detailsHtml = await this.fetchText(detailsUrl, {
      referer: `${this.fundamentusBaseUrl}/`,
    });

    if (!detailsHtml) {
      throw new BadGatewayException(
        'Não foi possível consultar os dados do ativo agora',
      );
    }

    const isFund = detailsHtml.includes(`fii_proventos.php?papel=${normalizedSymbol}`);
    const assetName =
      this.extractValueByLabel(detailsHtml, isFund ? 'Nome' : 'Empresa') ??
      normalizedSymbol;
    const currentPrice = this.parseBrazilianNumber(
      this.extractValueByLabel(detailsHtml, 'Cotação'),
    );
    const lastQuoteDate = this.extractValueByLabel(detailsHtml, 'Data últ cot');
    const low52w = this.parseBrazilianNumber(
      this.extractValueByLabel(detailsHtml, 'Min 52 sem'),
    );
    const high52w = this.parseBrazilianNumber(
      this.extractValueByLabel(detailsHtml, 'Max 52 sem'),
    );
    const dayPercent = this.parseBrazilianPercent(
      this.extractValueByLabel(detailsHtml, 'Dia'),
    );

    if (currentPrice === null) {
      throw new NotFoundException(`Ticker ${symbol} não encontrado`);
    }

    const previousClose =
      dayPercent === null
        ? currentPrice
        : this.roundNumber(currentPrice / (1 + dayPercent / 100));
    const dayChange = this.buildChange(previousClose, currentPrice);
    const history = await this.fetchFundamentusHistory(normalizedSymbol, isFund);
    const latestDividend = await this.fetchFundamentusLatestDividend(
      normalizedSymbol,
      isFund,
    );
    const latestPoint = history[history.length - 1] ?? {
      timestamp:
        this.parseBrazilianDateToMarketTimestamp(lastQuoteDate) ??
        Date.now(),
      close: currentPrice,
    };
    const previousPoint = history[Math.max(history.length - 2, 0)] ?? null;

    return {
      symbol: normalizedSymbol,
      marketSymbol: normalizedSymbol,
      shortName: assetName,
      longName: assetName,
      currency: 'BRL',
      price: currentPrice,
      previousClose,
      marketTime: new Date(
        this.parseBrazilianDateToMarketTimestamp(lastQuoteDate) ??
          latestPoint.timestamp,
      ).toISOString(),
      dayChange,
      periodChanges: this.buildBrazilianPeriodChanges({
        periods,
        currentPrice,
        dayChange,
        history,
        latestPoint,
        previousPoint,
      }),
      latestDividend,
      currencyValues: {
        usdBrlRate,
        price: this.buildCurrencyValues(currentPrice, 'BRL', usdBrlRate),
        previousClose: this.buildCurrencyValues(
          previousClose,
          'BRL',
          usdBrlRate,
        ),
        latestDividend: this.buildNullableCurrencyValues(
          latestDividend,
          'BRL',
          usdBrlRate,
        ),
      },
      priceRange: {
        high52w: high52w ?? currentPrice,
        low52w: low52w ?? currentPrice,
      },
    };
  }

  private async getYahooMarketData(
    symbol: string,
    periods: number[],
    market: InvestmentMarket,
    usdBrlRate: number | null = null,
  ): Promise<InvestmentMarketData> {
    const marketSymbol = this.normalizeSymbol(symbol, market);
    const url =
      `${this.yahooBaseUrl}/${encodeURIComponent(marketSymbol)}` +
      '?interval=1d&range=1y&includePrePost=false&events=div%2Csplits';
    const payload = await this.fetchJson(url);
    const chart = payload.chart?.result?.[0];
    const chartError = payload.chart?.error;

    if (!chart || chartError) {
      const message =
        chartError?.description || `Ticker ${symbol} não encontrado`;
      throw new NotFoundException(message);
    }

    const meta = chart.meta ?? {};
    const closes = chart.indicators?.quote?.[0]?.close ?? [];
    const timestamps = chart.timestamp ?? [];
    const pricePoints = this.extractPricePoints(timestamps, closes);

    if (pricePoints.length === 0) {
      throw new NotFoundException(
        `Sem histórico suficiente para o ticker ${symbol}`,
      );
    }

    const latestPoint = pricePoints[pricePoints.length - 1];
    const currentPrice = this.roundNumber(
      this.coerceNumber(meta.regularMarketPrice) ?? latestPoint.close,
    );
    const previousClose = this.roundNumber(
      this.coerceNumber(meta.chartPreviousClose) ??
        pricePoints[Math.max(pricePoints.length - 2, 0)].close,
    );
    const marketTime = new Date(
      (this.coerceNumber(meta.regularMarketTime) ?? latestPoint.timestamp) *
        1000,
    ).toISOString();
    const currency = meta.currency ?? 'BRL';
    const latestDividend = this.extractLatestDividend(chart.events?.dividends);

    return {
      symbol,
      marketSymbol,
      shortName: meta.shortName ?? null,
      longName: meta.longName ?? null,
      currency,
      price: currentPrice,
      previousClose,
      marketTime,
      dayChange: this.buildChange(previousClose, currentPrice),
      periodChanges: periods
        .map((days) =>
          this.buildPeriodChange(pricePoints, currentPrice, latestPoint, days),
        )
        .filter(
          (change): change is InvestmentPeriodChange => change !== null,
        ),
      latestDividend,
      currencyValues: {
        usdBrlRate,
        price: this.buildCurrencyValues(currentPrice, currency, usdBrlRate),
        previousClose: this.buildCurrencyValues(
          previousClose,
          currency,
          usdBrlRate,
        ),
        latestDividend: this.buildNullableCurrencyValues(
          latestDividend,
          currency,
          usdBrlRate,
        ),
      },
      priceRange: {
        high52w:
          this.roundNullable(meta.fiftyTwoWeekHigh) ?? currentPrice,
        low52w:
          this.roundNullable(meta.fiftyTwoWeekLow) ?? currentPrice,
      },
    };
  }

  private async getInternationalMarketData(
    symbol: string,
    periods: number[],
    usdBrlRate: number | null,
  ): Promise<InvestmentMarketData> {
    const normalizedSymbol = symbol.trim().toUpperCase();
    const marketSymbol = normalizedSymbol.includes('.')
      ? normalizedSymbol.toUpperCase()
      : `${normalizedSymbol}.US`;
    const stooqSymbol = marketSymbol.toLowerCase();
    const historyUrl = `https://stooq.com/q/d/l/?s=${encodeURIComponent(stooqSymbol)}&i=d`;
    const historyCsv = await this.fetchText(historyUrl, {
      referer: `https://stooq.com/q/?s=${encodeURIComponent(stooqSymbol)}`,
    });

    if (!historyCsv) {
      throw new BadGatewayException(
        'Não foi possível consultar os dados internacionais no momento',
      );
    }

    const history = this.parseStooqHistory(historyCsv);
    if (history.length < 2) {
      throw new NotFoundException(`Ticker ${symbol} não encontrado`);
    }

    const latestPoint = history[history.length - 1];
    const previousPoint = history[history.length - 2];
    const currentPrice = latestPoint.close;
    const previousClose = previousPoint.close;
    const recent52w = history.slice(-252);
    const pageHtml = await this.fetchText(`https://stooq.com/q/?s=${encodeURIComponent(stooqSymbol)}`, {
      referer: 'https://stooq.com/',
    }).catch(() => null);
    const assetName =
      this.extractStooqName(pageHtml) ??
      normalizedSymbol;

    return {
      symbol: normalizedSymbol,
      marketSymbol: marketSymbol.toUpperCase(),
      shortName: assetName,
      longName: assetName,
      currency: 'USD',
      price: currentPrice,
      previousClose,
      marketTime: new Date(latestPoint.timestamp).toISOString(),
      dayChange: this.buildChange(previousClose, currentPrice),
      periodChanges: periods
        .map((days) =>
          this.buildPeriodChangeFromHistory(history, currentPrice, latestPoint, days),
        )
        .filter((change): change is InvestmentPeriodChange => change !== null),
      latestDividend: null,
      currencyValues: {
        usdBrlRate,
        price: this.buildCurrencyValues(currentPrice, 'USD', usdBrlRate),
        previousClose: this.buildCurrencyValues(
          previousClose,
          'USD',
          usdBrlRate,
        ),
        latestDividend: null,
      },
      priceRange: {
        high52w: this.roundNumber(
          Math.max(...recent52w.map((point) => point.close)),
        ),
        low52w: this.roundNumber(
          Math.min(...recent52w.map((point) => point.close)),
        ),
      },
    };
  }

  private normalizeSymbol(symbol: string, market: InvestmentMarket): string {
    if (market === 'BR' && !symbol.includes('.')) {
      return `${symbol}.SA`;
    }

    return symbol;
  }

  private buildBrazilianPeriodChanges(params: {
    periods: number[];
    currentPrice: number;
    dayChange: InvestmentPriceChange;
    history: PricePoint[];
    latestPoint: PricePoint;
    previousPoint: PricePoint | null;
  }): InvestmentPeriodChange[] {
    const { periods, currentPrice, dayChange, history, latestPoint, previousPoint } =
      params;

    return periods
      .map((days) => {
        if (days === 1) {
          return {
            days,
            referenceDate: new Date(
              previousPoint?.timestamp ??
                latestPoint.timestamp - 24 * 60 * 60 * 1000,
            ).toISOString(),
            ...dayChange,
          };
        }

        return this.buildPeriodChangeFromHistory(
          history,
          currentPrice,
          latestPoint,
          days,
        );
      })
      .filter((change): change is InvestmentPeriodChange => change !== null);
  }

  private buildPeriodChangeFromHistory(
    points: PricePoint[],
    currentPrice: number,
    latestPoint: PricePoint,
    days: number,
  ): InvestmentPeriodChange | null {
    const referencePoint = this.findReferencePoint(
      points,
      latestPoint.timestamp - days * 24 * 60 * 60 * 1000,
      latestPoint.timestamp,
    );

    if (!referencePoint) {
      return null;
    }

    return {
      days,
      referenceDate: new Date(referencePoint.timestamp).toISOString(),
      ...this.buildChange(referencePoint.close, currentPrice),
    };
  }

  private async fetchFundamentusHistory(
    symbol: string,
    isFund: boolean,
  ): Promise<PricePoint[]> {
    const referer =
      `${this.fundamentusBaseUrl}/cotacoes.php?papel=${encodeURIComponent(symbol)}` +
      (isFund ? '&tela=3' : '');
    const historyUrl =
      `${this.fundamentusBaseUrl}/amline/cot_hist.php?papel=` +
      encodeURIComponent(symbol);

    try {
      const historyText = await this.fetchText(historyUrl, { referer });
      if (!historyText) {
        return [];
      }

      const parsed = JSON.parse(historyText) as Array<[number, number]>;
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .filter(
          (entry): entry is [number, number] =>
            Array.isArray(entry) &&
            entry.length >= 2 &&
            Number.isFinite(entry[0]) &&
            Number.isFinite(entry[1]),
        )
        .map(([timestamp, close]) => ({
          timestamp,
          close: this.roundNumber(close),
        }))
        .sort((left, right) => left.timestamp - right.timestamp);
    } catch {
      return [];
    }
  }

  private async fetchFundamentusLatestDividend(
    symbol: string,
    isFund: boolean,
  ): Promise<{ amount: number; date: string } | null> {
    const path = isFund ? 'fii_proventos.php' : 'proventos.php';
    const referer =
      `${this.fundamentusBaseUrl}/detalhes.php?papel=` +
      encodeURIComponent(symbol);
    const url =
      `${this.fundamentusBaseUrl}/${path}?papel=${encodeURIComponent(symbol)}&tipo=2`;

    try {
      const html = await this.fetchText(url, { referer });
      if (!html) {
        return null;
      }

      const rows = this.extractTableRows(html);
      if (rows.length === 0) {
        return null;
      }

      const typeIndex = isFund ? 1 : 2;
      const selectedRow =
        rows.find((row) =>
          /dividendo|rendimento/i.test(row[typeIndex] || ''),
        ) ?? rows[0];

      const amount = this.parseBrazilianNumber(
        isFund ? selectedRow[3] : selectedRow[1],
      );
      const rawDate = isFund
        ? selectedRow[2] || selectedRow[0]
        : selectedRow[3] || selectedRow[0];
      const paymentTimestamp = this.parseBrazilianDateToMarketTimestamp(rawDate);

      if (amount === null || paymentTimestamp === null) {
        return null;
      }

      return {
        amount,
        date: new Date(paymentTimestamp).toISOString(),
      };
    } catch {
      return null;
    }
  }

  private async fetchJson(
    url: string,
    attempt = 0,
  ): Promise<YahooChartResponse> {
    const curlPayload = await this.fetchJsonWithCurl(url);
    if (curlPayload) {
      return curlPayload;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.defaultTimeoutMs);

    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        if ((response.status === 429 || response.status >= 500) && attempt < 2) {
          await this.delay(350 * (attempt + 1));
          return this.fetchJson(url, attempt + 1);
        }

        throw new BadGatewayException(
          `Falha ao consultar a fonte externa (${response.status})`,
        );
      }

      return (await response.json()) as YahooChartResponse;
    } catch (error) {
      if (error instanceof BadGatewayException) {
        throw error;
      }

      throw new BadGatewayException(
        'Não foi possível consultar os dados do mercado no momento',
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private async getUsdBrlRate(): Promise<number | null> {
    if (this.fxRateCache && this.fxRateCache.expiresAt > Date.now()) {
      return this.fxRateCache.usdBrlRate;
    }

    try {
      const csv = await this.fetchText(
        'https://stooq.com/q/d/l/?s=usdbrl&i=d',
        {
          referer: 'https://stooq.com/q/?s=usdbrl',
        },
      );
      const history = this.parseStooqHistory(csv ?? '');
      const latest = history[history.length - 1] ?? null;
      const usdBrlRate = latest?.close ?? null;

      this.fxRateCache = {
        expiresAt: Date.now() + this.cacheTtlMs,
        usdBrlRate,
      };

      return usdBrlRate;
    } catch {
      this.fxRateCache = {
        expiresAt: Date.now() + this.cacheTtlMs,
        usdBrlRate: null,
      };
      return null;
    }
  }

  private async fetchJsonWithCurl(
    url: string,
  ): Promise<YahooChartResponse | null> {
    try {
      const { stdout } = await execFileAsync(
        'curl',
        [
          '-s',
          '-H',
          'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          '-H',
          'Accept: application/json',
          '-H',
          'Accept-Language: pt-BR,pt;q=0.9,en;q=0.8',
          url,
        ],
        {
          maxBuffer: 10 * 1024 * 1024,
        },
      );

      if (!stdout.trim()) {
        return null;
      }

      return JSON.parse(stdout) as YahooChartResponse;
    } catch {
      return null;
    }
  }

  private async fetchText(
    url: string,
    options?: { referer?: string },
    attempt = 0,
  ): Promise<string | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.defaultTimeoutMs);

    try {
      const response = await fetch(url, {
        headers: {
          Accept:
            'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
          ...(options?.referer ? { Referer: options.referer } : {}),
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        if ((response.status === 429 || response.status >= 500) && attempt < 2) {
          await this.delay(500 * (attempt + 1));
          return this.fetchText(url, options, attempt + 1);
        }

        throw new BadGatewayException(
          `Falha ao consultar a fonte externa (${response.status})`,
        );
      }

      const contentType = response.headers.get('content-type') || '';
      const encoding = /iso-8859-1/i.test(contentType) ? 'latin1' : 'utf-8';
      const buffer = await response.arrayBuffer();
      return new TextDecoder(encoding).decode(buffer);
    } catch (error) {
      if (error instanceof BadGatewayException) {
        throw error;
      }

      throw new BadGatewayException(
        'Não foi possível consultar os dados do mercado no momento',
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private extractPricePoints(
    timestamps: number[],
    closes: Array<number | null>,
  ): PricePoint[] {
    const pointsByDay = new Map<string, PricePoint>();

    timestamps.forEach((timestamp, index) => {
      const close = closes[index];
      if (!Number.isFinite(close)) {
        return;
      }

      const dayKey = this.buildDayKey(timestamp);
      pointsByDay.set(dayKey, {
        timestamp,
        close: this.roundNumber(close as number),
      });
    });

    return Array.from(pointsByDay.values()).sort(
      (left, right) => left.timestamp - right.timestamp,
    );
  }

  private buildDayKey(timestamp: number): string {
    const date = new Date(timestamp * 1000);
    const year = date.getUTCFullYear();
    const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
    const day = `${date.getUTCDate()}`.padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  private buildPeriodChange(
    points: PricePoint[],
    currentPrice: number,
    latestPoint: PricePoint,
    days: number,
  ): InvestmentPeriodChange | null {
    const referencePoint = this.findReferencePoint(
      points,
      latestPoint.timestamp - days * 24 * 60 * 60,
      latestPoint.timestamp,
    );

    if (!referencePoint) {
      return null;
    }

    return {
      days,
      referenceDate: new Date(referencePoint.timestamp * 1000).toISOString(),
      ...this.buildChange(referencePoint.close, currentPrice),
    };
  }

  private findReferencePoint(
    points: PricePoint[],
    targetTimestamp: number,
    latestTimestamp: number,
  ): PricePoint | null {
    let referencePoint: PricePoint | null = null;

    for (const point of points) {
      if (point.timestamp >= latestTimestamp) {
        break;
      }

      if (point.timestamp <= targetTimestamp) {
        referencePoint = point;
        continue;
      }

      if (referencePoint) {
        return referencePoint;
      }

      return point;
    }

    return referencePoint;
  }

  private extractLatestDividend(
    dividends?: Record<string, { amount?: number; date?: number }>,
  ): { amount: number; date: string } | null {
    if (!dividends) {
      return null;
    }

    const latest = Object.values(dividends)
      .map((entry) => ({
        amount: this.coerceNumber(entry.amount),
        date: this.coerceNumber(entry.date),
      }))
      .filter(
        (entry): entry is { amount: number; date: number } =>
          entry.amount !== null && entry.date !== null,
      )
      .sort((left, right) => right.date - left.date)[0];

    if (!latest) {
      return null;
    }

    return {
      amount: this.roundNumber(latest.amount),
      date: new Date(latest.date * 1000).toISOString(),
    };
  }

  private buildChange(from: number, to: number): InvestmentPriceChange {
    const amount = this.roundNumber(to - from);
    const percent = from === 0 ? 0 : this.roundNumber((amount / from) * 100);

    return {
      amount,
      percent,
      direction: this.resolveDirection(amount),
    };
  }

  private resolveDirection(value: number): InvestmentChangeDirection {
    if (value > 0) {
      return 'UP';
    }

    if (value < 0) {
      return 'DOWN';
    }

    return 'FLAT';
  }

  private coerceNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  private parseBrazilianNumber(value: string | null): number | null {
    if (!value) {
      return null;
    }

    const normalized = value
      .replace(/\s+/g, '')
      .replace(/\./g, '')
      .replace(',', '.')
      .replace('%', '')
      .trim();
    const parsed = Number(normalized);

    return Number.isFinite(parsed) ? this.roundNumber(parsed) : null;
  }

  private parseBrazilianPercent(value: string | null): number | null {
    return this.parseBrazilianNumber(value);
  }

  private parseBrazilianDateToMarketTimestamp(value: string | null): number | null {
    if (!value) {
      return null;
    }

    const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) {
      return null;
    }

    const [, day, month, year] = match;
    return Date.UTC(Number(year), Number(month) - 1, Number(day), 20, 0, 0);
  }

  private parseStooqHistory(csv: string): PricePoint[] {
    return csv
      .trim()
      .split('\n')
      .slice(1)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.split(','))
      .filter((columns) => columns.length >= 5 && columns[0] !== 'Date')
      .map((columns) => {
        const timestamp = this.parseIsoDateToMarketTimestamp(columns[0]);
        const close = Number(columns[4]);

        return timestamp && Number.isFinite(close)
          ? {
              timestamp,
              close: this.roundNumber(close),
            }
          : null;
      })
      .filter((point): point is PricePoint => point !== null);
  }

  private parseIsoDateToMarketTimestamp(value: string | null): number | null {
    if (!value) {
      return null;
    }

    const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      return null;
    }

    const [, year, month, day] = match;
    return Date.UTC(Number(year), Number(month) - 1, Number(day), 20, 0, 0);
  }

  private extractStooqName(html: string | null): string | null {
    if (!html) {
      return null;
    }

    const match = html.match(/<title>[^<]+ - ([^-<]+?) - Stooq<\/title>/i);
    return match?.[1]?.trim() || null;
  }

  private buildCurrencyValues(
    amount: number,
    originalCurrency: string,
    usdBrlRate: number | null,
  ): { brl: number | null; usd: number | null } {
    if (originalCurrency === 'BRL') {
      return {
        brl: amount,
        usd:
          usdBrlRate && usdBrlRate > 0
            ? this.roundNumber(amount / usdBrlRate)
            : null,
      };
    }

    if (originalCurrency === 'USD') {
      return {
        brl:
          usdBrlRate && usdBrlRate > 0
            ? this.roundNumber(amount * usdBrlRate)
            : null,
        usd: amount,
      };
    }

    return {
      brl: null,
      usd: null,
    };
  }

  private buildNullableCurrencyValues(
    snapshot: { amount: number; date: string } | null,
    originalCurrency: string,
    usdBrlRate: number | null,
  ): { brl: number | null; usd: number | null } | null {
    if (!snapshot) {
      return null;
    }

    return this.buildCurrencyValues(snapshot.amount, originalCurrency, usdBrlRate);
  }

  private extractValueByLabel(html: string, label: string): string | null {
    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(
      `<span class="txt">${escapedLabel}<\\/span><\\/td>\\s*<td class="data[^"]*">([\\s\\S]*?)<\\/td>`,
      'i',
    );
    const match = html.match(regex);

    if (!match) {
      return null;
    }

    return this.stripHtml(match[1]);
  }

  private extractTableRows(html: string): string[][] {
    const tbodyMatch = html.match(/<tbody>([\s\S]*?)<\/tbody>/i);
    if (!tbodyMatch) {
      return [];
    }

    return Array.from(
      tbodyMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi),
      (rowMatch) =>
        Array.from(
          rowMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi),
          (cellMatch) => this.stripHtml(cellMatch[1]),
        ).filter(Boolean),
    ).filter((row) => row.length > 0);
  }

  private stripHtml(value: string): string {
    return value
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private roundNullable(value: unknown): number | null {
    const numberValue = this.coerceNumber(value);
    return numberValue === null ? null : this.roundNumber(numberValue);
  }

  private isNotFoundError(error: unknown): error is NotFoundException {
    return error instanceof NotFoundException;
  }

  private roundNumber(value: number): number {
    return Number(value.toFixed(4));
  }

  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
