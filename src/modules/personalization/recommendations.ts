import { db } from "@/lib/db";
import { computeDecayedScore, computePriceBand } from "@/modules/personalization/tracker";
import { resolveVisitorSegments } from "@/modules/personalization/segments";
import { getCategoryAndDescendantIds } from "@/modules/catalog/service";
import type { AttributionTouch, MerchAction, MerchScope } from "@/modules/personalization/schemas";

export interface MerchandisableProduct {
  id: string;
  totalStock?: number | null;
  baseScore?: number;
  salesCount?: number;
  viewCount?: number;
}

export interface MerchRuleLike {
  id?: string;
  name?: string;
  segmentId?: string | null;
  scope: MerchScope | string;
  categoryId?: string | null;
  searchTerm?: string | null;
  action: MerchAction | string;
  productIds: readonly string[];
  weight?: number;
  priority?: number;
  startsAt?: Date | string | null;
  endsAt?: Date | string | null;
  isActive?: boolean;
}

export interface MerchandisingContext {
  scope: MerchScope;
  segmentId?: string | null;
  segmentIds?: readonly string[];
  categoryId?: string | null;
  searchTerm?: string | null;
  rules?: readonly MerchRuleLike[];
  now?: Date;
  pushOutOfStockToBottom?: boolean;
}

export function doesMerchRuleMatchContext(
  rule: MerchRuleLike,
  context: MerchandisingContext
): boolean {
  if (rule.isActive === false) return false;

  const now = context.now ?? new Date();
  if (rule.startsAt) {
    const start = rule.startsAt instanceof Date ? rule.startsAt : new Date(rule.startsAt);
    if (Number.isFinite(start.getTime()) && start.getTime() > now.getTime()) {
      return false;
    }
  }
  if (rule.endsAt) {
    const end = rule.endsAt instanceof Date ? rule.endsAt : new Date(rule.endsAt);
    if (Number.isFinite(end.getTime()) && end.getTime() < now.getTime()) {
      return false;
    }
  }

  if (rule.scope !== "ALL" && rule.scope !== context.scope) {
    return false;
  }

  if (rule.segmentId) {
    const activeSegmentIds = new Set<string>(context.segmentIds ?? []);
    if (context.segmentId) {
      activeSegmentIds.add(context.segmentId);
    }
    if (!activeSegmentIds.has(rule.segmentId)) {
      return false;
    }
  }

  if (rule.categoryId) {
    if (!context.categoryId || rule.categoryId !== context.categoryId) {
      return false;
    }
  }

  if (rule.searchTerm && rule.searchTerm.trim() !== "") {
    if (!context.searchTerm) return false;
    const expectedTerm = rule.searchTerm.trim().toLocaleLowerCase("tr-TR");
    const actualTerm = context.searchTerm.trim().toLocaleLowerCase("tr-TR");
    if (!actualTerm.includes(expectedTerm) && !expectedTerm.includes(actualTerm)) {
      return false;
    }
  }

  return true;
}

/**
 * Ürün listesine segmente ve kapsama (HOME | CATEGORY | SEARCH | ALL) göre
 * PIN (başa sabitle), BOOST (puan çarpanı), BURY (sona it), HIDE (gizle)
 * kurallarını ve stokta olmayan ürünleri otomatik geri itmeyi uygular.
 */
