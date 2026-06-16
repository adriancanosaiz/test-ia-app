import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  enqueueJob,
  cancelJob,
  resumePendingJobs,
  waitForQueueIdle,
  registerJobRunner,
  AbortError,
} from "./runner";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    processingJob: {
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { prisma as prismaMock } from "@/lib/prisma";

const prisma = prismaMock as unknown as {
  processingJob: {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
};

function mockJob(overrides: Record<string, unknown> = {}) {
  return {
    id: "job-1",
    entityType: "document",
    entityId: "doc-1",
    status: "PENDING",
    progress: 0,
    attempts: 0,
    maxAttempts: 3,
    errorMessage: null,
    payload: null,
    ...overrides,
  };
}

const jobsById = new Map<string, ReturnType<typeof mockJob>>();

beforeEach(() => {
  vi.clearAllMocks();
  jobsById.clear();
  prisma.processingJob.create.mockImplementation(async (args: { data: Record<string, unknown> }) => {
    const job = mockJob({ id: "job-1", ...args.data });
    jobsById.set(job.id, job);
    return job;
  });
  prisma.processingJob.findUnique.mockImplementation(
    async ({ where }: { where: { id: string } }) => jobsById.get(where.id) ?? null
  );
  prisma.processingJob.update.mockImplementation(async (args: { data: Record<string, unknown> }) =>
    mockJob({ ...args.data })
  );
  prisma.processingJob.updateMany.mockResolvedValue({ count: 1 });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("enqueueJob", () => {
  it("crea un ProcessingJob y devuelve su id", async () => {
    registerJobRunner("document", async () => {});

    const jobId = await enqueueJob("document", "doc-1");

    expect(jobId).toBe("job-1");
    expect(prisma.processingJob.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entityType: "document",
          entityId: "doc-1",
          status: "PENDING",
        }),
      })
    );
    await waitForQueueIdle();
  });

  it("persiste el progreso y el estado READY al terminar", async () => {
    registerJobRunner("document", async ({ onProgress }) => {
      await onProgress(50);
    });

    await enqueueJob("document", "doc-1");
    await waitForQueueIdle();

    expect(prisma.processingJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ progress: 50 }),
      })
    );
    expect(prisma.processingJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "READY", progress: 100 }),
      })
    );
  });

  it("persiste ERROR cuando el runner falla", async () => {
    registerJobRunner("document", async () => {
      throw new Error("boom");
    });

    await enqueueJob("document", "doc-1");
    await waitForQueueIdle();

    expect(prisma.processingJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "ERROR",
          errorMessage: "boom",
        }),
      })
    );
  });

  it("respeta una concurrencia máxima de 2", async () => {
    let running = 0;
    let maxRunning = 0;

    registerJobRunner("document", async ({ entityId }) => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((resolve) => setTimeout(resolve, Number(entityId)));
      running--;
    });

    await enqueueJob("document", "100");
    await enqueueJob("document", "100");
    await enqueueJob("document", "50");
    await waitForQueueIdle();

    expect(maxRunning).toBe(2);
  });
});

describe("cancelJob", () => {
  it("marca el job como CANCELLED", async () => {
    await cancelJob("job-1");

    expect(prisma.processingJob.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "job-1",
          status: { in: ["PENDING", "PROCESSING"] },
        }),
        data: { status: "CANCELLED" },
      })
    );
  });

  it("aborta un job en ejecución", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    let cancelledInDb = false;
    let aborted = false;
    registerJobRunner("document", async ({ signal, onProgress }) => {
      try {
        await onProgress(10);
        await new Promise((resolve) => setTimeout(resolve, 100));
        await onProgress(50);
        aborted = signal.aborted;
      } catch (error) {
        if (error instanceof AbortError) {
          aborted = true;
        }
      }
    });

    prisma.processingJob.findUnique.mockImplementation(async () => {
      return mockJob({ status: cancelledInDb ? "CANCELLED" : "PROCESSING" });
    });

    await enqueueJob("document", "doc-1");
    await vi.advanceTimersByTimeAsync(50);

    cancelledInDb = true;
    await cancelJob("job-1");
    await vi.advanceTimersByTimeAsync(200);
    await waitForQueueIdle();

    expect(aborted).toBe(true);
    vi.useRealTimers();
  });
});

describe("resumePendingJobs", () => {
  it("re-encola jobs PENDING y PROCESSING con intentos disponibles", async () => {
    const runner = vi.fn().mockResolvedValue(undefined);
    registerJobRunner("document", runner);

    const pendingJobs = [
      mockJob({ id: "job-a", status: "PENDING", attempts: 0 }),
      mockJob({ id: "job-b", status: "PROCESSING", attempts: 1 }),
      mockJob({ id: "job-c", status: "PROCESSING", attempts: 3 }),
    ];
    prisma.processingJob.findMany.mockResolvedValue(pendingJobs);
    prisma.processingJob.findUnique.mockImplementation(
      async ({ where }: { where: { id: string } }) =>
        pendingJobs.find((j) => j.id === where.id) ?? null
    );

    await resumePendingJobs();
    await waitForQueueIdle();

    expect(prisma.processingJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ["PENDING", "PROCESSING"] },
          attempts: { lt: 3 },
        }),
      })
    );
    expect(runner).toHaveBeenCalledTimes(2);
  });
});
