import { Prisma, SourceType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { EmbeddingProvider } from "./provider";
import { ollamaProvider } from "./ollama";

export interface RetrievedChunk {
  id: string;
  content: string;
  index: number;
  tokenCount: number | null;
  pageNumber: number | null;
  documentId: string;
  documentTitle: string;
  subjectId: string;
  subjectName: string;
  folderId: string;
  folderName: string;
  similarity: number;
}

export interface RetrieveOptions {
  documentId?: string;
  topK?: number;
  minSimilarity?: number;
}

export async function retrieveChunks(
  question: string,
  options: RetrieveOptions = {},
  embeddingProvider: EmbeddingProvider = ollamaProvider.embedding
): Promise<RetrievedChunk[]> {
  const { documentId, topK = 5, minSimilarity = 0.25 } = options;

  const embedding = await embeddingProvider.embed(question);
  const vectorLiteral = `[${embedding.join(",")}]`;

  const documentFilter = documentId
    ? Prisma.sql`AND d.id = ${documentId}`
    : Prisma.sql``;

  const results = await prisma.$queryRaw<RetrievedChunk[]>`
    SELECT
      c.id,
      c.content,
      c.index,
      c."tokenCount",
      c."pageNumber",
      d.id AS "documentId",
      d.title AS "documentTitle",
      s.id AS "subjectId",
      s.name AS "subjectName",
      f.id AS "folderId",
      f.name AS "folderName",
      1 - (c.embedding <=> ${vectorLiteral}::vector) AS similarity
    FROM "Chunk" c
    JOIN "Document" d ON c."documentId" = d.id
    JOIN "Subject" s ON d."subjectId" = s.id
    JOIN "Folder" f ON s."folderId" = f.id
    WHERE c.embedding IS NOT NULL
      ${documentFilter}
    ORDER BY c.embedding <=> ${vectorLiteral}::vector
    LIMIT ${topK}
  `;

  return results.filter((chunk) => chunk.similarity >= minSimilarity);
}

export async function retrieveChunksForScope(
  sourceType: SourceType,
  sourceId: string,
  sampleSize: number = 20
): Promise<RetrievedChunk[]> {
  let documentIds: string[] = [];

  switch (sourceType) {
    case "DOCUMENT":
      documentIds = [sourceId];
      break;
    case "SUBJECT": {
      const docs = await prisma.document.findMany({
        where: { subjectId: sourceId },
        select: { id: true },
      });
      documentIds = docs.map((d) => d.id);
      break;
    }
    case "FOLDER": {
      const docs = await prisma.document.findMany({
        where: { subject: { folderId: sourceId } },
        select: { id: true },
      });
      documentIds = docs.map((d) => d.id);
      break;
    }
  }

  if (documentIds.length === 0) {
    return [];
  }

  const chunks = await prisma.chunk.findMany({
    where: { documentId: { in: documentIds } },
    include: {
      document: {
        include: {
          subject: {
            include: { folder: true },
          },
        },
      },
    },
  });

  // Sampleo aleatorio simple
  const shuffled = chunks.sort(() => Math.random() - 0.5);
  const sampled = shuffled.slice(0, sampleSize);

  return sampled.map((chunk) => ({
    id: chunk.id,
    content: chunk.content,
    index: chunk.index,
    tokenCount: chunk.tokenCount,
    pageNumber: chunk.pageNumber,
    documentId: chunk.document.id,
    documentTitle: chunk.document.title,
    subjectId: chunk.document.subject.id,
    subjectName: chunk.document.subject.name,
    folderId: chunk.document.subject.folder.id,
    folderName: chunk.document.subject.folder.name,
    similarity: 0,
  }));
}
