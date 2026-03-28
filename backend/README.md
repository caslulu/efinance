# Backend - Finance Pro

API principal do Finance Pro, construída com NestJS, Prisma e PostgreSQL.

## Stack

- NestJS 11
- Prisma
- PostgreSQL
- JWT
- Passport
- Google OAuth
- Mailer
- Throttler
- Schedule

## Responsabilidades da API

- autenticação e sessão
- cadastro e perfil de usuário
- carteiras
- cartões
- transações
- categorias
- metas de gastos
- assinaturas e recorrências
- investimentos
- dashboard consolidado
- wishlist e alertas de preço
- chat com IA

## Estrutura principal

```text
backend/
├── prisma/schema.prisma
├── src/
│   ├── auth/
│   ├── budgets/
│   ├── cards/
│   ├── categories/
│   ├── chat/
│   ├── dashboard/
│   ├── investments/
│   ├── prisma/
│   ├── subscriptions/
│   ├── transactions/
│   ├── users/
│   ├── wallets/
│   └── wishlist/
└── test/
```

## Pre-requisitos

- Node.js 20+
- npm
- PostgreSQL 15+

## Configuração local

Instale as dependências:

```bash
npm install
```

Crie `backend/.env` com base no exemplo abaixo:

```env
DATABASE_URL=postgresql://financeuser:SUA_SENHA@localhost:5432/financepro?schema=public
JWT_SECRET=uma_chave_forte
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:3000

MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=seu_email
MAIL_PASS=sua_senha_ou_app_password
MAIL_FROM="Finance Pro <seu_email>"

GOOGLE_CLIENT_ID=seu_google_client_id
GOOGLE_CLIENT_SECRET=seu_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/redirect
FORCE_HTTPS=false
```

## Banco de dados

Gere o client do Prisma:

```bash
npx prisma generate
```

Crie ou aplique migrations:

```bash
npx prisma migrate dev
```

Se quiser inspecionar o banco:

```bash
npx prisma studio
```

## Executando

### Desenvolvimento

```bash
npm run start:dev
```

### Produção

```bash
npm run build
npm run start:prod
```

A API sobe, por padrão, na porta `3000`.

## Scripts disponíveis

```bash
npm run build
npm run format
npm run start
npm run start:dev
npm run start:debug
npm run start:prod
npm run lint
npm run test
npm run test:watch
npm run test:cov
npm run test:debug
npm run test:e2e
```

## Variáveis de ambiente

### Obrigatórias para funcionamento local

- `DATABASE_URL`
- `JWT_SECRET`
- `FRONTEND_URL`
- `BACKEND_URL`

### Email

- `MAIL_HOST`
- `MAIL_PORT`
- `MAIL_USER`
- `MAIL_PASS`
- `MAIL_FROM`

### OAuth Google

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_CALLBACK_URL`

### Runtime

- `PORT`
- `NODE_ENV`
- `FORCE_HTTPS`

## Segurança e comportamento da API

- `Helmet` habilitado globalmente
- `ValidationPipe` com `whitelist`, `forbidNonWhitelisted` e `transform`
- `JwtAuthGuard` aplicado globalmente
- `ThrottlerGuard` aplicado globalmente com limite de `100` requisições por minuto
- CORS aceita origens configuradas em `FRONTEND_URL` e alguns hosts locais em desenvolvimento
- arquivos enviados são servidos estaticamente em `/uploads`

## Módulos carregados em `AppModule`

- `PrismaModule`
- `UsersModule`
- `AuthModule`
- `WalletsModule`
- `TransactionsModule`
- `CategoriesModule`
- `SubscriptionsModule`
- `InvestmentsModule`
- `DashboardModule`
- `BudgetsModule`
- `WishlistModule`
- `CardsModule`
- `ChatModule`

## Modelo de dados

Entidades principais do `schema.prisma`:

- `User`
- `Wallet`
- `Card`
- `Transaction`
- `TransactionCategory`
- `Budget`
- `Subscription`
- `Investment`
- `EconomicIndicator`
- `TypeInvestment`
- `Wishlist`
- `WishlistProduct`
- `WishlistProductHistory`
- `WishlistPriceAlertNotification`
- `ChatConversation`
- `ChatMessage`
- `ChatDailyUsage`

Enums mapeados:

- `Frequency`
- `SubscriptionStatus`
- `ChatRole`

## Testes

### Unitários

```bash
npm run test
```

### E2E

```bash
npm run test:e2e
```

Os testes E2E ficam em `backend/test`.

## Docker

O `Dockerfile` do backend:

- usa `node:20-alpine`
- gera o client do Prisma durante o build
- compila a aplicação
- executa `prisma migrate deploy` no startup via `entrypoint.sh`

Ao subir pelo `docker compose`, o container espera o PostgreSQL ficar saudável antes de iniciar.
