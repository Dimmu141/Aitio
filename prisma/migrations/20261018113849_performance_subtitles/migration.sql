-- AlterTable
ALTER TABLE "Performance" ADD COLUMN     "subtitleLangs" TEXT[] DEFAULT ARRAY[]::TEXT[];
