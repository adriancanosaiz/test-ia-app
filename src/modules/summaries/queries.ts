"use server";

import { prisma } from "@/lib/prisma";

export async function getSummariesByDocument(documentId: string) {
  return prisma.documentSummary.findMany({
    where: { documentId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getSummary(id: string) {
  return prisma.documentSummary.findUnique({
    where: { id },
    include: {
      document: { select: { id: true, title: true, subjectId: true } },
    },
  });
}
