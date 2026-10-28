import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../prisma/prisma.service';
import { BudgetsService } from '../budgets/budgets.service';

const mockPrismaService = {
  wallet: { aggregate: jest.fn(), findMany: jest.fn() },
  transaction: { aggregate: jest.fn(), findMany: jest.fn() },
  subscription: { aggregate: jest.fn() },
};

const mockBudgetsService = {
  getBudgetStatus: jest.fn(),
};

describe('DashboardService', () => {
  let service: DashboardService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: BudgetsService, useValue: mockBudgetsService },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    jest.clearAllMocks();
    mockPrismaService.wallet.aggregate.mockResolvedValue({
      _sum: { actual_cash: 0 },
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
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('reports wallet cash without querying removed asset services', async () => {
    mockPrismaService.wallet.aggregate.mockResolvedValue({
      _sum: { actual_cash: 1250 },
    });

    const overview = await service.getOverview(1);

    expect(overview.totalBalance).toBe(1250);
    expect(overview.netWorth).toBe(1250);
    expect(overview).not.toHaveProperty('totalInvested');
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
