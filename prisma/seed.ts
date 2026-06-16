import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Datos de ejemplo para que cualquier desarrollador vea la estructura
  const folder = await prisma.folder.create({
    data: {
      name: "Grado en Informática",
      description: "Temario del grado",
      color: "#3b82f6",
      subjects: {
        create: [
          {
            name: "Bases de Datos",
            description: "Diseño, SQL y optimización",
          },
          {
            name: "Inteligencia Artificial",
            description: "Fundamentos de IA y ML",
          },
        ],
      },
    },
  });

  console.log(`Seed creado: ${folder.name}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
