export function excludeInternalCashflowFilter() {
  return {
    NOT: [
      { payment_method: 'TRANSFER' as const },
      { payment_method: 'INVESTMENT' as const },
      { event_type: 'INVOICE_PAYMENT' },
    ],
  };
}
