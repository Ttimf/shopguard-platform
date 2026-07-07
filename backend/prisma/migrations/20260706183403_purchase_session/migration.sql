-- CreateTable
CREATE TABLE "PurchaseSession" (
    "id" TEXT NOT NULL,
    "trackingId" TEXT,
    "storeId" TEXT NOT NULL,
    "checkoutId" TEXT,
    "receiptId" TEXT,
    "status" TEXT NOT NULL,
    "confidence" INTEGER NOT NULL DEFAULT 0,
    "aiProducts" JSONB NOT NULL,
    "receiptProducts" JSONB NOT NULL,
    "missingProducts" JSONB NOT NULL,
    "extraProducts" JSONB NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PurchaseSession_storeId_idx" ON "PurchaseSession"("storeId");

-- CreateIndex
CREATE INDEX "PurchaseSession_storeId_status_idx" ON "PurchaseSession"("storeId", "status");

-- CreateIndex
CREATE INDEX "PurchaseSession_checkoutId_idx" ON "PurchaseSession"("checkoutId");

-- CreateIndex
CREATE INDEX "PurchaseSession_createdAt_idx" ON "PurchaseSession"("createdAt");
