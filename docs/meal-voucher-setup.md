# Vale-refeição / Vale-alimentação (Flash, VR, VA)

Cards de VR/VA são pré-pagos: aparecem como `payment_method=CREDIT` mas
debitam imediatamente no saldo. O backend trata isso automaticamente
quando a `Wallet` tem `type: "MEAL_VOUCHER"`.

A regra única vive em
[`backend/src/common/finance-constants.ts`](../backend/src/common/finance-constants.ts):

```ts
isImmediateDebit(paymentMethod, walletType)
// → true se walletType === MEAL_VOUCHER
// → true se paymentMethod !== CREDIT
// → caso contrário, false (saldo só será impactado na fatura)
```

## Setup inicial (1x)

1. Crie uma Wallet do tipo `MEAL_VOUCHER` para o Flash:

   ```http
   POST /wallets
   { "name": "Flash", "type": "MEAL_VOUCHER", "actual_cash": 0 }
   ```

2. Anote o `id` retornado (`<flashWalletId>`).

## Automatizar a recarga mensal do dia 30

Em vez de criar uma transação manualmente todo mês, registre **uma única
Subscription** mensal de INCOME. O engine de subscriptions vai gerar a
transação automaticamente todo dia 30 e creditar no saldo.

```http
POST /subscriptions
{
  "name": "Recarga Flash",
  "value": 800,                       // valor padrão; ajuste mensalmente se variar
  "transaction_type": "INCOME",
  "frequency": "MONTHLY",
  "wallet_id": <flashWalletId>,
  "category_id": <categoria "Salário/Benefício">,
  "start_date": "2026-06-30"
}
```

Se o valor de um mês específico for diferente (varia com dias úteis), edite
o `value` antes do dia 30 ou edite a transação gerada depois de criada.

## Como compras com o Flash funcionam

- Use `payment_method: "CREDIT"` (o app/extrato sempre marca assim).
- Selecione a Wallet do Flash.
- O backend reconhece pelo `wallet.type === "MEAL_VOUCHER"` e debita
  imediatamente — sem precisar de campo extra ou validação de limite de
  cartão.
