# Gmail para verificacao de cadastro

## Requisitos

- Quando um cadastro exigir verificacao, a API deve aguardar o SMTP confirmar o
  envio antes de responder sucesso.
- Quando o SMTP estiver ausente ou falhar, a conta permanece pendente e a API
  deve responder erro acionavel, permitindo reenvio posterior.
- Credenciais nunca devem ser commitadas, retornadas pela API ou registradas em
  logs.

## Backend

- Gmail SMTP configurado por `MAIL_HOST`, `MAIL_PORT`, `MAIL_SECURE`,
  `MAIL_USER`, `MAIL_PASS` e `MAIL_FROM`.
- Porta 587 usa STARTTLS; porta 465 usa TLS implicito.
- Cadastro e recadastro pendente aguardam `sendVerificationEmail`.
- Falhas viram `503 Service Unavailable` sem expor resposta do provedor.

## Frontend

- O fluxo existente ja preserva o cadastro pendente e permite reenviar o codigo.
- A mensagem de erro HTTP continua sendo apresentada pelo tratamento atual.

## Seguranca

- `MAIL_PASS` deve ser uma senha de app do Google, nunca a senha normal.
- `backend/.env` permanece ignorado pelo Git.
- Nome do usuario e escapado antes de entrar no HTML.
- O codigo nao aparece em logs.

## Aceite

- Teste de envio bem-sucedido.
- Teste de falha SMTP sem falso sucesso.
- Teste de configuracao ausente sem tentativa de conexao.
- Typecheck e suite de auth passando.
