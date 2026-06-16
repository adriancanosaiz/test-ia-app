import { PrismaClient } from "@prisma/client";

const globalForPrismaTest = globalThis as unknown as {
  prismaTest: PrismaClient | undefined;
};

export const prismaTest =
  globalForPrismaTest.prismaTest ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrismaTest.prismaTest = prismaTest;
}
