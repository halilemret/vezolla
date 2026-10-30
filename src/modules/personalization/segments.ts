import { cookies } from "next/headers";
import { db } from "@/lib/db";
import {
  CUSTOMER_COOKIE,
  SEGMENT_PREVIEW_COOKIE,
  VISITOR_COOKIE,
  hashToken,
} from "@/lib/auth/session";
import {
  mergeAttributionTouches,
  parseAttributionJson,
  resolveVisitorAttribution,
} from "@/modules/personalization/attribution";
import {
  segmentRuleGroupSchema,
  type AttributionTouch,
  type SegmentCondition,
  type SegmentRuleField,
  type SegmentRuleGroup,
  type SegmentRuleOperator,
} from "@/modules/personalization/schemas";

export interface VisitorSegmentContext {
  visitorId?: string | null;
  ad_id?: string | null;
  adset_id?: string | null;
  campaign_id?: string | null;
  utm_campaign?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  device_type?: string | null;
  city?: string | null;
  viewed_categories?: string[];
  viewed_category?: string | string[] | null;
  min_orders?: number;
  order_count?: number;
  total_spent_min?: number;
  total_spent?: number;
  abandoned_cart?: boolean;
  first_visit?: boolean;
  customer_group?: string | null;
  previewSegmentId?: string | null;
}

export interface EvaluableSegment {
  id: string;
  name: string;
  description?: string | null;
  rules: unknown;
  priority: number;
  isActive: boolean;
}

export const SEGMENT_FIELD_METADATA: ReadonlyArray<{
  field: SegmentRuleField;
  label: string;
  valueType: "string" | "number" | "boolean";
  placeholder: string;
}> = [
  { field: "ad_id", label: "Reklam Kimliği (ad_id)", valueType: "string", placeholder: "Örn: meta_ad_101" },
  { field: "campaign_id", label: "Kampanya Kimliği (campaign_id)", valueType: "string", placeholder: "Örn: cmp_yaz_2026" },
  { field: "utm_campaign", label: "UTM Kampanya (utm_campaign)", valueType: "string", placeholder: "Örn: sonbahar_lansman" },
  { field: "utm_source", label: "UTM Kaynak (utm_source)", valueType: "string", placeholder: "Örn: instagram, google" },
  { field: "device_type", label: "Cihaz Tipi (device_type)", valueType: "string", placeholder: "mobile, desktop veya tablet" },
  { field: "city", label: "Şehir (city)", valueType: "string", placeholder: "Örn: İstanbul" },
  { field: "viewed_category", label: "İncelenen Kategori (viewed_category)", valueType: "string", placeholder: "Kategori ID veya slug" },
  { field: "min_orders", label: "Minimum Sipariş Sayısı (min_orders)", valueType: "number", placeholder: "Örn: 2" },
  { field: "total_spent_min", label: "Minimum Harcama Kuruş/TL (total_spent_min)", valueType: "number", placeholder: "Örn: 100000 (1.000 TL)" },
  { field: "abandoned_cart", label: "Terk Edilmiş Sepet Var mı (abandoned_cart)", valueType: "boolean", placeholder: "true / false" },
  { field: "first_visit", label: "İlk Ziyaret mi (first_visit)", valueType: "boolean", placeholder: "true / false" },
  { field: "customer_group", label: "Müşteri Grubu (customer_group)", valueType: "string", placeholder: "Grup ID veya adı" },
];

function normalizeText(val: unknown): string {
  if (typeof val === "string") return val.trim().toLocaleLowerCase("tr-TR");
  if (typeof val === "number" || typeof val === "boolean") return String(val).toLocaleLowerCase("tr-TR");
  return "";
}

function toStringList(val: unknown): string[] {
  if (Array.isArray(val)) {
    return val.map((item) => normalizeText(item)).filter(Boolean);
  }
  if (typeof val === "string") {
    return val
      .split(",")
      .map((item) => normalizeText(item))
      .filter(Boolean);
  }
  return [];
}

