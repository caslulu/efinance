/**
 * Filters out transactions that are not part of the user's personal cashflow.
 *
 * Nullable columns need explicit `OR ... IS NULL` branches: Prisma translates
 * `NOT (column IN (...))` to SQL where NULL rows do not match, which would
 * silently remove transactions without a payment method or event type.
 */
export function excludeInternalCashflowFilter() {
  return {
    AND: [
      {
        OR: [
          { payment_method: null },
          { payment_method: { notIn: ['TRANSFER', 'INVESTMENT'] } },
        ],
      },
      {
        OR: [
          { event_type: null },
          {
            event_type: {
              notIn: ['INVOICE_PAYMENT', 'THIRD_PARTY', 'RESALE'],
            },
          },
        ],
      },
    ],
  };
}
