import { createHash } from "node:crypto";
import { db } from "@/lib/db";

export interface WeightedVariantLike {
  id: string;
  name?: string;
  weight: number;
}

export interface VariantConversionMetrics {
  variantId: string;
  variantName: string;
  weight: number;
  segmentName: string | null;
  assignedVisitors: number;
  impressions: number;
  clicks: number;
  addToCarts: number;
  purchases: number;
  ctrPercent: number;
  addToCartRatePercent: number;
  purchaseConversionPercent: number;
  goalConversionPercent: number;
  isLeader: boolean;
}

export interface ExperimentReport {
  id: string;
  name: string;
  blockId: string;
  blockName: string;
  blockType: string;
  status: "DRAFT" | "RUNNING" | "PAUSED" | "COMPLETED";
  goal: string;
  startedAt: Date | null;
  endedAt: Date | null;
  totalAssignments: number;
  totalImpressions: number;
  variants: VariantConversionMetrics[];
}

/**
 * Ziyaretçiyi ağırlıklara (weight) göre SHA-256 özeti üzerinden deterministik olarak
 * bir HomeBlockVariant varyantına atar.
 */
export function selectDeterministicVariant<T extends WeightedVariantLike>(
  experimentId: string,
  visitorId: string,
  variants: readonly T[]
): T | null {
  if (variants.length === 0) return null;
  if (variants.length === 1) return variants[0] ?? null;

  const sorted = variants.slice().sort((a, b) => a.id.localeCompare(b.id));
  const normalizedWeights = sorted.map((v) => (v.weight > 0 ? v.weight : 0));
  let totalWeight = normalizedWeights.reduce((acc, w) => acc + w, 0);

  const effectiveWeights =
    totalWeight > 0 ? normalizedWeights : sorted.map(() => 1);
  if (totalWeight <= 0) {
    totalWeight = effectiveWeights.length;
  }

  const digest = createHash("sha256")
    .update(`${experimentId}:${visitorId}`)
    .digest();
  const bucketInt = digest.readUInt32BE(0);
  const target = (bucketInt / 0x1_0000_0000) * totalWeight;

  let cumulative = 0;
  for (let i = 0; i < sorted.length; i += 1) {
    const w = effectiveWeights[i] ?? 0;
    cumulative += w;
    if (target < cumulative) {
      return sorted[i] ?? null;
    }
  }

  return sorted[sorted.length - 1] ?? null;
}

/**
 * Aktif bir A/B testi için ziyaretçinin varyant atamasını getirir veya oluşturur.
 * Ziyaretçi kalıcı profile onay vermişse (Visitor kaydı mevcutsa) ExperimentAssignment tablosuna yazar.
 */
