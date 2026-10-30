import { db } from "@/lib/db";
import {
  attributionTouchSchema,
  type AdPlatform,
  type AttributionMatchField,
  type AttributionTouch,
} from "@/modules/personalization/schemas";

export interface AdMappingRecord {
  id: string;
  name: string;
  platform: string;
  matchField: string;
  matchValue: string;
  segmentId: string | null;
  featuredProductIds: string[];
  isActive: boolean;
}

export interface ResolvedAdAttribution {
  touch: AttributionTouch | null;
  platform: AdPlatform | null;
  primaryMapping: AdMappingRecord | null;
  matchedMappings: AdMappingRecord[];
  segmentId: string | null;
  segmentIds: string[];
  featuredProductIds: string[];
}

const MATCH_FIELD_PRIORITY: Record<AttributionMatchField, number> = {
  ad_id: 100,
  adset_id: 90,
  campaign_id: 80,
  utm_content: 60,
  utm_campaign: 50,
  utm_term: 40,
  utm_source: 30,
};

function normalizeParam(value: string | string[] | null | undefined): string | undefined {
  if (Array.isArray(value)) {
    const first = value[0]?.trim();
    return first ? first : undefined;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
  return undefined;
}

function toSearchParams(
  input:
    | string
    | URL
    | URLSearchParams
    | Record<string, string | string[] | undefined>
    | null
    | undefined
): { params: URLSearchParams; landingPath?: string } {
  if (!input) {
    return { params: new URLSearchParams() };
  }
  if (input instanceof URLSearchParams) {
    return { params: input };
  }
  if (input instanceof URL) {
    return { params: input.searchParams, landingPath: input.pathname };
  }
  if (typeof input === "string") {
    const raw = input.trim();
    if (!raw) {
      return { params: new URLSearchParams() };
    }
    try {
      const parsed = raw.startsWith("http://") || raw.startsWith("https://")
        ? new URL(raw)
        : new URL(raw.startsWith("/") ? raw : `/${raw}`, "http://localhost");
      return {
        params: parsed.searchParams,
        landingPath: parsed.pathname !== "/" || raw.startsWith("/") ? parsed.pathname : undefined,
      };
    } catch {
      const qIndex = raw.indexOf("?");
      const queryPart = qIndex >= 0 ? raw.slice(qIndex + 1) : raw;
      return { params: new URLSearchParams(queryPart) };
    }
  }

  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(input)) {
    const norm = normalizeParam(v);
    if (norm) {
      params.set(k, norm);
    }
  }
  return { params };
}

/**
 * URL, query string veya parametre nesnesinden reklam ve kaynak kimliklerini ayıklar.
 */
