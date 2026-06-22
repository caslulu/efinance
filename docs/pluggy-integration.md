# Pluggy Integration — Implementation Context

This document is the starting context for implementing automatic Nubank transaction sync via Pluggy (Open Finance Brasil) in the financeApp backend.

## Goal

Eliminate manual transaction entry by importing transactions automatically from Nubank using Pluggy's Open Finance integration. Single user (the app owner), single bank (Nubank), personal/non-commercial use.

## Why Pluggy (not pynubank, not OFX import)

- **pynubank**: discontinued/archived in 2023. Not viable.
- **OFX import**: planned as Phase 2 fallback. Lower setup cost but requires manual export ~1x/week.
- **Pluggy**: official Open Finance Brasil. No ToS gray area. Free for personal/non-commercial use via `meu.pluggy.ai`. Mature TypeScript SDK that fits the existing NestJS + TS stack.

## Architecture

`meu-pluggy` (the consumer-side hosted app at `meu.pluggy.ai`) is where **consent** lives. The financeApp backend is the **data consumer** registered in Pluggy Dashboard. The flow:

```
[User: lucas]                                  [financeApp NestJS backend]
     │
     │  1. Signs up at meu.pluggy.ai
     │  2. Connects Nubank via Open Finance
     │     (consent valid 12 months, renewable)
     │
     │  3. Authorizes financeApp (OAuth) to read
     │     data from his meu.pluggy account
     │                                              ←  itemId returned
     │
     │                                              4. Backend uses pluggy-node SDK
     │                                                 (clientId + clientSecret)
     │                                                 → fetchTransactions(itemId)
     │
     │                                              5. Pluggy webhook → POST /pluggy/webhook
     │                                                 on new transactions / item updates
     │                                                 → dedup → insert into Transaction table
```

## Tech stack confirmation

- **SDK**: `pluggy-node` (TypeScript, official, actively maintained — v0.89.0, 153 releases as of mid-2026).
- **Auth model**: server-side `PLUGGY_CLIENT_ID` + `PLUGGY_CLIENT_SECRET` → backend mints short-lived `connectToken` for frontend widget sessions when needed.
- **Sync model**: webhook-driven (preferred) with periodic reconcile via `@nestjs/schedule` (already in deps) as safety net.

## Setup checklist (manual, one-time)

1. Create account at `https://meu.pluggy.ai` and connect Nubank.
2. Create developer account at `https://dashboard.pluggy.ai`.
3. In the Dashboard, create a Development Application → grab `CLIENT_ID` and `CLIENT_SECRET`.
4. Add `MeuPluggy` as an allowed connector for the application.
5. OAuth flow: authorize the financeApp application to access data from the `meu.pluggy` account → obtain the `itemId` for the Nubank connection.
6. Register webhook URL in Dashboard pointing to the deployed backend (`/pluggy/webhook`). For local dev, use ngrok or similar.

## Env vars to add

```
PLUGGY_CLIENT_ID=
PLUGGY_CLIENT_SECRET=
PLUGGY_WEBHOOK_SECRET=        # for verifying webhook signatures
PLUGGY_NUBANK_ITEM_ID=        # captured after OAuth, stored to avoid re-auth flow per request
```

Store `PLUGGY_NUBANK_ITEM_ID` in env initially (single-user app). If multi-user later, move to a `BankConnection` table keyed by `user_id`.

## Backend module shape (proposed)

New module: `backend/src/integrations/pluggy/`

```
pluggy/
  pluggy.module.ts
  pluggy.service.ts          # wraps PluggyClient, fetchAccounts, fetchAllTransactions
  pluggy.controller.ts       # POST /pluggy/webhook
  pluggy.scheduler.ts        # daily reconcile job (fallback to webhook)
  dto/
    pluggy-webhook.dto.ts
  mappers/
    transaction.mapper.ts    # Pluggy Transaction → app Transaction
```

Wire it into `app.module.ts`.

## Mapping Pluggy → app Transaction model

Existing `Transaction` model (see `backend/prisma/schema.prisma:97`):

```
transaction_date, wallet_id, card_id?, transaction_type, payment_method?,
description?, is_recurring, value, installment_id?, installment_total?,
installment_number?, is_processed, category_id, subscription_id?
```

Mapping rules:

| Pluggy field         | App field            | Notes |
|----------------------|----------------------|-------|
| `date`               | `transaction_date`   | ISO date from Pluggy |
| `amount` (signed)    | `value` + `transaction_type` | Positive → income; negative → expense (abs value, type = "expense") |
| `description`        | `description`        | Raw merchant string |
| `category` (Pluggy)  | → `category_id`      | Need mapping table Pluggy categories → app `TransactionCategory` (seed once) |
| `paymentData.method` | `payment_method`     | PIX / TED / DEBIT / CREDIT |
| `id` (Pluggy)        | new column `external_id` | **Dedup key** — see below |

### Schema change required

Add to `Transaction`:

```prisma
external_id     String?  @unique   // Pluggy transaction id
external_source String?            // e.g. "pluggy:nubank"
```

Generate migration: `npx prisma migrate dev --name add_external_id_to_transaction`.

### Dedup strategy

On each sync (webhook or scheduler):

1. Pull transactions from Pluggy for the configured `itemId` (cursor-based pagination via `fetchTransactionsCursor`).
2. For each: `upsert` on `external_id`. Skip if already exists; insert if new.
3. Default `wallet_id` to the user's Nubank wallet (config: `PLUGGY_NUBANK_WALLET_ID`).
4. Default `category_id` to a fallback "Sem categoria" if Pluggy category not mapped.
5. `is_processed = true`, `is_recurring = false` by default (subscription detection is a separate concern).

## Webhook handling

Endpoint: `POST /pluggy/webhook`

Events to handle (minimum viable):
- `item/updated` → trigger transaction sync for that item.
- `transactions/created` → if Pluggy emits per-transaction events, ingest directly.

Must:
- Verify HMAC signature using `PLUGGY_WEBHOOK_SECRET`.
- Return 200 fast; do actual sync work async (queue or `setImmediate` — no queue infra yet, keep simple).
- Idempotent: replays must not duplicate (the `external_id` unique constraint guarantees this).

## Scheduler fallback

Use existing `@nestjs/schedule`. Daily job at e.g. 06:00 BRT:
- Fetches transactions from Pluggy from `lastSyncAt` (persist this) until now.
- Same upsert flow as webhook.

Purpose: catch missed webhooks, handle webhook outages.

## Consent expiration handling

Open Finance Brasil consents expire every 12 months by regulation. Pluggy emits an `item/login_failed` or `item/needs_user_action` event when this happens. Surface this in the app UI / send an email so the user knows to re-consent at `meu.pluggy.ai`.

## Phased plan

1. **Phase 0 — Setup** (manual, ~30 min): create accounts, get credentials, get `itemId`.
2. **Phase 1 — Read-only smoke test** (~2h): install `pluggy-node`, write a one-off script that fetches and prints last 10 transactions. Confirm shape.
3. **Phase 2 — Schema migration** (~30 min): add `external_id` + `external_source` to `Transaction`, deploy migration.
4. **Phase 3 — Sync service + mapper** (~3h): `PluggyService`, transaction mapper, category mapping table, upsert logic with tests.
5. **Phase 4 — Scheduler** (~1h): daily cron pulling transactions since `lastSyncAt`.
6. **Phase 5 — Webhook** (~2h): controller, signature verification, async dispatch to sync service.
7. **Phase 6 — Error surface** (~1h): expired consent → email + status flag visible in dashboard.

Total estimate: ~10h of focused work over the 3-day cloud window. Phases 1-4 are MVP — once those work, the user already has automatic daily sync. Phases 5-6 are upgrades.

## Risk & open questions to resolve during Phase 1

- **Free tier limits**: Pluggy doesn't publicly document `meu.pluggy` consumer API rate limits. If hit, daily scheduler may need backoff. Confirm by monitoring during smoke test.
- **Category taxonomy**: Pluggy's category set vs the app's existing `TransactionCategory` — needs a one-time mapping table. Decide: auto-create app categories from Pluggy, or curated mapping?
- **Credit card transactions**: Nubank credit card transactions come through Pluggy too. The app has a `Card` model. Decide whether to populate `card_id` and how to map Pluggy `creditCardMetadata` → installment fields.
- **Wallet balance reconciliation**: existing `Wallet.actual_cash` is manually maintained. Decide if Pluggy account balance overrides it, or stays advisory only.

## References

- Pluggy docs: `https://docs.pluggy.ai/`
- Pluggy Node SDK: `https://github.com/pluggyai/pluggy-node`
- meu-pluggy repo: `https://github.com/pluggyai/meu-pluggy`
- Pluggy Dashboard: `https://dashboard.pluggy.ai`
- Quickstart examples: `https://github.com/pluggyai/quickstart`

## Versioning reminder

Per project convention, bump `package.json` (semver) and update `CHANGELOG.md` as integration milestones land.