function compareStringOperator(
  actualRaw: string | null | undefined,
  expectedRaw: unknown,
  operator: SegmentRuleOperator = "eq"
): boolean {
  const actual = normalizeText(actualRaw ?? "");
  const expected = normalizeText(expectedRaw);

  if (operator === "neq") {
    return actual !== expected;
  }
  if (operator === "contains") {
    if (!expected) return false;
    return actual.includes(expected);
  }
  if (operator === "in") {
    const list = toStringList(expectedRaw);
    if (list.length === 0) return false;
    return list.includes(actual);
  }
  if (!expected) return false;
  return actual === expected;
}

function compareNumberOperator(
  actual: number,
  expectedRaw: unknown,
  operator: SegmentRuleOperator = "gte"
): boolean {
  const expected = typeof expectedRaw === "number" ? expectedRaw : Number(expectedRaw);
  if (!Number.isFinite(expected)) return false;

  if (operator === "eq") return actual === expected;
  if (operator === "neq") return actual !== expected;
  if (operator === "lte") return actual <= expected;
  return actual >= expected;
}

function compareBooleanOperator(
  actual: boolean,
  expectedRaw: unknown,
  operator?: SegmentRuleOperator
): boolean {
  if (operator === "is_true") return actual === true;
  if (operator === "is_false") return actual === false;

  if (typeof expectedRaw === "boolean") {
    return operator === "neq" ? actual !== expectedRaw : actual === expectedRaw;
  }
  if (typeof expectedRaw === "string") {
    const norm = expectedRaw.trim().toLowerCase();
    if (norm === "false" || norm === "0" || norm === "hayir" || norm === "hayır") {
      return operator === "neq" ? actual !== false : actual === false;
    }
    if (norm === "true" || norm === "1" || norm === "evet") {
      return operator === "neq" ? actual !== true : actual === true;
    }
  }
  if (typeof expectedRaw === "number") {
    const target = expectedRaw !== 0;
    return operator === "neq" ? actual !== target : actual === target;
  }
  return actual === true;
}

/**
 * Tek bir segment koşulunu ziyaretçi bağlamına göre değerlendirir.
 */
export function evaluateSegmentCondition(
  condition: SegmentCondition,
  context: VisitorSegmentContext
): boolean {
  const { field, operator, value } = condition;

  switch (field) {
    case "ad_id":
      return compareStringOperator(context.ad_id, value, operator ?? "eq");
    case "campaign_id":
      return compareStringOperator(context.campaign_id, value, operator ?? "eq");
    case "utm_campaign":
      return compareStringOperator(context.utm_campaign, value, operator ?? "eq");
    case "utm_source":
      return compareStringOperator(context.utm_source, value, operator ?? "eq");
    case "device_type":
      return compareStringOperator(context.device_type, value, operator ?? "eq");
    case "city":
      return compareStringOperator(context.city, value, operator ?? "eq");
    case "customer_group":
      return compareStringOperator(context.customer_group, value, operator ?? "eq");
    case "viewed_category": {
      const categories = new Set<string>();
      if (Array.isArray(context.viewed_categories)) {
        for (const c of context.viewed_categories) {
          const norm = normalizeText(c);
          if (norm) categories.add(norm);
        }
      }
      if (typeof context.viewed_category === "string") {
        const norm = normalizeText(context.viewed_category);
        if (norm) categories.add(norm);
      } else if (Array.isArray(context.viewed_category)) {
        for (const c of context.viewed_category) {
          const norm = normalizeText(c);
          if (norm) categories.add(norm);
        }
      }

      const targets = toStringList(value);
      if (targets.length === 0) return false;

      if (operator === "neq") {
        return targets.every((t) => !categories.has(t));
      }
      if (operator === "contains") {
        return Array.from(categories).some((cat) => targets.some((t) => cat.includes(t)));
      }
      return targets.some((t) => categories.has(t));
    }
    case "min_orders": {
      const orders = context.order_count ?? context.min_orders ?? 0;
      return compareNumberOperator(orders, value, operator ?? "gte");
    }
    case "total_spent_min": {
      const spent = context.total_spent ?? context.total_spent_min ?? 0;
      return compareNumberOperator(spent, value, operator ?? "gte");
    }
    case "abandoned_cart": {
      return compareBooleanOperator(Boolean(context.abandoned_cart), value, operator);
    }
    case "first_visit": {
      return compareBooleanOperator(Boolean(context.first_visit), value, operator);
    }
    default:
      return false;
  }
}

