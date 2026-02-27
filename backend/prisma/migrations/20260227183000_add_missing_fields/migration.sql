-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "description" TEXT,
ADD COLUMN     "payment_method" TEXT;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "description" TEXT,
ADD COLUMN     "payment_method" TEXT;

-- AlterTable
ALTER TABLE "TransactionCategory" ADD COLUMN     "icon" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "birthDate" TIMESTAMP(3),
ADD COLUMN     "email" TEXT NOT NULL,
ADD COLUMN     "emailVerificationToken" TEXT,
ADD COLUMN     "emailVerificationTokenExpiry" TIMESTAMP(3),
ADD COLUMN     "fullName" TEXT,
ADD COLUMN     "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isTwoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "resetToken" TEXT,
ADD COLUMN     "resetTokenExpiry" TIMESTAMP(3),
ADD COLUMN     "twoFactorToken" TEXT,
ADD COLUMN     "twoFactorTokenExpiry" TIMESTAMP(3),
ALTER COLUMN "password" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Wallet" ADD COLUMN     "closing_day" INTEGER,
ADD COLUMN     "due_day" INTEGER,
ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "WishlistProduct" ADD COLUMN     "last_checked_price" DECIMAL(10,2),
ADD COLUMN     "send_price_alerts" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "url" TEXT;

-- CreateTable
CREATE TABLE "Budget" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "category_id" INTEGER NOT NULL,
    "limit" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WishlistProductHistory" (
    "id" SERIAL NOT NULL,
    "wishlist_product_id" INTEGER NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WishlistProductHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WishlistPriceAlertNotification" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "wishlist_product_id" INTEGER NOT NULL,
    "old_price" DECIMAL(10,2) NOT NULL,
    "new_price" DECIMAL(10,2) NOT NULL,
    "message" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "notified_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WishlistPriceAlertNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Budget_user_id_category_id_key" ON "Budget"("user_id", "category_id");

-- CreateIndex
CREATE INDEX "WishlistProductHistory_wishlist_product_id_idx" ON "WishlistProductHistory"("wishlist_product_id");

-- CreateIndex
CREATE INDEX "WishlistPriceAlertNotification_user_id_is_read_idx" ON "WishlistPriceAlertNotification"("user_id", "is_read");

-- CreateIndex
CREATE INDEX "WishlistPriceAlertNotification_wishlist_product_id_idx" ON "WishlistPriceAlertNotification"("wishlist_product_id");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "TransactionCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishlistProductHistory" ADD CONSTRAINT "WishlistProductHistory_wishlist_product_id_fkey" FOREIGN KEY ("wishlist_product_id") REFERENCES "WishlistProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishlistPriceAlertNotification" ADD CONSTRAINT "WishlistPriceAlertNotification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishlistPriceAlertNotification" ADD CONSTRAINT "WishlistPriceAlertNotification_wishlist_product_id_fkey" FOREIGN KEY ("wishlist_product_id") REFERENCES "WishlistProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
