# Backlog consolidado do CORE financeiro

## Objetivo

Tornar confiavel, simples e auditavel o fluxo principal do FinanceApp:

- carteiras e saldos;
- receitas, despesas e transferencias;
- cartoes, limites e faturas;
- parcelas e recorrencias;
- assinaturas;
- importacao de extratos;
- categorias, budgets e indicadores do dashboard.

Investimentos, wishlist e IA ficam fora desta rodada, exceto quando interferem
nos calculos ou aumentam o acoplamento do CORE.

## Definicao de severidade

- **P0:** pode causar saldo, fatura ou historico incorreto; risco de duplicacao
  ou operacao parcial.
- **P1:** fluxo importante quebrado, contrato divergente ou regra de dominio
  incompleta.
- **P2:** complexidade, desempenho, UX, observabilidade ou cobertura.
- **P3:** limpeza incremental sem impacto funcional imediato.

## Fase 1 - Integridade financeira (P0)

### CORE-001 - Tornar mutacoes financeiras atomicas

**Problema:** create, update, delete, importacao e maturacao gravam a transacao,
o saldo e o estado de processamento em operacoes separadas.

**Implementacao:**

- [x] Executar criacao da transacao e impacto no saldo na mesma
  `prisma.$transaction`.
- [x] Executar reversao, alteracao e novo impacto do update na mesma transacao.
- [x] Executar reversao e delete na mesma transacao.
- [x] Fazer importacao confirmar registro e impacto de cada linha de forma
  atomica; decidir e documentar se o lote inteiro tambem sera atomico.
- [x] Fazer maturacao aplicar impacto e marcar `is_processed` atomicamente.
- [x] Adaptar `TransactionImpactService` e `WalletsService` para receber o
  Prisma transaction client, sem abrir operacoes fora da transacao corrente.

**Aceite:** nenhuma falha intermediaria deixa saldo e historico divergentes.

### CORE-002 - Impedir saldo negativo em concorrencia

**Problema:** o saldo e lido e validado antes do decremento, permitindo que
duas despesas simultaneas usem o mesmo saldo.

**Implementacao:**

- [x] Usar update condicional/lock dentro da transacao de banco.
- [x] Considerar sucesso apenas quando a carteira ainda possuir saldo suficiente.
- [x] Retornar erro de dominio consistente para saldo insuficiente.
- [x] Criar teste concorrente com duas despesas disputando o mesmo saldo.

### CORE-003 - Redesenhar update e delete de parcelas/series

**Problema:** o update multiplica valores e executa `updateMany`, assumindo que
toda a serie e homogenea e processada.

**Implementacao:**

- [x] Exigir escopo explicito: `THIS`, `THIS_AND_FUTURE` ou `ALL`.
- [x] Calcular diff individual por transacao afetada.
- [x] Reverter apenas registros cujo impacto foi aplicado.
- [x] Preservar datas relativas da serie.
- [x] Garantir filtro por usuario/carteira em operacoes de grupo.
- [x] Aplicar update e impactos em uma unica transacao Prisma.

**Aceite:** editar uma parcela nao altera outras sem escolha explicita; editar a
serie produz saldo igual a reconciliacao do historico.

### CORE-004 - Garantir idempotencia na maturacao

**Problema:** dois schedulers podem aplicar a mesma transacao futura mais de uma
vez.

- [x] Fazer claim atomico de transacoes pendentes.
- [x] Impedir que duas instancias processem o mesmo ID.
- [x] Registrar erro com `Logger`, ID e causa sem interromper outros registros.
- [x] Testar duas execucoes concorrentes.

### CORE-005 - Garantir idempotencia de ciclos de assinatura

**Problema:** execucoes simultaneas podem gerar duas transacoes para o mesmo
ciclo.

- [x] Garantir identidade unica do ciclo por claim condicional de
  `subscription_id + next_billing_date`.
- [x] Criar a transacao e avancar `next_billing_date` atomicamente.
- [x] Evitar duplicacao em cron, retry e chamadas manuais.
- [x] Fazer `SubscriptionsService.create` processar somente a assinatura criada,
  sem disparar verificacao global.