/**
 * VE (ALL) / VEYA (ANY) kural ağacını özyinelemeli olarak değerlendirir.
 */
export function evaluateSegmentRuleGroup(
  group: SegmentRuleGroup,
  context: VisitorSegmentContext
): boolean {
  const conditions = [
    ...(Array.isArray(group.conditions) ? group.conditions : []),
    ...(Array.isArray(group.rules) ? group.rules : []),
  ];
  const subGroups = Array.isArray(group.groups) ? group.groups : [];

  if (conditions.length === 0 && subGroups.length === 0) {
    return false;
  }

  const results: boolean[] = [
    ...conditions.map((c) => evaluateSegmentCondition(c, context)),
    ...subGroups.map((g) => evaluateSegmentRuleGroup(g, context)),
  ];

  if (group.match === "ANY") {
    return results.some(Boolean);
  }
  return results.every(Boolean);
}

/**
 * Veritabanından okunan JSON kural ağacını doğrulayıp değerlendirir.
 */
export function evaluateSegmentRules(
  rawRules: unknown,
  context: VisitorSegmentContext
): boolean {
  if (!rawRules || typeof rawRules !== "object") {
    return false;
  }
  const parsed = segmentRuleGroupSchema.safeParse(rawRules);
  if (!parsed.success) {
    return false;
  }
  return evaluateSegmentRuleGroup(parsed.data, context);
}

/**
 * Ziyaretçinin uyduğu segmentleri priority (yüksekten düşüğe) sırasına göre döndürür.
 * SEGMENT_PREVIEW_COOKIE (previewSegmentId) seçiliyse önizleme segmentini en başa koyar.
 */
export function matchVisitorSegments<T extends EvaluableSegment>(
  segments: readonly T[],
  context: VisitorSegmentContext,
  options?: {
    previewSegmentId?: string | null;
    adMappedSegmentIds?: readonly string[];
  }
): T[] {
  const previewId =
    (options?.previewSegmentId ?? context.previewSegmentId)?.trim() || null;
  const adMappedSet = new Set(options?.adMappedSegmentIds ?? []);

  const sortedActive = segments
    .filter((s) => s.isActive)
    .slice()
    .sort((a, b) => b.priority - a.priority);

  const matched: T[] = [];

  for (const segment of sortedActive) {
    const matchedByAd = adMappedSet.has(segment.id);
    const matchedByRules = evaluateSegmentRules(segment.rules, context);
    if (matchedByAd || matchedByRules) {
      matched.push(segment);
    }
  }

  if (previewId) {
    const previewSegment = segments.find((s) => s.id === previewId);
    if (previewSegment) {
      const rest = matched.filter((s) => s.id !== previewSegment.id);
      return [previewSegment, ...rest];
    }
  }

  return matched;
}

/**
 * Aktif istekteki çerezler, ziyaretçi profili, müşteri ve sepet verisinden
 * tam VisitorSegmentContext nesnesini inşa eder ve eşleşen segmentleri döndürür.
 */
