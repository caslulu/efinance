# Finance Pro

![Status](https://img.shields.io/badge/status-em_desenvolvimento-yellow)
![License](https://img.shields.io/badge/license-MIT-blue)
![Stack](https://img.shields.io/badge/stack-NestJS%20%7C%20React%20%7C%20Prisma-green)

Aplicação full stack para gestão financeira pessoal com foco em fluxo de caixa, patrimônio, recorrências, metas, wishlist e apoio por IA.

## Visao geral

O repositório está organizado como monorepo com duas aplicações:

- `backend/`: API em NestJS com Prisma e PostgreSQL.
- `frontend/`: interface em React + Vite.
- `docker-compose.yml`: sobe banco, backend e frontend em containers.

## Funcionalidades

- Dashboard com visão consolidada da vida financeira.
- Gestão de carteiras e saldo atual.
- Lançamento e histórico de transações.
- Categorias personalizadas por usuário.
- Metas de gastos por categoria.
- Assinaturas e recorrências com geração de cobranças.
- Cartões vinculados a carteiras.
- Investimentos com suporte a indicadores econômicos.
- Wishlist com histórico e alertas de preço.
- Autenticação com JWT, recuperação de senha, verificação por email e Google OAuth.
- Assistente com IA para interações no contexto financeiro.

## Arquitetura

### Backend

- Framework: NestJS 11
- ORM: Prisma
- Banco: PostgreSQL 15
- Segurança: JWT, Helmet, CORS configurável e Throttler global
- Extras: envio de email, tarefas agendadas e upload estático em `/uploads`

Módulos principais identificados no código:

- `auth`
- `users`
- `wallets`
- `transactions`
- `categories`
- `budgets`
- `subscriptions`
- `cards`
- `investments`
- `wishlist`
- `dashboard`
- `chat`

### Frontend

- React 19 + Vite 7
- React Router
- TanStack Query
- Axios
- Tailwind CSS
- Radix UI
- Recharts
- PWA via `vite-plugin-pwa`
- Playwright para testes E2E

## Estrutura do projeto

```text
financeApp/
├── backend/
│   ├── prisma/
│   └── src/
├── frontend/
│   ├── src/
│   └── tests/
├── docker-compose.yml
├── .env.example
└── .env.prod.example
```

## Pre-requisitos

- Node.js 20 ou superior
- npm 10 ou superior
- Docker e Docker Compose
- Git

## Executando localmente sem Docker

### 1. Banco de dados

Suba um PostgreSQL localmente. Se preferir, use apenas o serviço de banco do Compose:

```bash
docker compose up -d postgres
```

### 2. Backend

```bash
cd backend
npm install
```

Crie o arquivo `backend/.env` com pelo menos:

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
```

Depois execute:

```bash
npx prisma generate
npx prisma migrate dev
npm run start:dev
```

API padrão: `http://localhost:3000`

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

O arquivo `frontend/.env` deve apontar para a API:

```env
VITE_API_URL=http://localhost:3000
```

App padrão: `http://localhost:5173`

## Executando com Docker Compose

### 1. Configure as variáveis raiz

```bash
cp .env.example .env
```

Preencha ao menos:

```env
DB_USER=financeuser
DB_PASSWORD=uma_senha_forte
DB_NAME=financepro
VITE_API_URL=/api
```

### 2. Configure o backend para produção

```bash
cp backend/.env.prod.example backend/.env.prod
```

Revise principalmente:

- `JWT_SECRET`
- `MAIL_HOST`
- `MAIL_PORT`
- `MAIL_USER`
- `MAIL_PASS`
- `MAIL_FROM`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_CALLBACK_URL`
- `FRONTEND_URL`
- `BACKEND_URL`
- `FORCE_HTTPS`

### 3. Suba os serviços

```bash
docker compose up --build -d
```

Serviços criados:

- `postgres`
- `backend`
- `frontend`

O backend executa `prisma migrate deploy` automaticamente no start do container.

## Variáveis de ambiente

### Raiz do projeto

Usadas pelo `docker-compose.yml`:

- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `VITE_API_URL`

### Backend

Variáveis encontradas no código:

- `DATABASE_URL`
- `PORT`
- `NODE_ENV`
- `JWT_SECRET`
- `FRONTEND_URL`
- `BACKEND_URL`
- `FORCE_HTTPS`
- `MAIL_HOST`
- `MAIL_PORT`
- `MAIL_USER`
- `MAIL_PASS`
- `MAIL_FROM`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_CALLBACK_URL`

### Frontend

- `VITE_API_URL`

## Modelo de dados

O schema Prisma cobre os principais domínios da aplicação:

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

Alguns pontos importantes da modelagem:

- transações podem ser vinculadas a carteira, cartão, categoria e assinatura
- assinaturas possuem frequência e próxima cobrança
- investimentos podem usar taxa fixa ou indicador econômico
- wishlist mantém histórico de preço e notificações de queda
- conversas com IA armazenam contexto e uso diário

## Scripts úteis

### Backend

```bash
npm run start:dev
npm run build
npm run start:prod
npm run lint
npm run test
npm run test:e2e
npm run test:cov
```

### Frontend

```bash
npm run dev
npm run build
npm run preview
npm run lint
```

## Testes

### Backend

- unitários com Jest
- E2E em `backend/test`

### Frontend

- E2E com Playwright em `frontend/tests`

Observação: o `package.json` do frontend não possui script pronto para Playwright, então os testes devem ser executados com o CLI da ferramenta, por exemplo:

```bash
npx playwright test
```

## Deploy

O fluxo atual de produção é orientado a containers:

- PostgreSQL 15 como banco
- backend NestJS em Node 20 Alpine
- frontend servido por Nginx
- proxy reverso de `/api` e `/uploads`
- redirecionamento HTTP para HTTPS
- geração de certificado self-signed local quando não houver certificado real montado no container

## Estado atual da documentação

Os arquivos específicos de cada app também foram ajustados:

- `backend/README.md`: setup da API, módulos e ambiente
- `frontend/README.md`: setup da SPA, estrutura e integração com a API

## Contribuição

Como o projeto ainda está em evolução, vale validar qualquer mudança em três frentes:

- impacto nas regras financeiras
- compatibilidade com o schema Prisma
- fluxo completo entre frontend, backend e banco
