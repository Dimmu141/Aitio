-- AlterTable
ALTER TABLE "User" ADD COLUMN     "digestOptIn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "digestSentAt" TIMESTAMP(3);
