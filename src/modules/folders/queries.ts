"use server";

import { prisma } from "@/lib/prisma";

export async function getFolders() {
  const folders = await prisma.folder.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      subjects: {
        include: {
          _count: {
            select: { documents: true },
          },
        },
      },
    },
  });

  return folders.map((folder) => ({
    ...folder,
    _count: {
      documents: folder.subjects.reduce(
        (sum, subject) => sum + subject._count.documents,
        0
      ),
    },
  }));
}

export async function getFolder(id: string) {
  return prisma.folder.findUnique({
    where: { id },
    include: {
      subjects: {
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: { documents: true },
          },
        },
      },
    },
  });
}
