import { PrismaClient } from "@prisma/client";
import { generateStorageKey, saveFile } from "@/modules/documents/storage";
import { ollamaProvider } from "@/modules/ai/ollama";

const prisma = new PrismaClient();

const TEST_CONTENT = `
Francia es un país de Europa occidental. Su capital es París, una ciudad mundialmente conocida por la Torre Eiffel, construida para la Exposición Universal de 1889.

La gastronomía francesa es famosa internacionalmente. Platos emblemáticos incluyen el baguette, el queso, los croissants y el coq au vin. La repostería francesa destaca por los macarons y los éclairs.

El idioma oficial de Francia es el francés, hablado por la mayoría de la población. Es una de las lenguas romances derivadas del latín y se habla en numerosos países a través de organizaciones internacionales.

Francia tiene una economía altamente desarrollada. Los sectores clave incluyen el turismo, la aeronáutica, la energía nuclear, la agricultura y el lujo. Empresas como Airbus y L'Oréal tienen sede en el país.
`;

async function main() {
  const subject = await prisma.subject.findFirst({
    include: { folder: true },
  });
  if (!subject) throw new Error("No hay asignaturas en la base de datos");

  const storageKey = generateStorageKey();
  await saveFile(Buffer.from(TEST_CONTENT.trim()), storageKey);

  const document = await prisma.document.create({
    data: {
      title: "Apuntes de Francia",
      fileName: "francia.txt",
      storageKey,
      mimeType: "text/plain",
      status: "READY",
      chunkCount: 0,
      subjectId: subject.id,
    },
  });

  const rawChunks = [
    "Francia es un país de Europa occidental. Su capital es París, una ciudad mundialmente conocida por la Torre Eiffel, construida para la Exposición Universal de 1889.",
    "La gastronomía francesa es famosa internacionalmente. Platos emblemáticos incluyen el baguette, el queso, los croissants y el coq au vin. La repostería francesa destaca por los macarons y los éclairs.",
    "El idioma oficial de Francia es el francés, hablado por la mayoría de la población. Es una de las lenguas romances derivadas del latín y se habla en numerosos países.",
    "Francia tiene una economía altamente desarrollada. Los sectores clave incluyen el turismo, la aeronáutica, la energía nuclear, la agricultura y el lujo. Empresas como Airbus y L'Oréal tienen sede en el país.",
  ];

  const createdChunks = await prisma.$transaction(
    rawChunks.map((content, index) =>
      prisma.chunk.create({
        data: {
          documentId: document.id,
          content,
          index,
          tokenCount: Math.ceil(content.length / 4),
        },
      })
    )
  );

  for (const chunk of createdChunks) {
    const embedding = await ollamaProvider.embedding.embed(chunk.content);
    const vectorLiteral = `[${embedding.join(",")}]`;
    await prisma.$executeRaw`
      UPDATE "Chunk"
      SET embedding = ${vectorLiteral}::vector
      WHERE id = ${chunk.id}
    `;
  }

  await prisma.document.update({
    where: { id: document.id },
    data: { chunkCount: createdChunks.length },
  });

  const session = await prisma.chatSession.create({
    data: {
      title: "Preguntas sobre Francia",
      sourceDocumentId: document.id,
      messages: {
        create: {
          role: "user",
          content: "¿Qué país tiene la Torre Eiffel y cuál es su capital?",
        },
      },
    },
  });

  console.log(session.id);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
