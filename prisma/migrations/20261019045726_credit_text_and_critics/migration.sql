-- AlterEnum
ALTER TYPE "CreditRole" ADD VALUE 'ADAPTATION';

-- AlterTable
ALTER TABLE "Credit" ADD COLUMN     "roleText" TEXT;

-- AlterTable
ALTER TABLE "CriticReview" ADD COLUMN     "critic" TEXT,
ADD COLUMN     "feature" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paywalled" BOOLEAN NOT NULL DEFAULT false;
