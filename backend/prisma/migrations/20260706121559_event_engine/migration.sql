-- CreateTable
CREATE TABLE "EventLog" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "cameraId" TEXT,
    "trackingId" INTEGER,
    "eventType" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "confidence" DOUBLE PRECISION,
    "modelVersion" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventLog_storeId_idx" ON "EventLog"("storeId");

-- CreateIndex
CREATE INDEX "EventLog_cameraId_idx" ON "EventLog"("cameraId");

-- CreateIndex
CREATE INDEX "EventLog_eventType_idx" ON "EventLog"("eventType");

-- CreateIndex
CREATE INDEX "EventLog_timestamp_idx" ON "EventLog"("timestamp");

-- CreateIndex
CREATE INDEX "EventLog_storeId_eventType_timestamp_idx" ON "EventLog"("storeId", "eventType", "timestamp");
