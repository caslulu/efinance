# Importação assistida e lançamentos por texto

Na tela de carteiras, use **Importar extrato ou adicionar com IA** (também disponível no cartão).
Escolha arquivos ou descreva suas entradas e gastos, incluindo datas e valores.

- **IA assistida:** interpreta o conteúdo, sugere categorias existentes e faz perguntas agrupadas sobre ambiguidades. Responda e atualize a prévia; faça ajustes manuais depois das respostas.
- **IA automática:** prepara a prévia sem perguntas. Linhas ambíguas continuam desmarcadas para revisão.
- **Convencional:** mantém a leitura de OFX/CSV sem envio à IA.

Todos os modos exigem confirmação na tabela. A IA não possui ferramentas de escrita nem acesso direto ao banco. A gravação reutiliza as regras existentes de categorias, saldo, cartão e parcelas. Transferências entre contas próprias devem usar a função de transferência entre carteiras, excluindo a linha correspondente da importação.

## Configuração

A integração reutiliza o Ollama do chat. Configure no ambiente do backend:

```dotenv
OLLAMA_BASE_URL=https://ollama.com
OLLAMA_API_KEY=sua-chave
OLLAMA_MODEL=gpt-oss:20b
```

Para Ollama local, use `OLLAMA_BASE_URL=http://localhost:11434` (ou o endereço acessível pelo container) e um modelo instalado; a chave é opcional. No Docker de desenvolvimento, os valores de `docker-compose.yml` vêm do ambiente/root `.env`; em produção, use `backend/.env.prod`.

Ollama Cloud não oferece saída restrita por JSON Schema; a aplicação solicita JSON no prompt e valida a resposta no backend. Servidores próprios também recebem `format: "json"`. Respostas inválidas, truncadas ou declaradas parciais são rejeitadas. Nenhum erro de provedor é retornado com conteúdo financeiro ou credenciais.

## Formatos e limites

- Com IA: OFX, CSV, XLSX e TXT. Sem suporte a XLS antigo, PDF, imagens ou planilhas com senha nesta versão.
- Até 5 MB por arquivo, 60 mil caracteres extraídos e 500 lançamentos por análise. Fontes maiores precisam ser divididas; não são truncadas silenciosamente.
- Planilhas incluem abas e números de linha, com limites de 5 mil linhas e 100 colunas. Fórmulas usam o resultado salvo pelo Excel; não são executadas ou recalculadas.
- Texto inicial e histórico de esclarecimentos: até 20 mil caracteres cada.
- Tempo limite do provedor: 120 segundos. Até 10 análises por minuto pelo limitador da API.

O serviço recebe a fonte enviada, o nome/tipo da carteira, os nomes/IDs das categorias desse usuário e os esclarecimentos. O provedor é o configurado no servidor; políticas de retenção dependem desse provedor. Os arquivos e rascunhos não são persistidos por este fluxo. Fechar a janela descarta a prévia; uma requisição já enviada ao provedor pode terminar.

Cada linha mantém um trecho da fonte na prévia. Referências não localizadas, categorias desconhecidas e campos ausentes exigem revisão. A detecção existente de possíveis duplicidades é aplicada à prévia, e o frontend também sinaliza repetições no lote. A confirmação permite selecionar intencionalmente essas linhas. Falhas parciais mantêm apenas as linhas com falha para nova tentativa.

## Verificação

Os testes usam respostas de IA simuladas e planilhas XLSX reais geradas em memória. Antes de habilitar uso sem revisão detalhada, avalie omissões, sinais, datas, parcelas e duplicidades em extratos reais de diferentes bancos. A indicação `complete` da IA e a validação de formato não comprovam que a extração está semanticamente correta. Esta versão mantém a confirmação humana em todos os modos.

Referências: [Ollama — saída estruturada](https://docs.ollama.com/capabilities/structured-outputs), [API de chat](https://docs.ollama.com/api/chat).