export function applyMerchandisingRules<T extends MerchandisableProduct>(
  products: readonly T[],
  context: MerchandisingContext
): T[] {
  if (products.length === 0) return [];

  const applicableRules = (context.rules ?? [])
    .filter((r) => doesMerchRuleMatchContext(r, context))
    .slice()
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

  const hiddenIds = new Set<string>();
  const pinnedOrder = new Map<string, number>();
  const boostMultipliers = new Map<string, number>();
  const buriedWeights = new Map<string, number>();

  let pinRank = 0;

  for (const rule of applicableRules) {
    const action = rule.action.toUpperCase();
    if (action === "HIDE") {
      for (const pid of rule.productIds) {
        hiddenIds.add(pid);
      }
    } else if (action === "PIN") {
      for (const pid of rule.productIds) {
        if (!pinnedOrder.has(pid)) {
          pinnedOrder.set(pid, pinRank);
          pinRank += 1;
        }
      }
    } else if (action === "BOOST") {
      const weight = typeof rule.weight === "number" && rule.weight > 0 ? rule.weight : 2;
      const effectiveMultiplier = weight > 1 ? weight : 1 + weight;
      for (const pid of rule.productIds) {
        const prev = boostMultipliers.get(pid) ?? 1;
        boostMultipliers.set(pid, prev * effectiveMultiplier);
      }
    } else if (action === "BURY") {
      const weight = typeof rule.weight === "number" && rule.weight > 0 ? rule.weight : 2;
      for (const pid of rule.productIds) {
        const prev = buriedWeights.get(pid) ?? 1;
        buriedWeights.set(pid, prev * Math.max(1, weight));
      }
    }
  }

  const pushOutOfStock = context.pushOutOfStockToBottom !== false;
  const totalCount = products.length;

  interface RankedEntry {
    product: T;
    originalIndex: number;
    isOutOfStock: boolean;
    pinRank: number | undefined;
    isBoosted: boolean;
    isBuried: boolean;
    effectiveScore: number;
  }

  const entries: RankedEntry[] = [];

  products.forEach((product, index) => {
    if (hiddenIds.has(product.id)) {
      return;
    }

    const isOutOfStock =
      pushOutOfStock &&
      typeof product.totalStock === "number" &&
      product.totalStock <= 0;

    const baseScore =
      typeof product.baseScore === "number" && Number.isFinite(product.baseScore)
        ? product.baseScore
        : totalCount - index;

    const pin = pinnedOrder.get(product.id);
    const boostMult = boostMultipliers.get(product.id);
    const buryDiv = buriedWeights.get(product.id);

    const isBoosted = boostMult !== undefined && pin === undefined;
    const isBuried = buryDiv !== undefined && pin === undefined && !isBoosted;

    let effectiveScore = baseScore;
    if (boostMult !== undefined) {
      effectiveScore = Math.max(1, baseScore) * boostMult + 1000 * boostMult;
    }
    if (buryDiv !== undefined) {
      effectiveScore = effectiveScore / buryDiv;
    }

    entries.push({
      product,
      originalIndex: index,
      isOutOfStock,
      pinRank: pin,
      isBoosted,
      isBuried,
      effectiveScore,
    });
  });

  entries.sort((a, b) => {
    // 1. Stokta olmayan ürünler her zaman en sona itilir
    if (a.isOutOfStock !== b.isOutOfStock) {
      return a.isOutOfStock ? 1 : -1;
    }

    // 2. PIN (başa sabitlenenler) en üstte yer alır
    if (a.pinRank !== undefined || b.pinRank !== undefined) {
      if (a.pinRank !== undefined && b.pinRank !== undefined) {
        return a.pinRank - b.pinRank;
      }
      return a.pinRank !== undefined ? -1 : 1;
    }

    // 3. BURY (sona itilenler) normal ve boost edilen ürünlerin altına iner
    if (a.isBuried !== b.isBuried) {
      return a.isBuried ? 1 : -1;
    }

    // 4. BOOST veya temel puana göre azalan sıralama
    if (b.effectiveScore !== a.effectiveScore) {
      return b.effectiveScore - a.effectiveScore;
    }

    return a.originalIndex - b.originalIndex;
  });

  return entries.map((e) => e.product);
}

export interface AffinityRowLike {
  dimension: string;
  key: string;
  score: number;
  updatedAt: Date | string;
}

