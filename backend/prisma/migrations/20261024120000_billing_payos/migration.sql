-- PayOS payment link metadata for billing orders
ALTER TABLE "orders"
  ADD COLUMN "paymentLinkId" VARCHAR(255),
  ADD COLUMN "checkoutUrl" VARCHAR(2048),
  ADD COLUMN "expiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "orders_paymentLinkId_key" ON "orders"("paymentLinkId");
CREATE INDEX "orders_status_createdAt_idx" ON "orders"("status", "createdAt");

-- Backfill billing cycle for workspaces created before billing existed
UPDATE "workspaces"
SET
  "billingCycleStart" = NOW(),
  "nextResetAt" = NOW() + INTERVAL '1 month'
WHERE "billingCycleStart" IS NULL OR "nextResetAt" IS NULL;
