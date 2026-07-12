import { Test, TestingModule } from '@nestjs/testing';
import { StatementImportService } from './statement-import.service';
import { TransactionImpactService } from './transaction-impact.service';
import { PrismaService } from '../prisma/prisma.service';
import { WalletsService } from '../wallets/wallets.service';

const mockPrismaService = {
  $transaction: jest.fn(),
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

describe('StatementImportService', () => {
  let service: StatementImportService;
  let prisma: PrismaService;
  let walletsService: WalletsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatementImportService,
        TransactionImpactService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: WalletsService, useValue: mockWalletsService },
      ],
    }).compile();

    service = module.get<StatementImportService>(StatementImportService);
    prisma = module.get<PrismaService>(PrismaService);
    walletsService = module.get<WalletsService>(WalletsService);

    jest.clearAllMocks();
    mockPrismaService.$transaction.mockImplementation((callback) =>
      callback(mockPrismaService),
    );
    mockPrismaService.transaction.findMany.mockResolvedValue([]);
    mockPrismaService.transactionCategory.findUnique.mockResolvedValue({
      id: 1,
      user_id: 1,
      name: 'Outro',
    });
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
    // Trava o "hoje" para que a parcela 04/10 (2026-04-10) seja considerada futura
    // e portanto não dispare addExpense. Sem isso, o teste depende da data real e
    // quebra conforme o tempo passa.
    jest.useFakeTimers().setSystemTime(new Date('2026-03-20T12:00:00.000Z'));

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
    expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(3);
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
    expect(secondCall.installment_group_id).toBeTruthy();
    expect(thirdCall.installment_group_id).toBe(
      secondCall.installment_group_id,
    );
    expect(walletsService.addExpense).toHaveBeenCalledTimes(2);

    jest.useRealTimers();
  });

  it('should import card statement rows as credit card transactions', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-20T12:00:00.000Z'));

    mockPrismaService.wallet.findUnique.mockResolvedValueOnce({
      id: 1,
      user_id: 1,
      type: 'BANK',
    });
    mockPrismaService.card.findUnique
      .mockResolvedValueOnce({
        id: 10,
        wallet_id: 1,
        wallet: { user_id: 1 },
      })
      .mockResolvedValueOnce({
        id: 10,
        card_limit: 1000,
      });
    mockPrismaService.transaction.aggregate
      .mockResolvedValueOnce({ _sum: { value: 0 } })
      .mockResolvedValueOnce({ _sum: { value: 0 } });
    mockPrismaService.transaction.create.mockResolvedValueOnce({ id: 201 });

    const result = await service.confirmStatementImport(
      1,
      1,
      [
        {
          transaction_date: '2026-03-10T12:00:00.000Z',
          transaction_type: 'EXPENSE',
          value: 45.9,
          description: 'IFOOD',
          category_id: 1,
        },
      ],
      10,
    );

    expect(result).toEqual({
      importedCount: 1,
      failedCount: 0,
      failures: [],
    });
    expect(
      mockPrismaService.transaction.create.mock.calls[0][0].data,
    ).toMatchObject({
      card_id: 10,
      payment_method: 'CREDIT',
      wallet_id: 1,
      transaction_type: 'EXPENSE',
      value: 45.9,
    });
    expect(walletsService.addExpense).not.toHaveBeenCalled();

    jest.useRealTimers();
  });

  it('should import direct meal-voucher rows as credit transactions and debit immediately', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-20T12:00:00.000Z'));

    mockPrismaService.wallet.findUnique.mockResolvedValueOnce({
      id: 1,
      user_id: 1,
      type: 'MEAL_VOUCHER',
    });
    mockPrismaService.transaction.create.mockResolvedValueOnce({ id: 301 });

    const result = await service.confirmStatementImport(1, 1, [
      {
        transaction_date: '2026-03-10T12:00:00.000Z',
        transaction_type: 'EXPENSE',
        value: 45.9,
        description: 'IFOOD',
        category_id: 1,
      },
    ]);

    expect(result).toEqual({
      importedCount: 1,
      failedCount: 0,
      failures: [],
    });
    expect(
      mockPrismaService.transaction.create.mock.calls[0][0].data,
    ).toMatchObject({
      card_id: null,
      payment_method: 'CREDIT',
      wallet_id: 1,
      transaction_type: 'EXPENSE',
      value: 45.9,
    });
    expect(walletsService.addExpense).toHaveBeenCalledWith(
      1,
      1,
      45.9,
      mockPrismaService,
    );

    jest.useRealTimers();
  });

  it('should debit meal-voucher card imports immediately without validating card limit', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-20T12:00:00.000Z'));

    mockPrismaService.wallet.findUnique.mockResolvedValueOnce({
      id: 1,
      user_id: 1,
      type: 'MEAL_VOUCHER',
    });
    mockPrismaService.card.findUnique.mockResolvedValueOnce({
      id: 10,
      wallet_id: 1,
      wallet: { user_id: 1 },
    });
    mockPrismaService.transaction.create.mockResolvedValueOnce({ id: 301 });

    const result = await service.confirmStatementImport(
      1,
      1,
      [
        {
          transaction_date: '2026-03-10T12:00:00.000Z',
          transaction_type: 'EXPENSE',
          value: 45.9,
          description: 'IFOOD',
          category_id: 1,
        },
      ],
      10,
    );

    expect(result).toEqual({
      importedCount: 1,
      failedCount: 0,
      failures: [],
    });
    expect(
      mockPrismaService.transaction.create.mock.calls[0][0].data,
    ).toMatchObject({
      card_id: 10,
      payment_method: 'CREDIT',
      wallet_id: 1,
      transaction_type: 'EXPENSE',
      value: 45.9,
    });
    expect(mockPrismaService.card.findUnique).toHaveBeenCalledTimes(1);
    expect(mockPrismaService.transaction.aggregate).not.toHaveBeenCalled();
    expect(walletsService.addExpense).toHaveBeenCalledWith(
      1,
      1,
      45.9,
      mockPrismaService,
    );

    jest.useRealTimers();
  });
});