- [x] Restringir o endpoint `/subscriptions/trigger` para processar somente o
  usuario autenticado, mantendo o processamento global apenas no scheduler.

### CORE-006 - Criar pagamento de fatura atomico no backend

**Problema:** a UI executa duas chamadas independentes, podendo debitar a
carteira sem baixar a fatura.

- [x] Criar endpoint de dominio
  `POST /cards/:id/pay-invoice`.
- [x] Validar usuario, cartao, carteira de origem, valor, saldo e fatura.
- [x] Criar os dois lancamentos dentro da mesma transacao Prisma.
- [x] Vincular as duas pontas com `financial_event_id`.
- [x] Fazer a modal usar apenas o novo endpoint.
- [x] Remover o hook que aponta para `/wallets/:id/pay-invoice`.
- [x] Testar rollback quando o segundo lancamento falhar.

### CORE-007 - Validar todas as relacoes da transacao

**Problema:** o CRUD normal nao garante integralmente que cartao, carteira,
categoria e assinatura pertencam ao usuario e sejam compativeis entre si.

- [x] Validar `card.wallet_id === transaction.wallet_id`.
- [x] Validar que cartao, carteira, categoria e assinatura pertencem ao usuario.
- [x] Revalidar relacoes no update, inclusive quando somente `card_id` mudar.
- [x] Garantir que `subscription_id` seja compativel com carteira e categoria.
- [x] Retornar erros de dominio, sem expor existencia de recursos alheios.

## Fase 2 - Modelo financeiro e contratos (P1)

### CORE-008 - Separar parcelas, recorrencias e assinaturas

- [x] Substituir o uso ambiguo de `installment_id` por conceitos distintos:
  `installment_group_id`, `recurrence_id` e `subscription_id`.
- [x] Definir quem gera recorrencias: recorrencias manuais sao persistidas pelo
  backend; assinaturas futuras sao projecoes derivadas de `next_billing_date`,
  sem persistir antes do vencimento.
- [x] Centralizar o calculo de proxima ocorrencia em funcao pura testada em cada
  runtime.
- [x] Corrigir recorrencias nos dias 29, 30 e 31 e anos bissextos.

### CORE-009 - Parcelar valores sem perder centavos

- [x] Calcular em centavos inteiros.
- [x] Distribuir o resto entre parcelas de forma deterministica.
- [x] Garantir que a soma seja exatamente igual ao valor original.
- [x] Cobrir R$ 100,00 em 3 e R$ 0,05 em 2 parcelas.

### CORE-010 - Formalizar o dominio de faturas

- [ ] Definir ciclo, fechamento, vencimento e estados aberta, fechada, vencida e
  paga.
- [ ] Definir pagamento parcial e total.
- [ ] Relacionar pagamento ao ciclo correto.
- [ ] Fazer limite comprometido considerar somente eventos ainda devidos.
- [ ] Decidir se sera criada uma entidade `CardInvoice` agora ou uma etapa
  intermediaria com campos estruturados de ciclo/evento.
- [ ] Cobrir compras antes/depois do fechamento e pagamentos parciais.

### CORE-011 - Impedir alteracao de saldo sem historico

- [ ] Remover do controller ou restringir internamente
  `add-incoming`/`add-expense`.
- [ ] Modelar ajuste manual como transacao auditavel com motivo.
- [ ] Criar rotina de reconciliacao que recompute o saldo pelo historico e
  reporte divergencias por carteira.

### CORE-012 - Vincular transferencias

- [ ] Adicionar `transfer_id` ou `financial_event_id` comum as duas pontas.
- [ ] Parar de depender de nome de categoria/descricao para identificar
  transferencia.
- [ ] Garantir exclusao/estorno atomico das duas pontas.
- [ ] Corrigir o hook para enviar `fromId` e `toId`, ou padronizar o DTO inteiro
  em `fromWalletId` e `toWalletId`.

### CORE-013 - Alinhar contratos frontend/backend

