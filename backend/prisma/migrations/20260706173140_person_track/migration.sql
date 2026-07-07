-- CreateTable
CREATE TABLE "PersonTrack" (
    "id" TEXT NOT NULL,
    "trackingId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "cameraId" TEXT NOT NULL,
    "enteredAt" TIMESTAMP(3) NOT NULL,
    "exitedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonTrack_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PersonTrack_storeId_idx" ON "PersonTrack"("storeId");

-- CreateIndex
CREATE INDEX "PersonTrack_trackingId_idx" ON "PersonTrack"("trackingId");

-- CreateIndex
CREATE INDEX "PersonTrack_cameraId_idx" ON "PersonTrack"("cameraId");

-- CreateIndex
CREATE INDEX "PersonTrack_storeId_trackingId_idx" ON "PersonTrack"("storeId", "trackingId");

-- CreateIndex
CREATE INDEX "PersonTrack_storeId_trackingId_exitedAt_idx" ON "PersonTrack"("storeId", "trackingId", "exitedAt");
