export type InvestmentMarketDirection = 'UP' | 'DOWN' | 'FLAT';

export interface InvestmentMarketDayChange {
  amount: number;
  percent: number;
  direction: InvestmentMarketDirection;
}

export interface InvestmentMarketPeriodChange {
  days: number;
  amount: number;
  percent: number;
  direction: InvestmentMarketDirection;
  referenceDate: string;
}

export interface InvestmentLatestDividend {
  amount: number;
  date: string;
}

export interface InvestmentMarketPriceRange {
  high52w: number;
  low52w: number;
}

export interface InvestmentDualCurrencyValue {
  brl: number | null;
  usd: number | null;
}

export interface InvestmentMarketItem {
  symbol: string;
  marketSymbol: string;
  shortName: string | null;
  longName: string | null;
  currency: string;
  price: number;
  previousClose: number;
  marketTime: string;
  dayChange: InvestmentMarketDayChange;
  periodChanges: InvestmentMarketPeriodChange[];
  latestDividend: InvestmentLatestDividend | null;
  currencyValues: {
    usdBrlRate: number | null;
    price: InvestmentDualCurrencyValue;
    previousClose: InvestmentDualCurrencyValue;
    latestDividend: InvestmentDualCurrencyValue | null;
  };
  priceRange: InvestmentMarketPriceRange;
}

export interface InvestmentMarketQueryParams {
  symbols: string[];
  periods: number[];
  market?: string;
}
