import { describe, expect, it, beforeEach } from "vitest";
import { prismaTest } from "@/lib/test/prisma";
import { resetDatabase } from "@/lib/test/reset-db";

describe("ProcessingJob CRUD", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("crea y lee un job", async () => {
    const job = await prismaTest.processingJob.create({
      data: {
        entityType: "document",
        entityId: "doc-1",
        status: "PENDING",
        progress: 0,
      },
    });

    const found = await prismaTest.processingJob.findUnique({
      where: { id: job.id },
    });

    expect(found).not.toBeNull();
    expect(found?.entityType).toBe("document");
    expect(found?.entityId).toBe("doc-1");
    expect(found?.status).toBe("PENDING");
  });

  it("actualiza estado y progreso", async () => {
    const job = await prismaTest.processingJob.create({
      data: {
        entityType: "test",
        entityId: "test-1",
        status: "PENDING",
        progress: 0,
      },
    });

    await prismaTest.processingJob.update({
      where: { id: job.id },
      data: { status: "PROCESSING", progress: 50, attempts: 1 },
    });

    const updated = await prismaTest.processingJob.findUnique({
      where: { id: job.id },
    });

    expect(updated?.status).toBe("PROCESSING");
    expect(updated?.progress).toBe(50);
    expect(updated?.attempts).toBe(1);
  });

  it("elimina un job", async () => {
    const job = await prismaTest.processingJob.create({
      data: {
        entityType: "summary",
        entityId: "summary-1",
        status: "READY",
        progress: 100,
      },
    });

    await prismaTest.processingJob.delete({ where: { id: job.id } });

    const found = await prismaTest.processingJob.findUnique({
      where: { id: job.id },
    });

    expect(found).toBeNull();
  });

  it("filtra por tipo y entidad", async () => {
    await prismaTest.processingJob.create({
      data: {
        entityType: "chat",
        entityId: "msg-1",
        status: "PENDING",
      },
    });
    await prismaTest.processingJob.create({
      data: {
        entityType: "chat",
        entityId: "msg-2",
        status: "PROCESSING",
      },
    });
    await prismaTest.processingJob.create({
      data: {
        entityType: "document",
        entityId: "doc-1",
        status: "PENDING",
      },
    });

    const chatJobs = await prismaTest.processingJob.findMany({
      where: { entityType: "chat" },
    });

    expect(chatJobs).toHaveLength(2);
  });
});
