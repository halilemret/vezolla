import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import {
  extractAttributionFromUrl,
  mergeAttributionTouches,
  parseAttributionJson,
  resolveVisitorAttribution,
  type ResolvedAdAttribution,
} from "@/modules/personalization/attribution";
import type { AttributionTouch, VisitorEventPayload, VisitorEventType } from "@/modules/personalization/schemas";

export const EVENT_AFFINITY_WEIGHTS: Readonly<Record<string, number>> = {
  view_product: 1,
  view_category: 0.6,
  wishlist: 2.5,
  add_to_cart: 4,
  purchase: 8,
};

export interface AffinityIncrement {
  dimension: string;
  key: string;
  delta: number;
}

export interface ProductAffinitySource {
  id: string;
  brandId?: string | null;
  minPrice?: number | null;
  categories?: Array<{ categoryId: string; isPrimary?: boolean }>;
  tags?: Array<{ tagId: string; tag?: { slug: string } | null }>;
  attributes?: Array<{
    attribute: { key: string };
    valueText?: string | null;
    valueNumber?: number | null;
    valueBool?: boolean | null;
    valueList?: string[];
  }>;
}

/**
 * Zaman azalması (time-decay) hesaplayıcısı:
 * Yarı ömür (halfLifeDays = 14 gün) formülüyle yakın zamandaki etkileşimlere daha yüksek ağırlık verir.
 * score_decayed = score * 0.5^(elapsedDays / halfLifeDays)
 */
export function computeDecayedScore(
  score: number,
  updatedAt: Date | string | number,
  now: Date | string | number = new Date(),
  halfLifeDays = 14
): number {
  if (!Number.isFinite(score) || score <= 0) return 0;
  if (halfLifeDays <= 0) return score;

  const updatedTime = updatedAt instanceof Date ? updatedAt.getTime() : new Date(updatedAt).getTime();
  const nowTime = now instanceof Date ? now.getTime() : new Date(now).getTime();

  if (!Number.isFinite(updatedTime) || !Number.isFinite(nowTime)) {
    return score;
  }

  const elapsedMs = Math.max(0, nowTime - updatedTime);
  const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);
  const decayFactor = Math.pow(0.5, elapsedDays / halfLifeDays);

  return score * decayFactor;
}

/**
 * Kuruş cinsinden fiyatı fiyat bandı anahtarına dönüştürür.
 */
export function computePriceBand(priceMinor: number | null | undefined): string | null {
  if (typeof priceMinor !== "number" || !Number.isFinite(priceMinor) || priceMinor <= 0) {
    return null;
  }
  if (priceMinor < 25_000) return "0_250";
  if (priceMinor < 100_000) return "250_1000";
  if (priceMinor < 300_000) return "1000_3000";
  return "3000_plus";
}

export function detectDeviceTypeFromUserAgent(userAgent?: string | null): "mobile" | "tablet" | "desktop" {
  if (!userAgent) return "desktop";
  const ua = userAgent.toLowerCase();
  if (ua.includes("ipad") || ua.includes("tablet")) {
    return "tablet";
  }
  if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) {
    return "mobile";
  }
  return "desktop";
}

/**
 * Bir ürün ve olay ağırlığından category, brand, tag, price_band ve attr:<key>
 * ilgi boyutu artışlarını üretir.
 */
export function buildProductAffinityIncrements(
  product: ProductAffinitySource,
  weight: number
): AffinityIncrement[] {
  if (weight <= 0) return [];
  const increments: AffinityIncrement[] = [];
  const seen = new Set<string>();

  const pushUnique = (dimension: string, key: string, delta: number) => {
    const cleanKey = key.trim();
    if (!cleanKey || delta <= 0) return;
    const composite = `${dimension}::${cleanKey}`;
    if (seen.has(composite)) return;
    seen.add(composite);
    increments.push({ dimension, key: cleanKey, delta });
  };

  if (product.categories) {
    for (const c of product.categories) {
      pushUnique("category", c.categoryId, weight);
    }
  }

  if (product.brandId) {
    pushUnique("brand", product.brandId, weight);
  }

  if (product.tags) {
    for (const t of product.tags) {
      pushUnique("tag", t.tagId, weight);
      if (t.tag?.slug) {
        pushUnique("tag", t.tag.slug, weight);
      }
    }
  }

  const priceBand = computePriceBand(product.minPrice);
  if (priceBand) {
    pushUnique("price_band", priceBand, weight);
  }

  if (product.attributes) {
    for (const attr of product.attributes) {
      const attrKey = attr.attribute.key.trim();
      if (!attrKey) continue;
      const dimension = `attr:${attrKey}`;

      if (attr.valueText && attr.valueText.trim()) {
        pushUnique(dimension, attr.valueText.trim(), weight);
      }
      if (typeof attr.valueNumber === "number" && Number.isFinite(attr.valueNumber)) {
        pushUnique(dimension, String(attr.valueNumber), weight);
      }
      if (typeof attr.valueBool === "boolean") {
        pushUnique(dimension, String(attr.valueBool), weight);
      }
      if (Array.isArray(attr.valueList)) {
        for (const item of attr.valueList) {
          if (item && item.trim()) {
            pushUnique(dimension, item.trim(), weight);
          }
        }
      }
    }
  }

  return increments;
}

