import { prisma } from "@/lib/prisma";
import { SourceType } from "@prisma/client";

export const sourceLabels: Record<SourceType, string> = {
  FOLDER: "Carpeta",
  SUBJECT: "Asignatura",
  DOCUMENT: "Documento",
};

export async function getSourceName(
  sourceType: SourceType,
  sourceId: string
): Promise<string | null> {
  switch (sourceType) {
    case "FOLDER": {
      const folder = await prisma.folder.findUnique({
        where: { id: sourceId },
        select: { name: true },
      });
      return folder?.name ?? null;
    }
    case "SUBJECT": {
      const subject = await prisma.subject.findUnique({
        where: { id: sourceId },
        select: { name: true },
      });
      return subject?.name ?? null;
    }
    case "DOCUMENT": {
      const document = await prisma.document.findUnique({
        where: { id: sourceId },
        select: { title: true },
      });
      return document?.title ?? null;
    }
  }
}

export async function getScopeOptions(sourceType: SourceType) {
  switch (sourceType) {
    case "FOLDER":
      return prisma.folder.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      });
    case "SUBJECT":
      return prisma.subject.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      });
    case "DOCUMENT":
      return prisma.document.findMany({
        where: { status: "READY", chunkCount: { gt: 0 } },
        orderBy: { title: "asc" },
        select: { id: true, title: true },
      });
  }
}

export async function getTests() {
  const tests = await prisma.test.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { attempts: true } },
    },
  });

  const testsWithSourceName = await Promise.all(
    tests.map(async (test) => {
      const sourceName = await getSourceName(test.sourceType, test.sourceId);
      return {
        ...test,
        sourceName: sourceName ?? "Desconocido",
        sourceLabel: sourceLabels[test.sourceType],
      };
    })
  );

  return testsWithSourceName;
}

export async function getTest(id: string) {
  const test = await prisma.test.findUnique({
    where: { id },
    include: {
      questions: {
        orderBy: { createdAt: "asc" },
        include: {
          options: { orderBy: { index: "asc" } },
          sourceChunk: { select: { content: true } },
        },
      },
    },
  });

  if (!test) return null;

  const sourceName = await getSourceName(test.sourceType, test.sourceId);

  return {
    ...test,
    sourceName: sourceName ?? "Desconocido",
    sourceLabel: sourceLabels[test.sourceType],
  };
}

export async function getAttempts(testId: string) {
  return prisma.testAttempt.findMany({
    where: { testId },
    orderBy: { startedAt: "desc" },
  });
}

export async function getAttempt(id: string) {
  const attempt = await prisma.testAttempt.findUnique({
    where: { id },
    include: {
      test: {
        include: {
          questions: {
            include: { options: { orderBy: { index: "asc" } } },
          },
        },
      },
      answers: true,
    },
  });

  return attempt;
}
