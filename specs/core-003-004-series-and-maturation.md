# CORE-003/004 - Series explicitas e maturacao idempotente

## Requisitos

- Ao editar ou excluir uma transacao agrupada, o usuario deve escolher o escopo
  `THIS`, `THIS_AND_FUTURE` ou `ALL`.
- Cada registro afetado deve ter seu proprio impacto revertido/aplicado.
- Duas execucoes da maturacao nao podem aplicar a mesma transacao duas vezes.

## Arquitetura e seguranca

- O backend valida o enum de escopo e restringe queries de serie ao proprietario.
- A UI envia o escopo escolhido e preserva as datas relativas da serie.
- A maturacao faz claim condicional por ID e `is_processed=false` dentro da
  mesma transacao que aplica o saldo; rollback libera o claim em caso de erro.
- Nao ha novos dados sensiveis ou endpoints publicos.

## Testes

- Update e delete de somente um item.
- Update/delete de toda a serie com impactos individuais.
- Duas maturacoes concorrentes: somente um claim e um impacto.
