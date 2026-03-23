import { Test, TestingModule } from '@nestjs/testing';
import { InvestmentsService } from './investments.service';
import { InvestmentMarketDataService } from './investment-market-data.service';
import { InvestmentPortfolioService } from './investment-portfolio.service';

describe('InvestmentsService', () => {
  let service: InvestmentsService;
  const mockInvestmentMarketDataService = {
    getMany: jest.fn(),
  };
  const mockInvestmentPortfolioService = {
    getPortfolio: jest.fn(),
    createOperation: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvestmentsService,
        {
          provide: InvestmentMarketDataService,
          useValue: mockInvestmentMarketDataService,
        },
        {
          provide: InvestmentPortfolioService,
          useValue: mockInvestmentPortfolioService,
        },
      ],
    }).compile();

    service = module.get<InvestmentsService>(InvestmentsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should delegate market lookup to the provider', async () => {
    const expected = [
      {
        symbol: 'MXRF11',
        marketSymbol: 'MXRF11.SA',
        shortName: 'FII MAXI RENCI',
        longName: 'Maxi Renda',
        currency: 'BRL',
        price: 9.77,
        previousClose: 9.79,
        marketTime: '2026-03-21T12:00:00.000Z',
        dayChange: {
          amount: -0.02,
          percent: -0.2,
          direction: 'DOWN',
        },
        periodChanges: [],
        latestDividend: null,
        priceRange: {
          high52w: 9.99,
          low52w: 8.99,
        },
      },
    ];
    mockInvestmentMarketDataService.getMany.mockResolvedValue(expected);

    const query = {
      symbols: ['MXRF11'],
      periods: [1, 5, 30],
      market: 'BR' as const,
    };

    await expect(service.getMarketData(query)).resolves.toEqual(expected);
    expect(mockInvestmentMarketDataService.getMany).toHaveBeenCalledWith(query);
  });

  it('should delegate portfolio lookup to the portfolio service', async () => {
    const expected = {
      summary: {
        totalPortfolioValue: 1200,
        totalAvailableCash: 300,
        totalGainLoss: 120,
        totalGainLossPercent: 11.11,
        totalDividends: 14,
        totalJcp: 0,
        totalPositions: 2,
        totalWallets: 1,
      },
      wallets: [],
      positions: [],
    };
    mockInvestmentPortfolioService.getPortfolio.mockResolvedValue(expected);

    await expect(service.getPortfolio(42)).resolves.toEqual(expected);
    expect(mockInvestmentPortfolioService.getPortfolio).toHaveBeenCalledWith(42);
  });

  it('should delegate operation creation to the portfolio service', async () => {
    const payload = {
      wallet_id: 10,
      operation_type: 'BUY' as const,
      symbol: 'PETR4',
      market: 'BR' as const,
      transaction_date: '2026-03-21T12:00:00.000Z',
      quantity: 10,
    };
    const expected = {
      operationId: 1,
      walletId: 10,
      symbol: 'PETR4',
      market: 'BR',
    };
    mockInvestmentPortfolioService.createOperation.mockResolvedValue(expected);

    await expect(service.createOperation(7, payload)).resolves.toEqual(expected);
    expect(mockInvestmentPortfolioService.createOperation).toHaveBeenCalledWith(7, payload);
  });
});
