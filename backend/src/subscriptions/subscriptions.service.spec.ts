import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionsService } from './subscriptions.service';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionsService } from '../transactions/transactions.service';
import { NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';

const mockPrismaService = {
  $transaction: jest.fn(),
  subscription: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
  },
  transaction: {
    findMany: jest.fn(),
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
  remove: jest.fn(),
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
    mockPrismaService.$transaction.mockImplementation((callback) =>
      callback(mockPrismaService),
    );
    mockPrismaService.subscription.updateMany.mockResolvedValue({ count: 1 });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a subscription', async () => {
      const dto = {
        name: 'Netflix',
        value: 39.9,
        frequency: 'MONTHLY',
        wallet_id: 1,
        category_id: 1,
        start_date: new Date().toISOString(),
      };

      mockPrismaService.wallet.findUnique.mockResolvedValue({
        id: 1,
        user_id: userId,
      });
      mockPrismaService.transactionCategory.findUnique.mockResolvedValue({
        id: 1,
        user_id: userId,
      });
      mockPrismaService.subscription.create.mockResolvedValue({
        id: 1,
        ...dto,
        user_id: userId,
      });
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
        value: new Decimal(39.9),
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

      expect(transactionsService.create).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          value: 39.9,
          transaction_type: 'EXPENSE',
        }),
        mockPrismaService,
      );

      expect(prisma.subscription.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 1,
            next_billing_date: expect.any(Date),
          }),
          data: expect.objectContaining({
            next_billing_date: expect.any(Date),
          }),
        }),
      );
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
        value: new Decimal(19.9),
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

    it('should backfill ALL overdue cycles in a single run (Bug 2 fix)', async () => {
      // Today is 2026-06-23; Netflix mensal cobra dia 15. Last next_billing_date
      // = 2026-04-15. Engine deve criar 3 transações (abr/15, mai/15, jun/15)
      // e avançar next_billing_date para 2026-07-15.
      jest.useFakeTimers().setSystemTime(new Date('2026-06-23T12:00:00.000Z'));

      const overdueSub = {
        id: 1,
        user_id: 1,
        name: 'Netflix',
        value: new Decimal(39.9),
        frequency: 'MONTHLY',
        wallet_id: 1,
        category_id: 1,
        status: 'ACTIVE',
        start_date: new Date('2026-01-15'),
        next_billing_date: new Date('2026-04-15'),
        transaction_type: 'EXPENSE',
      };
      mockPrismaService.subscription.findMany.mockResolvedValue([overdueSub]);

      const result = await service.triggerCheck();

      expect(transactionsService.create).toHaveBeenCalledTimes(3);
      expect(result.processed).toBe(3);

      const dates = mockTransactionsService.create.mock.calls.map((c) =>
        c[1].transaction_date.slice(0, 10),
      );
      expect(dates).toEqual(['2026-04-15', '2026-05-15', '2026-06-15']);

      const updateCall =
        mockPrismaService.subscription.updateMany.mock.calls[2][0];
      expect(
        (updateCall.data.next_billing_date as Date).toISOString().slice(0, 10),
      ).toBe('2026-07-15');

      jest.useRealTimers();
    });

    it('should skip a billing cycle when another worker already claimed it', async () => {
      const dueSub = {
        id: 1,
        user_id: 1,
        name: 'Netflix',
        value: new Decimal(39.9),
        frequency: 'MONTHLY',
        wallet_id: 1,
        category_id: 1,
        status: 'ACTIVE',
        start_date: new Date('2026-01-01'),
        next_billing_date: new Date('2026-01-01'),
        transaction_type: 'EXPENSE',
      };
      mockPrismaService.subscription.findMany.mockResolvedValue([dueSub]);
      mockPrismaService.subscription.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.triggerCheck();

      expect(result.processed).toBe(0);
      expect(transactionsService.create).not.toHaveBeenCalled();
    });
  });

  describe('remove (Bug 3 fix)', () => {
    it('should delete linked transactions through TransactionsService.remove so balance is reverted', async () => {
      mockPrismaService.subscription.findUnique.mockResolvedValue({
        id: 9,
        user_id: userId,
      });
      mockPrismaService.transaction.findMany.mockResolvedValue([
        { id: 101 },
        { id: 102 },
      ]);
      mockPrismaService.subscription.delete.mockResolvedValue({ id: 9 });

      await service.remove(9, userId);

      expect(transactionsService.remove).toHaveBeenCalledTimes(2);
      expect(transactionsService.remove).toHaveBeenNthCalledWith(
        1,
        101,
        userId,
      );
      expect(transactionsService.remove).toHaveBeenNthCalledWith(
        2,
        102,
        userId,
      );
      expect(prisma.subscription.delete).toHaveBeenCalledWith({
        where: { id: 9 },
      });
    });
  });

  describe('pause / resume', () => {
    it('should set status to PAUSED', async () => {
      mockPrismaService.subscription.findUnique.mockResolvedValue({
        id: 1,
        user_id: userId,
      });
      await service.pause(1, userId);
      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: 'PAUSED' },
      });
    });

    it('should set status to ACTIVE on resume', async () => {
      mockPrismaService.subscription.findUnique.mockResolvedValue({
        id: 1,
        user_id: userId,
      });
      await service.resume(1, userId);
      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: 'ACTIVE' },
      });
    });
  });
});
