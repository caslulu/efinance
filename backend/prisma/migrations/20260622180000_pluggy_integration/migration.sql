-- AlterTable
ALTER TABLE "Wallet"
  ADD COLUMN "pluggy_item_id" TEXT,
  ADD COLUMN "pluggy_account_id" TEXT,
  ADD COLUMN "external_source" TEXT,
  ADD COLUMN "pluggy_last_sync_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Transaction"
  ADD COLUMN "external_id" TEXT,
  ADD COLUMN "external_source" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_pluggy_account_id_key" ON "Wallet"("pluggy_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_external_id_key" ON "Transaction"("external_id");

-- CreateIndex
CREATE INDEX "Transaction_external_source_idx" ON "Transaction"("external_source");
