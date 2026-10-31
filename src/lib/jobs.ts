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

async function executeClaimedJob(jobId: string): Promise<void> {
  const job = await db.job.findUnique({ where: { id: jobId } });
  if (!job) return;

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
    const shouldRetry = job.attempts < job.maxAttempts;
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

export async function runJobById(jobId: string, workerName = "inline"): Promise<void> {
  const now = new Date();
  const claimed = await db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "Job"
      WHERE "id" = ${jobId} AND "status" = 'QUEUED'::"JobStatus"
      FOR UPDATE SKIP LOCKED
    `;
    if (rows.length === 0) return false;
    await tx.job.update({
      where: { id: jobId },
      data: {
        status: "RUNNING",
        lockedAt: now,
        lockedBy: workerName,
        attempts: { increment: 1 },
      },
    });
    return true;
  });

  if (!claimed) return;
  await executeClaimedJob(jobId);
}

export async function runDueJobs(limit = 20, workerName = "worker"): Promise<number> {
  const now = new Date();
  // Çoklu worker ortamında yarış koşullarını ve çift çalıştırmayı önlemek için
  // PostgreSQL FOR UPDATE SKIP LOCKED ile işleri atomik seç ve kilitle
  const claimedIds = await db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "Job"
      WHERE "status" = 'QUEUED'::"JobStatus" AND "runAt" <= ${now}
      ORDER BY "runAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    `;
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    await tx.job.updateMany({
      where: { id: { in: ids } },
      data: {
        status: "RUNNING",
        lockedAt: now,
        lockedBy: workerName,
        attempts: { increment: 1 },
      },
    });
    return ids;
  });

  for (const id of claimedIds) {
    await executeClaimedJob(id);
  }

  return claimedIds.length;
}
