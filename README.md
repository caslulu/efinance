# Finance Pro

Aplicacao full stack local para gestao financeira pessoal. O projeto ainda nao
foi lancado; por isso o banco pode ser resetado com frequencia e o
`backend/prisma/schema.prisma` e a fonte canonica da modelagem.

## Stack

- Backend: NestJS, Prisma e PostgreSQL
- Frontend: React, Vite, TypeScript e Tailwind CSS
- Banco local: PostgreSQL 15 via Docker Compose

## Estrutura

```text
financeApp/
├── backend/
│   ├── prisma/schema.prisma
│   └── src/
├── frontend/
│   ├── src/
│   └── tests/
├── docs/
│   ├── database.dbml
│   └── meal-voucher-setup.md
└── docker-compose.yml
```

## Rodando com Docker Compose

Crie os arquivos de ambiente locais:

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env
```

Crie `backend/.env` com pelo menos:

```env
DATABASE_URL=postgresql://financeuser:financepass@localhost:5432/financepro?schema=public
JWT_SECRET=uma_chave_local
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:3000
FORCE_HTTPS=false
```

Suba a aplicacao:

```bash
docker compose up
```

Servicos locais:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`
- PostgreSQL: `localhost:5432`

O container do backend executa `prisma generate` e `prisma db push` antes de
iniciar o Nest em modo watch.

## Rodando sem Docker para backend/frontend

Use Docker apenas para o Postgres:

```bash
docker compose up -d postgres
```

Backend:

```bash
cd backend
npm install
npm run db:generate
npm run db:push
npm run start:dev
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

## Banco de dados

Nao ha migrations versionadas neste momento. Como o banco local e descartavel,
o fluxo e:

```bash
cd backend
npm run db:push
```

Para recriar o banco a partir do zero:

```bash
cd backend
npm run db:reset
```

O diagrama para Dbdiagram fica em `docs/database.dbml`. Cole esse arquivo em
<https://dbdiagram.io> para visualizar as tabelas e relacionamentos.

## Scripts uteis

Backend:

```bash
npm run start:dev
npm run build
npm run db:generate
npm run db:push
npm run db:reset
npm run db:studio
npm run test
```

Frontend:

```bash
npm run dev
npm run build
npm run test
```

## Observacoes

- O ambiente local continua usando `docker-compose.yml`.
- O deploy usa GitHub Actions, imagens no GHCR e `docker-compose.prod.yml`.
  Consulte [CI/CD e configuração do servidor](docs/ci-cd.md).
- O schema ainda não possui migrations versionadas. O deploy faz backup e
  bloqueia alterações que exigem aceitar perda de dados.
