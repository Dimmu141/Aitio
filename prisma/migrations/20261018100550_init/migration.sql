-- CreateEnum
CREATE TYPE "ProductionType" AS ENUM ('PLAY', 'MUSICAL', 'OPERA', 'DANCE', 'CONCERT', 'STANDUP', 'TALK', 'OTHER');

-- CreateEnum
CREATE TYPE "CreditRole" AS ENUM ('DIRECTOR', 'WRITER', 'COMPOSER', 'TRANSLATOR', 'CHOREOGRAPHER', 'DESIGNER', 'CAST', 'OTHER');

-- CreateEnum
CREATE TYPE "ScrapeStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "Theatre" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "website" TEXT NOT NULL,
    "ticketingProvider" TEXT,
    "sourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Theatre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stage" (
    "id" TEXT NOT NULL,
    "theatreId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Stage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Production" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "theatreId" TEXT NOT NULL,
    "stageId" TEXT,
    "externalId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "type" "ProductionType" NOT NULL DEFAULT 'OTHER',
    "typeConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "typeOverride" "ProductionType",
    "languages" TEXT[],
    "subtitleLangs" TEXT[],
    "premiereDate" TIMESTAMP(3),
    "runStart" TIMESTAMP(3),
    "runEnd" TIMESTAMP(3),
    "durationText" TEXT,
    "ticketUrl" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Production_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Performance" (
    "id" TEXT NOT NULL,
    "productionId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "stageId" TEXT,
    "ticketUrl" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Performance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Credit" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "productionId" TEXT NOT NULL,
    "role" "CreditRole" NOT NULL,
    "characterName" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Credit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CriticReview" (
    "id" TEXT NOT NULL,
    "productionId" TEXT NOT NULL,
    "outlet" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "CriticReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "handle" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'fi',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiaryEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productionId" TEXT NOT NULL,
    "performanceId" TEXT,
    "seenOn" TIMESTAMP(3) NOT NULL,
    "rating" DECIMAL(2,1),
    "review" TEXT,
    "isRewatch" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiaryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "labelFi" TEXT NOT NULL,
    "labelSv" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrapeRun" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "status" "ScrapeStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "itemsFound" INTEGER NOT NULL DEFAULT 0,
    "itemsChanged" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,

    CONSTRAINT "ScrapeRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_DiaryEntryToTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_DiaryEntryToTag_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Theatre_slug_key" ON "Theatre"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Theatre_sourceId_key" ON "Theatre"("sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "Stage_theatreId_name_key" ON "Stage"("theatreId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Production_slug_key" ON "Production"("slug");

-- CreateIndex
CREATE INDEX "Production_runEnd_idx" ON "Production"("runEnd");

-- CreateIndex
CREATE UNIQUE INDEX "Production_theatreId_externalId_key" ON "Production"("theatreId", "externalId");

-- CreateIndex
CREATE INDEX "Performance_startsAt_idx" ON "Performance"("startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "Performance_productionId_startsAt_key" ON "Performance"("productionId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "Person_slug_key" ON "Person"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Credit_personId_productionId_role_key" ON "Credit"("personId", "productionId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "CriticReview_url_key" ON "CriticReview"("url");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_handle_key" ON "User"("handle");

-- CreateIndex
CREATE INDEX "DiaryEntry_productionId_idx" ON "DiaryEntry"("productionId");

-- CreateIndex
CREATE INDEX "DiaryEntry_userId_seenOn_idx" ON "DiaryEntry"("userId", "seenOn");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

-- CreateIndex
CREATE INDEX "ScrapeRun_sourceId_startedAt_idx" ON "ScrapeRun"("sourceId", "startedAt");

-- CreateIndex
CREATE INDEX "_DiaryEntryToTag_B_index" ON "_DiaryEntryToTag"("B");

-- AddForeignKey
ALTER TABLE "Stage" ADD CONSTRAINT "Stage_theatreId_fkey" FOREIGN KEY ("theatreId") REFERENCES "Theatre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Production" ADD CONSTRAINT "Production_theatreId_fkey" FOREIGN KEY ("theatreId") REFERENCES "Theatre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Production" ADD CONSTRAINT "Production_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Performance" ADD CONSTRAINT "Performance_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Performance" ADD CONSTRAINT "Performance_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credit" ADD CONSTRAINT "Credit_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credit" ADD CONSTRAINT "Credit_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CriticReview" ADD CONSTRAINT "CriticReview_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiaryEntry" ADD CONSTRAINT "DiaryEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiaryEntry" ADD CONSTRAINT "DiaryEntry_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiaryEntry" ADD CONSTRAINT "DiaryEntry_performanceId_fkey" FOREIGN KEY ("performanceId") REFERENCES "Performance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DiaryEntryToTag" ADD CONSTRAINT "_DiaryEntryToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "DiaryEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DiaryEntryToTag" ADD CONSTRAINT "_DiaryEntryToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