export async function resolveVisitorSegments(options?: {
  visitorId?: string | null;
  customerId?: string | null;
  touch?: AttributionTouch | null;
  previewSegmentId?: string | null;
  deviceType?: string | null;
  city?: string | null;
}): Promise<{
  context: VisitorSegmentContext;
  segments: EvaluableSegment[];
  primarySegment: EvaluableSegment | null;
  featuredProductIds: string[];
}> {
  let cookieVisitorId: string | null = null;
  let cookiePreviewSegmentId: string | null = null;
  let cookieCustomerId: string | null = null;

  try {
    const cookieStore = await cookies();
    cookieVisitorId = cookieStore.get(VISITOR_COOKIE)?.value ?? null;
    cookiePreviewSegmentId = cookieStore.get(SEGMENT_PREVIEW_COOKIE)?.value ?? null;

    if (!options?.customerId) {
      const rawCustomerToken = cookieStore.get(CUSTOMER_COOKIE)?.value;
      if (rawCustomerToken) {
        const sessionId = hashToken(rawCustomerToken);
        const session = await db.customerSession.findUnique({
          where: { id: sessionId },
          select: { customerId: true, expiresAt: true },
        });
        if (session && session.expiresAt.getTime() > Date.now()) {
          cookieCustomerId = session.customerId;
        }
      }
    }
  } catch {
    // Çerez bağlamı olmayan arka plan / test çağrılarında güvenli devam et
  }

  const visitorId = options?.visitorId ?? cookieVisitorId;
  const previewSegmentId = options?.previewSegmentId ?? cookiePreviewSegmentId;

  const [allSegments, visitor] = await Promise.all([
    db.segment.findMany({
      where: { isActive: true },
      orderBy: { priority: "desc" },
    }),
    visitorId
      ? db.visitor.findUnique({
          where: { id: visitorId },
          include: {
            affinities: {
              where: { dimension: "category" },
              orderBy: { score: "desc" },
              take: 25,
            },
          },
        })
      : Promise.resolve(null),
  ]);

  const effectiveCustomerId =
    options?.customerId ?? visitor?.customerId ?? cookieCustomerId ?? null;

  const [customer, activeCart] = await Promise.all([
    effectiveCustomerId
      ? db.customer.findUnique({
          where: { id: effectiveCustomerId },
          include: {
            group: { select: { id: true, name: true } },
            addresses: {
              where: { isDefaultShipping: true },
              take: 1,
              select: { city: true },
            },
          },
        })
      : Promise.resolve(null),
    visitorId || effectiveCustomerId
      ? db.cart.findFirst({
          where: {
            completedAt: null,
            OR: [
              ...(visitorId ? [{ visitorId }] : []),
              ...(effectiveCustomerId ? [{ customerId: effectiveCustomerId }] : []),
            ],
          },
          include: {
            items: { select: { id: true } },
          },
          orderBy: { updatedAt: "desc" },
        })
      : Promise.resolve(null),
  ]);

  const firstTouch = visitor ? parseAttributionJson(visitor.firstTouch) : null;
  const lastTouch = visitor ? parseAttributionJson(visitor.lastTouch) : null;
  const mergedTouch = mergeAttributionTouches(firstTouch, lastTouch, options?.touch);

  const resolvedAd = await resolveVisitorAttribution({
    firstTouch,
    lastTouch,
    touch: options?.touch,
  });

  const viewedCategories = new Set<string>();
  if (visitor?.affinities) {
    for (const aff of visitor.affinities) {
      viewedCategories.add(aff.key);
    }
  }

  if (viewedCategories.size > 0) {
    const categoryRows = await db.category.findMany({
      where: { id: { in: Array.from(viewedCategories) } },
      select: { id: true, slug: true },
    });
    for (const cat of categoryRows) {
      viewedCategories.add(cat.slug);
    }
  }

  const city =
    options?.city ??
    visitor?.city ??
    customer?.addresses[0]?.city ??
    null;

  const context: VisitorSegmentContext = {
    visitorId,
    ad_id: mergedTouch?.ad_id ?? null,
    adset_id: mergedTouch?.adset_id ?? null,
    campaign_id: mergedTouch?.campaign_id ?? null,
    utm_campaign: mergedTouch?.utm_campaign ?? null,
    utm_source: mergedTouch?.utm_source ?? null,
    utm_medium: mergedTouch?.utm_medium ?? null,
    utm_content: mergedTouch?.utm_content ?? null,
    utm_term: mergedTouch?.utm_term ?? null,
    device_type: options?.deviceType ?? visitor?.deviceType ?? "desktop",
    city,
    viewed_categories: Array.from(viewedCategories),
    order_count: customer?.orderCount ?? 0,
    total_spent: customer?.totalSpent ?? 0,
    abandoned_cart: Boolean(activeCart && activeCart.items.length > 0),
    first_visit: !visitor || visitor.sessionCount <= 1,
    customer_group: customer?.group?.name ?? customer?.groupId ?? null,
    previewSegmentId,
  };

  const matchedSegments = matchVisitorSegments(allSegments, context, {
    previewSegmentId,
    adMappedSegmentIds: resolvedAd.segmentIds,
  });

  return {
    context,
    segments: matchedSegments,
    primarySegment: matchedSegments[0] ?? null,
    featuredProductIds: resolvedAd.featuredProductIds,
  };
}
