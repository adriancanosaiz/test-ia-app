import { prismaTest } from "./prisma";

const TABLES = [
  '"ProcessingJob"',
  '"ChatMessage"',
  '"ChatSession"',
  '"Answer"',
  '"TestAttempt"',
  '"Option"',
  '"Question"',
  '"Test"',
  '"Chunk"',
  '"DocumentSummary"',
  '"Document"',
  '"Subject"',
  '"Folder"',
];

export async function resetDatabase(): Promise<void> {
  await prismaTest.$executeRawUnsafe(
    `TRUNCATE TABLE ${TABLES.join(", ")} RESTART IDENTITY CASCADE;`
  );
}
