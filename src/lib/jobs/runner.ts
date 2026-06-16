import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getLocaleFromPayload, getJobMessage } from "@/lib/i18n/jobs";

export class AbortError extends Error {
  constructor(message = "Job cancelled") {
    super(message);
    this.name = "AbortError";
  }
}

export type JobProgressCallback = (progress: number) => Promise<void> | void;

export interface JobRunnerContext {
  jobId: string;
  entityId: string;
  signal: AbortSignal;
  onProgress: JobProgressCallback;
  payload: unknown;
}

export type JobRunner = (context: JobRunnerContext) => Promise<void>;

type QueuedJob = { jobId: string };

const queue: QueuedJob[] = [];
const runners = new Map<string, JobRunner>();
const activeJobIds = new Set<string>();
let isRunning = false;
let runningCount = 0;
const CONCURRENCY = 2;

function logJobError(jobId: string, error: unknown) {
  if (process.env.NODE_ENV !== "test") {
    console.error(
      `Job ${jobId} failed:`,
      error instanceof Error ? error.message : error
    );
  }
}

export function registerJobRunner(type: string, runner: JobRunner): void {
  runners.set(type, runner);
}

export async function enqueueJob(
  type: string,
  entityId: string,
  options?: {
    maxAttempts?: number;
    payload?: unknown;
  }
): Promise<string> {
  const job = await prisma.processingJob.create({
    data: {
      entityType: type,
      entityId,
      status: "PENDING",
      progress: 0,
      attempts: 0,
      maxAttempts: options?.maxAttempts ?? 3,
      payload: options?.payload ?? Prisma.JsonNull,
    },
  });

  activeJobIds.add(job.id);
  queue.push({ jobId: job.id });
  void processQueue();
  return job.id;
}

export async function cancelJob(jobId: string): Promise<void> {
  await prisma.processingJob.updateMany({
    where: { id: jobId, status: { in: ["PENDING", "PROCESSING"] } },
    data: { status: "CANCELLED" },
  });
}

export async function resumePendingJobs(): Promise<void> {
  const pending = await prisma.processingJob.findMany({
    where: {
      status: { in: ["PENDING", "PROCESSING"] },
      attempts: { lt: 3 },
    },
    orderBy: { createdAt: "asc" },
  });

  for (const job of pending) {
    if (!activeJobIds.has(job.id)) {
      activeJobIds.add(job.id);
      queue.push({ jobId: job.id });
    }
  }

  if (queue.length > 0) {
    void processQueue();
  }
}

async function processQueue(): Promise<void> {
  if (isRunning) return;
  isRunning = true;

  try {
    while (queue.length > 0 || runningCount > 0) {
      while (runningCount < CONCURRENCY && queue.length > 0) {
        const { jobId } = queue.shift()!;
        runningCount++;
        runJob(jobId)
          .catch((error) => {
            logJobError(jobId, error);
          })
          .finally(() => {
            runningCount--;
            activeJobIds.delete(jobId);
            void processQueue();
          });
      }

      if (runningCount > 0) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }
  } finally {
    isRunning = false;
  }
}

async function runJob(jobId: string): Promise<void> {
  const job = await prisma.processingJob.findUnique({
    where: { id: jobId },
  });

  if (!job) return;
  if (job.status === "CANCELLED") return;

  const language = getLocaleFromPayload(job.payload);

  if (job.attempts >= job.maxAttempts) {
    await prisma.processingJob.update({
      where: { id: jobId },
      data: {
        status: "ERROR",
        errorMessage: getJobMessage(language, "maxAttemptsReached"),
      },
    });
    return;
  }

  const runner = runners.get(job.entityType);
  if (!runner) {
    await prisma.processingJob.update({
      where: { id: jobId },
      data: {
        status: "ERROR",
        errorMessage: `${getJobMessage(language, "noRegisteredRunner")} ${job.entityType}`,
      },
    });
    return;
  }

  await prisma.processingJob.update({
    where: { id: jobId },
    data: { status: "PROCESSING", attempts: { increment: 1 } },
  });

  const controller = new AbortController();
  let cancelled = false;

  async function isCancelled(): Promise<boolean> {
    if (cancelled) return true;
    const latest = await prisma.processingJob.findUnique({
      where: { id: jobId },
      select: { status: true },
    });
    if (latest?.status === "CANCELLED") {
      cancelled = true;
      controller.abort();
      return true;
    }
    return false;
  }

  async function onProgress(progress: number): Promise<void> {
    if (await isCancelled()) {
      throw new AbortError(getJobMessage(language, "jobCancelled"));
    }
    await prisma.processingJob.update({
      where: { id: jobId },
      data: { progress: Math.min(Math.max(progress, 0), 100) },
    });
  }

  try {
    if (await isCancelled()) return;

    await runner({
      jobId,
      entityId: job.entityId,
      signal: controller.signal,
      onProgress,
      payload: job.payload,
    });
    if (await isCancelled()) return;

    await prisma.processingJob.update({
      where: { id: jobId },
      data: { status: "READY", progress: 100, errorMessage: null },
    });
  } catch (error) {
    if (cancelled || controller.signal.aborted || error instanceof AbortError) {
      return;
    }

    const message =
      error instanceof Error ? error.message : "Error desconocido";
    await prisma.processingJob.update({
      where: { id: jobId },
      data: { status: "ERROR", errorMessage: message },
    });
  }
}

export async function waitForQueueIdle(): Promise<void> {
  while (queue.length > 0 || runningCount > 0 || isRunning) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}
