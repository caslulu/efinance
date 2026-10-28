Avaliação do Finance Pro — 24/10/2026

O principal obstáculo para adoção é a quantidade de trabalho exigida antes de obter uma resposta útil. Hoje o usuário precisa entender carteiras, saldos, cartões, categorias, modos de importação, recorrências e parcelas. A importação com IA reduz a digitação, mas ainda termina em uma revisão extensa e usa regras de saldo que dificultam carregar um histórico real.

Para o uso descrito pelo proprietário, a prioridade deveria ser: importar um extrato, resolver poucas pendências e entender os gastos do mês com confiança.

**Escopo e evidências**

- Revisão do código atual, incluindo alterações locais ainda não commitadas. Nenhuma implementação existente foi alterada nesta avaliação.
- Foco em entrada no sistema, carteiras, transações, cartões, dashboard e importação convencional/com IA. Outros módulos não receberam auditoria aprofundada.
- Backend: 22 suítes e 126 testes passaram. Frontend: 6 arquivos e 30 testes passaram. Os dois builds passaram.
- Reproduções adicionais executaram os serviços compilados com dependências de banco simuladas: saldo após importar histórico, importação dependente da ordem, valor internacional em CSV, reimportação do CSV exportado e exclusão de pagamento de fatura.
- Não executei navegação em navegador, testes E2E contra banco real nem análise com provedor de IA real. As observações de usabilidade derivam dos fluxos e componentes implementados; a qualidade semântica da IA em extratos reais permanece por validar.

P1 abaixo significa corrigir antes de depender do sistema para acompanhar dinheiro real. P2 significa corrigir em seguida por afetar confiança ou esforço de uso.

**1. P1 — Saldo atual e importação histórica têm semânticas incompatíveis**

O onboarding pede “Saldo Atual”. Cada lançamento passado importado aplica novamente seu impacto nesse saldo. Não existe data de referência para separar o saldo informado dos movimentos já incluídos nele.

Reprodução: carteira com saldo atual de R$ 1.000; importar salário de R$ 3.000 e gastos de R$ 2.000 já refletidos nesse saldo. Resultado observado: R$ 2.000, com ambas as linhas importadas sem falha. O saldo real continuaria R$ 1.000.

É um problema no contrato entre os fluxos: aplicar movimentos é correto quando o saldo informado representa o início do período, mas a interface pede o saldo atual.

Proposta: saldo com data de referência e conciliação na primeira importação. Diferenciar registrar histórico de acrescentar movimentação nova. Mostrar o saldo resultante antes de confirmar. Não resolver pedindo ao usuário que deduza e edite manualmente o saldo inicial.