export function extractAttributionFromUrl(
  urlOrParams:
    | string
    | URL
    | URLSearchParams
    | Record<string, string | string[] | undefined>
    | null
    | undefined,
  referrer?: string | null,
  now: Date = new Date()
): AttributionTouch | null {
  const { params, landingPath } = toSearchParams(urlOrParams);

  const ad_id =
    normalizeParam(params.get("ad_id")) ??
    normalizeParam(params.get("adId")) ??
    normalizeParam(params.get("hsa_ad"));
  const adset_id =
    normalizeParam(params.get("adset_id")) ??
    normalizeParam(params.get("adsetId")) ??
    normalizeParam(params.get("hsa_grp"));
  const campaign_id =
    normalizeParam(params.get("campaign_id")) ??
    normalizeParam(params.get("campaignId")) ??
    normalizeParam(params.get("hsa_cam"));
  const utm_source =
    normalizeParam(params.get("utm_source")) ?? normalizeParam(params.get("utmSource"));
  const utm_medium =
    normalizeParam(params.get("utm_medium")) ?? normalizeParam(params.get("utmMedium"));
  const utm_campaign =
    normalizeParam(params.get("utm_campaign")) ?? normalizeParam(params.get("utmCampaign"));
  const utm_content =
    normalizeParam(params.get("utm_content")) ?? normalizeParam(params.get("utmContent"));
  const utm_term =
    normalizeParam(params.get("utm_term")) ?? normalizeParam(params.get("utmTerm"));
  const gclid = normalizeParam(params.get("gclid"));
  const fbclid = normalizeParam(params.get("fbclid"));
  const ttclid = normalizeParam(params.get("ttclid"));
  const cleanReferrer = normalizeParam(referrer ?? params.get("referrer") ?? params.get("ref"));

  const hasSignal = Boolean(
    ad_id ||
      adset_id ||
      campaign_id ||
      utm_source ||
      utm_medium ||
      utm_campaign ||
      utm_content ||
      utm_term ||
      gclid ||
      fbclid ||
      ttclid ||
      cleanReferrer
  );

  if (!hasSignal) {
    return null;
  }

  const touch: AttributionTouch = {
    ...(ad_id ? { ad_id } : {}),
    ...(adset_id ? { adset_id } : {}),
    ...(campaign_id ? { campaign_id } : {}),
    ...(utm_source ? { utm_source } : {}),
    ...(utm_medium ? { utm_medium } : {}),
    ...(utm_campaign ? { utm_campaign } : {}),
    ...(utm_content ? { utm_content } : {}),
    ...(utm_term ? { utm_term } : {}),
    ...(gclid ? { gclid } : {}),
    ...(fbclid ? { fbclid } : {}),
    ...(ttclid ? { ttclid } : {}),
    ...(cleanReferrer ? { referrer: cleanReferrer } : {}),
    ...(landingPath ? { landingPath } : {}),
    capturedAt: now.toISOString(),
  };

  return touch;
}

export const parseAttributionParams = extractAttributionFromUrl;

export function detectAdPlatform(touch: AttributionTouch | null | undefined): AdPlatform | null {
  if (!touch) return null;
  const src = (touch.utm_source ?? "").toLowerCase();
  const ref = (touch.referrer ?? "").toLowerCase();

  if (
    touch.fbclid ||
    src.includes("meta") ||
    src.includes("facebook") ||
    src.includes("instagram") ||
    src === "fb" ||
    src === "ig" ||
    ref.includes("facebook.com") ||
    ref.includes("instagram.com")
  ) {
    return "META";
  }

  if (
    touch.gclid ||
    src.includes("google") ||
    src.includes("adwords") ||
    src.includes("gads") ||
    ref.includes("google.")
  ) {
    return "GOOGLE";
  }

  if (touch.ttclid || src.includes("tiktok") || src === "tt" || ref.includes("tiktok.com")) {
    return "TIKTOK";
  }

  if (
    touch.ad_id ||
    touch.adset_id ||
    touch.campaign_id ||
    touch.utm_campaign ||
    touch.utm_source ||
    touch.utm_medium ||
    touch.referrer
  ) {
    return "OTHER";
  }

  return null;
}

export function parseAttributionJson(raw: unknown): AttributionTouch | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const parsed = attributionTouchSchema.safeParse(raw);
  if (!parsed.success) {
    return null;
  }
  return parsed.data;
}

export function mergeAttributionTouches(
  ...touches: Array<AttributionTouch | null | undefined>
): AttributionTouch | null {
  const valid = touches.filter((t): t is AttributionTouch => Boolean(t));
  if (valid.length === 0) return null;

  const merged: AttributionTouch = {};
  for (const t of valid) {
    if (t.ad_id) merged.ad_id = t.ad_id;
    if (t.adset_id) merged.adset_id = t.adset_id;
    if (t.campaign_id) merged.campaign_id = t.campaign_id;
    if (t.utm_source) merged.utm_source = t.utm_source;
    if (t.utm_medium) merged.utm_medium = t.utm_medium;
    if (t.utm_campaign) merged.utm_campaign = t.utm_campaign;
    if (t.utm_content) merged.utm_content = t.utm_content;
    if (t.utm_term) merged.utm_term = t.utm_term;
    if (t.gclid) merged.gclid = t.gclid;
    if (t.fbclid) merged.fbclid = t.fbclid;
    if (t.ttclid) merged.ttclid = t.ttclid;
    if (t.referrer) merged.referrer = t.referrer;
    if (t.landingPath) merged.landingPath = t.landingPath;
    if (t.capturedAt) merged.capturedAt = t.capturedAt;
  }
  return merged;
}