- [x] Corrigir `useCreateBudget`: enviar `limit`, nao `limit_value`.
- [x] Fazer `useUpdateBudget` usar o upsert `POST /budgets`.
- [x] Corrigir o contrato do hook de transferencia.
- [x] Remover hooks apontando para rotas inexistentes.
- [x] Criar DTO validado para budget, transferencia e pagamento de fatura.
- [x] Adicionar testes de contrato para budget, transferencia e pagamento de
  fatura atomico.

### CORE-014 - Tipar valores financeiros estruturais

- [ ] Transformar `transaction_type`, `payment_method` e `wallet.type` em enums
  ou constantes validadas de uma unica fonte.
- [ ] Rejeitar metodos incompatíveis com carteira/cartao.
- [ ] Remover `as any` e `any[]` do caminho financeiro.
- [ ] Definir tipos de request e response compartilhados ou gerados.

### CORE-015 - Definir politica de delecao e arquivamento

- [ ] Decidir comportamento para carteira, cartao e categoria com historico:
  bloquear, arquivar ou migrar.
- [ ] Preferir preservacao do historico financeiro.
- [ ] Tornar `onDelete` explicito nas relacoes Prisma.
- [ ] Retornar mensagens acionaveis na UI.
- [ ] Testar integridade referencial de todas as exclusoes.

## Fase 3 - Calculos, importacao e desempenho (P1/P2)

### CORE-016 - Substituir filtros textuais por metadados

- [x] Remover filtros por descricoes como "Pagamento de fatura" e
  "Aplicacao RDB".
- [x] Usar `payment_method`, `event_type` e `financial_event_id` como metadado
  estruturado.
- [x] Compartilhar a mesma regra entre dashboard, budgets e contexto da
  IA.
- [x] Garantir que transferencias e pagamentos internos nao contem como renda
  ou despesa real.

### CORE-017 - Corrigir importacao de extratos

- [ ] Definir importacao atomica ou parcial com relatorio e `import_batch_id`.
- [ ] Melhorar deduplicacao com descricao normalizada, identificador externo e
  score, sem depender apenas de data/valor/tipo.
- [ ] Validar limite do grupo completo de parcelas importadas.
- [ ] Permitir desfazer um lote com seguranca.
- [ ] Criar fixtures reais e anonimizadas de CSV/OFX.

### CORE-018 - Eliminar N+1 de budgets

- [x] Agregar despesas de todas as categorias em uma unica query agrupada.
- [x] Combinar resultados com budgets em memoria.
- [x] Manter a agregacao encapsulada em `BudgetsService`, ja reutilizado pelo
  dashboard.

### CORE-019 - Adicionar indices financeiros

- [x] Adicionar indices para:
  `wallet_id + transaction_date`, `card_id + transaction_date`,
  `subscription_id`, `installment_group_id`,
  `is_processed + transaction_date` e `category_id + transaction_date`.
- [ ] Medir as queries principais com volume representativo antes de producao.

### CORE-020 - Padronizar periodos e timezone

- [ ] Definir timezone de negocio e estrategia de persistencia UTC.
- [ ] Evitar depender do timezone local do processo para fim do dia/mes.
- [ ] Exibir claramente o periodo de cada KPI.
- [ ] Alinhar dashboard, budgets, faturas e lista de transacoes.

## Fase 4 - Simplificacao e UX (P2/P3)

### CORE-021 - Dividir `StatementImportService`

- [ ] Extrair parser CSV puro.
- [ ] Extrair parser OFX puro.
- [ ] Extrair inferencia/normalizacao.
- [ ] Extrair detector de duplicados.
- [ ] Extrair validador e aplicador do lote.
- [ ] Evitar repositorios genericos ou hierarquias sem necessidade.

### CORE-022 - Dividir componentes grandes do frontend

- [ ] Separar `ImportStatementModal` em tabela, editor de linha, resumo e hook
  local de estado.
- [ ] Separar `TransactionsPage` em filtros, agrupamento/projecao, resumo e lista.
- [ ] Manter calculos financeiros em funcoes puras, fora dos componentes.
- [ ] Corrigir dependencias do `useMemo` dos filtros de data.

### CORE-023 - Centralizar cache e erros financeiros

- [ ] Criar matriz de invalidacao para transacoes, wallets, cards, dashboard e
  budgets.
