import "server-only";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5433/eticaret";

const PRISMA_SCHEMA_VERSION = "2026-10-29-invoicing-v1";

const globalForPrisma = globalThis as unknown as {
  pgPool?: Pool;
  prisma?: PrismaClient;
  prismaSchemaVersion?: string;
};

const pool =
  globalForPrisma.pgPool ??
  new Pool({
    connectionString,
    max: 10,
  });

const adapter = new PrismaPg(pool);

export const db =
  globalForPrisma.prisma &&
  globalForPrisma.prismaSchemaVersion === PRISMA_SCHEMA_VERSION &&
  "wishlistCollection" in (globalForPrisma.prisma as object) &&
  "seoKeyword" in (globalForPrisma.prisma as object) &&
  "invoice" in (globalForPrisma.prisma as object)
    ? globalForPrisma.prisma
    : new PrismaClient({
        adapter,
      });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.pgPool = pool;
  globalForPrisma.prisma = db;
  globalForPrisma.prismaSchemaVersion = PRISMA_SCHEMA_VERSION;
}

/**
 * Atomik sıra numarası üretici (sipariş numarası vb. için).
 */
export async function nextCounterValue(key: string, startAt = 1000): Promise<number> {
  const row = await db.counter.upsert({
    where: { key },
    create: { key, value: startAt },
    update: { value: { increment: 1 } },
  });
  return row.value;
}
