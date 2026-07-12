import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsService } from './transactions.service';
import { TransactionImpactService } from './transaction-impact.service';
import { PrismaService } from '../prisma/prisma.service';
import { WalletsService } from '../wallets/wallets.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { TransactionSeriesScope } from './dto/update-transaction.dto';

const mockPrismaService = {
  $transaction: jest.fn(),
  transaction: {
    create: jest.fn(),
    createMany: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    aggregate: jest.fn(),
  },
  transactionCategory: {
    findFirst: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
  },
  wallet: {
    findUnique: jest.fn(),
  },
  card: {
    findUnique: jest.fn(),
  },
  subscription: {
    findUnique: jest.fn(),
  },
};

const mockWalletsService = {
  addIncoming: jest.fn(),
  addExpense: jest.fn(),
};

describe('TransactionsService', () => {
  let service: TransactionsService;
  let prisma: PrismaService;
  let walletsService: WalletsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        TransactionImpactService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: WalletsService, useValue: mockWalletsService },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
    prisma = module.get<PrismaService>(PrismaService);
    walletsService = module.get<WalletsService>(WalletsService);

    jest.clearAllMocks();
    mockPrismaService.$transaction.mockImplementation((callback) =>
      callback(mockPrismaService),
    );
    mockPrismaService.wallet.findUnique.mockResolvedValue({
      id: 1,
      user_id: 1,
      type: 'BANK',
    });
    mockPrismaService.transactionCategory.findUnique.mockResolvedValue({
      id: 1,
      user_id: 1,
    });
    mockPrismaService.transaction.findMany.mockResolvedValue([]);
    mockPrismaService.subscription.findUnique.mockResolvedValue(null);
    mockPrismaService.card.findUnique.mockResolvedValue(null);
    mockPrismaService.transaction.aggregate.mockResolvedValue({
      _sum: { value: 0 },
    });
  });

  it('should create a single transaction and update wallet (DEBIT/Default)', async () => {
    const dto = {
      transaction_date: new Date().toISOString(),
      wallet_id: 1,
      transaction_type: 'EXPENSE',
      is_recurring: false,
      value: 100,
      category_id: 1,
    };
    const userId = 1;

    mockPrismaService.transaction.create.mockResolvedValue({ id: 1, ...dto });

    await service.create(userId, dto);

    expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.transaction.create).toHaveBeenCalled();
    expect(walletsService.addExpense).toHaveBeenCalledWith(
      dto.wallet_id,
      userId,
      dto.value,
      mockPrismaService,
    );
  });

  it('should execute creation and balance impact through the same transaction client', async () => {
    const dto = {
      transaction_date: new Date().toISOString(),
      wallet_id: 1,
      transaction_type: 'EXPENSE',
      is_recurring: false,
      value: 100,
      category_id: 1,
    };
    mockPrismaService.transaction.create.mockResolvedValue({ id: 1, ...dto });

    await service.create(1, dto);

    expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
    expect(mockWalletsService.addExpense).toHaveBeenCalledWith(
      1,
      1,
      100,
      mockPrismaService,
    );
  });

  it('should update wallet balance if payment_method is DEBIT', async () => {
    const dto = {
      transaction_date: new Date().toISOString(),
      wallet_id: 1,
      transaction_type: 'EXPENSE',
      is_recurring: false,
      value: 50,
      category_id: 1,
      payment_method: 'DEBIT',
    };
    const userId = 1;

    mockPrismaService.transaction.create.mockResolvedValue({ id: 1, ...dto });

    await service.create(userId, dto);

    expect(prisma.transaction.create).toHaveBeenCalled();
    expect(walletsService.addExpense).toHaveBeenCalledWith(
      dto.wallet_id,
      userId,
      dto.value,
      mockPrismaService,
    );
  });

  it('should update wallet balance if payment_method is PIX', async () => {
    const dto = {
      transaction_date: new Date().toISOString(),
      wallet_id: 1,
      transaction_type: 'EXPENSE',
      is_recurring: false,
      value: 75,
      category_id: 1,
      payment_method: 'PIX',
    };
    const userId = 1;

    mockPrismaService.transaction.create.mockResolvedValue({ id: 1, ...dto });

    await service.create(userId, dto);

    expect(prisma.transaction.create).toHaveBeenCalled();
    expect(walletsService.addExpense).toHaveBeenCalledWith(
      dto.wallet_id,
      userId,
      dto.value,
      mockPrismaService,
    );
  });

  it('should NOT update wallet balance if payment_method is CREDIT', async () => {
    const dto = {
      transaction_date: new Date().toISOString(),
      wallet_id: 1,
      transaction_type: 'EXPENSE',
      is_recurring: false,
      value: 100,
      category_id: 1,
      payment_method: 'CREDIT',
    };
    const userId = 1;

    mockPrismaService.transaction.create.mockResolvedValue({ id: 1, ...dto });

    await service.create(userId, dto);

    expect(prisma.transaction.create).toHaveBeenCalled();
    expect(walletsService.addExpense).not.toHaveBeenCalled();
  });

  it('should debit meal-voucher wallet immediately even when payment_method is CREDIT', async () => {
    const dto = {
      transaction_date: new Date().toISOString(),
      wallet_id: 1,
      transaction_type: 'EXPENSE',
      is_recurring: false,
      value: 100,
      category_id: 1,
      payment_method: 'CREDIT',
      card_id: 1,
    };
    const userId = 1;

    mockPrismaService.wallet.findUnique.mockResolvedValueOnce({
      id: 1,
      user_id: 1,
      type: 'MEAL_VOUCHER',
    });
    mockPrismaService.card.findUnique.mockResolvedValue({
      id: 1,
      wallet_id: 1,
      wallet: { user_id: 1 },
    });
    mockPrismaService.transaction.create.mockResolvedValue({ id: 1, ...dto });

    await service.create(userId, dto);

    expect(prisma.transaction.create).toHaveBeenCalled();
    expect(walletsService.addExpense).toHaveBeenCalledWith(
      dto.wallet_id,
      userId,
      dto.value,
      mockPrismaService,
    );
    expect(mockPrismaService.card.findUnique).toHaveBeenCalledTimes(1);
    expect(mockPrismaService.transaction.aggregate).not.toHaveBeenCalled();
  });

  it('should explode installments into multiple records', async () => {
    const dto = {
      transaction_date: '2026-01-30T00:00:00.000Z',
      wallet_id: 1,
      transaction_type: 'EXPENSE',
      is_recurring: false,
      category_id: 1,
      installment_total: 10,
      value: 100,
      payment_method: 'CREDIT',
    };
    const userId = 1;

    mockPrismaService.transaction.createMany.mockResolvedValue({ count: 10 });

    await service.create(userId, dto);

    expect(prisma.transaction.createMany).toHaveBeenCalled();
    const callArgs = mockPrismaService.transaction.createMany.mock.calls[0][0];
    expect(callArgs.data.length).toBe(10);
    expect(callArgs.data[0].payment_method).toBe('CREDIT');

    // Default behavior (no payment_method) calls addExpense
    expect(walletsService.addExpense).not.toHaveBeenCalled();
  });

  it('should distribute cents so installments sum exactly to the original value', async () => {
    const dto = {
      transaction_date: '2026-01-30T00:00:00.000Z',
      wallet_id: 1,
      transaction_type: 'EXPENSE',
      is_recurring: false,
      category_id: 1,
      installment_total: 3,
      value: 100,
      payment_method: 'CREDIT',
    };
    mockPrismaService.transaction.createMany.mockResolvedValue({ count: 3 });

    await service.create(1, dto);

    const installments =
      mockPrismaService.transaction.createMany.mock.calls[0][0].data;
    const total = installments.reduce(
      (sum: number, installment: { value: number }) => sum + installment.value,
      0,
    );
    expect(total).toBe(100);
    expect(installments.map((item: { value: number }) => item.value)).toEqual([
      33.34, 33.33, 33.33,
    ]);
  });

  it('should distribute a five-cent value across two installments', async () => {
    mockPrismaService.transaction.createMany.mockResolvedValue({ count: 2 });

    await service.create(1, {
      transaction_date: '2026-01-30T00:00:00.000Z',
      wallet_id: 1,
      transaction_type: 'EXPENSE',
      is_recurring: false,
      category_id: 1,
      installment_total: 2,
      value: 0.05,
      payment_method: 'CREDIT',
    });

    const installments =
      mockPrismaService.transaction.createMany.mock.calls[0][0].data;
    expect(installments.map((item: { value: number }) => item.value)).toEqual([
      0.03, 0.02,
    ]);
  });

  it('should create a Subscription (12 months view) when is_recurring is true (DEBIT)', async () => {
    const dto = {
      transaction_date: new Date().toISOString(),
      wallet_id: 1,
      transaction_type: 'EXPENSE',
      is_recurring: true,
      category_id: 2,
      value: 29.9,
      payment_method: 'DEBIT',
    };
    const userId = 1;

    mockPrismaService.transaction.createMany.mockResolvedValue({ count: 12 });

    await service.create(userId, dto);

    expect(prisma.transaction.createMany).toHaveBeenCalled();
    const callArgs = mockPrismaService.transaction.createMany.mock.calls[0][0];
    expect(callArgs.data.length).toBe(12);
    expect(callArgs.data[0].payment_method).toBe('DEBIT');

    expect(callArgs.data[0].value).toBe(29.9);
    expect(callArgs.data[11].value).toBe(29.9);
    expect(callArgs.data[0].recurrence_id).toBeTruthy();
    expect(callArgs.data[0].installment_group_id).toBeUndefined();

    expect(walletsService.addExpense).toHaveBeenCalledWith(
      dto.wallet_id,
      userId,
      29.9,
      mockPrismaService,
    );
  });

  it('should NOT update wallet balance if payment_method is CREDIT for Subscription', async () => {
    const dto = {
      transaction_date: new Date().toISOString(),
      wallet_id: 1,
      transaction_type: 'EXPENSE',
      is_recurring: true,
      category_id: 2,
      value: 29.9,
      payment_method: 'CREDIT',
    };
    const userId = 1;

    mockPrismaService.transaction.createMany.mockResolvedValue({ count: 12 });

    await service.create(userId, dto);

    expect(prisma.transaction.createMany).toHaveBeenCalled();
    const callArgs = mockPrismaService.transaction.createMany.mock.calls[0][0];
    expect(callArgs.data[0].payment_method).toBe('CREDIT');
    expect(walletsService.addExpense).not.toHaveBeenCalled();
  });

  it('should throw NotFoundException if wallet belongs to another user', async () => {
    const dto = {
      transaction_date: new Date().toISOString(),
      wallet_id: 1,
      transaction_type: 'EXPENSE',
      is_recurring: false,
      value: 100,
      category_id: 1,
    };
    const userId = 1;

    // mock wallet belonging to user 999
    mockPrismaService.wallet.findUnique.mockResolvedValueOnce({
      id: 1,
      user_id: 999,
      type: 'BANK',
    });

    await expect(service.create(userId, dto)).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.transaction.create).not.toHaveBeenCalled();
  });

  it('should throw BadRequestException when card limit is exceeded', async () => {
    const dto = {
      transaction_date: new Date().toISOString(),
      wallet_id: 1,
      transaction_type: 'EXPENSE',
      is_recurring: false,
      value: 1500,
      category_id: 1,
      payment_method: 'CREDIT',
      card_id: 1,
    };
    const userId = 1;

    // mock card
    mockPrismaService.card.findUnique.mockResolvedValue({
      id: 1,
      card_limit: 1000,
      wallet_id: 1,
      wallet: { user_id: 1 },
    });
    // mock aggregates
    mockPrismaService.transaction.aggregate = jest
      .fn()
      .mockResolvedValueOnce({ _sum: { value: 200 } }) // exp
      .mockResolvedValueOnce({ _sum: { value: 0 } }); // inc

    await expect(service.create(userId, dto)).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.transaction.create).not.toHaveBeenCalled();
  });

  it('should reject a card that does not belong to the transaction wallet', async () => {
    mockPrismaService.card.findUnique.mockResolvedValue({
      id: 99,
      wallet_id: 2,
      wallet: { user_id: 1 },
    });

    await expect(
      service.create(1, {
        transaction_date: new Date().toISOString(),
        wallet_id: 1,
        transaction_type: 'EXPENSE',
        is_recurring: false,
        value: 10,
        category_id: 1,
        payment_method: 'CREDIT',
        card_id: 99,
      }),
    ).rejects.toThrow(NotFoundException);
    expect(mockPrismaService.transaction.create).not.toHaveBeenCalled();
  });

  it('should reject a subscription incompatible with wallet or category', async () => {
    mockPrismaService.subscription.findUnique.mockResolvedValue({
      id: 3,
      user_id: 1,
      wallet_id: 2,
      category_id: 1,
    });

    await expect(
      service.create(1, {
        transaction_date: new Date().toISOString(),
        wallet_id: 1,
        transaction_type: 'EXPENSE',
        is_recurring: true,
        value: 10,
        category_id: 1,
        subscription_id: 3,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should revalidate ownership when only card_id changes', async () => {
    mockPrismaService.transaction.findFirst.mockResolvedValue({
      id: 7,
      wallet_id: 1,
      category_id: 1,
      card_id: null,
      subscription_id: null,
      wallet: { id: 1, user_id: 1, type: 'BANK' },
    });
    mockPrismaService.card.findUnique.mockResolvedValue({
      id: 2,
      wallet_id: 2,
      wallet: { user_id: 999 },
    });

    await expect(service.update(7, 1, { card_id: 2 })).rejects.toThrow(
      NotFoundException,
    );
    expect(mockPrismaService.transaction.update).not.toHaveBeenCalled();
  });

  it('should update only the selected installment by default and apply its individual diff', async () => {
    const oldTransaction = {
      id: 7,
      wallet_id: 1,
      transaction_type: 'EXPENSE',
      payment_method: 'DEBIT',
      value: 100,
      transaction_date: new Date('2026-03-01T12:00:00.000Z'),
      installment_group_id: 'series-1',
      installment_total: 3,
      is_processed: true,
      wallet: { id: 1, user_id: 1, type: 'BANK' },
    };
    mockPrismaService.transaction.findFirst.mockResolvedValue(oldTransaction);
    mockPrismaService.transaction.update.mockResolvedValue({
      ...oldTransaction,
      value: 120,
    });

    await service.update(7, 1, { value: 120 });

    expect(mockPrismaService.transaction.update).toHaveBeenCalledTimes(1);
    expect(mockPrismaService.transaction.updateMany).not.toHaveBeenCalled();
    expect(mockWalletsService.addIncoming).toHaveBeenCalledWith(
      1,
      1,
      100,
      mockPrismaService,
    );
    expect(mockWalletsService.addExpense).toHaveBeenCalledWith(
      1,
      1,
      120,
      mockPrismaService,
    );
  });

  it('should delete only the selected installment when scope is THIS', async () => {
    const oldTransaction = {
      id: 7,
      wallet_id: 1,
      transaction_type: 'EXPENSE',
      payment_method: 'DEBIT',
      value: 100,
      installment_group_id: 'series-1',
      is_processed: true,
      wallet: { id: 1, user_id: 1, type: 'BANK' },
    };
    mockPrismaService.transaction.findFirst.mockResolvedValue(oldTransaction);
    mockPrismaService.transaction.delete.mockResolvedValue(oldTransaction);

    await service.remove(7, 1, TransactionSeriesScope.THIS);

    expect(mockPrismaService.transaction.delete).toHaveBeenCalledWith({
      where: { id: 7 },
    });
    expect(mockPrismaService.transaction.deleteMany).not.toHaveBeenCalled();
    expect(mockWalletsService.addIncoming).toHaveBeenCalledWith(
      1,
      1,
      100,
      mockPrismaService,
    );
  });

  it('should update every installment with an individual balance diff when scope is ALL', async () => {
    const base = {
      wallet_id: 1,
      transaction_type: 'EXPENSE',
      payment_method: 'DEBIT',
      installment_group_id: 'series-1',
      installment_total: 2,
      is_processed: true,
      wallet: { id: 1, user_id: 1, type: 'BANK' },
    };
    const first = {
      ...base,
      id: 7,
      value: 100,
      transaction_date: new Date('2026-03-01T12:00:00.000Z'),
    };
    const second = {
      ...base,
      id: 8,
      value: 110,
      transaction_date: new Date('2026-04-01T12:00:00.000Z'),
    };
    mockPrismaService.transaction.findFirst.mockResolvedValue(first);
    mockPrismaService.transaction.findMany.mockResolvedValue([first, second]);
    mockPrismaService.transaction.update.mockImplementation(({ where, data }) =>
      Promise.resolve({ id: where.id, ...data }),
    );

    const result = await service.update(7, 1, {
      value: 120,
      series_scope: TransactionSeriesScope.ALL,
    });

    expect(result).toEqual({ count: 2 });
    expect(mockPrismaService.transaction.update).toHaveBeenCalledTimes(2);
    expect(mockWalletsService.addIncoming).toHaveBeenNthCalledWith(
      1,
      1,
      1,
      100,
      mockPrismaService,
    );
    expect(mockWalletsService.addIncoming).toHaveBeenNthCalledWith(
      2,
      1,
      1,
      110,
      mockPrismaService,
    );
    expect(mockWalletsService.addExpense).toHaveBeenCalledTimes(2);
    for (const call of mockPrismaService.transaction.update.mock.calls) {
      expect(call[0].data.transaction_date).toBeUndefined();
    }
  });

  it('should delete the complete owned series when scope is ALL', async () => {
    const base = {
      wallet_id: 1,
      transaction_type: 'EXPENSE',
      payment_method: 'DEBIT',
      installment_group_id: 'series-1',
      is_processed: true,
      wallet: { id: 1, user_id: 1, type: 'BANK' },
    };
    const first = { ...base, id: 7, value: 100 };
    const second = { ...base, id: 8, value: 110 };
    mockPrismaService.transaction.findFirst.mockResolvedValue(first);
    mockPrismaService.transaction.findMany.mockResolvedValue([first, second]);
    mockPrismaService.transaction.deleteMany.mockResolvedValue({ count: 2 });

    const result = await service.remove(7, 1, TransactionSeriesScope.ALL);

    expect(result).toEqual({ count: 2 });
    expect(mockWalletsService.addIncoming).toHaveBeenCalledTimes(2);
    expect(mockPrismaService.transaction.deleteMany).toHaveBeenCalledWith({
      where: {
        id: { in: [7, 8] },
        wallet: { user_id: 1 },
      },
    });
  });

  it('should apply a matured transaction only when its atomic claim succeeds', async () => {
    const matured = {
      id: 20,
      wallet_id: 1,
      transaction_type: 'EXPENSE',
      payment_method: 'DEBIT',
      value: 25,
      transaction_date: new Date('2026-01-01T12:00:00.000Z'),
      is_processed: false,
      wallet: { id: 1, user_id: 1, type: 'BANK' },
    };
    mockPrismaService.transaction.findMany.mockResolvedValue([matured]);
    mockPrismaService.transaction.updateMany.mockResolvedValue({ count: 0 });

    const result = await service.processMaturedTransactions();

    expect(result).toBe(0);
    expect(mockPrismaService.transaction.updateMany).toHaveBeenCalledWith({
      where: { id: 20, is_processed: false },
      data: { is_processed: true },
    });
    expect(mockWalletsService.addExpense).not.toHaveBeenCalled();
  });

  it('should allow only one of two concurrent maturity runs to claim the transaction', async () => {
    const matured = {
      id: 20,
      wallet_id: 1,
      transaction_type: 'EXPENSE',
      payment_method: 'DEBIT',
      value: 25,
      transaction_date: new Date('2026-01-01T12:00:00.000Z'),
      is_processed: false,
      wallet: { id: 1, user_id: 1, type: 'BANK' },
    };
    mockPrismaService.transaction.findMany.mockResolvedValue([matured]);
    mockPrismaService.transaction.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    const results = await Promise.all([
      service.processMaturedTransactions(),
      service.processMaturedTransactions(),
    ]);

    expect(results.sort()).toEqual([0, 1]);
    expect(mockWalletsService.addExpense).toHaveBeenCalledTimes(1);
  });
});
