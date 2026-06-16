-- DropIndex
DROP INDEX "idx_chunk_embedding";

-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN     "status" TEXT;

-- AlterTable
ALTER TABLE "Test" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
