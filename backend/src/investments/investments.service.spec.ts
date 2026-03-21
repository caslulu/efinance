import { Test, TestingModule } from '@nestjs/testing';
import { InvestmentsService } from './investments.service';
import { InvestmentMarketDataService } from './investment-market-data.service';

describe('InvestmentsService', () => {
  let service: InvestmentsService;
  const mockInvestmentMarketDataService = {
    getMany: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvestmentsService,
        {
          provide: InvestmentMarketDataService,
          useValue: mockInvestmentMarketDataService,
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
});
