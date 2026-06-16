-- CreateTable
CREATE TABLE "DocumentSummary" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROCESSING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentSummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentSummary_documentId_key" ON "DocumentSummary"("documentId");

-- AlterTable
ALTER TABLE "Folder" ADD COLUMN     "color" TEXT;

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "progress" INTEGER NOT NULL DEFAULT 0,
                        ADD COLUMN     "subjectId" TEXT;

-- AlterTable
ALTER TABLE "Test" ADD COLUMN     "progress" INTEGER NOT NULL DEFAULT 0,
                   ADD COLUMN     "errorMessage" TEXT;

-- Migrate existing documents: assign subjectId from their current Topic
UPDATE "Document"
SET "subjectId" = (
    SELECT "subjectId"
    FROM "Topic"
    WHERE "Topic"."id" = "Document"."topicId"
);

-- AlterEnum
BEGIN;
CREATE TYPE "TestStatus_new" AS ENUM ('DRAFT', 'READY', 'PROCESSING', 'ERROR');
ALTER TABLE "Test" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Test" ALTER COLUMN "status" TYPE "TestStatus_new" USING ("status"::text::"TestStatus_new");
ALTER TYPE "TestStatus" RENAME TO "TestStatus_old";
ALTER TYPE "TestStatus_new" RENAME TO "TestStatus";
DROP TYPE "TestStatus_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "SourceType_new" AS ENUM ('FOLDER', 'SUBJECT', 'DOCUMENT');
ALTER TABLE "Test" ALTER COLUMN "sourceType" DROP DEFAULT;
ALTER TABLE "Test" ALTER COLUMN "sourceType" TYPE "SourceType_new" USING ("sourceType"::text::"SourceType_new");
ALTER TYPE "SourceType" RENAME TO "SourceType_old";
ALTER TYPE "SourceType_new" RENAME TO "SourceType";
DROP TYPE "SourceType_old";
COMMIT;

-- Make subjectId required
ALTER TABLE "Document" ALTER COLUMN "subjectId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentSummary" ADD CONSTRAINT "DocumentSummary_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropForeignKey
ALTER TABLE "Document" DROP CONSTRAINT "Document_topicId_fkey";

-- AlterTable
ALTER TABLE "Document" DROP COLUMN "topicId";

-- DropTable
DROP TABLE "Topic";
