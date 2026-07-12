import { BadRequestException } from '@nestjs/common';
import { CardsService } from './cards.service';

const prisma = {
  $transaction: jest.fn(),
  card: { findUnique: jest.fn() },
  wallet: {
    findUnique: jest.fn(),
    updateMany: jest.fn(),
  },
  transaction: {
    aggregate: jest.fn(),
    create: jest.fn(),
  },
  transactionCategory: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
};

describe('CardsService invoice payment', () => {
  let service: CardsService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((callback) => callback(prisma));
    service = new CardsService(prisma as never);
    prisma.card.findUnique.mockResolvedValue({
      id: 10,
      wallet_id: 2,
      wallet: { id: 2, user_id: 1, type: 'BANK' },
    });
    prisma.wallet.findUnique.mockResolvedValue({
      id: 1,
      user_id: 1,
      actual_cash: 500,
    });
    prisma.wallet.updateMany.mockResolvedValue({ count: 1 });
    prisma.transaction.aggregate
      .mockResolvedValueOnce({ _sum: { value: 300 } })
      .mockResolvedValueOnce({ _sum: { value: 50 } });
    prisma.transactionCategory.findFirst.mockResolvedValue({ id: 5 });
    prisma.transaction.create
      .mockResolvedValueOnce({ id: 100 })
      .mockResolvedValueOnce({ id: 101 });
  });

  it('debits the source wallet and creates both linked entries atomically', async () => {
    const result = await service.payInvoice(10, 1, {
      sourceWalletId: 1,
      amount: 200,
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.wallet.updateMany).toHaveBeenCalledWith({
      where: { id: 1, user_id: 1, actual_cash: { gte: 200 } },
      data: { actual_cash: { decrement: 200 } },
    });
    expect(prisma.transaction.create).toHaveBeenCalledTimes(2);
    const expense = prisma.transaction.create.mock.calls[0][0].data;
    const settlement = prisma.transaction.create.mock.calls[1][0].data;
    expect(expense.financial_event_id).toBeTruthy();
    expect(settlement.financial_event_id).toBe(expense.financial_event_id);
    expect(result).toMatchObject({
      amount: 200,
      financial_event_id: expense.financial_event_id,
    });
  });

  it('rejects a payment greater than the outstanding invoice', async () => {
    await expect(
      service.payInvoice(10, 1, { sourceWalletId: 1, amount: 300 }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.wallet.updateMany).not.toHaveBeenCalled();
    expect(prisma.transaction.create).not.toHaveBeenCalled();
  });

  it('propagates a second-entry failure so Prisma rolls the operation back', async () => {
    prisma.transaction.create
      .mockReset()
      .mockResolvedValueOnce({ id: 100 })
      .mockRejectedValueOnce(new Error('database failure'));

    await expect(
      service.payInvoice(10, 1, { sourceWalletId: 1, amount: 200 }),
    ).rejects.toThrow('database failure');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
