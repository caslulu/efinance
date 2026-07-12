import { Test, TestingModule } from '@nestjs/testing';
import { BudgetsService } from './budgets.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrismaService = {
  budget: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  transaction: {
    aggregate: jest.fn(),
    groupBy: jest.fn(),
  },
};

describe('BudgetsService', () => {
  let service: BudgetsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BudgetsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<BudgetsService>(BudgetsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('aggregates all budget categories in a single grouped query', async () => {
    mockPrismaService.budget.findMany.mockResolvedValue([
      {
        id: 1,
        category_id: 10,
        limit: 500,
        category: { name: 'Casa', icon: null },
      },
      {
        id: 2,
        category_id: 20,
        limit: 200,
        category: { name: 'Lazer', icon: null },
      },
    ]);
    mockPrismaService.transaction.groupBy.mockResolvedValue([
      { category_id: 10, _sum: { value: 125 } },
      { category_id: 20, _sum: { value: 50 } },
    ]);

    const result = await service.getBudgetStatus(1);

    expect(mockPrismaService.transaction.groupBy).toHaveBeenCalledTimes(1);
    expect(mockPrismaService.transaction.aggregate).not.toHaveBeenCalled();
    expect(result).toMatchObject([
      { category_id: 10, spent: 125, remaining: 375, percentage: 25 },
      { category_id: 20, spent: 50, remaining: 150, percentage: 25 },
    ]);
  });
});