Referências: [OnboardingPage.tsx](../frontend/src/features/onboarding/pages/OnboardingPage.tsx#L93), [statement-import.service.ts](../backend/src/transactions/statement-import.service.ts#L571), [transaction-impact.service.ts](../backend/src/transactions/transaction-impact.service.ts).

**2. P1 — Importação depende da ordem das linhas e bloqueia históricos válidos**

A confirmação grava e debita uma linha por vez. `addExpense` exige saldo disponível naquele instante. Extratos em ordem decrescente, arquivos combinados e a ordenação de conflitos da própria prévia podem colocar despesas antes das receitas que as financiam.

Reprodução: saldo inicial zero; primeira linha despesa de R$ 100; segunda linha receita de R$ 200. Resultado observado: receita importada, despesa recusada por saldo insuficiente e saldo final de R$ 200. Processando a receita antes, o resultado seria R$ 100.

Além disso, um histórico que realmente ficou negativo não pode ser representado por essa regra.

Proposta: tratar importação como reconstrução de histórico, com política explícita de saldo inicial e ordenação cronológica estável. Definir se contas bancárias podem ficar negativas. Ordenar apenas as linhas não resolve o conflito do item 1.

Referências: [statement-import.service.ts](../backend/src/transactions/statement-import.service.ts#L814), [wallets.service.ts](../backend/src/wallets/wallets.service.ts#L81), [ImportStatementModal.tsx](../frontend/src/features/wallets/components/ImportStatementModal.tsx#L1055).

**3. P1 — Exclusão/edição pode separar as duas pontas de um evento financeiro**

O pagamento de fatura cria duas transações com o mesmo `financial_event_id`: débito da conta e liquidação do cartão. O CRUD de transações trata cada registro isoladamente e não usa esse vínculo para atualizar ou desfazer o evento completo.

Reprodução com serviço simulado: excluir o débito de um pagamento de R$ 100 chamou a reversão de saldo e excluiu somente aquele ID. A liquidação do cartão não foi incluída na exclusão. Isso permite devolver dinheiro à conta e manter a fatura paga.

Transferências também criam duas pontas, mas não recebem identificador de evento no fluxo atual. Excluir uma ponta pode deixar a outra intacta.

Proposta: eventos de pagamento e transferência devem ser editados/desfeitos atomicamente; alternativamente, bloquear o CRUD isolado dessas linhas e oferecer uma ação específica.

Referências: [cards.service.ts](../backend/src/cards/cards.service.ts#L131), [transactions.service.ts](../backend/src/transactions/transactions.service.ts#L500), [wallets.service.ts](../backend/src/wallets/wallets.service.ts#L126).

**4. P1 — Repetir uma confirmação pode duplicar lançamentos**

A detecção de duplicidades acontece na prévia. A confirmação não recebe uma chave de idempotência nem mantém identidade persistente de lote/linha. Se o servidor gravar e a resposta se perder, repetir o pedido pode gravar tudo novamente.

Há outro caminho no frontend: uma falha parcial mantém somente as linhas com falha em `rows`, mas preserva as prévias originais. Se ainda houver perguntas e o usuário atualizar a análise, `handleClarify` reconstrói linhas a partir dessas prévias, podendo recolocar linhas já importadas. A nova análise consulta duplicidades, mas linhas recuperadas de outros arquivos usam prévias antigas.

Proposta: persistir identidade de lote e linha, com confirmação idempotente. Depois de uma confirmação parcial, preservar explicitamente o estado de linhas já gravadas e permitir retentar apenas as pendentes. Duplicidades legítimas devem continuar possíveis por uma ação explícita.

Referências: [statement-import.service.ts](../backend/src/transactions/statement-import.service.ts#L787), [ImportStatementModal.tsx](../frontend/src/features/wallets/components/ImportStatementModal.tsx#L189), [ImportStatementModal.tsx](../frontend/src/features/wallets/components/ImportStatementModal.tsx#L310), [schema.prisma](../backend/prisma/schema.prisma).

**5. P2 — Importação de cartão não atualiza o cache de faturas/limite**

`useConfirmStatementImport` invalida transações, carteiras, dashboard, investimentos e orçamento, mas não `queryKeys.cards`. Os cartões visíveis usam consultas próprias por carteira. O cache tem validade de cinco minutos e não atualiza ao focar a janela.

Consequência: a importação pode concluir e o cartão continuar exibindo os valores anteriores de fatura e limite. Criar, editar e excluir transações pelos hooks também omite essa invalidação.

Proposta: centralizar a invalidação dos dados financeiros derivados, incluindo cartões. Validar que importar, editar e excluir uma compra atualiza imediatamente fatura e limite.

Referências: [useTransactions.ts](../frontend/src/hooks/useTransactions.ts#L136), [SortableWalletCard.tsx](../frontend/src/features/wallets/components/SortableWalletCard.tsx#L38), [queryClient.ts](../frontend/src/lib/queryClient.ts#L8).

**6. P2 — Valores internacionais e CSV exportado pelo próprio app têm problemas na importação convencional**

O parser trata qualquer número com ponto e vírgula como formato brasileiro. Reprodução: `1,234.56` virou `1.23456`, em vez de `1234.56`. A prévia fica errada; a confirmação pode rejeitar o valor pelas casas decimais. O parser do valor editável repete a mesma suposição.

O CSV exportado usa o cabeçalho `Nome`, ausente dos aliases de descrição da importação. Reprodução com o formato exportado: `Mercado` voltou como descrição `null`. Categoria também não é reconstruída pelo parser convencional. A exportação inclui projeções virtuais de recorrências, sem uma coluna explícita que diferencie previsão de registro real.

Proposta: normalizar números conforme o formato detectado, recusar ambiguidades com mensagem clara e garantir um contrato de exportação/reimportação. Separar exportação de histórico de exportação de previsões.

Referências: [statement-import.service.ts](../backend/src/transactions/statement-import.service.ts#L64), [statement-import.service.ts](../backend/src/transactions/statement-import.service.ts#L342), [TransactionsPage.tsx](../frontend/src/features/transactions/pages/TransactionsPage.tsx#L184), [ImportStatementModal.tsx](../frontend/src/features/wallets/components/ImportStatementModal.tsx#L1141).

**7. P2 — Duplicidade é definida por data, valor e tipo, sem distinguir compras diferentes**

Duas despesas legítimas de R$ 25 no mesmo dia, em estabelecimentos diferentes, entram em conflito. No lote, a segunda começa desmarcada. Contra o banco, todas as linhas com essa combinação podem começar desmarcadas. É uma heurística conservadora, mas pode omitir gastos se o usuário confirmar sem perceber.

Proposta: aproveitar identificadores bancários, quando disponíveis, descrição normalizada e quantidade de ocorrências. Mostrar separadamente “repetição provável” e “mesmo valor no mesmo dia”, com revisão rápida. Recalcular avisos quando o usuário editar data/valor/tipo; hoje os indicadores derivam da prévia original.

Referências: [statement-import.service.ts](../backend/src/transactions/statement-import.service.ts#L515), [ImportStatementModal.tsx](../frontend/src/features/wallets/components/ImportStatementModal.tsx#L1022).

**8. P2 — Dashboard e detalhamento usam períodos diferentes**

O gráfico de categorias usa o intervalo escolhido. Ao clicar na categoria, o endpoint ignora esse intervalo, usa aproximadamente o último mês e limita a 20 transações sem paginação ou aviso de truncamento. A soma dos detalhes pode não explicar o gráfico.

Sem filtro, a tela mostra o nome do mês atual, mas a agregação padrão de categorias começa na mesma data do mês anterior, não no primeiro dia do mês atual. Isso também diverge dos resumos mensais da tela de transações.

Proposta: período explícito e compartilhado entre resumo, gráfico, detalhamento e exportação. Passar intervalo ao endpoint de categoria e informar paginação/total.

Referências: [DashboardPage.tsx](../frontend/src/features/dashboard/pages/DashboardPage.tsx#L38), [useDashboard.ts](../frontend/src/hooks/useDashboard.ts#L25), [dashboard.service.ts](../backend/src/dashboard/dashboard.service.ts#L27), [dashboard.service.ts](../backend/src/dashboard/dashboard.service.ts#L414).

**9. P2 — “Recorrente” tem comportamentos diferentes por fluxo**

No cadastro manual, marcar recorrência pode gerar 12 lançamentos. Na importação, grava-se apenas `is_recurring`, sem criar assinatura ou grupo de recorrência. A previsão da tela de transações vem das assinaturas, não desse indicador isolado.

Proposta: diferenciar “este lançamento pertence a um gasto recorrente” de “criar agendamento para os próximos meses”. Ao importar, oferecer criação de uma regra futura explicitamente, com data inicial para evitar gerar novamente o histórico.

Referências: [transactions.service.ts](../backend/src/transactions/transactions.service.ts#L296), [statement-import.service.ts](../backend/src/transactions/statement-import.service.ts#L623), [TransactionsPage.tsx](../frontend/src/features/transactions/pages/TransactionsPage.tsx#L57).

**Lacunas que mantêm a experiência complexa**

1. **A ação principal não está na entrada do produto.** O onboarding termina no dashboard; importar exige descobrir a ação dentro de uma carteira/cartão. Proposta: “Importar extrato” e “Registrar gasto” no início, com conta escolhida ou criada no próprio fluxo.
2. **A prévia é uma planilha extensa.** A tabela tem largura mínima de 1.180 px e oito colunas, incluindo controles à direita. Pelo código, isso exige rolagem horizontal no celular. Proposta: resumo de totais e período, linhas claras recolhidas e cartões de revisão somente para pendências; tabela completa como opção.
3. **Escolher o mecanismo de leitura vira trabalho do usuário.** Há modos assistido, automático e convencional antes de qualquer resultado. Proposta: fluxo padrão único; leitura estruturada quando possível e IA para interpretar/classificar ou resolver dúvidas. Preferências avançadas podem ficar em uma opção secundária, respeitando a escolha de envio à IA.
4. **Faltam categorias iniciais para a IA aproveitar.** O serviço só sugere categorias já existentes; não encontrei criação de categorias padrão no cadastro/onboarding. Uma conta nova tende a importar para “Outro”. Proposta: conjunto inicial pequeno, editável, e correção por estabelecimento em lote.
5. **Não há conferência contábil da extração.** JSON válido, `complete=true` e trecho literal não provam que todos os movimentos foram lidos nem que seus valores/sinais estão certos. Proposta: comparar contagem e totais de entradas/saídas, saldo inicial/final e período quando a fonte trouxer esses dados. Para OFX/CSV estruturado, usar os movimentos determinísticos como referência.
6. **Revisar não deixa progresso durável.** Fechar a janela descarta arquivo/prévia/ajustes, e uma nova resposta à IA refaz os ajustes do arquivo. Proposta: rascunho recuperável e confirmação antes de abandonar alterações. Ao reanalisar, preservar correções ou mostrar o que mudou.
7. **Lotes grandes dão pouco retorno intermediário.** Os arquivos são analisados sequencialmente; as prévias só aparecem quando todos terminam. Uma falha posterior impede aproveitar os resultados anteriores naquela tentativa. Proposta: progresso por arquivo, resultados incrementais e retentativa individual.
8. **Movimentos internos ainda exigem sair da importação.** Transferências próprias precisam ser excluídas e cadastradas em outra função. Pagamentos de fatura importados não recebem automaticamente o evento que os exclui dos indicadores. Proposta: resolver esses casos na revisão, vinculando conta/cartão e as duas pontas, sem exigir recadastro.
9. **A página inicial apresenta muitas interpretações antes de orientar uma ação.** Patrimônio, autonomia, consumo semanal, aderência, fixos/variáveis e projeções competem por atenção. Proposta: começar com saldo conciliado, gastos do período, próximas contas e pendências; demais análises sob demanda.
10. **Falta uma operação de recuperação adequada ao uso contínuo.** Há exportação de transações, mas não identifiquei backup/restauração completo pela interface. O README ainda assume banco descartável. Antes de transformar o app no registro financeiro principal, definir backup restaurável e evolução do banco que preserve dados.

**O que já vale preservar**

A importação exige confirmação humana, verifica propriedade da carteira/cartão antes de enviar dados ao provedor, valida o formato da resposta e mantém trechos de origem. Linhas ambíguas começam desmarcadas. Há importação sem IA e isolamento do provedor em um serviço. São boas bases para simplificar a interface sem perder revisão e rastreabilidade.

**Sequência recomendada**

1. Corrigir o modelo de saldo/importação histórica, a integridade de eventos financeiros e a idempotência. Atualizar o cache dos cartões e alinhar períodos. Esses problemas prejudicam a confiança mesmo com uma interface melhor.
2. Entregar um único percurso de adoção: importar → escolher/criar conta → conferir resumo → resolver pendências → ver gastos do período. Incluir categorias iniciais e revisão em lote.
3. Validar com extratos pessoais de dois ou três meses, incluindo contas, cartão, transferências e pagamento de fatura. Conferir centavo a centavo contra a fonte e repetir o mesmo arquivo para testar duplicidades.
4. Fazer um uso acompanhado: começar sem lembrar onde estão as funções e observar pontos de hesitação. Critério proposto: primeira importação útil em até cinco minutos; nos retornos, revisar apenas exceções e obter o resumo sem navegar por vários módulos.
5. Depois estabilizar rascunhos, recuperação, regras de classificação e desempenho. O build atual concentra aproximadamente 2,15 MB de JavaScript em um arquivo (611 KB gzip); dividir por rota é uma melhoria secundária, especialmente em celular.

O próximo incremento mais útil é tornar a importação confiável e curta o suficiente para virar rotina. Adicionar mais análises ou opções antes disso tende a aumentar o custo de voltar a usar o produto.
