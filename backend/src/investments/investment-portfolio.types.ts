export type PortfolioWalletSummary = {
  walletId: number;
  walletName: string;
  portfolioValue: number;
  availableCash: number;
  positionsCount: number;
  displayValue: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  totalDividends: number;
};

export type PortfolioPositionSummary = {
  positionId: number;
  walletId: number;
  walletName: string;
  symbol: string;
  market: 'BR' | 'GLOBAL';
  marketSymbol: string;
  quantity: number;
  currency: string;
  shortName: string | null;
  longName: string | null;
  averageCost: number;
  averageCostBrl: number;
  currentPrice: number;
  currentPriceBrl: number;
  investedAmount: number;
  investedAmountBrl: number;
  currentValue: number;
  currentValueBrl: number;
  gainLoss: number;
  gainLossBrl: number;
  gainLossPercent: number;
  dividendsReceived: number;
  dividendsReceivedBrl: number;
  jcpReceived: number;
  jcpReceivedBrl: number;
  marketTime: string | null;
};

export type InvestmentPortfolioResponse = {
  summary: {
    totalPortfolioValue: number;
    totalAvailableCash: number;
    totalGainLoss: number;
    totalGainLossPercent: number;
    totalDividends: number;
    totalJcp: number;
    totalPositions: number;
    totalWallets: number;
  };
  wallets: PortfolioWalletSummary[];
  positions: PortfolioPositionSummary[];
};
