-- CreateEnum
CREATE TYPE "InvestmentMarket" AS ENUM ('BR', 'GLOBAL');

-- CreateEnum
CREATE TYPE "InvestmentOperationType" AS ENUM ('BUY', 'SELL', 'DIVIDEND', 'JCP');

-- CreateTable
CREATE TABLE "InvestmentPosition" (
    "id" SERIAL NOT NULL,
    "wallet_id" INTEGER NOT NULL,
    "symbol" TEXT NOT NULL,
    "market" "InvestmentMarket" NOT NULL,
    "currency" TEXT NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "average_cost" DECIMAL(18,6) NOT NULL,
    "invested_amount" DECIMAL(18,6) NOT NULL,
    "invested_amount_brl" DECIMAL(18,6) NOT NULL,
    "realized_pnl" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "realized_pnl_brl" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "dividends_received" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "dividends_received_brl" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "jcp_received" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "jcp_received_brl" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "last_market_price" DECIMAL(18,6),
    "last_market_price_brl" DECIMAL(18,6),
    "last_market_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestmentPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestmentOperation" (
    "id" SERIAL NOT NULL,
    "wallet_id" INTEGER NOT NULL,
    "position_id" INTEGER,
    "type" "InvestmentOperationType" NOT NULL,
    "symbol" TEXT NOT NULL,
    "market" "InvestmentMarket" NOT NULL,
    "currency" TEXT NOT NULL,
    "quantity" DECIMAL(18,6),
    "unit_price" DECIMAL(18,6),
    "gross_amount" DECIMAL(18,6) NOT NULL,
    "gross_amount_brl" DECIMAL(18,6) NOT NULL,
    "fx_rate" DECIMAL(18,6),
    "transaction_date" TIMESTAMP(3) NOT NULL,
    "source_event_key" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvestmentOperation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InvestmentPosition_wallet_id_symbol_market_key" ON "InvestmentPosition"("wallet_id", "symbol", "market");

-- CreateIndex
CREATE INDEX "InvestmentPosition_wallet_id_market_idx" ON "InvestmentPosition"("wallet_id", "market");

-- CreateIndex
CREATE INDEX "InvestmentPosition_symbol_market_idx" ON "InvestmentPosition"("symbol", "market");

-- CreateIndex
CREATE UNIQUE INDEX "InvestmentOperation_source_event_key_key" ON "InvestmentOperation"("source_event_key");

-- CreateIndex
CREATE INDEX "InvestmentOperation_wallet_id_symbol_market_transaction_date_idx" ON "InvestmentOperation"("wallet_id", "symbol", "market", "transaction_date");

-- CreateIndex
CREATE INDEX "InvestmentOperation_position_id_transaction_date_idx" ON "InvestmentOperation"("position_id", "transaction_date");

-- AddForeignKey
ALTER TABLE "InvestmentPosition" ADD CONSTRAINT "InvestmentPosition_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentOperation" ADD CONSTRAINT "InvestmentOperation_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentOperation" ADD CONSTRAINT "InvestmentOperation_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "InvestmentPosition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
