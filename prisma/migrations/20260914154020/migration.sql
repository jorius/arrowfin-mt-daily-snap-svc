-- CreateEnum
CREATE TYPE "BrokerType" AS ENUM ('retail', 'prop');

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('verified', 'pending', 'suspended');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('funded', 'demo', 'eval', 'pro', 'pro_plus');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('active', 'restricted', 'closed');

-- CreateEnum
CREATE TYPE "FillSide" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "Liquidity" AS ENUM ('maker', 'taker');

-- CreateTable
CREATE TABLE "brokers" (
    "id" VARCHAR(32) NOT NULL,
    "name" TEXT NOT NULL,
    "type" "BrokerType" NOT NULL,
    "white_label_name" TEXT NOT NULL,
    "api_key_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "brokers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "traders" (
    "id" VARCHAR(32) NOT NULL,
    "broker_id" VARCHAR(32) NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "dob" DATE NOT NULL,
    "ssn_last4" CHAR(4) NOT NULL,
    "address_line1" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT,
    "postal_code" TEXT NOT NULL,
    "kyc_status" "KycStatus" NOT NULL,
    "notes" TEXT,
    "audit_notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "traders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trader_credentials" (
    "trader_id" VARCHAR(32) NOT NULL,
    "secret_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rotated_at" TIMESTAMPTZ(3),

    CONSTRAINT "trader_credentials_pkey" PRIMARY KEY ("trader_id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" UUID NOT NULL,
    "trader_id" VARCHAR(32) NOT NULL,
    "broker_id" VARCHAR(32) NOT NULL,
    "key_hash" CHAR(64) NOT NULL,
    "key_prefix" VARCHAR(16) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "last_used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" VARCHAR(32) NOT NULL,
    "trader_id" VARCHAR(32) NOT NULL,
    "broker_id" VARCHAR(32) NOT NULL,
    "account_number" VARCHAR(32) NOT NULL,
    "account_type" "AccountType" NOT NULL,
    "balance" DECIMAL(18,2) NOT NULL,
    "buying_power" DECIMAL(18,2) NOT NULL,
    "max_position_size" INTEGER NOT NULL,
    "status" "AccountStatus" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instruments" (
    "symbol" VARCHAR(8) NOT NULL,
    "description" TEXT NOT NULL,
    "exchange" VARCHAR(8) NOT NULL,
    "point_value_usd" DECIMAL(18,6) NOT NULL,
    "tick_size" DECIMAL(18,6) NOT NULL,
    "tick_value_usd" DECIMAL(18,6) NOT NULL,
    "initial_margin_usd" DECIMAL(18,2) NOT NULL,
    "maintenance_margin_usd" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "instruments_pkey" PRIMARY KEY ("symbol")
);

-- CreateTable
CREATE TABLE "market_prices" (
    "symbol" VARCHAR(8) NOT NULL,
    "mark_price" DECIMAL(18,6) NOT NULL,
    "as_of" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "market_prices_pkey" PRIMARY KEY ("symbol")
);

-- CreateTable
CREATE TABLE "fills" (
    "id" VARCHAR(32) NOT NULL,
    "account_id" VARCHAR(32) NOT NULL,
    "broker_id" VARCHAR(32) NOT NULL,
    "instrument_symbol" VARCHAR(8) NOT NULL,
    "side" "FillSide" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" DECIMAL(18,6) NOT NULL,
    "filled_at" TIMESTAMPTZ(3) NOT NULL,
    "order_id" VARCHAR(32) NOT NULL,
    "liquidity" "Liquidity" NOT NULL,
    "commission_usd" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "fills_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "traders_broker_id_idx" ON "traders"("broker_id");

-- CreateIndex
CREATE UNIQUE INDEX "traders_id_broker_id_key" ON "traders"("id", "broker_id");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "api_keys_trader_id_broker_id_idx" ON "api_keys"("trader_id", "broker_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_account_number_key" ON "accounts"("account_number");

-- CreateIndex
CREATE INDEX "accounts_broker_id_trader_id_idx" ON "accounts"("broker_id", "trader_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_id_broker_id_key" ON "accounts"("id", "broker_id");

-- CreateIndex
CREATE INDEX "fills_broker_id_account_id_filled_at_idx" ON "fills"("broker_id", "account_id", "filled_at");

-- CreateIndex
CREATE INDEX "fills_order_id_idx" ON "fills"("order_id");

-- AddForeignKey
ALTER TABLE "traders" ADD CONSTRAINT "traders_broker_id_fkey" FOREIGN KEY ("broker_id") REFERENCES "brokers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trader_credentials" ADD CONSTRAINT "trader_credentials_trader_id_fkey" FOREIGN KEY ("trader_id") REFERENCES "traders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_trader_id_broker_id_fkey" FOREIGN KEY ("trader_id", "broker_id") REFERENCES "traders"("id", "broker_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_broker_id_fkey" FOREIGN KEY ("broker_id") REFERENCES "brokers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_trader_id_broker_id_fkey" FOREIGN KEY ("trader_id", "broker_id") REFERENCES "traders"("id", "broker_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_broker_id_fkey" FOREIGN KEY ("broker_id") REFERENCES "brokers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_prices" ADD CONSTRAINT "market_prices_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "instruments"("symbol") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fills" ADD CONSTRAINT "fills_account_id_broker_id_fkey" FOREIGN KEY ("account_id", "broker_id") REFERENCES "accounts"("id", "broker_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fills" ADD CONSTRAINT "fills_broker_id_fkey" FOREIGN KEY ("broker_id") REFERENCES "brokers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fills" ADD CONSTRAINT "fills_instrument_symbol_fkey" FOREIGN KEY ("instrument_symbol") REFERENCES "instruments"("symbol") ON DELETE RESTRICT ON UPDATE CASCADE;
