ALTER TABLE "InvestmentPosition"
ADD COLUMN "asset_type" TEXT NOT NULL DEFAULT 'LISTED';

ALTER TABLE "InvestmentOperation"
ADD COLUMN "asset_type" TEXT NOT NULL DEFAULT 'LISTED',
ADD COLUMN "cdb_cdi_percentage" DECIMAL(10,4),
ADD COLUMN "cdb_cdi_rate" DECIMAL(10,4);

DROP INDEX IF EXISTS "InvestmentPosition_wallet_id_symbol_market_key";
DROP INDEX IF EXISTS "InvestmentPosition_wallet_id_market_idx";
DROP INDEX IF EXISTS "InvestmentPosition_symbol_market_idx";

CREATE UNIQUE INDEX "InvestmentPosition_wallet_id_symbol_market_asset_type_key"
ON "InvestmentPosition"("wallet_id", "symbol", "market", "asset_type");

CREATE INDEX "InvestmentPosition_wallet_id_market_asset_type_idx"
ON "InvestmentPosition"("wallet_id", "market", "asset_type");

CREATE INDEX "InvestmentPosition_symbol_market_asset_type_idx"
ON "InvestmentPosition"("symbol", "market", "asset_type");
