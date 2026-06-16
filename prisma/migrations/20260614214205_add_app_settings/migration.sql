-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL,
    "chatProvider" TEXT NOT NULL,
    "chatModel" TEXT NOT NULL,
    "embeddingProvider" TEXT NOT NULL,
    "embeddingModel" TEXT NOT NULL,
    "apiKey" TEXT,
    "baseUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);
