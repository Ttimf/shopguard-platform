-- CreateTable
CREATE TABLE "BehaviorSession" (
    "id" TEXT NOT NULL,
    "trackingId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "visitedCameras" JSONB NOT NULL,
    "productsTaken" INTEGER NOT NULL DEFAULT 0,
    "productsReturned" INTEGER NOT NULL DEFAULT 0,
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "behaviorType" TEXT NOT NULL DEFAULT 'BROWSER',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BehaviorSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BehaviorSession_storeId_idx" ON "BehaviorSession"("storeId");

-- CreateIndex
CREATE INDEX "BehaviorSession_storeId_trackingId_idx" ON "BehaviorSession"("storeId", "trackingId");

-- CreateIndex
CREATE INDEX "BehaviorSession_storeId_behaviorType_idx" ON "BehaviorSession"("storeId", "behaviorType");

-- CreateIndex
CREATE INDEX "BehaviorSession_storeId_riskScore_idx" ON "BehaviorSession"("storeId", "riskScore");

-- CreateIndex
CREATE INDEX "BehaviorSession_startedAt_idx" ON "BehaviorSession"("startedAt");
