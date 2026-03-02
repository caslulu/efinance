-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "is_processed" BOOLEAN NOT NULL DEFAULT true;

-- Set existing future transactions as unprocessed
UPDATE "Transaction" SET "is_processed" = false WHERE "transaction_date" > NOW();
