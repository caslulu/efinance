-- AlterTable
ALTER TABLE "Card"
  ADD COLUMN "external_id" TEXT,
  ADD COLUMN "external_source" TEXT,
  ADD COLUMN "pluggy_account_id" TEXT,
  ADD COLUMN "pluggy_card_number" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Card_external_id_key" ON "Card"("external_id");

-- CreateIndex
CREATE INDEX "Card_pluggy_account_id_idx" ON "Card"("pluggy_account_id");
