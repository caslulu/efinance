-- AlterTable: add card_id to Subscription
ALTER TABLE "Subscription" ADD COLUMN "card_id" INTEGER;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "Card"("id") ON DELETE SET NULL ON UPDATE CASCADE;