export interface TrackVisitorEventOptions extends VisitorEventPayload {
  visitorId: string;
  customerId?: string | null;
  consent: boolean;
  touch?: AttributionTouch | null;
  userAgent?: string | null;
  now?: Date;
}

export interface TrackVisitorEventResult {
  visitorId: string;
  persisted: boolean;
  consent: boolean;
  eventId: string | null;
  updatedAffinities: number;
  attribution: ResolvedAdAttribution;
}

/**
 * Ziyaretçi olayını işler.
 * KVKK çerez onayı (consent) verilmemişse veritabanında kalıcı davranış profili
 * (VisitorEvent, VisitorAffinity) yazılmaz; yalnızca o oturumdaki reklam/kampanya kimliği çözülür.
 */
export async function trackVisitorEvent(
  options: TrackVisitorEventOptions
): Promise<TrackVisitorEventResult> {
  const now = options.now ?? new Date();
  const extractedTouch =
    options.touch ??
    (options.url || options.referrer
      ? extractAttributionFromUrl(options.url, options.referrer, now)
      : null);

  if (!options.consent) {
    const ephemeralAttribution = await resolveVisitorAttribution({
      touch: extractedTouch,
    });
    return {
      visitorId: options.visitorId,
      persisted: false,
      consent: false,
      eventId: null,
      updatedAffinities: 0,
      attribution: ephemeralAttribution,
    };
  }

  const existingVisitor = await db.visitor.findUnique({
    where: { id: options.visitorId },
  });

  const existingFirstTouch = existingVisitor ? parseAttributionJson(existingVisitor.firstTouch) : null;
  const existingLastTouch = existingVisitor ? parseAttributionJson(existingVisitor.lastTouch) : null;

  const nextFirstTouch = existingFirstTouch ?? extractedTouch;
  const nextLastTouch = extractedTouch
    ? mergeAttributionTouches(existingLastTouch, extractedTouch)
    : existingLastTouch;

  const deviceType =
    options.deviceType ??
    existingVisitor?.deviceType ??
    detectDeviceTypeFromUserAgent(options.userAgent);

  const city = options.city ?? existingVisitor?.city ?? null;
  const isNewSession =
    existingVisitor && now.getTime() - existingVisitor.lastSeenAt.getTime() > 30 * 60 * 1000;

  await db.visitor.upsert({
    where: { id: options.visitorId },
    create: {
      id: options.visitorId,
      customerId: options.customerId ?? null,
      consent: true,
      firstTouch: nextFirstTouch ? (nextFirstTouch as unknown as Prisma.InputJsonValue) : undefined,
      lastTouch: nextLastTouch ? (nextLastTouch as unknown as Prisma.InputJsonValue) : undefined,
      deviceType,
      city,
      sessionCount: 1,
      firstSeenAt: now,
      lastSeenAt: now,
    },
    update: {
      consent: true,
      ...(options.customerId ? { customerId: options.customerId } : {}),
      ...(nextFirstTouch && !existingVisitor?.firstTouch
        ? { firstTouch: nextFirstTouch as unknown as Prisma.InputJsonValue }
        : {}),
      ...(nextLastTouch
        ? { lastTouch: nextLastTouch as unknown as Prisma.InputJsonValue }
        : {}),
      ...(deviceType ? { deviceType } : {}),
      ...(city ? { city } : {}),
      ...(isNewSession ? { sessionCount: { increment: 1 } } : {}),
      lastSeenAt: now,
    },
  });

  const eventRow = await db.visitorEvent.create({
    data: {
      visitorId: options.visitorId,
      type: options.type,
      productId: options.productId ?? null,
      categoryId: options.categoryId ?? null,
      value: options.value ?? null,
      meta: options.meta ? (options.meta as Prisma.InputJsonValue) : undefined,
      createdAt: now,
    },
  });

  if (options.type === "view_product" && options.productId) {
    await db.product
      .update({
        where: { id: options.productId },
        data: { viewCount: { increment: 1 } },
      })
      .catch(() => {});
  }

  const weight = EVENT_AFFINITY_WEIGHTS[options.type as VisitorEventType] ?? 0;
  const increments: AffinityIncrement[] = [];

  if (weight > 0) {
    if (options.type === "view_category" && options.categoryId) {
      increments.push({
        dimension: "category",
        key: options.categoryId,
        delta: weight,
      });
    }

    const productIdsToProcess: string[] = [];
    if (options.productId) {
      productIdsToProcess.push(options.productId);
    }
    if (options.meta && Array.isArray(options.meta.productIds)) {
      for (const rawId of options.meta.productIds) {
        if (typeof rawId === "string" && rawId && !productIdsToProcess.includes(rawId)) {
          productIdsToProcess.push(rawId);
        }
      }
    }

    if (productIdsToProcess.length > 0) {
      const products = await db.product.findMany({
        where: { id: { in: productIdsToProcess } },
        select: {
          id: true,
          brandId: true,
          minPrice: true,
          categories: { select: { categoryId: true, isPrimary: true } },
          tags: { select: { tagId: true, tag: { select: { slug: true } } } },
          attributes: {
            select: {
              valueText: true,
              valueNumber: true,
              valueBool: true,
              valueList: true,
              attribute: { select: { key: true } },
            },
          },
        },
      });

      for (const product of products) {
        const productIncrements = buildProductAffinityIncrements(product, weight);
        increments.push(...productIncrements);
      }
    }
  }

  let updatedAffinities = 0;

  if (increments.length > 0) {
    const existingAffinities = await db.visitorAffinity.findMany({
      where: { visitorId: options.visitorId },
    });

    const affinityMap = new Map<string, { score: number; updatedAt: Date }>();
    for (const row of existingAffinities) {
      affinityMap.set(`${row.dimension}::${row.key}`, {
        score: row.score,
        updatedAt: row.updatedAt,
      });
    }

    for (const inc of increments) {
      const mapKey = `${inc.dimension}::${inc.key}`;
      const current = affinityMap.get(mapKey);
      const decayedBase = current
        ? computeDecayedScore(current.score, current.updatedAt, now, 14)
        : 0;
      const nextScore = Number((decayedBase + inc.delta).toFixed(4));

      await db.visitorAffinity.upsert({
        where: {
          visitorId_dimension_key: {
            visitorId: options.visitorId,
            dimension: inc.dimension,
            key: inc.key,
          },
        },
        create: {
          visitorId: options.visitorId,
          dimension: inc.dimension,
          key: inc.key,
          score: nextScore,
        },
        update: {
          score: nextScore,
        },
      });

      affinityMap.set(mapKey, { score: nextScore, updatedAt: now });
      updatedAffinities += 1;
    }
  }

  const attribution = await resolveVisitorAttribution({
    firstTouch: nextFirstTouch,
    lastTouch: nextLastTouch,
    touch: extractedTouch,
  });

  return {
    visitorId: options.visitorId,
    persisted: true,
    consent: true,
    eventId: eventRow.id,
    updatedAffinities,
    attribution,
  };
}

export const recordVisitorEvent = trackVisitorEvent;

/**
 * Ziyaretçinin KVKK çerez onay tercihini günceller.
 * Onay geri çekilirse (consent = false), kalıcı davranış profili ve olay kayıtları silinir.
 */
export async function setVisitorConsent(visitorId: string, consent: boolean): Promise<void> {
  if (!visitorId) return;
  if (!consent) {
    await db.visitorAffinity.deleteMany({ where: { visitorId } });
    await db.visitorEvent.deleteMany({ where: { visitorId } });
    await db.visitor
      .update({
        where: { id: visitorId },
        data: { consent: false },
      })
      .catch(() => {});
    return;
  }

  await db.visitor.upsert({
    where: { id: visitorId },
    create: {
      id: visitorId,
      consent: true,
    },
    update: {
      consent: true,
      lastSeenAt: new Date(),
    },
  });
}
