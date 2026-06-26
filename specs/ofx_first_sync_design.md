# OFX-first Sync Design

## Goal

Make manual statement import the primary finance workflow while Pluggy is paused.
The user operates Nubank as the main bank account and Flash as a meal-voucher
wallet.

## Backend

- Keep Pluggy source files and schema fields available for future reactivation.
- Remove Pluggy from the active Nest module graph so no scheduler, controller, or
  background sync can create wallets, cards, categories, or transactions.
- Keep dashboard calculations based on stored app transactions only.

## Frontend

- Keep the existing OFX/CSV import preview and confirmation flow.
- Support selecting multiple OFX/CSV files for the same wallet and reviewing
  them in one combined table.
- Reword the import surface around Nubank OFX as the primary flow.
- Make Flash guidance explicit: use a meal-voucher wallet and CSV/manual entries
  when OFX is not available.

## Security

- Statement import remains behind JWT auth.
- Wallet ownership continues to be validated server-side before preview or
  confirm.
- Imported rows are parsed and confirmed through DTO validation before database
  writes.