/**
 * Verilen reklam/kaynak bilgisini AdMapping kayıtlarıyla eşleştirir.
 * Daha spesifik alanlar (ad_id > adset_id > campaign_id > utm_content > utm_campaign > utm_term > utm_source)
 * öncelikli olarak sıralanır.
 */
export function matchAdMappings(
  touch: AttributionTouch | null | undefined,
  mappings: readonly AdMappingRecord[]
): ResolvedAdAttribution {
  if (!touch) {
    return {
      touch: null,
      platform: null,
      primaryMapping: null,
      matchedMappings: [],
      segmentId: null,
      segmentIds: [],
      featuredProductIds: [],
    };
  }

  const activeMappings = mappings.filter((m) => m.isActive);
  const matched: Array<{ mapping: AdMappingRecord; specificity: number }> = [];

  for (const mapping of activeMappings) {
    const field = mapping.matchField as AttributionMatchField;
    const touchValue = touch[field];
    if (!touchValue) continue;

    if (touchValue.trim().toLowerCase() === mapping.matchValue.trim().toLowerCase()) {
      const specificity = MATCH_FIELD_PRIORITY[field] ?? 10;
      matched.push({ mapping, specificity });
    }
  }

  matched.sort((a, b) => b.specificity - a.specificity);

  const matchedMappings = matched.map((item) => item.mapping);
  const primaryMapping = matchedMappings[0] ?? null;

  const segmentIds: string[] = [];
  const featuredProductIds: string[] = [];

  for (const m of matchedMappings) {
    if (m.segmentId && !segmentIds.includes(m.segmentId)) {
      segmentIds.push(m.segmentId);
    }
    for (const pid of m.featuredProductIds) {
      if (pid && !featuredProductIds.includes(pid)) {
        featuredProductIds.push(pid);
      }
    }
  }

  const primaryPlatform = primaryMapping?.platform as AdPlatform | undefined;
  const platform =
    primaryPlatform && ["META", "GOOGLE", "TIKTOK", "OTHER"].includes(primaryPlatform)
      ? primaryPlatform
      : detectAdPlatform(touch);

  return {
    touch,
    platform,
    primaryMapping,
    matchedMappings,
    segmentId: segmentIds[0] ?? null,
    segmentIds,
    featuredProductIds,
  };
}

/**
 * Veritabanındaki aktif AdMapping kayıtlarıyla ziyaretçinin reklam/kampanya kaynağını çözer.
 */
export async function resolveVisitorAttribution(options: {
  visitorId?: string | null;
  touch?: AttributionTouch | null;
  firstTouch?: AttributionTouch | null;
  lastTouch?: AttributionTouch | null;
}): Promise<ResolvedAdAttribution> {
  let firstTouch = options.firstTouch ?? null;
  let lastTouch = options.lastTouch ?? null;

  if (options.visitorId && !firstTouch && !lastTouch) {
    const visitor = await db.visitor.findUnique({
      where: { id: options.visitorId },
      select: { firstTouch: true, lastTouch: true },
    });
    if (visitor) {
      firstTouch = parseAttributionJson(visitor.firstTouch);
      lastTouch = parseAttributionJson(visitor.lastTouch);
    }
  }

  const combinedTouch = mergeAttributionTouches(firstTouch, lastTouch, options.touch);
  if (!combinedTouch) {
    return {
      touch: null,
      platform: null,
      primaryMapping: null,
      matchedMappings: [],
      segmentId: null,
      segmentIds: [],
      featuredProductIds: [],
    };
  }

  const mappings = await db.adMapping.findMany({
    where: { isActive: true },
    orderBy: { updatedAt: "desc" },
  });

  return matchAdMappings(combinedTouch, mappings);
}
