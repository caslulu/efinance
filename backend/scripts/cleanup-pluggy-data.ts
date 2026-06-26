import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type Args = {
  confirm: boolean;
  userEmail?: string;
  userId?: number;
};

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const parsed: Args = { confirm: false };

  for (const arg of args) {
    if (arg === '--confirm') {
      parsed.confirm = true;
      continue;
    }
    if (arg.startsWith('--user-email=')) {
      parsed.userEmail = arg.slice('--user-email='.length).trim();
      continue;
    }
    if (arg.startsWith('--user-id=')) {
      const userId = Number(arg.slice('--user-id='.length));
      if (!Number.isInteger(userId) || userId <= 0) {
        throw new Error('--user-id must be a positive integer');
      }
      parsed.userId = userId;
    }
  }

  return parsed;
}

async function resolveUser(args: Args) {
  if (args.userId) {
    const user = await prisma.user.findUnique({ where: { id: args.userId } });
    if (!user) throw new Error(`User #${args.userId} not found`);
    return user;
  }

  if (args.userEmail) {
    const user = await prisma.user.findUnique({
      where: { email: args.userEmail },
    });
    if (!user) throw new Error(`User ${args.userEmail} not found`);
    return user;
  }

  const users = await prisma.user.findMany({
    orderBy: { id: 'asc' },
    take: 2,
  });

  if (users.length === 1) return users[0];

  throw new Error(
    'Multiple users found. Pass --user-email=email@example.com or --user-id=1',
  );
}

function pluggyTransactionWhere(userId: number) {
  return {
    wallet: { user_id: userId },
    OR: [
      { external_source: { startsWith: 'pluggy:' } },
      { external_id: { startsWith: 'pluggy:' } },
      { wallet: { pluggy_account_id: { not: null } } },
      { wallet: { pluggy_item_id: { not: null } } },
      { card: { external_source: { startsWith: 'pluggy:' } } },
      { card: { pluggy_account_id: { not: null } } },
    ],
  };
}

function pluggyCardWhere(userId: number) {
  return {
    wallet: { user_id: userId },
    OR: [
      { external_source: { startsWith: 'pluggy:' } },
      { external_id: { startsWith: 'pluggy:' } },
      { pluggy_account_id: { not: null } },
      { pluggy_card_number: { not: null } },
    ],
  };
}

function pluggyWalletWhere(userId: number) {
  return {
    user_id: userId,
    OR: [
      { external_source: { startsWith: 'pluggy:' } },
      { pluggy_account_id: { not: null } },
      { pluggy_item_id: { not: null } },
    ],
  };
}

async function main() {
  const args = parseArgs();
  const user = await resolveUser(args);
  const userId = user.id;

  const [transactions, cards, wallets, pluggyEnabled] = await Promise.all([
    prisma.transaction.count({ where: pluggyTransactionWhere(userId) }),
    prisma.card.count({ where: pluggyCardWhere(userId) }),
    prisma.wallet.count({ where: pluggyWalletWhere(userId) }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { pluggy_enabled: true },
    }),
  ]);

  console.log(`User: ${user.email} (#${user.id})`);
  console.log(`Pluggy enabled flag: ${pluggyEnabled?.pluggy_enabled ?? false}`);
  console.log(`Pluggy transactions to remove: ${transactions}`);
  console.log(`Pluggy cards to remove: ${cards}`);
  console.log(`Pluggy wallets to remove: ${wallets}`);

  if (!args.confirm) {
    console.log('');
    console.log('Dry run only. Re-run with --confirm to delete these records.');
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { pluggy_enabled: false },
    });

    const deletedTransactions = await tx.transaction.deleteMany({
      where: pluggyTransactionWhere(userId),
    });

    const deletedCards = await tx.card.deleteMany({
      where: pluggyCardWhere(userId),
    });

    const deletedWallets = await tx.wallet.deleteMany({
      where: pluggyWalletWhere(userId),
    });

    return {
      transactions: deletedTransactions.count,
      cards: deletedCards.count,
      wallets: deletedWallets.count,
    };
  });

  console.log('');
  console.log('Pluggy cleanup complete.');
  console.log(`Deleted transactions: ${result.transactions}`);
  console.log(`Deleted cards: ${result.cards}`);
  console.log(`Deleted wallets: ${result.wallets}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
