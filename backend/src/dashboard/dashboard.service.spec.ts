import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../prisma/prisma.service';
import { BudgetsService } from '../budgets/budgets.service';
import { InvestmentPortfolioService } from '../investments/investment-portfolio.service';

const mockPrismaService = {
  wallet: { findMany: jest.fn() },
  transaction: { aggregate: jest.fn(), findMany: jest.fn() },
  subscription: { aggregate: jest.fn() },
};

const mockBudgetsService = {
  findAllWithProgress: jest.fn(),
};

const mockInvestmentPortfolioService = {
  getPortfolioSummary: jest.fn(),
};

describe('DashboardService', () => {
  let service: DashboardService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: BudgetsService, useValue: mockBudgetsService },
        {
          provide: InvestmentPortfolioService,
          useValue: mockInvestmentPortfolioService,
        },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    mockInvestmentPortfolioService.getPortfolioSummary.mockResolvedValue({
      totalPortfolioValue: 0,
      totalAvailableCash: 0,
      totalGainLoss: 0,
      totalGainLossPercent: 0,
      totalDividends: 0,
      totalJcp: 0,
      totalPositions: 0,
      totalWallets: 0,
    });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
