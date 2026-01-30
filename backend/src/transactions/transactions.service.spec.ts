import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsService } from './transactions.service';
import { PrismaService } from '../prisma/prisma.service';
import { WalletsService } from '../wallets/wallets.service';

const mockPrismaService = {
  transaction: {
    create: jest.fn(),
    createMany: jest.fn(),
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
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: WalletsService, useValue: mockWalletsService },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
    prisma = module.get<PrismaService>(PrismaService);
    walletsService = module.get<WalletsService>(WalletsService);

    jest.clearAllMocks();
  });

  it('should create a single transaction and update wallet', async () => {
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

  it('should explode installments into multiple records', async () => {
    const dto = {
      transaction_date: '2026-01-30T00:00:00.000Z',
      wallet_id: 1,
      transaction_type: 'EXPENSE',
      is_recurring: false,
      value: 100, // Total value
      category_id: 1,
      installment_total: 10,
    };
    const userId = 1;

    mockPrismaService.transaction.createMany.mockResolvedValue({ count: 10 });

    await service.create(userId, dto);

    // Should call createMany with 10 records
    expect(prisma.transaction.createMany).toHaveBeenCalled();
    const callArgs = mockPrismaService.transaction.createMany.mock.calls[0][0];
    expect(callArgs.data.length).toBe(10);
    
    // Check if dates are incremented (first is Jan, second should be Feb)
    const secondInstallmentDate = new Date(callArgs.data[1].transaction_date);
    expect(secondInstallmentDate.getMonth()).toBe(1); // February (0-indexed)

    // Wallet should be updated ONLY for the first installment value (100 / 10 = 10)
    expect(walletsService.addExpense).toHaveBeenCalledWith(dto.wallet_id, userId, 10);
  });

  it('should create a Subscription (12 months view) when is_recurring is true', async () => {
    const dto = {
      transaction_date: '2026-01-30T00:00:00.000Z',
      wallet_id: 1,
      transaction_type: 'EXPENSE',
      is_recurring: true, // Subscription
      value: 29.90, // Monthly value
      category_id: 2,
    };
    const userId = 1;

    mockPrismaService.transaction.createMany.mockResolvedValue({ count: 12 });

    await service.create(userId, dto);

    // Should create 12 records (1 year horizon)
    expect(prisma.transaction.createMany).toHaveBeenCalled();
    const callArgs = mockPrismaService.transaction.createMany.mock.calls[0][0]; // 1st call in THIS test (cleared in beforeEach)
    expect(callArgs.data.length).toBe(12);

    // Value should remain constant (NOT divided)
    expect(callArgs.data[0].value).toBe(29.90);
    expect(callArgs.data[11].value).toBe(29.90);

    // Wallet should be updated with the single monthly value
    expect(walletsService.addExpense).toHaveBeenCalledWith(dto.wallet_id, userId, 29.90);
  });
});
