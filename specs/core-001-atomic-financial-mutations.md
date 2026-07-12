# CORE-001 - Mutacoes financeiras atomicas

## Requisitos

- Enquanto uma mutacao financeira estiver em andamento, quando qualquer etapa
  falhar, o sistema deve desfazer tanto o historico quanto o impacto no saldo.
- Enquanto uma transacao futura for maturada, quando o impacto for aplicado, o
  sistema deve marcar o registro como processado na mesma transacao de banco.
- Enquanto um extrato for confirmado, quando uma linha falhar, essa linha nao
  deve deixar registro ou saldo parcial; o lote continua parcial por decisao do
  contrato atual.

## Arquitetura

### Frontend

- Nenhuma mudanca de contrato nesta tarefa.
- Erros continuam sendo apresentados pelos fluxos existentes.

### Backend

- `TransactionsService` delimita as transacoes Prisma de create/update/delete e
  maturacao.
- `StatementImportService` delimita uma transacao Prisma por linha importada.
- `TransactionImpactService` recebe opcionalmente um `TransactionClient` e o
  encaminha ao servico de carteiras.
- `WalletsService` executa leitura e update pelo client recebido, mantendo
  verificacao de propriedade e saldo.

### Seguranca

- Todos os endpoints permanecem protegidos pelo guard JWT.
- As verificacoes de propriedade continuam antes e dentro do caminho de saldo.
- Nenhuma entrada nova e aceita e nenhum dado sensivel novo e retornado.
- Operacoes usam Prisma parametrizado; nao ha SQL interpolado.

## Estrategia de erro

- Excecoes de dominio e banco propagam para o filtro global.
- O rollback fica sob responsabilidade de `prisma.$transaction`.
- Na importacao parcial, a falha e associada somente a linha correspondente.
- Na maturacao em lote, uma falha nao interrompe as demais transacoes.

## Plano de implementacao

- [x] Escrever e observar testes falhando para limites transacionais.
- [x] Permitir impacto de saldo pelo Prisma transaction client.
- [x] Tornar create/update/delete atomicos.
- [x] Tornar cada linha importada atomica.
- [x] Tornar impacto + `is_processed` atomicos na maturacao.
- [x] Rodar testes focados, suite backend e typecheck.
- [x] Marcar CORE-001 somente apos todos os gates passarem.
