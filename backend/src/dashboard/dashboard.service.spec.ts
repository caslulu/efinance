import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../prisma/prisma.service';
import { BudgetsService } from '../budgets/budgets.service';
import { InvestmentPortfolioService } from '../investments/investment-portfolio.service';

const mockPrismaService = {
  wallet: { aggregate: jest.fn(), findMany: jest.fn() },
  investment: { aggregate: jest.fn() },
  transaction: { aggregate: jest.fn(), findMany: jest.fn() },
  subscription: { aggregate: jest.fn() },
};

const mockBudgetsService = {
  getBudgetStatus: jest.fn(),
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
    jest.clearAllMocks();
    mockPrismaService.wallet.aggregate.mockResolvedValue({
      _sum: { actual_cash: 0 },
    });
    mockPrismaService.investment.aggregate.mockResolvedValue({
      _sum: { current_amount: 0 },
    });
    mockPrismaService.transaction.aggregate.mockResolvedValue({
      _sum: { value: 0 },
    });
    mockPrismaService.transaction.findMany.mockResolvedValue([]);
    mockPrismaService.subscription.aggregate.mockResolvedValue({
      _sum: { value: 0 },
      _count: { id: 0 },
    });
    mockBudgetsService.getBudgetStatus.mockResolvedValue([]);
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

  it('should include meal-voucher credit expenses in the 24-month cashflow filter', async () => {
    await service.getOverview(1);

    const monthlyFlowCall =
      mockPrismaService.transaction.findMany.mock.calls.find(
        ([args]) =>
          args?.where?.transaction_type === 'EXPENSE' &&
          Array.isArray(args?.where?.OR) &&
          args.where.OR.some(
            (condition) => condition.payment_method?.not === 'CREDIT',
          ),
      );

    expect(monthlyFlowCall?.[0].where).toMatchObject({
      wallet: { user_id: 1 },
      transaction_type: 'EXPENSE',
      OR: [
        { payment_method: { not: 'CREDIT' } },
        { wallet: { type: 'MEAL_VOUCHER' } },
      ],
    });
  });
});
