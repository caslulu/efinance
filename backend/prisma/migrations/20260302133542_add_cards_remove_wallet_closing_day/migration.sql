/*
  Warnings:

  - You are about to drop the column `closing_day` on the `Wallet` table. All the data in the column will be lost.
  - You are about to drop the column `due_day` on the `Wallet` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "card_id" INTEGER;

-- AlterTable
ALTER TABLE "Wallet" DROP COLUMN "closing_day",
DROP COLUMN "due_day";

-- CreateTable
CREATE TABLE "Card" (
    "id" SERIAL NOT NULL,
    "wallet_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "flag" TEXT NOT NULL,
    "closing_day" INTEGER NOT NULL,
    "due_day" INTEGER NOT NULL,
    "card_limit" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "Card"("id") ON DELETE SET NULL ON UPDATE CASCADE;
