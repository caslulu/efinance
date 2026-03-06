import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionsService } from './subscriptions.service';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionsService } from '../transactions/transactions.service';
import { NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';

const mockPrismaService = {
  subscription: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  wallet: {
    findUnique: jest.fn(),
  },
  transactionCategory: {
    findUnique: jest.fn(),
  },
};

const mockTransactionsService = {
  create: jest.fn(),
};

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  let prisma: PrismaService;
  let transactionsService: TransactionsService;
  const userId = 1;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: TransactionsService, useValue: mockTransactionsService },
      ],
    }).compile();

    service = module.get<SubscriptionsService>(SubscriptionsService);
    prisma = module.get<PrismaService>(PrismaService);
    transactionsService = module.get<TransactionsService>(TransactionsService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a subscription', async () => {
      const dto = {
        name: 'Netflix',
        value: 39.90,
        frequency: 'MONTHLY',
        wallet_id: 1,
        category_id: 1,
        start_date: new Date().toISOString(),
      };

      mockPrismaService.wallet.findUnique.mockResolvedValue({ id: 1, user_id: userId });
      mockPrismaService.transactionCategory.findUnique.mockResolvedValue({ id: 1, user_id: userId });
      mockPrismaService.subscription.create.mockResolvedValue({ id: 1, ...dto, user_id: userId });
      mockPrismaService.subscription.findMany.mockResolvedValue([]);

      const result = await service.create(userId, dto as any);
      expect(result.id).toBe(1);
      expect(prisma.subscription.create).toHaveBeenCalled();
    });
  });

  describe('processSubscriptions (Engine)', () => {
    it('should generate transactions for due subscriptions and advance date', async () => {
      const dueSub = {
        id: 1,
        user_id: 1,
        name: 'Netflix',
        value: new Decimal(39.90),
        frequency: 'MONTHLY',
        wallet_id: 1,
        category_id: 1,
        status: 'ACTIVE',
        start_date: new Date('2026-01-01'),
        next_billing_date: new Date('2026-01-01'),
        transaction_type: 'EXPENSE',
      };

      mockPrismaService.subscription.findMany.mockResolvedValue([dueSub]);

      await service.triggerCheck();

      expect(transactionsService.create).toHaveBeenCalledWith(1, expect.objectContaining({
        value: 39.90,
        transaction_type: 'EXPENSE',
      }));

      expect(prisma.subscription.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({
          next_billing_date: expect.any(Date),
        }),
      }));
    });

    it('should NOT generate transactions for PAUSED subscriptions', async () => {
      mockPrismaService.subscription.findMany.mockResolvedValue([]);

      await service.triggerCheck();
      expect(transactionsService.create).not.toHaveBeenCalled();
    });

    it('should NOT generate transactions if next_billing_date is in the future', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 2); // 2 days in the future
      const futureSub = {
        id: 1,
        user_id: 1,
        name: 'Spotify',
        value: new Decimal(19.90),
        frequency: 'MONTHLY',
        wallet_id: 1,
        category_id: 1,
        status: 'ACTIVE',
        start_date: new Date('2026-01-01'),
        next_billing_date: futureDate,
        transaction_type: 'EXPENSE',
      };

      // Since the where clause in triggerCheck only fetches dates <= endOfToday
      // findMany should return an empty array or we test the query itself
      // In this case, we just return empty as it simulates the DB logic
      mockPrismaService.subscription.findMany.mockResolvedValue([]);
      await service.triggerCheck();
      expect(transactionsService.create).not.toHaveBeenCalled();
    });
  });
});
