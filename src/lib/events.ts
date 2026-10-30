import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export type DomainEventName =
  | "order.placed"
  | "order.paid"
  | "order.shipped"
  | "order.cancelled"
  | "order.refunded"
  | "inventory.restocked"
  | "feed.completed"
  | "feed.failed";

type EventHandler = (payload: Record<string, unknown>) => Promise<void>;

const handlers = new Map<DomainEventName, EventHandler[]>();

export function onDomainEvent(name: DomainEventName, handler: EventHandler): void {
  const list = handlers.get(name) ?? [];
  list.push(handler);
  handlers.set(name, list);
}

/**
 * Olayı veritabanına yazar ve aynı süreçte kayıtlı işleyicileri çalıştırmayı dener.
 * İşleyici hata verirse olay FAILED olarak işaretlenir ve worker tarafından tekrar denenebilir.
 */
export async function emitDomainEvent(
  name: DomainEventName,
  payload: Record<string, unknown>
): Promise<void> {
  const event = await db.domainEvent.create({
    data: {
      name,
      payload: payload as Prisma.InputJsonValue,
      status: "PENDING",
    },
  });

  await dispatchDomainEvent(event.id, name, payload);
}

async function dispatchDomainEvent(
  eventId: string,
  name: string,
  payload: Record<string, unknown>
): Promise<void> {
  const list = handlers.get(name as DomainEventName) ?? [];
  try {
    for (const fn of list) {
      await fn(payload);
    }
    await db.domainEvent.update({
      where: { id: eventId },
      data: {
        status: "PROCESSED",
        attempts: { increment: 1 },
        processedAt: new Date(),
        error: null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.domainEvent.update({
      where: { id: eventId },
      data: {
        status: "FAILED",
        attempts: { increment: 1 },
        error: message,
      },
    });
  }
}

export async function processPendingEvents(limit = 50): Promise<number> {
  const rows = await db.domainEvent.findMany({
    where: {
      status: { in: ["PENDING", "FAILED"] },
      attempts: { lt: 5 },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  for (const row of rows) {
    const payload =
      row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
        ? (row.payload as Record<string, unknown>)
        : {};
    await dispatchDomainEvent(row.id, row.name, payload);
  }

  return rows.length;
}