export async function assignVisitorToExperiment(options: {
  experimentId: string;
  visitorId: string;
}): Promise<{ variantId: string; persisted: boolean } | null> {
  const { experimentId, visitorId } = options;
  if (!experimentId || !visitorId) return null;

  const existing = await db.experimentAssignment.findUnique({
    where: {
      experimentId_visitorId: {
        experimentId,
        visitorId,
      },
    },
  });

  const experiment = await db.experiment.findUnique({
    where: { id: experimentId },
    include: {
      variants: {
        where: { isHidden: false },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!experiment || experiment.variants.length === 0) {
    return null;
  }

  if (existing && experiment.variants.some((v) => v.id === existing.variantId)) {
    return { variantId: existing.variantId, persisted: true };
  }

  const chosen = selectDeterministicVariant(
    experimentId,
    visitorId,
    experiment.variants
  );
  if (!chosen) return null;

  const visitorExists = await db.visitor.findUnique({
    where: { id: visitorId },
    select: { id: true, consent: true },
  });

  if (visitorExists && visitorExists.consent) {
    await db.experimentAssignment.upsert({
      where: {
        experimentId_visitorId: {
          experimentId,
          visitorId,
        },
      },
      create: {
        experimentId,
        visitorId,
        variantId: chosen.id,
      },
      update: {
        variantId: chosen.id,
      },
    });
    return { variantId: chosen.id, persisted: true };
  }

  return { variantId: chosen.id, persisted: false };
}

function readMetaString(meta: unknown, key: string): string | null {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  const val = (meta as Record<string, unknown>)[key];
  return typeof val === "string" && val.trim() ? val.trim() : null;
}

function roundPercent(numerator: number, denominator: number): number {
  if (denominator <= 0 || numerator <= 0) return 0;
  return Number(((numerator / denominator) * 100).toFixed(2));
}

/**
 * Tüm A/B testlerini ve her varyant için gerçek görüntülenme (block_impression),
 * tıklama (block_click), sepete ekleme (add_to_cart) ve satın alma (purchase)
 * dönüşüm oranlarını veritabanından hesaplar.
 */
export async function listExperimentsWithReports(): Promise<ExperimentReport[]> {
  const experiments = await db.experiment.findMany({
    include: {
      block: { select: { id: true, name: true, type: true } },
      variants: {
        include: { segment: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      },
      assignments: {
        select: {
          visitorId: true,
          variantId: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (experiments.length === 0) return [];

  const allAssignedVisitors = Array.from(
    new Set(experiments.flatMap((e) => e.assignments.map((a) => a.visitorId)))
  );
  const allBlockIds = Array.from(new Set(experiments.map((e) => e.blockId)));

  const events = await db.visitorEvent.findMany({
    where: {
      type: {
        in: ["block_impression", "block_click", "add_to_cart", "purchase"],
      },
      OR: [
        ...(allAssignedVisitors.length > 0
          ? [{ visitorId: { in: allAssignedVisitors } }]
          : []),
        ...(allBlockIds.length > 0 ? [{ value: { in: allBlockIds } }] : []),
      ],
    },
    select: {
      visitorId: true,
      type: true,
      value: true,
      meta: true,
      createdAt: true,
    },
  });

  const orders =
    allAssignedVisitors.length > 0
      ? await db.order.findMany({
          where: {
            visitorId: { in: allAssignedVisitors },
            status: { not: "CANCELLED" },
          },
          select: {
            id: true,
            visitorId: true,
            placedAt: true,
          },
        })
      : [];

  return experiments.map((exp) => {
    const assignmentByVisitor = new Map<string, string>();
    const visitorsByVariant = new Map<string, Set<string>>();

    for (const v of exp.variants) {
      visitorsByVariant.set(v.id, new Set<string>());
    }

    for (const a of exp.assignments) {
      assignmentByVisitor.set(a.visitorId, a.variantId);
      visitorsByVariant.get(a.variantId)?.add(a.visitorId);
    }

    const impressionsByVariant = new Map<string, number>();
    const clicksByVariant = new Map<string, number>();
    const addToCartVisitorsByVariant = new Map<string, Set<string>>();
    const purchaseVisitorsByVariant = new Map<string, Set<string>>();

    for (const v of exp.variants) {
      impressionsByVariant.set(v.id, 0);
      clicksByVariant.set(v.id, 0);
      addToCartVisitorsByVariant.set(v.id, new Set<string>());
      purchaseVisitorsByVariant.set(v.id, new Set<string>());
    }

    const startCutoff = exp.startedAt ? exp.startedAt.getTime() : 0;

    for (const ev of events) {
      if (startCutoff > 0 && ev.createdAt.getTime() < startCutoff) {
        continue;
      }

      const metaVariantId = readMetaString(ev.meta, "variantId");
      const metaBlockId = readMetaString(ev.meta, "blockId") ?? ev.value;
      const assignedVariantId = assignmentByVisitor.get(ev.visitorId) ?? null;

      if (ev.type === "block_impression") {
        const targetVariant =
          metaVariantId && impressionsByVariant.has(metaVariantId)
            ? metaVariantId
            : metaBlockId === exp.blockId && assignedVariantId
              ? assignedVariantId
              : null;
        if (targetVariant) {
          impressionsByVariant.set(
            targetVariant,
            (impressionsByVariant.get(targetVariant) ?? 0) + 1
          );
          visitorsByVariant.get(targetVariant)?.add(ev.visitorId);
        }
      } else if (ev.type === "block_click") {
        const targetVariant =
          metaVariantId && clicksByVariant.has(metaVariantId)
            ? metaVariantId
            : metaBlockId === exp.blockId && assignedVariantId
              ? assignedVariantId
              : null;
        if (targetVariant) {
          clicksByVariant.set(
            targetVariant,
            (clicksByVariant.get(targetVariant) ?? 0) + 1
          );
          visitorsByVariant.get(targetVariant)?.add(ev.visitorId);
        }
      } else if (ev.type === "add_to_cart") {
        const targetVariant =
          metaVariantId && addToCartVisitorsByVariant.has(metaVariantId)
            ? metaVariantId
            : assignedVariantId;
        if (targetVariant) {
          addToCartVisitorsByVariant.get(targetVariant)?.add(ev.visitorId);
        }
      } else if (ev.type === "purchase") {
        const targetVariant =
          metaVariantId && purchaseVisitorsByVariant.has(metaVariantId)
            ? metaVariantId
            : assignedVariantId;
        if (targetVariant) {
          purchaseVisitorsByVariant.get(targetVariant)?.add(ev.visitorId);
        }
      }
    }

    for (const order of orders) {
      if (!order.visitorId) continue;
      if (startCutoff > 0 && order.placedAt.getTime() < startCutoff) continue;
      const assignedVariantId = assignmentByVisitor.get(order.visitorId);
      if (assignedVariantId) {
        purchaseVisitorsByVariant.get(assignedVariantId)?.add(order.visitorId);
      }
    }

    const variantReports: VariantConversionMetrics[] = exp.variants.map((v) => {
      const assignedVisitors = visitorsByVariant.get(v.id)?.size ?? 0;
      const impressions = impressionsByVariant.get(v.id) ?? 0;
      const clicks = clicksByVariant.get(v.id) ?? 0;
      const addToCarts = addToCartVisitorsByVariant.get(v.id)?.size ?? 0;
      const purchases = purchaseVisitorsByVariant.get(v.id)?.size ?? 0;

      const exposureBase = impressions > 0 ? impressions : assignedVisitors;
      const ctrPercent = roundPercent(clicks, exposureBase);
      const addToCartRatePercent = roundPercent(addToCarts, exposureBase);
      const purchaseConversionPercent = roundPercent(purchases, exposureBase);

      const goalConversionPercent =
        exp.goal === "block_click"
          ? ctrPercent
          : exp.goal === "add_to_cart"
            ? addToCartRatePercent
            : purchaseConversionPercent;

      return {
        variantId: v.id,
        variantName: v.name,
        weight: v.weight,
        segmentName: v.segment?.name ?? null,
        assignedVisitors,
        impressions,
        clicks,
        addToCarts,
        purchases,
        ctrPercent,
        addToCartRatePercent,
        purchaseConversionPercent,
        goalConversionPercent,
        isLeader: false,
      };
    });

    const maxGoalRate = Math.max(...variantReports.map((vr) => vr.goalConversionPercent), 0);
    if (maxGoalRate > 0) {
      const leader = variantReports.find((vr) => vr.goalConversionPercent === maxGoalRate);
      if (leader) {
        leader.isLeader = true;
      }
    }

    const totalAssignments = variantReports.reduce((acc, vr) => acc + vr.assignedVisitors, 0);
    const totalImpressions = variantReports.reduce((acc, vr) => acc + vr.impressions, 0);

    return {
      id: exp.id,
      name: exp.name,
      blockId: exp.blockId,
      blockName: exp.block.name,
      blockType: exp.block.type,
      status: exp.status,
      goal: exp.goal,
      startedAt: exp.startedAt,
      endedAt: exp.endedAt,
      totalAssignments,
      totalImpressions,
      variants: variantReports,
    };
  });
}
