"use server";

import { prisma } from "@/lib/prisma";

export async function getSubject(id: string) {
  return prisma.subject.findUnique({
    where: { id },
    include: {
      folder: true,
      documents: {
        orderBy: { createdAt: "desc" },
      },
      _count: {
        select: { documents: true },
      },
    },
  });
}
