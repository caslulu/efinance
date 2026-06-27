# Backend - Finance Pro

API local do Finance Pro, construida com NestJS, Prisma e PostgreSQL.

## Setup local

Crie `backend/.env`:

```env
DATABASE_URL=postgresql://financeuser:financepass@localhost:5432/financepro?schema=public
JWT_SECRET=uma_chave_local
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:3000
FORCE_HTTPS=false
```

Instale dependencias e sincronize o banco:

```bash
npm install
npm run db:generate
npm run db:push
```

Inicie a API:

```bash
npm run start:dev
```

## Prisma

O projeto usa `schema.prisma` como fonte canonica durante a fase local. Nao ha
historico de migrations versionado.

Comandos:

```bash
npm run db:generate
npm run db:push
npm run db:reset
npm run db:studio
```

`db:reset` recria o banco a partir do schema atual e pode apagar dados locais.

## Testes

```bash
npm run test
npm run test:e2e
```
