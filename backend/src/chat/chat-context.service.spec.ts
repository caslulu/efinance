import { ChatContextService } from './chat-context.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ChatContextService', () => {
  it('builds spending context using only the retained financial modules', async () => {
    const expense = {
      description: 'Mercado',
      value: 120,
      transaction_date: new Date('2026-10-01T12:00:00Z'),
      TransactionCategory: { name: 'Alimentação' },
      wallet: { name: 'Conta principal' },
    };
    // No investment or wishlist clients: the assistant must work independently.
    const prisma = {
      wallet: {
        findMany: jest.fn().mockResolvedValue([
          { name: 'Conta principal', actual_cash: 800, type: 'BANK' },
        ]),
      },
      transaction: {
        findMany: jest.fn().mockImplementation(({ where }) =>
          Promise.resolve(where.transaction_type === 'EXPENSE' ? [expense] : []),
        ),
        aggregate: jest.fn().mockImplementation(({ where }) =>
          Promise.resolve({
            _sum: { value: where.transaction_type === 'EXPENSE' ? 120 : 1000 },
          }),
        ),
      },
      subscription: { findMany: jest.fn().mockResolvedValue([]) },
      budget: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new ChatContextService(prisma as unknown as PrismaService);

    const context = await service.buildFinancialContext(7);

    expect(context).toContain('Dinheiro em Carteiras: R$ 800.00');
    expect(context).toContain('Despesas do Mês: R$ 120.00');
    expect(context).toContain('Receitas do Mês: R$ 1000.00');
    expect(context).toContain('Alimentação: R$ 120.00');
    expect(context).toContain('Mercado');
    expect(prisma.wallet.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { user_id: 7 } }),
    );
  });
});
