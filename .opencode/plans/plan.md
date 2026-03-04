# Implementation Plan: Wallet/Card Refactor & Bug Fixes

## 1. Branch Creation
- Checkout a new branch `feature/wallet-cards-refactor`.

## 2. Bug Fix: Double Wallet Prompt
**Root Cause**: In `frontend/src/features/onboarding/pages/OnboardingPage.tsx`, the state transitions between `isPending` completing and `setStep(3)` causing a re-render aren't batched properly or the button remains enabled. Additionally, navigating to `/` mounts `OnboardingWrapper` while the cache is stale, triggering a background fetch that momentarily leaves `isFetching` active, which could cause a race condition if `wallets` returns empty before the database commits.
**Fix**:
- **OnboardingPage**: Strictly disable the submit button whenever `step !== 1` unless ready, and ensure `createWallet.isPending` blocks rapid double-clicks. Navigate to Dashboard explicitly bypassing `OnboardingWrapper` cache validation, or ensuring the local cache is strongly updated before invalidating.
- **OnboardingWrapper**: Refine the logic to avoid bouncing users. Check `if (!isLoading && !isFetching && wallets && wallets.length === 0)` only when the query is fully settled, and perhaps add a fallback flag (`localStorage.getItem('onboarded')`) to prevent looping immediately after creation.

## 3. Backend: Wallet "Transfer Only" & Card Limits
**Schema Updates**:
- `Wallet` model: Add `is_transfer_only Boolean @default(false)`. This explicitly defines wallets that do not accept direct expenses (e.g., a checking account where money is only transferred out to pay card invoices).
- Run `npx prisma db push` to sync the schema.

**Service Updates**:
- **`transactions.service.ts`**: When a transaction is created on a `Card`, validate the card's available limit:
  - Fetch all unpaid expenses for the current billing cycle of the card.
  - Calculate `Sum(expenses) + new_transaction.value`.
  - If it exceeds `card.card_limit`, throw a `BadRequestException` ("Insufficient card limit").
- **`wallets.service.ts`**: When creating or updating a wallet, accept `is_transfer_only`. If true, block direct expenses on the wallet (unless it's paying a card invoice).

## 4. Frontend: Cards & "Transfer Only" Wallets
- **`CreateWalletModal.tsx` & `EditWalletModal.tsx`**: Add a toggle/checkbox for "Apenas Transferência" (`is_transfer_only`).
- **`WalletCard.tsx` / `SortableWalletCard.tsx`**:
  - If a wallet is marked `is_transfer_only`, hide the "Add Expense" button for the wallet itself, but keep the "Transfer" and "Add Card" buttons.
  - Display associated `Card`s correctly using the new Card sub-components (`CardItem`, `CreateCardModal`, `EditCardModal`).
  - Calculate and display the "Available Limit" on each card based on its monthly expenses.
- **Card Logic Integration**: Ensure the user can create, edit, and delete cards, specifying `closing_day`, `due_day`, and `card_limit`.

## 5. UI Refactor: Emerald Green Theme
- **Color Palette Swap**: The user requested a more standard, elegant finance app color instead of the current blue. We will transition to an **Emerald Green / Slate** theme.
- **Implementation**:
  - `tailwind.config.js`: Define new primary colors or update the default `blue-*` classes.
  - Create a bash script (similar to existing `replace-all.js`) to bulk replace `blue-50` through `blue-900` with `emerald-50` through `emerald-900` across all `frontend/src/**/*.tsx` and `.ts` files.
  - Refine `OnboardingPage`, `RegisterPage`, and `DashboardPage` gradients to use elegant `emerald` and `teal` combinations (e.g., `from-emerald-600 via-emerald-500 to-teal-600`).
  - Update `BottomNav`, sidebar highlights, active states, and buttons to match the new branding.