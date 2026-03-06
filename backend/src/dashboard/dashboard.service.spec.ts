import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../prisma/prisma.service';
import { BudgetsService } from '../budgets/budgets.service';

const mockPrismaService = {
  wallet: { findMany: jest.fn() },
  transaction: { aggregate: jest.fn(), findMany: jest.fn() },
  subscription: { aggregate: jest.fn() },
};

const mockBudgetsService = {
  findAllWithProgress: jest.fn(),
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
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
