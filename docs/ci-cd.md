# CI/CD — GitHub Actions

A pipeline fica em [`.github/workflows/ci-cd.yml`](../.github/workflows/ci-cd.yml).

## Fluxo

1. Pull requests executam os testes completos do backend e do frontend, validam o Prisma, compilam a aplicação, simulam o deploy e verificam o build Docker.
2. Pushes na branch principal (`master` neste repositório) publicam imagens AMD64/ARM64 no GHCR, com a tag `sha-<commit>`.
3. Com a variável de repositório `DEPLOY_ENABLED=true`, a pipeline atualiza produção via SSH. O botão **Actions → CI/CD → Run workflow** também permite executar o fluxo; desmarque `deploy` para apenas validar e publicar as imagens.

A publicação e o deploy são restritos à branch principal. Pull requests não recebem a chave SSH nem publicam imagens. Os deploys são serializados; um novo push não interrompe um deploy em andamento.

## Ambiente atual

| Configuração | Valor padrão |
| --- | --- |
| Servidor | `136.248.123.233` |
| Usuário SSH | `ubuntu` |
| Porta SSH | `22` |
| Diretório | `/home/ubuntu/finance-pro` |
| Projeto Compose | `finance-pro` |
| Porta HTTP interna | `127.0.0.1:3100` |

O servidor é ARM64. O Nginx/HTTPS externo e os volumes `finance-pro_finance_pgdata_prod` e `finance-pro_finance_uploads_prod` são preservados. A aplicação mantém os mesmos nomes de containers e a mesma porta.

## Configuração do GitHub

Em **Settings → Environments**, crie `production`. Nesse environment, configure:

| Secret | Conteúdo |
| --- | --- |
| `DEPLOY_SSH_KEY` | Conteúdo completo da chave privada autorizada para `ubuntu`. A chave não pode exigir interação/passphrase. |
| `DEPLOY_KNOWN_HOSTS` | Opcional: linhas de `known_hosts` verificadas para outro servidor/porta. O host atual já está fixado em `deploy/known_hosts`. |

Em **Settings → Secrets and variables → Actions → Variables**, configure a variável de **repositório** `DEPLOY_ENABLED=true` para ativar deploys automáticos. Ela deve ser de repositório, pois é avaliada antes de entrar no environment. Se precisar trocar o destino, use `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_PORT` e `DEPLOY_PATH`; atualize também a chave de host confiável.

O GHCR usa o `GITHUB_TOKEN` temporário do próprio workflow, com `packages:write` para publicar e `packages:read` para o servidor baixar as imagens. Não é necessário criar um PAT. O login do servidor usa um diretório temporário de credenciais, removido ao terminar.

Pela CLI autenticada no GitHub, a chave pode ser cadastrada sem imprimi-la:

```bash
gh api --method PUT repos/caslulu/efinance/environments/production
gh secret set DEPLOY_SSH_KEY --repo caslulu/efinance --env production < aplicacoes.key
gh variable set DEPLOY_ENABLED --repo caslulu/efinance --body true
```

## Requisitos do servidor

Docker Engine, Docker Compose v2 com `--wait`, Bash, `flock`, `gzip` e `curl`. O usuário precisa acessar o Docker e escrever no diretório da aplicação. A porta SSH deve ser acessível aos runners do GitHub. A chave de host verificada é exigida em todas as conexões.

Dois arquivos de ambiente devem continuar no servidor:

- `/home/ubuntu/finance-pro/.env.prod`: `DB_USER`, `DB_PASSWORD`, `DB_NAME`.
- `/home/ubuntu/finance-pro/backend/.env.prod`: JWT, URLs públicas, SMTP, OAuth e Ollama, conforme as integrações utilizadas.

Esses arquivos não são enviados ao GitHub nem substituídos pela pipeline. O `DATABASE_URL` do container continua apontando para o serviço `postgres` da rede Compose. O frontend usa `/api`, definido durante o build; variáveis de ambiente passadas apenas ao Nginx não alteram um bundle Vite já compilado.

## Procedimento de deploy

O workflow envia somente `docker-compose.prod.yml` e `deploy.sh` para `.deploy/releases/<commit>/`. A execução:

1. Adquire um lock no servidor e registra os IDs das imagens em execução para recuperação.
2. Valida o Compose e baixa as duas imagens por digest imutável.
3. Aguarda o PostgreSQL e grava um backup compactado em `backups/pre-deploy-<data>-<commit>.sql.gz`.
4. Executa o Prisma CLI 5.22.0 da própria imagem com `db push --skip-generate`, **sem** `--accept-data-loss`. Se houver alteração destrutiva, o deploy falha antes de trocar os containers da aplicação.
5. Recria backend e frontend, aguarda os healthchecks e verifica a interface e `/api/`.
6. Registra a release em `.deploy/current-release` somente após sucesso.

Há uma interrupção breve durante a recriação dos containers. O workflow não executa `docker compose down`, remoção de volumes ou limpeza global de imagens. Backups e imagens anteriores precisam de retenção administrada conforme o espaço disponível.

O projeto ainda usa `schema.prisma`, sem histórico de migrations versionado. O deploy preserva esse fluxo, bloqueando perda de dados. Alterações complexas de schema devem receber migrations revisadas antes de automatizar sua aplicação.

## Falhas e recuperação

Uma falha no backup ou na atualização do schema impede a troca dos containers. Se a nova aplicação não ficar saudável, o script tenta restaurar automaticamente as imagens que estavam em execução e mantém o workflow como falha.

O rollback restaura **a aplicação**, sem reverter automaticamente o banco. Mudanças de schema precisam ser compatíveis com a versão anterior; restaurar um backup exige avaliar os dados gravados desde o backup. Inclusive para imagens antigas, o Compose inicia diretamente o Node, evitando o comando legado que executava `db push --accept-data-loss`.

Para repetir manualmente a recuperação de containers no servidor, use o SHA da tentativa que falhou:

```bash
APP_DIR=/home/ubuntu/finance-pro
FAILED_SHA=<sha-completo-da-tentativa>
docker compose --project-name finance-pro --project-directory "$APP_DIR" \
  --env-file "$APP_DIR/.env.prod" \
  --env-file "$APP_DIR/.deploy/releases/$FAILED_SHA/rollback.env" \
  -f "$APP_DIR/.deploy/releases/$FAILED_SHA/docker-compose.prod.yml" \
  up -d --no-deps --force-recreate --pull never --wait --wait-timeout 180 backend frontend
```

Não remova as imagens anteriores antes de confirmar a estabilidade da nova release. Backups possuem dados financeiros e são criados com acesso restrito ao usuário do deploy.

## Verificação local

```bash
node --test deploy/deploy.test.mjs
bash -n deploy/deploy.sh
```

Os testes de deploy usam Docker e HTTP simulados e cobrem backup, ordem das operações, falhas de schema e rollback. Builds de imagens e o fluxo remoto completo são validados no runner com Docker; executar apenas os testes locais não equivale a realizar um deploy.

Referências: [publicação de imagens pelo GitHub Actions](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images), [saúde e dependências no Compose](https://docs.docker.com/compose/how-tos/startup-order/).
