-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "actual_cash" DECIMAL(10,2) NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" SERIAL NOT NULL,
    "transaction_date" TIMESTAMP(3) NOT NULL,
    "wallet_id" INTEGER NOT NULL,
    "transaction_type" TEXT NOT NULL,
    "is_recurring" BOOLEAN NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "installment_id" INTEGER,
    "installment_total" INTEGER,
    "installment_number" INTEGER,
    "category_id" INTEGER NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionCategory" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "TransactionCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Investment" (
    "start_date" TIMESTAMP(3) NOT NULL,
    "maturity_date" TIMESTAMP(3),
    "id" SERIAL NOT NULL,
    "wallet_id" INTEGER NOT NULL,
    "investment_category" INTEGER NOT NULL,
    "investment_amount" DECIMAL(10,2) NOT NULL,
    "current_amount" DECIMAL(10,2) NOT NULL,
    "name" TEXT NOT NULL,
    "indicator_id" INTEGER,
    "percentage_of_indicator" DECIMAL(10,2),
    "fix_rate" DECIMAL(10,2),

    CONSTRAINT "Investment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EconomicIndicator" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "current_rate" DECIMAL(10,2) NOT NULL,
    "last_update" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EconomicIndicator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TypeInvestment" (
    "investment_category" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "TypeInvestment_pkey" PRIMARY KEY ("investment_category")
);

-- CreateTable
CREATE TABLE "Wishlist" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Wishlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WishlistProduct" (
    "id" SERIAL NOT NULL,
    "id_wishlist" INTEGER NOT NULL,
    "name_product" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "WishlistProduct_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "TransactionCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionCategory" ADD CONSTRAINT "TransactionCategory_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Investment" ADD CONSTRAINT "Investment_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Investment" ADD CONSTRAINT "Investment_investment_category_fkey" FOREIGN KEY ("investment_category") REFERENCES "TypeInvestment"("investment_category") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Investment" ADD CONSTRAINT "Investment_indicator_id_fkey" FOREIGN KEY ("indicator_id") REFERENCES "EconomicIndicator"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wishlist" ADD CONSTRAINT "Wishlist_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishlistProduct" ADD CONSTRAINT "WishlistProduct_id_wishlist_fkey" FOREIGN KEY ("id_wishlist") REFERENCES "Wishlist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
