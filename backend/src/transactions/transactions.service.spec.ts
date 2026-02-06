import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsService } from './transactions.service';
import { PrismaService } from '../prisma/prisma.service';
import { WalletsService } from '../wallets/wallets.service';

const mockPrismaService = {
  transaction: {
    create: jest.fn(),
    createMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  transactionCategory: {
    findFirst: jest.fn(),
    create: jest.fn(),
  }
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
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: WalletsService, useValue: mockWalletsService },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
    prisma = module.get<PrismaService>(PrismaService);
    walletsService = module.get<WalletsService>(WalletsService);

    jest.clearAllMocks();
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

    expect(prisma.transaction.create).toHaveBeenCalled();
    expect(walletsService.addExpense).toHaveBeenCalledWith(dto.wallet_id, userId, dto.value);
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
    expect(walletsService.addExpense).toHaveBeenCalledWith(dto.wallet_id, userId, dto.value);
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
    expect(walletsService.addExpense).toHaveBeenCalledWith(dto.wallet_id, userId, dto.value);
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

  it('should explode installments into multiple records', async () => {
    const dto = {
      transaction_date: '2026-01-30T00:00:00.000Z',
      wallet_id: 1,
      transaction_type: 'EXPENSE',
      is_recurring: false,
      category_id: 1,
      installment_total: 10,
      value: 100,
      payment_method: 'CREDIT'
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

  it('should create a Subscription (12 months view) when is_recurring is true (DEBIT)', async () => {
    const dto = {
      transaction_date: '2026-01-30T00:00:00.000Z',
      wallet_id: 1,
      transaction_type: 'EXPENSE',
      is_recurring: true,
      category_id: 2,
      value: 29.90,
      payment_method: 'DEBIT'
    };
    const userId = 1;

    mockPrismaService.transaction.createMany.mockResolvedValue({ count: 12 });

    await service.create(userId, dto);

    expect(prisma.transaction.createMany).toHaveBeenCalled();
    const callArgs = mockPrismaService.transaction.createMany.mock.calls[0][0];
    expect(callArgs.data.length).toBe(12);
    expect(callArgs.data[0].payment_method).toBe('DEBIT');

    expect(callArgs.data[0].value).toBe(29.90);
    expect(callArgs.data[11].value).toBe(29.90);

    expect(walletsService.addExpense).toHaveBeenCalledWith(dto.wallet_id, userId, 29.90);
  });

  it('should NOT update wallet balance if payment_method is CREDIT for Subscription', async () => {
    const dto = {
      transaction_date: '2026-01-30T00:00:00.000Z',
      wallet_id: 1,
      transaction_type: 'EXPENSE',
      is_recurring: true,
      category_id: 2,
      value: 29.90,
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
});
