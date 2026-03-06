# Finance Pro — Todo List (Audited)

> Each item verified against the current codebase. ✅ = Done · ⬜ = Pending

---

## 🔴 Bugs & Corrections — ALL DONE ✅

| # | Issue | Status | Notes |
|---|-------|--------|-------|
| 1 | `handleResend` undefined | ✅ | Defined at line 86 with full timer logic |
| 2 | `resendTimer` never used | ✅ | Wired to `useEffect` countdown |
| 3 | `user` typed as `any` | ✅ | Typed as `User \| null` |
| 4 | Invalid `size` on `<Link>` | ✅ | No invalid prop found |
| 5 | No 401 global redirect | ✅ | 401 interceptor in `api.ts` |
| 6 | Session lost on refresh | ✅ | `localStorage` / `sessionStorage` logic |
| 7 | Wallet labels not translated | ✅ | `typeLabels` map in `WalletCard.tsx` |
| 8 | Frequency not translated | ✅ | `frequencyLabels` in `SubscriptionsPage.tsx` |
| 9 | `next_billing_date` locale | ✅ | Uses `toLocaleDateString('pt-BR')` |
| 10 | Wishlist native dialogs | ✅ | Replaced with toast + ConfirmDialog + Dialog modals |
| 11 | Subs/Categories native dialogs | ✅ | Replaced in all files |
| 12 | Avatar cache-busting | ✅ | No timestamp appended; uses plain URL |

---

## 🟡 UX / UI Improvements

### Navigation & Layout

| # | Item | Status | Notes |
|---|------|--------|-------|
| 13 | Loading skeletons | ✅ | Skeleton component implemented across pages |
| 14 | ProtectedRoute blank page | ✅ | Shows `<LoadingSpinner />` |
| 15 | No 404 page | ✅ | `NotFoundPage` exists with catch-all route |
| 16 | Page title in header | ✅ | `PAGE_TITLES` map renders in header |
| 17 | Sidebar collapse persisted | ✅ | Uses `localStorage` |
| 18 | Sidebar tooltip `fixed` | ✅ | Uses relative `absolute` positioning |

### Auth Pages

| # | Item | Status | Notes |
|---|------|--------|-------|
| 19 | Login/Register visually plain | ✅ | Has gradient background + logo branding |
| 20 | No password strength on Register | ✅ | `PasswordStrengthIndicator` used |
| 21 | No Google OAuth on Register | ✅ | Google button present |

### Dashboard

| # | Item | Status | Notes |
|---|------|--------|-------|
| 22 | No date range selector | ✅ | DatePickerWithRange implemented |
| 23 | `window.location.href` navigation | ✅ | Uses `useNavigate` |
| 24 | KPI tooltips overflow | ✅ | Contained positioning instead of centering |

### Transactions

| # | Item | Status | Notes |
|---|------|--------|-------|
| 25 | No date range filter | ✅ | Added sub-month and multi-month date pickers |
| 26 | No export (CSV/PDF) | ✅ | CSV export implemented globally |
| 27 | No bulk actions | ✅ | Checkboxes for bulk deletion added |

### Subscriptions

| # | Item | Status | Notes |
|---|------|--------|-------|
| 28 | No edit modal | ✅ | `EditSubscriptionModal` implemented |
| 29 | "Processar Pendentes" is user-facing | ✅ | Renamed to "Sincronizar", ghost variant |
| 30 | No subscription summary card | ✅ | Summary cards with monthly cost, active/paused counts |

### Wallets

| # | Item | Status | Notes |
|---|------|--------|-------|
| 31 | No confirmation before wallet deletion | ✅ | ConfirmDialog in EditWalletModal |
| 32 | No wallet sorting/reordering | ✅ | Drag and drop reordering added |

### Wishlist

| # | Item | Status | Notes |
|---|------|--------|-------|
| 33 | No price history chart | ✅ | Line chart component added |
| 34 | Table missing URL/alert columns | ✅ | Added external link and alert badges |
| 35 | First wishlist not auto-selected | ✅ | Visual highlight uses `activeWishlistId` |

### Profile & Settings

| # | Item | Status | Notes |
|---|------|--------|-------|
| 36 | No account deletion | ✅ | Account deletion with password confirmation |
| 37 | No password strength in Settings | ✅ | `PasswordStrengthIndicator` used |
| 38 | No show/hide toggle in Settings | ✅ | Eye/EyeOff toggles on all 3 fields |

---

## 🟢 New Features — ALL PENDING

| # | Feature | Status |
|---|---------|--------|
| 39 | Investments Module | ⬜ |
| 40 | Tags system for transactions | ⬜ |
| 41 | Recurring income support | ⬜ |
| 42 | Monthly/Annual financial report | ⬜ |
| 43 | Year-over-year comparison | ⬜ |
| 44 | Income vs Expense trend chart | ⬜ |
| 45 | Goals / Savings goals | ⬜ |
| 46 | Dark mode | ⬜ |
| 47 | Onboarding wizard | ⬜ |
| 48 | Keyboard shortcuts | ⬜ |
| 49 | Toast notifications | ✅ |
| 50 | Search bar in header | ⬜ |
| 51 | Currency input mask | ⬜ |
| 52 | Confirmation dialogs | ✅ |
| 53 | PWA support | ⬜ |
| 54 | Bottom navigation on mobile | ⬜ |

---

## ⚙️ Code Quality

| # | Issue | Status | Notes |
|---|-------|--------|-------|
| 55 | Excessive `any` types | ⬜ | Still present in catch blocks |
| 56 | No error boundaries | ⬜ | Not implemented |
| 57 | `formatCurrency` duplicated | ⬜ | Duplicated in 5+ files |
| 58 | No unit/integration tests | ⬜ | No test files |
| 59 | No env-based API URL | ⬜ | Falls back to `window.location` |
| 60 | QueryClientProvider missing | ✅ | Present in `main.tsx` |
| 61 | Wallet invoice fields not typed | ✅ | `Wallet.ts` has all fields |
| 62 | DashboardPage monolithic (630 lines) | ⬜ | Still 629 lines |

---

## 🔒 Security

| # | Issue | Status | Notes |
|---|-------|--------|-------|
| 63 | No rate limiting | ✅ | `ThrottlerModule` in backend |
| 64 | No CSRF protection | ⬜ | Not implemented |
| 65 | Token in sessionStorage (XSS) | ⬜ | Still uses browser storage |
| 66 | No input sanitization | ⬜ | Not implemented |

---

## Summary

| Category | Done | Pending | Total |
|----------|------|---------|-------|
| 🔴 Bugs | **12** | 0 | 12 |
| 🟡 UX/UI | **25** | 1 | 26 |
| 🟢 Features | **2** | 12 | 14 |
| ⚙️ Code Quality | **2** | 6 | 8 |
| 🔒 Security | **1** | 3 | 4 |
| **Total** | **40** | **24** | **64** |
