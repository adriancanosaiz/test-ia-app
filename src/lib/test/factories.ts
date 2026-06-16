import { prismaTest } from "./prisma";

export async function createFolder(data: {
  name: string;
  description?: string;
  color?: string;
}) {
  return prismaTest.folder.create({ data });
}

export async function createSubject(data: {
  name: string;
  description?: string;
  folderId: string;
}) {
  return prismaTest.subject.create({ data });
}

export async function createDocument(data: {
  title: string;
  fileName: string;
  storageKey: string;
  mimeType: string;
  subjectId: string;
  status?: "PENDING" | "PROCESSING" | "READY" | "ERROR";
  chunkCount?: number;
}) {
  return prismaTest.document.create({
    data: {
      title: data.title,
      fileName: data.fileName,
      storageKey: data.storageKey,
      mimeType: data.mimeType,
      subjectId: data.subjectId,
      status: data.status ?? "READY",
      chunkCount: data.chunkCount ?? 0,
    },
  });
}

export async function createChunk(data: {
  documentId: string;
  content: string;
  index: number;
  tokenCount?: number;
  embedding?: number[];
}) {
  const chunk = await prismaTest.chunk.create({
    data: {
      documentId: data.documentId,
      content: data.content,
      index: data.index,
      tokenCount: data.tokenCount ?? Math.ceil(data.content.length / 4),
    },
  });

  if (data.embedding) {
    const vectorLiteral = `[${data.embedding.join(",")}]`;
    await prismaTest.$executeRaw`
      UPDATE "Chunk"
      SET embedding = ${vectorLiteral}::vector
      WHERE id = ${chunk.id}
    `;
  }

  return chunk;
}

export async function createDocumentSummary(data: {
  documentId: string;
  content?: string;
  status?: string;
  progress?: number;
  errorMessage?: string | null;
}) {
  return prismaTest.documentSummary.create({
    data: {
      documentId: data.documentId,
      content: data.content ?? "",
      status: data.status ?? "PROCESSING",
      progress: data.progress ?? 0,
      errorMessage: data.errorMessage ?? null,
    },
  });
}

export async function createChatSession(data: {
  title?: string;
  sourceDocumentId?: string;
}) {
  return prismaTest.chatSession.create({
    data: {
      title: data.title ?? "Test session",
      sourceDocumentId: data.sourceDocumentId ?? null,
    },
  });
}

export async function createChatMessage(data: {
  sessionId: string;
  role: string;
  content: string;
}) {
  return prismaTest.chatMessage.create({ data });
}
