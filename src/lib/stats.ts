import { prisma } from "@/lib/prisma";

export async function getStats() {
  const [
    folders,
    documents,
    documentsReady,
    tests,
    chatSessions,
    attemptsAggregate,
  ] = await Promise.all([
    prisma.folder.count(),
    prisma.document.count(),
    prisma.document.count({ where: { status: "READY" } }),
    prisma.test.count(),
    prisma.chatSession.count(),
    prisma.testAttempt.aggregate({
      _avg: { score: true },
      _count: { score: true },
    }),
  ]);

  const [recentDocuments, recentTests, recentChats] = await Promise.all([
    prisma.document.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        title: true,
        createdAt: true,
        subject: {
          select: {
            id: true,
            name: true,
            folder: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.test.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
      },
    }),
    prisma.chatSession.findMany({
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: {
        id: true,
        title: true,
        createdAt: true,
        _count: { select: { messages: true } },
      },
    }),
  ]);

  return {
    folders,
    documents,
    documentsReady,
    tests,
    chatSessions,
    attemptsCount: attemptsAggregate._count.score,
    averageScore: attemptsAggregate._avg.score,
    recentDocuments,
    recentTests,
    recentChats,
  };
}
