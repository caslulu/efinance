/**
 * Pluggy smoke test — fetch last transactions from the configured itemId
 *
 * Run:
 *   PLUGGY_CLIENT_ID=... PLUGGY_CLIENT_SECRET=... PLUGGY_NUBANK_ITEM_ID=... \
 *     npx ts-node scripts/pluggy-smoke-test.ts
 */
import { PluggyClient } from 'pluggy-sdk';

async function main() {
  const clientId = process.env.PLUGGY_CLIENT_ID;
  const clientSecret = process.env.PLUGGY_CLIENT_SECRET;
  const itemId = process.env.PLUGGY_NUBANK_ITEM_ID;

  if (!clientId || !clientSecret || !itemId) {
    console.error(
      'Missing env vars. Required: PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET, PLUGGY_NUBANK_ITEM_ID',
    );
    process.exit(1);
  }

  const client = new PluggyClient({ clientId, clientSecret });

  console.log('→ Fetching item info...');
  const item = await client.fetchItem(itemId);
  console.log('Item status:', item.status);
  console.log('Connector:', item.connector?.name);
  console.log('Last updated:', item.lastUpdatedAt);
  console.log('');

  console.log('→ Fetching accounts...');
  const accounts = await client.fetchAccounts(itemId);
  console.log(`Found ${accounts.results.length} account(s):`);
  for (const acc of accounts.results) {
    console.log(
      `  - [${acc.type}] ${acc.name} | balance: ${acc.balance} ${acc.currencyCode} | id: ${acc.id}`,
    );
  }
  console.log('');

  console.log('→ Fetching last 10 transactions across all accounts...');
  for (const acc of accounts.results) {
    const txs = await client.fetchTransactionsCursor(acc.id);
    const slice = txs.results.slice(0, 10);
    console.log(`\nAccount ${acc.name} — ${slice.length} of ${txs.results.length} transactions shown:`);
    for (const tx of slice) {
      console.log(
        `  ${tx.date.toString().slice(0, 10)} | ${tx.amount.toString().padStart(10)} ${tx.currencyCode} | ${tx.description?.slice(0, 50)}`,
      );
    }
  }

  console.log('\n✓ Smoke test complete');
}

main().catch((err) => {
  console.error('✗ Smoke test failed:', err);
  process.exit(1);
});
