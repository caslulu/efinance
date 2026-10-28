/**
 * One-off post-migration backfill for the dindin data.
 *
 * Run AFTER the database has the new Transaction columns
 * (installment_group_id, recurrence_id, financial_event_id, event_type)
 * and with a Prisma client generated from the current schema.
 *
 * What it does:
 * - backfills event_type on historical rows;
 * - pairs the 15 historical invoice payments with the card-side credits;
 * - groups the 120 future income rows with recurrence_id;
 * - materializes 13 months of recurring expense transactions for every active
 *   subscription. The subscription scheduler was changed to skip cycles that
 *   already have a transaction, so these forecasts are not duplicated.
 *
 * The script is idempotent and can be run again.
 */
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const USERNAME = 'lucasbatistasuarte';
const HORIZON = new Date('2027-11-30T23:59:59.999Z');
const MONTHS_AHEAD = 13;

function sha1(value) {
  return crypto.createHash('sha1').update(String(value)).digest('hex');
}

function slug(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function isoDate(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function addMonthsSafe(date, months) {
  const result = new Date(date);
  const targetDay = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDay = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0,
  ).getDate();
  result.setDate(Math.min(targetDay, lastDay));
  return result;
}

function advance(date, frequency) {
  switch (frequency) {
    case 'WEEKLY': {
      const next = new Date(date);
      next.setDate(next.getDate() + 7);
      return next;
    }
    case 'MONTHLY':
      return addMonthsSafe(date, 1);
    case 'QUARTERLY':
      return addMonthsSafe(date, 3);
    case 'YEARLY': {
      const next = new Date(date);
      next.setFullYear(next.getFullYear() + 1);
      return next;
    }
    default:
      return new Date(date);
  }
}

async function main() {
  const user = await prisma.user.findFirst({ where: { username: USERNAME } });
  if (!user) throw new Error(`Usuário ${USERNAME} não encontrado.`);

  const categories = await prisma.transactionCategory.findMany({
    where: { user_id: user.id },
    select: { id: true, name: true },
  });
  const categoryIdByName = new Map(categories.map((c) => [c.name, c.id]));

  const result = await prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(728394652)');

      const eventTypeUpdates = [];
      const applyEventType = async (eventType, where) => {
        const updated = await tx.transaction.updateMany({
          where: { wallet: { user_id: user.id }, event_type: null, ...where },
          data: { event_type: eventType },
        });
        eventTypeUpdates.push({ eventType, count: updated.count });
      };

      await applyEventType('INVOICE_PAYMENT', {
        description: { startsWith: 'Pagamento de fatura' },
      });
      await applyEventType('INVOICE_PAYMENT', {
        description: { startsWith: 'Pagamento recebido' },
      });
      await applyEventType('THIRD_PARTY', {
        category_id: categoryIdByName.get('Terceiros - Pai'),
      });
      await applyEventType('RESALE', {
        category_id: categoryIdByName.get('Revenda'),
      });
      await applyEventType('REIMBURSEMENT', {
        description: { startsWith: 'Reembolso Van' },
      });
      await applyEventType('REIMBURSEMENT', {
        category_id: categoryIdByName.get('Família e amigos'),
      });
      await applyEventType('REFUND', {
        category_id: categoryIdByName.get('Reembolsos e estornos'),
      });
      await applyEventType('BENEFIT', {
        category_id: categoryIdByName.get('Benefícios (VA/Flash)'),
      });
      await applyEventType('FEE', {
        description: { startsWith: 'Nubank Ultravioleta' },
      });
      await applyEventType('TRAVEL', {
        OR: [
          { category_id: categoryIdByName.get('Viagem') },
          { category_id: categoryIdByName.get('Viagem - Chile') },
        ],
      });

      // Pair the 15 account invoice payments with the card-side credits.
      const accountInvoices = await tx.transaction.findMany({
        where: {
          wallet: { user_id: user.id },
          description: { startsWith: 'Pagamento de fatura' },
        },
        select: { id: true, transaction_date: true, value: true },
      });
      const cardPayments = await tx.transaction.findMany({
        where: {
          wallet: { user_id: user.id },
          description: { startsWith: 'Pagamento recebido' },
        },
        select: { id: true, transaction_date: true, value: true },
      });
      const cardPaymentsByKey = new Map();
      for (const payment of cardPayments) {
        const key = `${isoDate(payment.transaction_date)}|${Number(payment.value).toFixed(2)}`;
        if (!cardPaymentsByKey.has(key)) cardPaymentsByKey.set(key, []);
        cardPaymentsByKey.get(key).push(payment);
      }
      let pairedInvoices = 0;
      for (const invoice of accountInvoices) {
        const key = `${isoDate(invoice.transaction_date)}|${Number(invoice.value).toFixed(2)}`;
        const candidates = cardPaymentsByKey.get(key) || [];
        const cardPayment = candidates.shift();
        if (!cardPayment) {
          await tx.transaction.update({
            where: { id: invoice.id },
            data: { financial_event_id: `seed:invoice-account:${invoice.id}` },
          });
          continue;
        }
        const eventId = `seed:invoice:${sha1(key)}`;
        await tx.transaction.update({
          where: { id: invoice.id },
          data: { financial_event_id: eventId },
        });
        await tx.transaction.update({
          where: { id: cardPayment.id },
          data: { financial_event_id: eventId },
        });
        pairedInvoices++;
      }
      let unmatchedCardPayments = 0;
      for (const candidates of cardPaymentsByKey.values()) {
        for (const payment of candidates) {
          await tx.transaction.update({
            where: { id: payment.id },
            data: { financial_event_id: `seed:prewindow:${payment.id}` },
          });
          unmatchedCardPayments++;
        }
      }

      // Group the 120 finite future income rows into recurrence series.
      const futureIncomes = await tx.transaction.findMany({
        where: {
          wallet: { user_id: user.id },
          transaction_type: 'INCOME',
          is_processed: false,
          card_id: null,
          recurrence_id: null,
        },
        select: { id: true, description: true },
      });
      let futureIncomeGroups = 0;
      for (const transaction of futureIncomes) {
        const prefix = String(transaction.description || '')
          .split(' - previsto ')[0]
          .trim();
        if (!prefix) continue;
        await tx.transaction.update({
          where: { id: transaction.id },
          data: { recurrence_id: `seed-future:${slug(prefix)}` },
        });
        futureIncomeGroups++;
      }

      // Materialize recurring expenses from the active subscriptions.
      const subscriptions = await tx.subscription.findMany({
        where: { user_id: user.id, status: 'ACTIVE' },
        orderBy: { id: 'asc' },
      });
      const created = [];
      const skipped = [];
      for (const subscription of subscriptions) {
        const targetCount =
          subscription.frequency === 'YEARLY' ? 1 : MONTHS_AHEAD;
        let date = new Date(subscription.next_billing_date);
        for (let index = 0; index < targetCount; index++) {
          if (date > HORIZON) break;
          const existing = await tx.transaction.findFirst({
            where: {
              subscription_id: subscription.id,
              transaction_date: date,
            },
            select: { id: true },
          });
          if (existing) {
            skipped.push({
              subscription: subscription.name,
              date: isoDate(date),
              transactionId: existing.id,
            });
            date = advance(date, subscription.frequency);
            continue;
          }
          const iso = isoDate(date);
          const transaction = await tx.transaction.create({
            data: {
              transaction_date: date,
              wallet_id: subscription.wallet_id,
              card_id: subscription.card_id,
              transaction_type: subscription.transaction_type,
              payment_method: subscription.payment_method,
              description: `${subscription.name} - previsto ${iso.slice(0, 7)}`,
              is_recurring: true,
              value: subscription.value,
              category_id: subscription.category_id,
              installment_group_id: null,
              recurrence_id: `seed-sub:${subscription.id}`,
              installment_total: null,
              installment_number: null,
              is_processed: false,
              subscription_id: subscription.id,
              financial_event_id: `seed-sub:${subscription.id}:${iso}`,
              event_type: null,
            },
            select: { id: true },
          });
          created.push({
            subscription: subscription.name,
            date: iso,
            transactionId: transaction.id,
            value: Number(subscription.value),
          });
          date = advance(date, subscription.frequency);
        }
      }

      const totalTransactions = await tx.transaction.count();
      const totalFuture = await tx.transaction.count({
        where: { transaction_type: 'EXPENSE', is_processed: false },
      });
      return {
        user: { id: user.id, username: user.username },
        eventTypeUpdates,
        invoices: {
          accountRows: accountInvoices.length,
          cardRows: cardPayments.length,
          pairedInvoices,
          unmatchedCardPayments,
        },
        futureIncomes: {
          rows: futureIncomes.length,
          grouped: futureIncomeGroups,
        },
        recurringExpenses: {
          subscriptions: subscriptions.length,
          created: created.length,
          skipped: skipped.length,
          createdRows: created,
          skippedRows: skipped,
        },
        totalTransactions,
        totalFutureExpenses: totalFuture,
      };
    },
    { timeout: 300000, isolationLevel: 'Serializable' },
  );

  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error('Falha no pós-migração:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
