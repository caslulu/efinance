# Frontend - Finance Pro

SPA do Finance Pro construída com React, Vite e TypeScript.

## Stack

- React 19
- Vite 7
- TypeScript
- React Router
- TanStack Query
- Axios
- Tailwind CSS
- Radix UI
- Recharts
- Vite PWA
- Playwright

## Funcionalidades refletidas na interface

- login, cadastro e recuperação de senha
- dashboard financeiro
- carteiras
- transações
- categorias
- metas de gastos
- investimentos
- assinaturas
- wishlist
- perfil e configurações
- onboarding
- assistente IA

## Estrutura principal

```text
frontend/
├── public/
├── src/
│   ├── api/
│   ├── components/
│   ├── context/
│   ├── features/
│   ├── hooks/
│   ├── lib/
│   └── types/
├── tests/
└── vite.config.ts
```

Dentro de `src/features/` existem módulos de tela para:

- `auth`
- `dashboard`
- `wallets`
- `transactions`
- `categories`
- `budgets`
- `subscriptions`
- `investments`
- `wishlist`
- `profile`
- `settings`
- `onboarding`
- `chat`
- `404`

## Configuração local

Instale as dependências:

```bash
npm install
```

Crie o arquivo `.env` na pasta `frontend`:

```bash
cp .env.example .env
```

Defina a URL da API:

```env
VITE_API_URL=http://localhost:3000
```

Se a aplicação estiver atrás de proxy reverso, `VITE_API_URL=/api` também funciona.

## Executando

### Desenvolvimento

```bash
npm run dev
```

Aplicação padrão: `http://localhost:5173`

### Build de produção

```bash
npm run build
```

### Preview local do build

```bash
npm run preview
```

## Scripts disponíveis

```bash
npm run dev
npm run build
npm run lint
npm run preview
```

## Integração com a API

O cliente HTTP está centralizado em `src/api/api.ts`.

Comportamentos importantes:

- `baseURL` vem de `VITE_API_URL`
- `withCredentials` está habilitado
- token Bearer pode ser injetado em memória
- respostas `401` fora de `/auth/profile` limpam a sessão local e redirecionam para `/login`

## Roteamento da aplicação

Rotas principais identificadas em `src/App.tsx`:

- `/`
- `/login`
- `/register`
- `/forgot-password`
- `/reset-password`
- `/wallets`
- `/transactions`
- `/budgets`
- `/wishlists`
- `/investments`
- `/subscriptions`
- `/categories`
- `/chat`
- `/profile`
- `/settings`
- `/onboarding`

Rotas autenticadas passam por `ProtectedRoute`.

## Estado e dados

- autenticação via `AuthContext`
- tema via `ThemeContext`
- cache e sincronização de dados com TanStack Query
- hooks dedicados para domínios como carteiras, transações, categorias, investimentos, recorrências e wishlist

## PWA

O projeto usa `vite-plugin-pwa` com:

- `registerType: autoUpdate`
- manifesto com nome `Finance Pro`
- modo `standalone`

Para a experiência PWA ficar completa em produção, garanta que os ícones referenciados no `vite.config.ts` existam no build final.

## Testes E2E

Os testes ficam em `frontend/tests`.

Configuração atual do Playwright:

- execução em `chromium`, `firefox` e `webkit`
- `baseURL` padrão em `http://127.0.0.1:5173`
- relatório HTML habilitado

Execução manual:

```bash
npx playwright test
```

Abrir relatório:

```bash
npx playwright show-report
```

## Docker e deploy

O `Dockerfile` do frontend:

- compila a aplicação com `VITE_API_URL` em build time
- entrega os arquivos estáticos via Nginx
- expõe portas `80` e `443`

O `nginx.conf` atual:

- redireciona HTTP para HTTPS
- atende a SPA com fallback para `index.html`
- encaminha `/api` para o backend
- encaminha `/uploads` para o backend

Quando não existe certificado montado, o `docker-entrypoint.sh` gera um certificado self-signed para ambiente local ou de teste.
