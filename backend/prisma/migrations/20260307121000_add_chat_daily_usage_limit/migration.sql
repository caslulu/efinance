-- CreateTable: track daily AI question usage per user
CREATE TABLE "ChatDailyUsage" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "usage_date" DATE NOT NULL,
    "questions_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatDailyUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChatDailyUsage_user_id_usage_date_key" ON "ChatDailyUsage"("user_id", "usage_date");

-- CreateIndex
CREATE INDEX "ChatDailyUsage_user_id_usage_date_idx" ON "ChatDailyUsage"("user_id", "usage_date");

-- AddForeignKey
ALTER TABLE "ChatDailyUsage" ADD CONSTRAINT "ChatDailyUsage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
