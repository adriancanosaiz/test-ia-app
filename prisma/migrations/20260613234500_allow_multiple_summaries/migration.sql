-- Drop the unique constraint so a document can have many summaries
DROP INDEX IF EXISTS "DocumentSummary_documentId_key";

-- Add a regular index for lookups by documentId
CREATE INDEX "DocumentSummary_documentId_idx" ON "DocumentSummary"("documentId");
