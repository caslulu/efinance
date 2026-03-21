import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsService } from './transactions.service';
import { PrismaService } from '../prisma/prisma.service';
import { WalletsService } from '../wallets/wallets.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

const mockPrismaService = {
  transaction: {
    create: jest.fn(),
    createMany: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
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
    expect(walletsService.addExpense).toHaveBeenCalledWith(
      dto.wallet_id,
      userId,
      dto.value,
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

    expect(walletsService.addExpense).toHaveBeenCalledWith(
      dto.wallet_id,
      userId,
      29.9,
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
    mockPrismaService.card.findUnique.mockResolvedValueOnce({
      id: 1,
      card_limit: 1000,
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

  it('should preview OFX rows and identify installment purchases', async () => {
    const file = {
      originalname: 'statement.ofx',
      buffer: Buffer.from(`OFXHEADER:100
<OFX>
  <BANKMSGSRSV1>
    <STMTTRNRS>
      <STMTRS>
        <BANKTRANLIST>
          <STMTTRN>
            <TRNTYPE>DEBIT
            <DTPOSTED>20260310120000[-3:BRT]
            <TRNAMT>-150.75
            <FITID>20260310-1
            <MEMO>LOJA XPTO PARC 03/10
          </STMTTRN>
        </BANKTRANLIST>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>`),
    } as Express.Multer.File;

    mockPrismaService.wallet.findUnique.mockResolvedValueOnce({
      id: 1,
      user_id: 1,
      name: 'Main wallet',
    });

    const result = await service.previewStatementImport(1, 1, file);

    expect(result.format).toBe('OFX');
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      transaction_type: 'EXPENSE',
      value: 150.75,
      description: 'LOJA XPTO PARC 03/10',
      installment_total: 10,
      installment_number: 3,
      is_recurring: false,
    });
  });

  it('should preview CSV rows and identify recurring payments across months', async () => {
    const file = {
      originalname: 'statement.csv',
      buffer: Buffer.from(`date;description;amount
2026-01-05;NETFLIX;-39.90
2026-02-05;NETFLIX;-39.90
2026-03-05;NETFLIX;-39.90
2026-03-07;SALARY;5000.00`),
    } as Express.Multer.File;

    mockPrismaService.wallet.findUnique.mockResolvedValueOnce({
      id: 1,
      user_id: 1,
      name: 'Main wallet',
    });

    const result = await service.previewStatementImport(1, 1, file);
    const netflixRows = result.rows.filter(
      (row) => row.description === 'NETFLIX',
    );
    const salaryRow = result.rows.find((row) => row.description === 'SALARY');

    expect(netflixRows).toHaveLength(3);
    expect(netflixRows.every((row) => row.is_recurring)).toBe(true);
    expect(salaryRow?.is_recurring).toBe(false);
  });

  it('should preserve recurring and installment metadata when confirming imports', async () => {
    const rows = [
      {
        transaction_date: '2026-03-05T12:00:00.000Z',
        transaction_type: 'EXPENSE' as const,
        value: 39.9,
        description: 'NETFLIX',
        category_id: 1,
        is_recurring: true,
      },
      {
        transaction_date: '2026-03-10T12:00:00.000Z',
        transaction_type: 'EXPENSE' as const,
        value: 150.75,
        description: 'LOJA XPTO PARC 03/10',
        category_id: 1,
        installment_total: 10,
        installment_number: 3,
      },
      {
        transaction_date: '2026-04-10T12:00:00.000Z',
        transaction_type: 'EXPENSE' as const,
        value: 150.75,
        description: 'LOJA XPTO PARC 04/10',
        category_id: 1,
        installment_total: 10,
        installment_number: 4,
      },
    ];

    mockPrismaService.wallet.findUnique.mockResolvedValueOnce({
      id: 1,
      user_id: 1,
      type: 'BANK',
    });
    mockPrismaService.transaction.create
      .mockResolvedValueOnce({ id: 101 })
      .mockResolvedValueOnce({ id: 102 })
      .mockResolvedValueOnce({ id: 103 });

    const result = await service.confirmStatementImport(1, 1, rows);

    expect(result).toEqual({
      importedCount: 3,
      failedCount: 0,
      failures: [],
    });
    expect(prisma.transaction.create).toHaveBeenCalledTimes(3);
    expect(prisma.transaction.createMany).not.toHaveBeenCalled();

    const firstCall =
      mockPrismaService.transaction.create.mock.calls[0][0].data;
    const secondCall =
      mockPrismaService.transaction.create.mock.calls[1][0].data;
    const thirdCall =
      mockPrismaService.transaction.create.mock.calls[2][0].data;

    expect(firstCall).toMatchObject({
      is_recurring: true,
      installment_total: 1,
      installment_number: 1,
    });
    expect(secondCall).toMatchObject({
      is_recurring: false,
      installment_total: 10,
      installment_number: 3,
    });
    expect(thirdCall).toMatchObject({
      is_recurring: false,
      installment_total: 10,
      installment_number: 4,
    });
    expect(secondCall.installment_id).toBeTruthy();
    expect(thirdCall.installment_id).toBe(secondCall.installment_id);
    expect(walletsService.addExpense).toHaveBeenCalledTimes(2);
  });
});
