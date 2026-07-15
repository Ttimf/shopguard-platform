-- CreateTable
CREATE TABLE "AiWorker" (
    "id" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "gpuName" TEXT,
    "gpuMemory" INTEGER,
    "cuda" TEXT,
    "driverVersion" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ONLINE',
    "startedAt" TIMESTAMP(3) NOT NULL,
    "lastSeen" TIMESTAMP(3) NOT NULL,
    "gpuUsage" INTEGER,
    "vramUsed" INTEGER,
    "temperature" INTEGER,
    "power" INTEGER,
    "cpu" INTEGER,
    "ram" INTEGER,
    "fps" INTEGER,
    "cameras" INTEGER,
    "tracks" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiWorker_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiWorker_status_idx" ON "AiWorker"("status");

-- CreateIndex
CREATE INDEX "AiWorker_lastSeen_idx" ON "AiWorker"("lastSeen");
