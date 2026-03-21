export type InvestmentMarket = 'BR' | 'GLOBAL';

export type InvestmentChangeDirection = 'UP' | 'DOWN' | 'FLAT';

export type InvestmentPriceChange = {
  amount: number;
  percent: number;
  direction: InvestmentChangeDirection;
};

export type InvestmentPeriodChange = InvestmentPriceChange & {
  days: number;
  referenceDate: string;
};

export type InvestmentDividendSnapshot = {
  amount: number;
  date: string;
};

export type InvestmentDualCurrencyValue = {
  brl: number | null;
  usd: number | null;
};

export type InvestmentMarketData = {
  symbol: string;
  marketSymbol: string;
  shortName: string | null;
  longName: string | null;
  currency: string;
  price: number;
  previousClose: number;
  marketTime: string;
  dayChange: InvestmentPriceChange;
  periodChanges: InvestmentPeriodChange[];
  latestDividend: InvestmentDividendSnapshot | null;
  currencyValues: {
    usdBrlRate: number | null;
    price: InvestmentDualCurrencyValue;
    previousClose: InvestmentDualCurrencyValue;
    latestDividend: InvestmentDualCurrencyValue | null;
  };
  priceRange: {
    high52w: number;
    low52w: number;
  };
};
