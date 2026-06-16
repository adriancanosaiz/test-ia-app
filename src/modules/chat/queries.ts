"use server";

import { prisma } from "@/lib/prisma";

export async function getChatSessions() {
  return prisma.chatSession.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      sourceDocument: {
        select: { title: true },
      },
      _count: {
        select: { messages: true },
      },
    },
  });
}

export async function getChatSession(id: string) {
  return prisma.chatSession.findUnique({
    where: { id },
    include: {
      sourceDocument: {
        select: { id: true, title: true },
      },
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  });
}
