# Frontend - Finance Pro

SPA local do Finance Pro, construida com React, Vite e TypeScript.

## Setup local

```bash
npm install
cp .env.example .env
npm run dev
```

Valor padrao de ambiente:

```env
VITE_API_URL=http://localhost:3000
```

Quando a aplicacao roda pelo Docker Compose, o frontend usa `/api` e o proxy do
Vite encaminha as chamadas para o backend em `http://backend:3000`.

## Scripts

```bash
npm run dev
npm run build
npm run test
npm run lint
```

## Testes E2E

Os testes Playwright ficam em `frontend/tests`. Os relatorios e resultados
gerados localmente nao devem ser versionados.
