-- AlterTable
ALTER TABLE "Production" ADD COLUMN     "titleCased" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "titleOverride" TEXT;
