import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export type JobHandler = (payload: Record<string, unknown>) => Promise<Record<string, unknown> | void>;

const jobHandlers = new Map<string, JobHandler>();

export function registerJobHandler(type: string, handler: JobHandler): void {
  jobHandlers.set(type, handler);
}

export interface EnqueueJobOptions {
  type: string;
  payload?: Record<string, unknown>;
  runAt?: Date;
  dedupeKey?: string;
  maxAttempts?: number;
}

export async function enqueueJob(options: EnqueueJobOptions): Promise<string> {
  if (options.dedupeKey) {
    const existing = await db.job.findFirst({
      where: {
        dedupeKey: options.dedupeKey,
        status: { in: ["QUEUED", "RUNNING"] },
      },
    });
    if (existing) {
      return existing.id;
    }
  }

  const job = await db.job.create({
    data: {
      type: options.type,
      payload: (options.payload ?? {}) as Prisma.InputJsonValue,
      runAt: options.runAt ?? new Date(),
      dedupeKey: options.dedupeKey ?? null,
      maxAttempts: options.maxAttempts ?? 3,
      status: "QUEUED",
    },
  });

  return job.id;
}

export async function runJobById(jobId: string, workerName = "inline"): Promise<void> {
  const job = await db.job.findUnique({ where: { id: jobId } });
  if (!job || job.status === "RUNNING" || job.status === "DONE") return;

  await db.job.update({
    where: { id: job.id },
    data: {
      status: "RUNNING",
      lockedAt: new Date(),
      lockedBy: workerName,
      attempts: { increment: 1 },
    },
  });

  const handler = jobHandlers.get(job.type);
  if (!handler) {
    await db.job.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        lastError: `Kayıtlı işleyici bulunamadı: ${job.type}`,
        finishedAt: new Date(),
      },
    });
    return;
  }

  try {
    const payload =
      job.payload && typeof job.payload === "object" && !Array.isArray(job.payload)
        ? (job.payload as Record<string, unknown>)
        : {};
    const result = await handler(payload);
    await db.job.update({
      where: { id: job.id },
      data: {
        status: "DONE",
        result: (result ?? null) as Prisma.InputJsonValue,
        lastError: null,
        finishedAt: new Date(),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const shouldRetry = job.attempts + 1 < job.maxAttempts;
    await db.job.update({
      where: { id: job.id },
      data: {
        status: shouldRetry ? "QUEUED" : "FAILED",
        runAt: shouldRetry ? new Date(Date.now() + 60_000) : job.runAt,
        lastError: message,
        finishedAt: shouldRetry ? null : new Date(),
      },
    });
  }
}

export async function runDueJobs(limit = 20, workerName = "worker"): Promise<number> {
  const due = await db.job.findMany({
    where: {
      status: "QUEUED",
      runAt: { lte: new Date() },
    },
    orderBy: { runAt: "asc" },
    take: limit,
  });

  for (const job of due) {
    await runJobById(job.id, workerName);
  }

  return due.length;
}
