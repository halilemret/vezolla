import { addVat, applyBps, parseMoneyInput, roundPriceMinor } from "@/lib/money";
import {
  DEFAULT_FEED_TRANSFORM,
  feedTransformSchema,
  type FeedTransform,
} from "@/modules/xml/schemas";

function resolveTransformRules(input?: Partial<FeedTransform> | null): FeedTransform {
  if (!input) return DEFAULT_FEED_TRANSFORM;
  const parsed = feedTransformSchema.safeParse({
    ...DEFAULT_FEED_TRANSFORM,
    ...input,
  });
  return parsed.success ? parsed.data : DEFAULT_FEED_TRANSFORM;
}

/**
 * Ham kuruş fiyatına döviz çarpanı, KDV dönüşümü, kâr marjı ve psikolojik yuvarlama uygular.
 */
export function transformPriceMinor(
  basePriceMinor: number,
  transform?: Partial<FeedTransform> | null,
  overrideVatRateBps?: number | null
): number {
  if (!Number.isFinite(basePriceMinor) || basePriceMinor <= 0) {
    return 0;
  }

  const rules = resolveTransformRules(transform);

  // 1. Döviz kuru çarpanı
  let current = Math.round(basePriceMinor * rules.currencyMultiplier);
  if (current <= 0) return 0;

  // 2. KDV hariç ise KDV ekle
  if (!rules.sourceIncludesVat) {
    const vatBps =
      typeof overrideVatRateBps === "number" && overrideVatRateBps >= 0
        ? overrideVatRateBps
        : rules.vatRateBps;
    current = addVat(current, vatBps);
  }

  // 3. Kâr marjı (Yüzde, Sabit veya Kademeli)
  if (rules.marginMode === "PERCENT") {
    current = current + applyBps(current, rules.marginPercentBps);
  } else if (rules.marginMode === "FIXED") {
    current = current + rules.marginFixedMinor;
  } else if (rules.marginMode === "TIERED") {
    const sortedTiers = [...rules.tiers].sort(
      (a, b) => a.upToMinor - b.upToMinor
    );
    const matchedTier = sortedTiers.find((tier) => current <= tier.upToMinor);
    if (matchedTier) {
      current =
        current +
        applyBps(current, matchedTier.percentBps) +
        matchedTier.fixedMinor;
    } else if (
      rules.marginPercentBps !== 0 ||
      rules.marginFixedMinor !== 0
    ) {
      current =
        current +
        applyBps(current, rules.marginPercentBps) +
        rules.marginFixedMinor;
    } else {
      const lastTier = sortedTiers[sortedTiers.length - 1];
      if (lastTier) {
        current =
          current +
          applyBps(current, lastTier.percentBps) +
          lastTier.fixedMinor;
      }
    }
  }

  if (current <= 0) return 0;

  // 4. Psikolojik yuvarlama
  return roundPriceMinor(current, rules.rounding);
}

/**
 * XML'den gelen metin veya sayı fiyatını kuruşa çevirip dönüşüm kurallarını uygular.
 */
export function parseAndTransformPrice(
  rawPrice: string | number,
  transform?: Partial<FeedTransform> | null,
  rawVatPercent?: string | number | null
): number {
  const baseMinor = parseMoneyInput(rawPrice);
  if (baseMinor <= 0) return 0;

  let overrideVatBps: number | null = null;
  if (rawVatPercent !== undefined && rawVatPercent !== null && rawVatPercent !== "") {
    const parsedVat = Number(String(rawVatPercent).replace(",", ".").trim());
    if (Number.isFinite(parsedVat) && parsedVat >= 0 && parsedVat <= 100) {
      overrideVatBps = Math.round(parsedVat * 100);
    }
  }

  return transformPriceMinor(baseMinor, transform, overrideVatBps);
}

/**
 * Stok miktarını çözümler ve minimum stok eşiği altındakileri 0 kabul eder.
 */
export function transformStockQuantity(
  rawStock: string | number | null | undefined,
  transform?: Partial<FeedTransform> | null
): number {
  if (rawStock === null || rawStock === undefined || rawStock === "") {
    return 0;
  }

  const numeric =
    typeof rawStock === "number"
      ? rawStock
      : Number(String(rawStock).replace(",", ".").trim());

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 0;
  }

  const quantity = Math.floor(numeric);
  const rules = resolveTransformRules(transform);

  if (rules.minStockThreshold > 0 && quantity < rules.minStockThreshold) {
    return 0;
  }

  return quantity;
}

/**
 * Bul-değiştir kurallarını uygular; başlık ise önek ve sonek ekler.
 */
export function transformText(
  rawText: string,
  transform?: Partial<FeedTransform> | null,
  options?: { isTitle?: boolean }
): string {
  const rules = resolveTransformRules(transform);
  let output = rawText.trim();
  if (!output) return "";

  for (const rule of rules.replacements) {
    if (rule.find.length > 0) {
      output = output.split(rule.find).join(rule.replace);
    }
  }

  output = output.replace(/\s{2,}/g, " ").trim();

  const isTitle = options?.isTitle ?? true;
  if (isTitle) {
    const prefix = rules.titlePrefix.trim();
    const suffix = rules.titleSuffix.trim();

    if (prefix && !output.toLowerCase().startsWith(prefix.toLowerCase())) {
      output = `${prefix} ${output}`.trim();
    }
    if (suffix && !output.toLowerCase().endsWith(suffix.toLowerCase())) {
      output = `${output} ${suffix}`.trim();
    }
  }

  return output;
}

export function transformProductTitle(
  rawTitle: string,
  transform?: Partial<FeedTransform> | null
): string {
  return transformText(rawTitle, transform, { isTitle: true });
}

export function transformDescriptionText(
  rawDescription: string,
  transform?: Partial<FeedTransform> | null
): string {
  const rules = resolveTransformRules(transform);
  let output = rawDescription.trim();
  if (!output) return "";

  for (const rule of rules.replacements) {
    if (rule.find.length > 0) {
      output = output.split(rule.find).join(rule.replace);
    }
  }

  return output;
}
