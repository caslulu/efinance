export interface InvestmentPortfolioSummary {
  totalPortfolioValue: number;
  totalAvailableCash: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  totalDividends: number;
  totalJcp: number;
  totalPositions: number;
  totalWallets: number;
}

export interface InvestmentPortfolioWalletSummary {
  walletId: number;
  walletName: string;
  portfolioValue: number;
  availableCash: number;
  positionsCount: number;
  displayValue: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  totalDividends: number;
}

export interface InvestmentPortfolioPosition {
  positionId: number;
  walletId: number;
  walletName: string;
  symbol: string;
  market: 'BR' | 'GLOBAL';
  assetType: 'LISTED' | 'CDB';
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
  cdbCdiPercentage: number | null;
  cdbCdiRate: number | null;
}

export interface InvestmentPortfolio {
  summary: InvestmentPortfolioSummary;
  wallets: InvestmentPortfolioWalletSummary[];
  positions: InvestmentPortfolioPosition[];
}

export interface CreateInvestmentOperationPayload {
  wallet_id: number;
  operation_type: 'BUY' | 'SELL' | 'DIVIDEND' | 'JCP';
  asset_type?: 'LISTED' | 'CDB';
  symbol: string;
  market: 'BR' | 'GLOBAL';
  transaction_date: string;
  quantity?: number;
  gross_amount?: number;
  notes?: string;
  cdb_cdi_percentage?: number;
  cdb_cdi_rate?: number;
}
