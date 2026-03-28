import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { InvestmentPortfolioService } from './investment-portfolio.service';
import { InvestmentMarketDataService } from './investment-market-data.service';

const txMock = {
  investmentOperation: {
    create: jest.fn(),
    findMany: jest.fn(),
    updateMany: jest.fn(),
  },
  investmentPosition: {
    upsert: jest.fn(),
  },
  wallet: {
    update: jest.fn(),
  },
  transactionCategory: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  transaction: {
    create: jest.fn(),
  },
};

const prismaMock = {
  wallet: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  economicIndicator: {
    findFirst: jest.fn(),
  },
  investmentOperation: {
    findMany: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
  },
  investmentPosition: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
  transactionCategory: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  transaction: {
    create: jest.fn(),
  },
  $transaction: jest.fn(async (callback: (tx: typeof txMock) => unknown) =>
    callback(txMock),
  ),
};

const marketDataMock = {
  getUsdBrlRateValue: jest.fn(),
  getDividendEvents: jest.fn(),
  getMany: jest.fn(),
};

describe('InvestmentPortfolioService', () => {
  let service: InvestmentPortfolioService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvestmentPortfolioService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: InvestmentMarketDataService, useValue: marketDataMock },
      ],
    }).compile();

    service = module.get<InvestmentPortfolioService>(InvestmentPortfolioService);
    jest.clearAllMocks();

    txMock.transactionCategory.findFirst.mockResolvedValue({ id: 9 });
    prismaMock.economicIndicator.findFirst.mockResolvedValue(null);
    marketDataMock.getDividendEvents.mockResolvedValue([]);
    marketDataMock.getMany.mockResolvedValue([]);
  });

  it('should create a buy operation and rebuild the aggregated position', async () => {
    marketDataMock.getMany.mockResolvedValueOnce([
      {
        symbol: 'PETR4',
        marketSymbol: 'PETR4',
        shortName: 'Petrobras',
        longName: 'Petroleo Brasileiro SA Petrobras',
        currency: 'BRL',
        price: 20,
        previousClose: 19.5,
        marketTime: '2026-03-21T12:00:00.000Z',
        dayChange: { amount: 0.5, percent: 2.56, direction: 'UP' },
        periodChanges: [],
        latestDividend: null,
        currencyValues: {
          usdBrlRate: null,
          price: { brl: 20, usd: 3.6 },
          previousClose: { brl: 19.5, usd: 3.51 },
          latestDividend: null,
        },
        priceRange: { high52w: 24, low52w: 18 },
      },
    ]);
    prismaMock.wallet.findUnique.mockResolvedValue({
      id: 1,
      user_id: 7,
      type: 'INVESTMENT',
      actual_cash: new Decimal(1000),
      name: 'Corretora XP',
    });
    prismaMock.investmentOperation.findMany.mockResolvedValue([]);
    txMock.investmentOperation.create.mockResolvedValue({
      id: 11,
      wallet_id: 1,
      type: 'BUY',
      symbol: 'PETR4',
      market: 'BR',
      asset_type: 'LISTED',
      currency: 'BRL',
      quantity: new Decimal(10),
      unit_price: new Decimal(20),
      gross_amount: new Decimal(200),
      gross_amount_brl: new Decimal(200),
      fx_rate: null,
      cdb_cdi_percentage: null,
      cdb_cdi_rate: null,
      transaction_date: new Date('2026-03-21T12:00:00.000Z'),
      source_event_key: null,
      notes: null,
      created_at: new Date('2026-03-21T12:00:00.000Z'),
    });
    txMock.investmentOperation.findMany.mockResolvedValue([
      {
        id: 11,
        wallet_id: 1,
        type: 'BUY',
        symbol: 'PETR4',
        market: 'BR',
        asset_type: 'LISTED',
        currency: 'BRL',
        quantity: new Decimal(10),
        unit_price: new Decimal(20),
        gross_amount: new Decimal(200),
        gross_amount_brl: new Decimal(200),
        fx_rate: null,
        cdb_cdi_percentage: null,
        cdb_cdi_rate: null,
        transaction_date: new Date('2026-03-21T12:00:00.000Z'),
        source_event_key: null,
        notes: null,
        created_at: new Date('2026-03-21T12:00:00.000Z'),
      },
    ]);
    txMock.investmentPosition.upsert.mockResolvedValue({ id: 4 });

    await expect(
      service.createOperation(7, {
        wallet_id: 1,
        operation_type: 'BUY',
        symbol: 'PETR4',
        market: 'BR',
        transaction_date: '2026-03-21T12:00:00.000Z',
        quantity: 10,
      }),
    ).resolves.toEqual({
      operationId: 11,
      walletId: 1,
      symbol: 'PETR4',
      market: 'BR',
    });

    expect(txMock.wallet.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        actual_cash: {
          decrement: new Decimal(200),
        },
      },
    });
    expect(txMock.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          wallet_id: 1,
          transaction_type: 'EXPENSE',
          payment_method: 'INVESTMENT',
          value: new Decimal(200),
        }),
      }),
    );
    expect(txMock.investmentPosition.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          wallet_id: 1,
          symbol: 'PETR4',
          quantity: new Decimal(10),
          average_cost: new Decimal(20),
          invested_amount: new Decimal(200),
          invested_amount_brl: new Decimal(200),
        }),
      }),
    );
    expect(marketDataMock.getMany).toHaveBeenCalledWith({
      symbols: ['PETR4'],
      periods: [1],
      market: 'BR',
    });
  });

  it('should reject a sell operation when the wallet does not hold enough quantity', async () => {
    marketDataMock.getMany.mockResolvedValueOnce([
      {
        symbol: 'PETR4',
        marketSymbol: 'PETR4',
        shortName: 'Petrobras',
        longName: 'Petroleo Brasileiro SA Petrobras',
        currency: 'BRL',
        price: 25,
        previousClose: 24,
        marketTime: '2026-03-21T12:00:00.000Z',
        dayChange: { amount: 1, percent: 4.16, direction: 'UP' },
        periodChanges: [],
        latestDividend: null,
        currencyValues: {
          usdBrlRate: null,
          price: { brl: 25, usd: 4.5 },
          previousClose: { brl: 24, usd: 4.32 },
          latestDividend: null,
        },
        priceRange: { high52w: 30, low52w: 18 },
      },
    ]);
    prismaMock.wallet.findUnique.mockResolvedValue({
      id: 1,
      user_id: 7,
      type: 'INVESTMENT',
      actual_cash: new Decimal(1000),
      name: 'Corretora XP',
    });
    prismaMock.investmentOperation.findMany.mockResolvedValue([
      {
        id: 10,
        type: 'BUY',
        symbol: 'PETR4',
        market: 'BR',
        asset_type: 'LISTED',
        currency: 'BRL',
        quantity: new Decimal(1),
        unit_price: new Decimal(20),
        gross_amount: new Decimal(20),
        gross_amount_brl: new Decimal(20),
        fx_rate: null,
        cdb_cdi_percentage: null,
        cdb_cdi_rate: null,
        transaction_date: new Date('2026-03-20T12:00:00.000Z'),
        source_event_key: null,
        notes: null,
        created_at: new Date('2026-03-20T12:00:00.000Z'),
      },
    ]);

    await expect(
      service.createOperation(7, {
        wallet_id: 1,
        operation_type: 'SELL',
        symbol: 'PETR4',
        market: 'BR',
        transaction_date: '2026-03-21T12:00:00.000Z',
        quantity: 2,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should not duplicate an automatic BR dividend when the provider event key already exists', async () => {
    prismaMock.investmentPosition.findMany
      .mockResolvedValueOnce([
        {
          wallet_id: 1,
          symbol: 'PETR4',
          market: 'BR',
        },
      ])
      .mockResolvedValueOnce([]);
    prismaMock.wallet.findUnique.mockResolvedValue({
      id: 1,
      user_id: 7,
      type: 'INVESTMENT',
      actual_cash: new Decimal(400),
      name: 'Corretora XP',
    });
    prismaMock.wallet.findMany.mockResolvedValue([
      {
        id: 1,
        name: 'Corretora XP',
        type: 'INVESTMENT',
        actual_cash: new Decimal(400),
      },
    ]);
    prismaMock.investmentOperation.findMany.mockResolvedValue([
      {
        id: 99,
        type: 'DIVIDEND',
        symbol: 'PETR4',
        market: 'BR',
        asset_type: 'LISTED',
        currency: 'BRL',
        quantity: null,
        unit_price: null,
        gross_amount: new Decimal('2.964'),
        gross_amount_brl: new Decimal('2.96'),
        fx_rate: null,
        cdb_cdi_percentage: null,
        cdb_cdi_rate: null,
        transaction_date: new Date('2026-03-20T20:00:00.000Z'),
        source_event_key: '1:PETR4:DIVIDEND:2026-03-20T20:00:00.000Z:0.296400',
        notes: null,
        created_at: new Date('2026-03-20T20:00:00.000Z'),
      },
    ]);
    marketDataMock.getDividendEvents.mockResolvedValue([
      {
        amount: 0.2964,
        date: '2026-03-20T20:00:00.000Z',
        type: 'DIVIDEND',
      },
    ]);

    const result = await service.getPortfolio(7);

    expect(result.summary.totalWallets).toBe(1);
    expect(txMock.investmentOperation.create).not.toHaveBeenCalled();
  });

  it('should create a CDB buy operation without requiring a market quote', async () => {
    prismaMock.wallet.findUnique.mockResolvedValue({
      id: 1,
      user_id: 7,
      type: 'INVESTMENT',
      actual_cash: new Decimal(5000),
      name: 'Banco',
    });
    prismaMock.investmentOperation.findMany.mockResolvedValue([]);
    txMock.investmentOperation.create.mockResolvedValue({
      id: 21,
      wallet_id: 1,
      type: 'BUY',
      symbol: 'CDB NUBANK 120% CDI',
      market: 'BR',
      asset_type: 'CDB',
      currency: 'BRL',
      quantity: new Decimal(1000),
      unit_price: new Decimal(1),
      gross_amount: new Decimal(1000),
      gross_amount_brl: new Decimal(1000),
      fx_rate: null,
      cdb_cdi_percentage: new Decimal(120),
      cdb_cdi_rate: new Decimal(10.5),
      transaction_date: new Date('2026-03-21T12:00:00.000Z'),
      source_event_key: null,
      notes: null,
      created_at: new Date('2026-03-21T12:00:00.000Z'),
    });
    txMock.investmentOperation.findMany.mockResolvedValue([
      {
        id: 21,
        wallet_id: 1,
        type: 'BUY',
        symbol: 'CDB NUBANK 120% CDI',
        market: 'BR',
        asset_type: 'CDB',
        currency: 'BRL',
        quantity: new Decimal(1000),
        unit_price: new Decimal(1),
        gross_amount: new Decimal(1000),
        gross_amount_brl: new Decimal(1000),
        fx_rate: null,
        cdb_cdi_percentage: new Decimal(120),
        cdb_cdi_rate: new Decimal(10.5),
        transaction_date: new Date('2026-03-21T12:00:00.000Z'),
        source_event_key: null,
        notes: null,
        created_at: new Date('2026-03-21T12:00:00.000Z'),
      },
    ]);
    txMock.investmentPosition.upsert.mockResolvedValue({ id: 8 });

    await expect(
      service.createOperation(7, {
        wallet_id: 1,
        operation_type: 'BUY',
        asset_type: 'CDB',
        symbol: 'CDB Nubank 120% CDI',
        market: 'BR',
        transaction_date: '2026-03-21T12:00:00.000Z',
        gross_amount: 1000,
        cdb_cdi_percentage: 120,
        cdb_cdi_rate: 10.5,
      }),
    ).resolves.toEqual({
      operationId: 21,
      walletId: 1,
      symbol: 'CDB NUBANK 120% CDI',
      market: 'BR',
    });

    expect(marketDataMock.getMany).not.toHaveBeenCalled();
    expect(marketDataMock.getDividendEvents).not.toHaveBeenCalled();
    expect(prismaMock.investmentOperation.findMany).toHaveBeenCalledWith({
      where: {
        wallet_id: 1,
        symbol: 'CDB NUBANK 120% CDI',
        market: 'BR',
        asset_type: 'CDB',
      },
      orderBy: [{ transaction_date: 'asc' }, { id: 'asc' }],
    });
    expect(txMock.investmentOperation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          asset_type: 'CDB',
          quantity: new Decimal(1000),
          unit_price: new Decimal(1),
          cdb_cdi_percentage: new Decimal(120),
          cdb_cdi_rate: new Decimal(10.5),
        }),
      }),
    );
  });

  it('should use the latest CDI indicator when a CDB buy omits the annual CDI rate', async () => {
    prismaMock.economicIndicator.findFirst.mockResolvedValue({
      current_rate: new Decimal('11.25'),
    });
    prismaMock.wallet.findUnique.mockResolvedValue({
      id: 1,
      user_id: 7,
      type: 'INVESTMENT',
      actual_cash: new Decimal(5000),
      name: 'Banco',
    });
    prismaMock.investmentOperation.findMany.mockResolvedValue([]);
    txMock.investmentOperation.create.mockResolvedValue({
      id: 31,
      wallet_id: 1,
      type: 'BUY',
      symbol: 'CDB INTER 110% CDI',
      market: 'BR',
      asset_type: 'CDB',
      currency: 'BRL',
      quantity: new Decimal(1500),
      unit_price: new Decimal(1),
      gross_amount: new Decimal(1500),
      gross_amount_brl: new Decimal(1500),
      fx_rate: null,
      cdb_cdi_percentage: new Decimal(110),
      cdb_cdi_rate: new Decimal('11.25'),
      transaction_date: new Date('2026-03-21T12:00:00.000Z'),
      source_event_key: null,
      notes: null,
      created_at: new Date('2026-03-21T12:00:00.000Z'),
    });
    txMock.investmentOperation.findMany.mockResolvedValue([
      {
        id: 31,
        wallet_id: 1,
        type: 'BUY',
        symbol: 'CDB INTER 110% CDI',
        market: 'BR',
        asset_type: 'CDB',
        currency: 'BRL',
        quantity: new Decimal(1500),
        unit_price: new Decimal(1),
        gross_amount: new Decimal(1500),
        gross_amount_brl: new Decimal(1500),
        fx_rate: null,
        cdb_cdi_percentage: new Decimal(110),
        cdb_cdi_rate: new Decimal('11.25'),
        transaction_date: new Date('2026-03-21T12:00:00.000Z'),
        source_event_key: null,
        notes: null,
        created_at: new Date('2026-03-21T12:00:00.000Z'),
      },
    ]);
    txMock.investmentPosition.upsert.mockResolvedValue({ id: 10 });

    await expect(
      service.createOperation(7, {
        wallet_id: 1,
        operation_type: 'BUY',
        asset_type: 'CDB',
        symbol: 'CDB Inter 110% CDI',
        market: 'BR',
        transaction_date: '2026-03-21T12:00:00.000Z',
        gross_amount: 1500,
        cdb_cdi_percentage: 110,
      }),
    ).resolves.toEqual({
      operationId: 31,
      walletId: 1,
      symbol: 'CDB INTER 110% CDI',
      market: 'BR',
    });

    expect(prismaMock.economicIndicator.findFirst).toHaveBeenCalledWith({
      where: {
        name: {
          contains: 'CDI',
          mode: 'insensitive',
        },
      },
      orderBy: [{ last_update: 'desc' }, { id: 'desc' }],
      select: {
        current_rate: true,
      },
    });
    expect(txMock.investmentOperation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          cdb_cdi_rate: new Decimal('11.25'),
        }),
      }),
    );
  });

  it('should create a CDB redemption and reduce the remaining principal', async () => {
    prismaMock.wallet.findUnique.mockResolvedValue({
      id: 1,
      user_id: 7,
      type: 'INVESTMENT',
      actual_cash: new Decimal(500),
      name: 'Banco',
    });
    prismaMock.investmentOperation.findMany.mockResolvedValue([
      {
        id: 21,
        wallet_id: 1,
        type: 'BUY',
        symbol: 'CDB NUBANK 120% CDI',
        market: 'BR',
        asset_type: 'CDB',
        currency: 'BRL',
        quantity: new Decimal(1000),
        unit_price: new Decimal(1),
        gross_amount: new Decimal(1000),
        gross_amount_brl: new Decimal(1000),
        fx_rate: null,
        cdb_cdi_percentage: new Decimal(120),
        cdb_cdi_rate: new Decimal(10.5),
        transaction_date: new Date('2026-03-21T12:00:00.000Z'),
        source_event_key: null,
        notes: null,
        created_at: new Date('2026-03-21T12:00:00.000Z'),
      },
    ]);
    txMock.investmentOperation.create.mockResolvedValue({
      id: 22,
      wallet_id: 1,
      type: 'SELL',
      symbol: 'CDB NUBANK 120% CDI',
      market: 'BR',
      asset_type: 'CDB',
      currency: 'BRL',
      quantity: new Decimal(400),
      unit_price: new Decimal(1),
      gross_amount: new Decimal(450),
      gross_amount_brl: new Decimal(450),
      fx_rate: null,
      cdb_cdi_percentage: null,
      cdb_cdi_rate: null,
      transaction_date: new Date('2026-03-28T12:00:00.000Z'),
      source_event_key: null,
      notes: null,
      created_at: new Date('2026-03-28T12:00:00.000Z'),
    });
    txMock.investmentOperation.findMany.mockResolvedValue([
      {
        id: 21,
        wallet_id: 1,
        type: 'BUY',
        symbol: 'CDB NUBANK 120% CDI',
        market: 'BR',
        asset_type: 'CDB',
        currency: 'BRL',
        quantity: new Decimal(1000),
        unit_price: new Decimal(1),
        gross_amount: new Decimal(1000),
        gross_amount_brl: new Decimal(1000),
        fx_rate: null,
        cdb_cdi_percentage: new Decimal(120),
        cdb_cdi_rate: new Decimal(10.5),
        transaction_date: new Date('2026-03-21T12:00:00.000Z'),
        source_event_key: null,
        notes: null,
        created_at: new Date('2026-03-21T12:00:00.000Z'),
      },
      {
        id: 22,
        wallet_id: 1,
        type: 'SELL',
        symbol: 'CDB NUBANK 120% CDI',
        market: 'BR',
        asset_type: 'CDB',
        currency: 'BRL',
        quantity: new Decimal(400),
        unit_price: new Decimal(1),
        gross_amount: new Decimal(450),
        gross_amount_brl: new Decimal(450),
        fx_rate: null,
        cdb_cdi_percentage: null,
        cdb_cdi_rate: null,
        transaction_date: new Date('2026-03-28T12:00:00.000Z'),
        source_event_key: null,
        notes: null,
        created_at: new Date('2026-03-28T12:00:00.000Z'),
      },
    ]);
    txMock.investmentPosition.upsert.mockResolvedValue({ id: 9 });

    await expect(
      service.createOperation(7, {
        wallet_id: 1,
        operation_type: 'SELL',
        asset_type: 'CDB',
        symbol: 'CDB Nubank 120% CDI',
        market: 'BR',
        transaction_date: '2026-03-28T12:00:00.000Z',
        quantity: 400,
        gross_amount: 450,
      }),
    ).resolves.toEqual({
      operationId: 22,
      walletId: 1,
      symbol: 'CDB NUBANK 120% CDI',
      market: 'BR',
    });

    expect(marketDataMock.getMany).not.toHaveBeenCalled();
    expect(txMock.wallet.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        actual_cash: {
          increment: new Decimal(450),
        },
      },
    });
    expect(txMock.investmentPosition.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          wallet_id_symbol_market_asset_type: expect.objectContaining({
            wallet_id: 1,
            symbol: 'CDB NUBANK 120% CDI',
            market: 'BR',
            asset_type: 'CDB',
          }),
        }),
        update: expect.objectContaining({
          quantity: new Decimal(600),
          invested_amount: new Decimal(600),
          invested_amount_brl: new Decimal(600),
          realized_pnl: new Decimal(50),
          realized_pnl_brl: new Decimal(50),
        }),
      }),
    );
    expect(marketDataMock.getDividendEvents).not.toHaveBeenCalled();
    expect(prismaMock.investmentOperation.findMany).toHaveBeenCalledWith({
      where: {
        wallet_id: 1,
        symbol: 'CDB NUBANK 120% CDI',
        market: 'BR',
        asset_type: 'CDB',
      },
      orderBy: [{ transaction_date: 'asc' }, { id: 'asc' }],
    });
  });

  it('should value a CDB position using only the remaining principal after a redemption', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-28T12:00:00.000Z'));

    try {
      prismaMock.investmentPosition.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: 8,
            wallet_id: 1,
            wallet: {
              id: 1,
              name: 'Banco',
              actual_cash: new Decimal(950),
            },
            symbol: 'CDB NUBANK 120% CDI',
            market: 'BR',
            asset_type: 'CDB',
            currency: 'BRL',
            quantity: new Decimal(600),
            average_cost: new Decimal(1),
            invested_amount: new Decimal(600),
            invested_amount_brl: new Decimal(600),
            dividends_received: new Decimal(0),
            dividends_received_brl: new Decimal(0),
            jcp_received: new Decimal(0),
            jcp_received_brl: new Decimal(0),
            last_market_price: null,
            last_market_price_brl: null,
            last_market_at: null,
          },
        ]);
      prismaMock.wallet.findMany.mockResolvedValue([
        {
          id: 1,
          name: 'Banco',
          type: 'INVESTMENT',
          actual_cash: new Decimal(950),
        },
      ]);
      prismaMock.investmentOperation.findMany.mockResolvedValue([
        {
          id: 21,
          wallet_id: 1,
          type: 'BUY',
          symbol: 'CDB NUBANK 120% CDI',
          market: 'BR',
          asset_type: 'CDB',
          currency: 'BRL',
          quantity: new Decimal(1000),
          unit_price: new Decimal(1),
          gross_amount: new Decimal(1000),
          gross_amount_brl: new Decimal(1000),
          fx_rate: null,
          cdb_cdi_percentage: new Decimal(120),
          cdb_cdi_rate: new Decimal(10),
          transaction_date: new Date('2026-03-01T12:00:00.000Z'),
          source_event_key: null,
          notes: null,
          created_at: new Date('2026-03-01T12:00:00.000Z'),
        },
        {
          id: 22,
          wallet_id: 1,
          type: 'SELL',
          symbol: 'CDB NUBANK 120% CDI',
          market: 'BR',
          asset_type: 'CDB',
          currency: 'BRL',
          quantity: new Decimal(400),
          unit_price: new Decimal(1),
          gross_amount: new Decimal(430),
          gross_amount_brl: new Decimal(430),
          fx_rate: null,
          cdb_cdi_percentage: null,
          cdb_cdi_rate: null,
          transaction_date: new Date('2026-03-20T12:00:00.000Z'),
          source_event_key: null,
          notes: null,
          created_at: new Date('2026-03-20T12:00:00.000Z'),
        },
      ]);

      const portfolio = await service.getPortfolio(7);
      const expectedBusinessDays = 20;
      const expectedCurrentValue = Number(
        (600 * Math.pow(1.12, expectedBusinessDays / 252)).toFixed(2),
      );

      expect(portfolio.positions).toHaveLength(1);
      expect(portfolio.positions[0]).toEqual(
        expect.objectContaining({
          assetType: 'CDB',
          quantity: 600,
          investedAmountBrl: 600,
          currentValueBrl: expectedCurrentValue,
          cdbCdiPercentage: 120,
          cdbCdiRate: 10,
        }),
      );
      expect(marketDataMock.getDividendEvents).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});
