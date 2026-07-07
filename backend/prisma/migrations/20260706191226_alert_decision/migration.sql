-- CreateTable
CREATE TABLE "AlertDecision" (
    "id" TEXT NOT NULL,
    "trackingId" TEXT,
    "storeId" TEXT NOT NULL,
    "alertType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "riskScore" INTEGER,
    "confidence" INTEGER,
    "behaviorSessionId" TEXT,
    "purchaseSessionId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AlertDecision_storeId_idx" ON "AlertDecision"("storeId");

-- CreateIndex
CREATE INDEX "AlertDecision_storeId_severity_idx" ON "AlertDecision"("storeId", "severity");

-- CreateIndex
CREATE INDEX "AlertDecision_storeId_alertType_idx" ON "AlertDecision"("storeId", "alertType");

-- CreateIndex
CREATE INDEX "AlertDecision_createdAt_idx" ON "AlertDecision"("createdAt");
