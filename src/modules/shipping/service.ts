import { z } from "zod";
import { db } from "@/lib/db";

export const weightRuleSchema = z.object({
  maxGrams: z.number().int().min(1),
  price: z.number().int().min(0),
});

export type WeightRule = z.infer<typeof weightRuleSchema>;

export function parseWeightRules(raw: unknown): WeightRule[] {
  if (!Array.isArray(raw)) return [];
  const rules: WeightRule[] = [];
  for (const item of raw) {
    const parsed = weightRuleSchema.safeParse(item);
    if (parsed.success) {
      rules.push(parsed.data);
    }
  }
  rules.sort((a, b) => a.maxGrams - b.maxGrams);
  return rules;
}

export interface ShippingMethodRecord {
  id: string;
  name: string;
  description: string | null;
  carrier: string | null;
  price: number;
  freeOverAmount: number | null;
  cities: string[];
  weightRules: unknown;
  estimatedDays: string | null;
  isActive: boolean;
  position: number;
}

export interface ShippingQuoteContext {
  city?: string | null;
  subtotalAfterDiscountMinor: number;
  totalWeightGrams: number;
  promoFreeShipping?: boolean;
}

export interface ShippingMethodQuote {
  id: string;
  name: string;
  description: string | null;
  carrier: string | null;
  estimatedDays: string | null;
  basePriceMinor: number;
  effectivePriceMinor: number;
  isFree: boolean;
  freeOverAmountMinor: number | null;
}

/**
 * Tek bir kargo yönteminin verilen il, sepet tutarı ve toplam ağırlığa göre
 * uygunluğunu ve ücretini hesaplar. İl filtresine uymuyorsa null döner.
 */
export function evaluateShippingMethod(
  method: ShippingMethodRecord,
  ctx: ShippingQuoteContext
): ShippingMethodQuote | null {
  if (!method.isActive) return null;

  if (method.cities.length > 0 && ctx.city && ctx.city.trim() !== "") {
    const normalizedCity = ctx.city.trim().toLocaleLowerCase("tr-TR");
    const allowed = method.cities.some(
      (c) => c.trim().toLocaleLowerCase("tr-TR") === normalizedCity
    );
    if (!allowed) return null;
  }

  let basePriceMinor = method.price;
  const weightRules = parseWeightRules(method.weightRules);
  if (weightRules.length > 0 && ctx.totalWeightGrams > 0) {
    const matchedTier = weightRules.find((r) => ctx.totalWeightGrams <= r.maxGrams);
    if (matchedTier) {
      basePriceMinor = matchedTier.price;
    } else {
      const heaviestTier = weightRules[weightRules.length - 1];
      if (heaviestTier) {
        basePriceMinor = heaviestTier.price;
      }
    }
  }

  const freeByThreshold =
    method.freeOverAmount != null &&
    method.freeOverAmount > 0 &&
    ctx.subtotalAfterDiscountMinor >= method.freeOverAmount;

  const isFree = Boolean(ctx.promoFreeShipping) || freeByThreshold || basePriceMinor === 0;
  const effectivePriceMinor = isFree ? 0 : Math.max(0, basePriceMinor);

  return {
    id: method.id,
    name: method.name,
    description: method.description,
    carrier: method.carrier,
    estimatedDays: method.estimatedDays,
    basePriceMinor,
    effectivePriceMinor,
    isFree,
    freeOverAmountMinor: method.freeOverAmount,
  };
}

export async function getAvailableShippingMethods(
  ctx: ShippingQuoteContext
): Promise<ShippingMethodQuote[]> {
  const methods = await db.shippingMethod.findMany({
    where: { isActive: true },
    orderBy: [{ position: "asc" }, { price: "asc" }],
  });

  if (methods.length === 0) {
    const fallbackFree =
      Boolean(ctx.promoFreeShipping) || ctx.subtotalAfterDiscountMinor >= 150000;
    return [
      {
        id: "default-standard",
        name: "Standart Kargo",
        description: "1-3 iş günü içinde teslimat",
        carrier: "yurtici",
        estimatedDays: "1-3 iş günü",
        basePriceMinor: 7990,
        effectivePriceMinor: fallbackFree ? 0 : 7990,
        isFree: fallbackFree,
        freeOverAmountMinor: 150000,
      },
    ];
  }

  const quotes: ShippingMethodQuote[] = [];
  for (const m of methods) {
    const q = evaluateShippingMethod(m, ctx);
    if (q) quotes.push(q);
  }
  return quotes;
}

export async function listShippingMethodsAdmin() {
  return db.shippingMethod.findMany({
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
}
