export const WALLET_TYPES = {
  BANK_ACCOUNT: 'Conta Bancária',
  PHYSICAL: 'Dinheiro Físico',
  MEAL_VOUCHER: 'Vale Refeição',
  INVESTMENT: 'Investimento',
  OTHER: 'Outro'
};

export const PAYMENT_METHODS = {
  CREDIT: 'Crédito',
  DEBIT: 'Débito',
  PIX: 'Pix',
  MONEY: 'Dinheiro',
  TRANSFER: 'Transferência',
  DEPOSIT: 'Depósito'
};

// Maps Wallet Type Name -> Array of Payment Method Keys
export const ALLOWED_METHODS: Record<string, string[]> = {
  [WALLET_TYPES.BANK_ACCOUNT]: ['CREDIT', 'DEBIT', 'PIX', 'TRANSFER'],
  [WALLET_TYPES.PHYSICAL]: ['MONEY'],
  [WALLET_TYPES.MEAL_VOUCHER]: ['CREDIT'],
  [WALLET_TYPES.INVESTMENT]: ['DEPOSIT', 'TRANSFER'],
  [WALLET_TYPES.OTHER]: ['MONEY', 'TRANSFER']
};