export interface ScorableCatalogProduct extends MerchandisableProduct {
  id: string;
  brandId?: string | null;
  minPrice?: number | null;
  categories?: Array<{ categoryId: string }>;
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
 * Ziyaretçinin zaman azaltmalı VisitorAffinity profiline göre ürünleri puanlar.
 */
export function scoreProductsByAffinity<T extends ScorableCatalogProduct>(
  products: readonly T[],
  affinities: readonly AffinityRowLike[],
  now: Date = new Date()
): Array<T & { baseScore: number }> {
  const decayedMap = new Map<string, number>();

  for (const row of affinities) {
    const decayed = computeDecayedScore(row.score, row.updatedAt, now, 14);
    if (decayed > 0.01) {
      decayedMap.set(`${row.dimension}::${row.key}`, decayed);
    }
  }

  return products.map((product) => {
    let score = 0;

    if (product.categories) {
      for (const c of product.categories) {
        score += (decayedMap.get(`category::${c.categoryId}`) ?? 0) * 1.4;
      }
    }

    if (product.brandId) {
      score += (decayedMap.get(`brand::${product.brandId}`) ?? 0) * 1.2;
    }

    if (product.tags) {
      for (const t of product.tags) {
        score += (decayedMap.get(`tag::${t.tagId}`) ?? 0) * 1.0;
        if (t.tag?.slug) {
          score += (decayedMap.get(`tag::${t.tag.slug}`) ?? 0) * 1.0;
        }
      }
    }

    const band = computePriceBand(product.minPrice);
    if (band) {
      score += (decayedMap.get(`price_band::${band}`) ?? 0) * 0.8;
    }

    if (product.attributes) {
      for (const attr of product.attributes) {
        const dim = `attr:${attr.attribute.key}`;
        if (attr.valueText) {
          score += (decayedMap.get(`${dim}::${attr.valueText}`) ?? 0) * 0.9;
        }
        if (typeof attr.valueNumber === "number") {
          score += (decayedMap.get(`${dim}::${String(attr.valueNumber)}`) ?? 0) * 0.9;
        }
        if (typeof attr.valueBool === "boolean") {
          score += (decayedMap.get(`${dim}::${String(attr.valueBool)}`) ?? 0) * 0.9;
        }
        if (Array.isArray(attr.valueList)) {
          for (const val of attr.valueList) {
            score += (decayedMap.get(`${dim}::${val}`) ?? 0) * 0.9;
          }
        }
      }
    }

    const popularityBonus =
      (product.salesCount ?? 0) * 0.05 + (product.viewCount ?? 0) * 0.005;

    return {
      ...product,
      baseScore: Number((score + popularityBonus).toFixed(4)),
    };
  });
}

const PRODUCT_CARD_INCLUDE = {
  brand: { select: { id: true, name: true, slug: true } },
  images: { orderBy: { position: "asc" as const }, take: 2 },
  variants: {
    where: { isActive: true },
    orderBy: { position: "asc" as const },
    take: 5,
  },
  categories: {
    include: { category: { select: { id: true, name: true, slug: true } } },
  },
  tags: {
    include: { tag: { select: { id: true, name: true, slug: true } } },
  },
  attributes: {
    include: { attribute: { select: { key: true, label: true } } },
  },
};

export type RecommendedProduct = Awaited<
  ReturnType<typeof fetchActiveProductsByIds>
>[number] & { baseScore?: number };

async function fetchActiveProductsByIds(ids: string[]) {
  if (ids.length === 0) return [];
  const rows = await db.product.findMany({
    where: {
      id: { in: ids },
      status: "ACTIVE",
      deletedAt: null,
    },
    include: PRODUCT_CARD_INCLUDE,
  });

  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter((r): r is NonNullable<typeof r> => Boolean(r));
}

export type RecommendationSource =
  | "ad_campaign"
  | "for_you"
  | "recently_viewed"
  | "abandoned_cart"
  | "associated"
  | "cold_start"
  | "category"
  | "collection"
  | "manual";

export interface GetRecommendationsOptions {
  source: RecommendationSource;
  visitorId?: string | null;
  customerId?: string | null;
  touch?: AttributionTouch | null;
  segmentIds?: string[];
  categoryId?: string | null;
  collectionId?: string | null;
  productIds?: string[];
  searchTerm?: string | null;
  scope?: MerchScope;
  limit?: number;
  strictSource?: boolean;
}

/**
 * İstenen kaynağa (ad_campaign, for_you, recently_viewed, abandoned_cart, associated, cold_start)
 * göre dinamik ürün listesi üretir ve MerchRule sıralama kurallarını uygular.
 */
export async function getRecommendedProducts(
  options: GetRecommendationsOptions
): Promise<RecommendedProduct[]> {
  const limit = Math.max(1, Math.min(48, options.limit ?? 8));
  const scope: MerchScope = options.scope ?? "HOME";
  const now = new Date();

  const resolved = await resolveVisitorSegments({
    visitorId: options.visitorId,
    customerId: options.customerId,
    touch: options.touch,
  });

  const effectiveVisitorId = options.visitorId ?? resolved.context.visitorId ?? null;
  const activeSegmentIds =
    options.segmentIds ?? resolved.segments.map((s) => s.id);

  const merchRules = await db.merchRule.findMany({
    where: { isActive: true },
    orderBy: { priority: "desc" },
  });

  let candidates: RecommendedProduct[] = [];

  if (options.source === "manual" && options.productIds && options.productIds.length > 0) {
    candidates = await fetchActiveProductsByIds(options.productIds);
  } else if (options.source === "category" && options.categoryId) {
    const categoryIds = await getCategoryAndDescendantIds({ id: options.categoryId });
    candidates = await db.product.findMany({
      where: {
        status: "ACTIVE",
        deletedAt: null,
        categories: {
          some: {
            categoryId: { in: categoryIds.length > 0 ? categoryIds : [options.categoryId] },
          },
        },
      },
      include: PRODUCT_CARD_INCLUDE,
      orderBy: [{ totalStock: "desc" }, { salesCount: "desc" }, { createdAt: "desc" }],
      take: limit * 2,
    });
  } else if (options.source === "collection" && options.collectionId) {
    const colProducts = await db.collectionProduct.findMany({
      where: { collectionId: options.collectionId },
      orderBy: { position: "asc" },
      select: { productId: true },
      take: limit * 2,
    });
    candidates = await fetchActiveProductsByIds(colProducts.map((cp) => cp.productId));
  } else if (options.source === "ad_campaign") {
    const featuredIds = resolved.featuredProductIds;
    if (featuredIds.length > 0) {
      const featuredProducts = await fetchActiveProductsByIds(featuredIds);
      const categoryIds = Array.from(
        new Set(
          featuredProducts.flatMap((p) => p.categories.map((c) => c.categoryId))
        )
      );

      let complementary: RecommendedProduct[] = [];
      if (featuredProducts.length < limit && categoryIds.length > 0) {
        complementary = await db.product.findMany({
          where: {
            status: "ACTIVE",
            deletedAt: null,
            id: { notIn: featuredIds },
            categories: { some: { categoryId: { in: categoryIds } } },
          },
          include: PRODUCT_CARD_INCLUDE,
          orderBy: [{ totalStock: "desc" }, { salesCount: "desc" }],
          take: limit * 2,
        });
      }

      candidates = [
        ...featuredProducts.map((p, idx) => ({
          ...p,
          baseScore: 500 - idx * 10,
        })),
        ...complementary.map((p, idx) => ({
          ...p,
          baseScore: 100 - idx,
        })),
      ];
    } else if (!options.strictSource) {
      candidates = await fetchColdStartProducts(limit * 2);
    }
  } else if (options.source === "recently_viewed") {
    if (effectiveVisitorId) {
      const recentEvents = await db.visitorEvent.findMany({
        where: {
          visitorId: effectiveVisitorId,
          type: "view_product",
          productId: { not: null },
        },
        orderBy: { createdAt: "desc" },
        take: 40,
        select: { productId: true },
      });

      const uniqueIds: string[] = [];
      for (const ev of recentEvents) {
        if (ev.productId && !uniqueIds.includes(ev.productId)) {
          uniqueIds.push(ev.productId);
        }
      }
      candidates = await fetchActiveProductsByIds(uniqueIds.slice(0, limit * 2));
    }
  } else if (options.source === "abandoned_cart") {
    if (effectiveVisitorId || options.customerId) {
      const cart = await db.cart.findFirst({
        where: {
          completedAt: null,
          OR: [
            ...(effectiveVisitorId ? [{ visitorId: effectiveVisitorId }] : []),
            ...(options.customerId ? [{ customerId: options.customerId }] : []),
          ],
        },
        include: {
          items: {
            include: {
              variant: { select: { productId: true } },
            },
            orderBy: { updatedAt: "desc" },
          },
        },
        orderBy: { updatedAt: "desc" },
      });

      if (cart && cart.items.length > 0) {
        const productIds = Array.from(
          new Set(cart.items.map((item) => item.variant.productId))
        );
        candidates = await fetchActiveProductsByIds(productIds);
      }
    }
  } else if (options.source === "associated") {
    let anchorIds = options.productIds ? [...options.productIds] : [];
    if (anchorIds.length === 0 && effectiveVisitorId) {
      const recentViews = await db.visitorEvent.findMany({
        where: {
          visitorId: effectiveVisitorId,
          type: { in: ["view_product", "add_to_cart"] },
          productId: { not: null },
        },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { productId: true },
      });
      anchorIds = Array.from(
        new Set(
          recentViews
            .map((e) => e.productId)
            .filter((id): id is string => Boolean(id))
        )
      );
    }

    if (anchorIds.length > 0) {
      const associations = await db.productAssociation.findMany({
        where: {
          productId: { in: anchorIds },
          relatedProductId: { notIn: anchorIds },
        },
        orderBy: { score: "desc" },
        take: limit * 4,
      });

      const scoreByRelated = new Map<string, number>();
      for (const assoc of associations) {
        const kindWeight = assoc.kind === "CO_PURCHASE" ? 1.5 : 1.0;
        const current = scoreByRelated.get(assoc.relatedProductId) ?? 0;
        scoreByRelated.set(assoc.relatedProductId, current + assoc.score * kindWeight);
      }

      const orderedIds = Array.from(scoreByRelated.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([id]) => id)
        .slice(0, limit * 2);

      const assocProducts = await fetchActiveProductsByIds(orderedIds);
      candidates = assocProducts.map((p) => ({
        ...p,
        baseScore: scoreByRelated.get(p.id) ?? 1,
      }));
    }

    if (candidates.length === 0 && !options.strictSource) {
      candidates = await fetchColdStartProducts(limit * 2);
    }
  } else if (options.source === "for_you") {
    const affinities = effectiveVisitorId
      ? await db.visitorAffinity.findMany({
          where: { visitorId: effectiveVisitorId },
          orderBy: { score: "desc" },
          take: 50,
        })
      : [];

    if (affinities.length > 0) {
      const pool = await db.product.findMany({
        where: {
          status: "ACTIVE",
          deletedAt: null,
        },
        include: PRODUCT_CARD_INCLUDE,
        take: 120,
      });

      const scored = scoreProductsByAffinity(pool, affinities, now);
      scored.sort((a, b) => b.baseScore - a.baseScore);
      candidates = scored.slice(0, limit * 2);
    } else {
      candidates = await fetchColdStartProducts(limit * 2);
    }
  } else {
    candidates = await fetchColdStartProducts(limit * 2);
  }

  const ranked = applyMerchandisingRules(candidates, {
    scope,
    segmentIds: activeSegmentIds,
    categoryId: options.categoryId ?? null,
    searchTerm: options.searchTerm ?? null,
    rules: merchRules,
    now,
    pushOutOfStockToBottom: true,
  });

  return ranked.slice(0, limit);
}

async function fetchColdStartProducts(take: number): Promise<RecommendedProduct[]> {
  const rows = await db.product.findMany({
    where: {
      status: "ACTIVE",
      deletedAt: null,
    },
    include: PRODUCT_CARD_INCLUDE,
    orderBy: [{ salesCount: "desc" }, { viewCount: "desc" }, { createdAt: "desc" }],
    take,
  });

  return rows.map((p, idx) => ({
    ...p,
    baseScore: p.salesCount * 2 + p.viewCount * 0.1 + (take - idx),
  }));
}

/**
 * Sipariş (OrderItem) ve ziyaretçi olay (VisitorEvent) geçmişinden
 * birlikte satın alınan (CO_PURCHASE) ve birlikte görüntülenen (CO_VIEW)
 * ürün ilişkilerini hesaplayıp ProductAssociation tablosunu günceller.
 */
export async function rebuildProductAssociations(): Promise<{
  coPurchaseCount: number;
  coViewCount: number;
  totalUpdated: number;
}> {
  const [orders, viewEvents] = await Promise.all([
    db.order.findMany({
      where: { status: { not: "CANCELLED" } },
      select: {
        id: true,
        items: {
          select: {
            productId: true,
            quantity: true,
          },
        },
      },
      orderBy: { placedAt: "desc" },
      take: 1000,
    }),
    db.visitorEvent.findMany({
      where: {
        type: "view_product",
        productId: { not: null },
      },
      select: {
        visitorId: true,
        productId: true,
      },
      orderBy: { createdAt: "desc" },
      take: 5000,
    }),
  ]);

  const coPurchaseMap = new Map<string, number>();

  for (const order of orders) {
    const productIds = Array.from(
      new Set(
        order.items
          .map((item) => item.productId)
          .filter((id): id is string => Boolean(id))
      )
    );

    if (productIds.length < 2) continue;

    for (let i = 0; i < productIds.length; i += 1) {
      for (let j = 0; j < productIds.length; j += 1) {
        if (i === j) continue;
        const pA = productIds[i];
        const pB = productIds[j];
        if (!pA || !pB) continue;
        const key = `${pA}::${pB}`;
        coPurchaseMap.set(key, (coPurchaseMap.get(key) ?? 0) + 2);
      }
    }
  }

  const viewsByVisitor = new Map<string, Set<string>>();
  for (const ev of viewEvents) {
    if (!ev.productId) continue;
    let set = viewsByVisitor.get(ev.visitorId);
    if (!set) {
      set = new Set<string>();
      viewsByVisitor.set(ev.visitorId, set);
    }
    if (set.size < 20) {
      set.add(ev.productId);
    }
  }

  const coViewMap = new Map<string, number>();
  for (const productSet of viewsByVisitor.values()) {
    const productIds = Array.from(productSet);
    if (productIds.length < 2) continue;

    for (let i = 0; i < productIds.length; i += 1) {
      for (let j = 0; j < productIds.length; j += 1) {
        if (i === j) continue;
        const pA = productIds[i];
        const pB = productIds[j];
        if (!pA || !pB) continue;
        const key = `${pA}::${pB}`;
        coViewMap.set(key, (coViewMap.get(key) ?? 0) + 1);
      }
    }
  }

  let coPurchaseCount = 0;
  let coViewCount = 0;

  await db.productAssociation.deleteMany({});

  const rowsToInsert: Array<{
    productId: string;
    relatedProductId: string;
    kind: string;
    score: number;
  }> = [];

  for (const [pairKey, score] of coPurchaseMap.entries()) {
    const [productId, relatedProductId] = pairKey.split("::");
    if (!productId || !relatedProductId) continue;
    rowsToInsert.push({
      productId,
      relatedProductId,
      kind: "CO_PURCHASE",
      score,
    });
    coPurchaseCount += 1;
  }

  for (const [pairKey, score] of coViewMap.entries()) {
    const [productId, relatedProductId] = pairKey.split("::");
    if (!productId || !relatedProductId) continue;
    rowsToInsert.push({
      productId,
      relatedProductId,
      kind: "CO_VIEW",
      score,
    });
    coViewCount += 1;
  }

  if (rowsToInsert.length > 0) {
    await db.productAssociation.createMany({
      data: rowsToInsert,
      skipDuplicates: true,
    });
  }

  return {
    coPurchaseCount,
    coViewCount,
    totalUpdated: rowsToInsert.length,
  };
}
