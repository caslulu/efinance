DROP INDEX IF EXISTS "InvestmentPosition_wallet_id_symbol_market_key";
DROP INDEX IF EXISTS "InvestmentPosition_wallet_id_market_idx";
DROP INDEX IF EXISTS "InvestmentPosition_symbol_market_idx";

CREATE UNIQUE INDEX IF NOT EXISTS "InvestmentPosition_wallet_id_symbol_market_asset_type_key"
ON "InvestmentPosition"("wallet_id", "symbol", "market", "asset_type");

CREATE INDEX IF NOT EXISTS "InvestmentPosition_wallet_id_market_asset_type_idx"
ON "InvestmentPosition"("wallet_id", "market", "asset_type");

CREATE INDEX IF NOT EXISTS "InvestmentPosition_symbol_market_asset_type_idx"
ON "InvestmentPosition"("symbol", "market", "asset_type");