- [ ] Evitar chamadas `api.get/post` diretas nos componentes do CORE.
- [ ] Padronizar extracao de erro backend e mensagens acionaveis.
- [ ] Preservar o modal aberto e os dados preenchidos quando uma mutacao falhar.

### CORE-024 - Desacoplar o CORE de investimentos

- [ ] Remover o enriquecimento de portfolio do caminho comum de
  `WalletsService.findAll`, ou torna-lo consulta separada e opcional.
- [ ] Manter regras de investimento fora dos filtros centrais, usando apenas
  metadados financeiros genericos quando necessario.
- [ ] Garantir que falha do modulo de investimentos nao impeça listar carteiras
  comuns.

### CORE-025 - Melhorar observabilidade

- [ ] Substituir `console.log/error` por `Logger` contextual.
- [ ] Registrar IDs de evento, transacao, carteira e lote sem dados sensiveis.
- [ ] Criar log/resultado da reconciliacao de saldo.
- [ ] Medir falhas de importacao, assinatura e maturacao.

## Matriz minima de testes

### Backend

- [ ] Receita e despesa alteram saldo exatamente uma vez.
- [ ] Falha de saldo nao persiste transacao parcial.
- [ ] Falha de persistencia nao altera saldo.
- [ ] Update reverte o estado antigo e aplica o novo atomicamente.
- [ ] Delete reverte somente impactos processados.
- [ ] Duas despesas concorrentes nao ultrapassam o saldo.
- [ ] Transacao futura matura uma unica vez sob concorrencia.
- [ ] Ciclo de assinatura e idempotente sob retry/concorrencia.
- [ ] Parcelas somam exatamente o valor original.
- [ ] Escopos `THIS`, `THIS_AND_FUTURE` e `ALL` funcionam.
- [ ] Pagamento de fatura cria ambos os lados ou nenhum.
- [ ] Cartao de outra carteira/usuario e rejeitado.
- [ ] Transferencia vinculada nao entra como renda/despesa real.
- [ ] Reconciliacao encontra e reporta divergencias.

### Frontend/contratos

- [ ] Hooks chamam somente rotas existentes e com payload correto.
- [ ] Filtros de data recalculam imediatamente.
- [ ] Recorrencias nos dias 29, 30 e 31 sao exibidas corretamente.
- [ ] Pagamento de fatura usa uma unica mutacao.
- [ ] Erro backend preserva formulario e apresenta causa util.
- [ ] Mutacoes invalidam todos os recursos financeiros afetados.

### E2E prioritario

- [ ] Criar carteira, receita, despesa e conferir saldo/historico.
- [ ] Tentar despesa sem saldo e confirmar ausencia de lancamento parcial.
- [ ] Criar e editar compra parcelada.
- [ ] Criar assinatura vencida e confirmar um unico ciclo.
- [ ] Criar cartao, comprar, fechar/pagar fatura e conferir limite.
- [ ] Transferir entre carteiras e conferir as duas pontas vinculadas.
- [ ] Importar extrato com duplicados e desfazer lote.
- [ ] Criar budget e conferir progresso apos mutacoes.

## Gates de conclusao do CORE

- [ ] Nenhum item P0 aberto.
- [ ] Saldo reconciliado com o historico em todas as carteiras de teste.
- [ ] Nenhum endpoint publico altera saldo sem evento auditavel.
- [ ] Nenhum hook financeiro aponta para rota inexistente.
- [ ] Testes unitarios, integracao e E2E prioritarios passando.
- [ ] Typecheck backend/frontend passando.
- [ ] Fluxos concorrentes de maturacao e assinatura sao idempotentes.
- [ ] Politicas de fatura, parcelas, recorrencias e delecao documentadas.

## Ordem sugerida de execucao

1. CORE-001, CORE-002 e CORE-007.
2. CORE-003, CORE-004 e CORE-005.
3. CORE-006 e CORE-010.
4. CORE-008, CORE-009, CORE-011 e CORE-012.
5. CORE-013, CORE-014 e CORE-015.
6. CORE-016 a CORE-020.
7. CORE-021 a CORE-025.
