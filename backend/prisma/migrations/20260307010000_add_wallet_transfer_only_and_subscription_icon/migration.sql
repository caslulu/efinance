-- AlterTable: add is_transfer_only to Wallet
ALTER TABLE "Wallet" ADD COLUMN IF NOT EXISTS "is_transfer_only" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: add icon to Subscription
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "icon" TEXT;