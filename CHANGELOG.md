# Changelog

Todos os releases notáveis deste projeto serão documentados aqui.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e
o versionamento segue [SemVer](https://semver.org/lang/pt-BR/). Enquanto a
versão major for `0.x`, alterações com impacto incompatível podem ocorrer
em bumps de minor.

## [Unreleased]

## [0.2.0] - 2026-06-22

### Adicionado
- **Integração Pluggy (Open Finance / MeuPluggy)**: sync automático de
  transações do Nubank (conta e cartão) via SDK oficial `pluggy-sdk`.
  - Novo módulo `backend/src/integrations/pluggy/` com `PluggyService`,
    `PluggyScheduler` (cron diário às 09:00 UTC / 06:00 BRT) e
    `PluggyController` (`POST /integrations/pluggy/sync`,
    `GET /integrations/pluggy/status`).
  - Campos novos em `Wallet`: `pluggy_item_id`, `pluggy_account_id` (unique),
    `external_source`, `pluggy_last_sync_at`.
  - Campos novos em `Transaction`: `external_id` (unique, dedup key) e
    `external_source` (index).
  - Mapeamento Pluggy → Transaction: detecta INCOME/EXPENSE pelo sinal do
    `amount` (com semântica invertida para contas CREDIT), preserva info de
    parcelas via `creditCardMetadata`, auto-cria categorias por nome.
  - Wallets para Nubank são criadas automaticamente no primeiro sync (uma
    por conta Pluggy — conta corrente vira `BANK`, cartão vira `CREDIT_CARD`).
  - Script de smoke test em `backend/scripts/pluggy-smoke-test.ts`.
  - Documentação em `docs/pluggy-integration.md`.

### Configuração
- Novas variáveis de ambiente (opcionais — integração desabilita se faltar
  qualquer uma): `PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET`,
  `PLUGGY_NUBANK_ITEM_ID`, `PLUGGY_USER_ID`.

## [0.1.0] - 2026-06-22

### Adicionado
- **CSRF**: middleware double-submit cookie + endpoint `GET /csrf` para emissão
  inicial do token; interceptor do axios injeta `X-CSRF-Token` automaticamente.
- **Sanitização global**: `SanitizeInterceptor` aplica `sanitize-html` em body e
  query strings, preservando campos sensíveis (senhas, tokens, URLs, conteúdo
  de chat).
- **ErrorBoundary** global no frontend com fallback UI.
- **Testes unitários frontend** (Vitest + Testing Library): `lib/utils`,
  `ErrorBoundary`, `AuthContext`. Scripts `test`, `test:watch`, `test:cov`.
- **CI/CD** via GitHub Actions (`.github/workflows/ci.yml`): jobs paralelos
  backend (lint + build + test + Prisma validate/migrate contra Postgres 15
  service) e frontend (lint + typecheck + test + build).
- Tipos compartilhados `Dashboard.ts` e `Budget.ts`.
- **CHANGELOG.md** seguindo Keep a Changelog.

### Alterado
- **Autenticação cookie-only**: o JWT passa a sair exclusivamente de cookie
  HTTP-only. A `JwtStrategy` removeu o suporte ao header `Authorization:
  Bearer`. As respostas de `/auth/login`, `/auth/2fa/login` e
  `/auth/verify-email` deixaram de incluir `access_token` no body.
- Frontend deixou de persistir token em `localStorage`/`sessionStorage`. O
  estado de autenticação passa a ser derivado do cookie + `/auth/profile`.
- `PrismaClientExceptionFilter`: trata `P2025`, mascara detalhes em produção
  e usa `Logger` do Nest.
- `AuthService` substituiu `console.*` por `Logger` estruturado.
- Eliminados todos os `any` em `frontend/src/` (≈30 ocorrências).
- `useDashboard` e `useBudgetStatus` agora retornam tipos concretos.
- Teste de `confirmStatementImport` agora trava `Date.now()` com
  `jest.useFakeTimers()` para deixar de ser dependente do calendário.

### Corrigido
- Teste flaky em `transactions.service.spec.ts`: a regra
  `walletsService.addExpense` só é chamada para datas não-futuras; o teste
  dependia da data real e quebrava com o passar do tempo. Agora usa fake
  timer fixado em `2026-03-20`.

### Segurança
- Mitigação de XSS-via-storage: o token não é mais legível por JavaScript.
- Mitigação de CSRF: rotas mutáveis exigem header com token que casa com
  o cookie (`csrf_token`).
- Mitigação de XSS-via-input: sanitização aplicada a todo input textual.
- Vazamento de detalhes do Prisma em produção foi suprimido.

[Unreleased]: https://github.com/caslulu/efinance/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/caslulu/efinance/releases/tag/v0.1.0
