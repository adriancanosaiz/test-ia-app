import { prisma } from "@/lib/prisma";
import { sourceLabels } from "@/modules/tests/queries";

export type SearchItemType =
  | "folder"
  | "subject"
  | "document"
  | "test"
  | "chat";

export interface SearchItem {
  id: string;
  type: SearchItemType;
  title: string;
  subtitle?: string | null;
  href: string;
  createdAt: Date;
  updatedAt: Date;
}

export async function getSearchIndex(): Promise<SearchItem[]> {
  const [folders, subjects, documents, tests, chats] = await Promise.all([
    prisma.folder.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.subject.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        folder: { select: { name: true } },
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.document.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        fileName: true,
        subject: { select: { name: true, folder: { select: { name: true } } } },
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.test.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        sourceType: true,
        sourceId: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.chatSession.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        sourceDocument: { select: { title: true } },
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  const testSourceNames = new Map<string, string>();
  for (const test of tests) {
    if (!testSourceNames.has(test.sourceId)) {
      let name: string | null = null;
      switch (test.sourceType) {
        case "FOLDER": {
          const folder = await prisma.folder.findUnique({
            where: { id: test.sourceId },
            select: { name: true },
          });
          name = folder?.name ?? null;
          break;
        }
        case "SUBJECT": {
          const subject = await prisma.subject.findUnique({
            where: { id: test.sourceId },
            select: { name: true },
          });
          name = subject?.name ?? null;
          break;
        }
        case "DOCUMENT": {
          const document = await prisma.document.findUnique({
            where: { id: test.sourceId },
            select: { title: true },
          });
          name = document?.title ?? null;
          break;
        }
      }
      testSourceNames.set(test.sourceId, name ?? "Desconocido");
    }
  }

  const items: SearchItem[] = [
    ...folders.map((folder) => ({
      id: folder.id,
      type: "folder" as const,
      title: folder.name,
      subtitle: folder.description,
      href: `/folders/${folder.id}`,
      createdAt: folder.createdAt,
      updatedAt: folder.updatedAt,
    })),
    ...subjects.map((subject) => ({
      id: subject.id,
      type: "subject" as const,
      title: subject.name,
      subtitle: subject.description
        ? `${subject.folder.name} · ${subject.description}`
        : subject.folder.name,
      href: `/subjects/${subject.id}`,
      createdAt: subject.createdAt,
      updatedAt: subject.updatedAt,
    })),
    ...documents.map((document) => ({
      id: document.id,
      type: "document" as const,
      title: document.title,
      subtitle: `${document.subject.folder.name} · ${document.subject.name}`,
      href: `/documents/${document.id}/summaries`,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    })),
    ...tests.map((test) => ({
      id: test.id,
      type: "test" as const,
      title: test.title,
      subtitle: `${sourceLabels[test.sourceType]}: ${testSourceNames.get(test.sourceId) ?? "Desconocido"}`,
      href: `/tests/${test.id}`,
      createdAt: test.createdAt,
      updatedAt: test.updatedAt,
    })),
    ...chats.map((chat) => ({
      id: chat.id,
      type: "chat" as const,
      title: chat.title ?? "Sin título",
      subtitle: chat.sourceDocument?.title
        ? `Documento: ${chat.sourceDocument.title}`
        : null,
      href: `/chat/${chat.id}`,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
    })),
  ];

  return items;
}
