-- CreateEnum
CREATE TYPE "CameraStatus" AS ENUM ('ONLINE', 'OFFLINE', 'UNKNOWN');

-- AlterTable
ALTER TABLE "Camera" ADD COLUMN     "description" TEXT,
ADD COLUMN     "fps" INTEGER,
ADD COLUMN     "lastOnline" TIMESTAMP(3),
ADD COLUMN     "location" TEXT,
ADD COLUMN     "manufacturer" TEXT,
ADD COLUMN     "model" TEXT,
ADD COLUMN     "passwordEnc" TEXT,
ADD COLUMN     "resolution" TEXT,
ADD COLUMN     "status" "CameraStatus" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "username" TEXT;
