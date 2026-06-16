"use server";

import { prisma } from "@/lib/prisma";

export async function getIndexedDocuments() {
  return prisma.document.findMany({
    where: { status: "READY", chunkCount: { gt: 0 } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      subject: {
        select: {
          name: true,
          folder: { select: { name: true } },
        },
      },
    },
  });
}

export async function getDocumentsBySubject(subjectId: string) {
  return prisma.document.findMany({
    where: { subjectId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getDocument(id: string) {
  return prisma.document.findUnique({
    where: { id },
    include: { chunks: { orderBy: { index: "asc" } } },
  });
}
