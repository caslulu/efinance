# 💰 Finance Pro - Gestão Financeira Inteligente

![Badge Status](https://img.shields.io/badge/Status-Em_Desenvolvimento-yellow)
![Badge License](https://img.shields.io/badge/License-MIT-blue)
![Badge Stack](https://img.shields.io/badge/Stack-NestJS_|_React_|_Prisma-green)

Uma aplicação Fullstack completa para controle financeiro pessoal, projetada para ir além do básico. O sistema foca em previsibilidade de investimentos, controle de múltiplas carteiras (wallets) e decisões baseadas em dados.

## 📋 Funcionalidades Principais

O projeto foi arquitetado para atender aos 6 pilares definidos no escopo:

1.  **Fluxo de Caixa Mensal:** Controle detalhado de entradas e saídas, permitindo visualizar o saldo líquido mês a mês.
2.  **Múltiplas Carteiras (Wallets):** Gerenciamento centralizado de diferentes fontes de dinheiro (Nubank, Inter, Dinheiro Físico, Vale Refeição).
3.  **Investimentos Híbridos & Previsão:**
    * Suporte a **Renda Fixa Pré-fixada** (ex: 13% a.a).
    * Suporte a **Renda Fixa Pós-fixada** (ex: 110% do CDI) integrada a uma tabela de Indicadores Econômicos.
    * Cálculo de previsão de resgate (Forecasting) baseado nas taxas atuais.
4.  **Gestão de Patrimônio:** Visão clara da separação entre dinheiro corrente (caixa) e dinheiro investido (ativos).
5.  **Lista de Desejos (Wishlist):** Planejamento de compras futuras organizadas por pastas (ex: "Viagem", "Setup"), com priorização.
6.  **Analytics & IA:** Gráficos de categorias de gastos e integração futura com IA para análise de saúde financeira.

---

## 🚀 Tech Stack

O projeto utiliza uma arquitetura **Monorepo** moderna baseada em TypeScript.

### Backend (API)
* **Framework:** [NestJS](https://nestjs.com/) - Arquitetura modular, injecção de dependência e escalabilidade.
* **Database:** [PostgreSQL](https://www.postgresql.org/) - Banco de dados relacional robusto.
* **ORM:** [Prisma](https://www.prisma.io/) - Modelagem de dados declarativa e Type-safety garantida.
* **Linguagem:** TypeScript.

### Frontend (Interface)
* **Framework:** [React](https://react.dev/) + [Vite](https://vitejs.dev/).
* **Linguagem:** TypeScript.
* **Estilização:** (Planejado: TailwindCSS / ShadcnUI).

---

## 🗄️ Destaques da Modelagem de Dados

O banco de dados não é apenas um CRUD simples. Ele foi modelado para suportar regras de negócio financeiras reais:

* **Parcelamento Explodido:** Transações parceladas (ex: 10x no cartão) geram registros futuros no banco, garantindo que o fluxo de caixa dos meses seguintes já nasça preenchido.
* **Indicadores Econômicos:** Tabela dedicada para indexadores (CDI, SELIC, IPCA). Os investimentos se relacionam a esses indicadores, permitindo atualizar a rentabilidade de toda a carteira alterando apenas a taxa do indicador.
* **UUID vs Int:** Uso de chaves seguras para agrupamento de parcelas.

---

## 🛠️ Instalação e Configuração

### Pré-requisitos
* Node.js (v18 ou superior)
* Docker (Recomendado para o Banco de Dados)
* Git

## 🤝 Contribuição

Este projeto é desenvolvido para fins de estudo e portfólio. Sugestões de melhoria na arquitetura ou lógica financeira são bem-vindas.


