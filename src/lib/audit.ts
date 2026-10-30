import "server-only";
import { db } from "@/lib/db";
import { getRequestMeta } from "@/lib/auth/session";
import type { Prisma } from "@/generated/prisma/client";

export interface AuditInput {
  staffUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary?: string | null;
  before?: Prisma.InputJsonValue | null;
  after?: Prisma.InputJsonValue | null;
}

export async function recordAudit(input: AuditInput): Promise<void> {
  const meta = await getRequestMeta();
  await db.auditLog.create({
    data: {
      staffUserId: input.staffUserId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      summary: input.summary ?? null,
      before: input.before ?? undefined,
      after: input.after ?? undefined,
      ip: meta.ip,
    },
  });
}
