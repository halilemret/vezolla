import { applyBps } from "@/lib/money";
import { parsePromotionConditions, type PromotionTypeValue } from "@/modules/promotions/schemas";

export interface PromoLineInput {
  lineId: string;
  variantId: string;
  productId: string;
  categoryIds: string[];
  quantity: number;
  unitPriceMinor: number;
}

export interface PromoCandidate {
  id: string;
  name: string;
  code: string | null;
  type: PromotionTypeValue;
  value: number;
  conditions: unknown;
  buyQuantity?: number | null;
  getQuantity?: number | null;
  getDiscountBps?: number | null;
  maxDiscount?: number | null;
  usageLimit?: number | null;
  usagePerCustomer?: number | null;
  usageCount: number;
  customerUsageCount?: number;
  startsAt?: Date | null;
  endsAt?: Date | null;
  isActive: boolean;
  isCombinable: boolean;
  priority: number;
}

export interface PromoEvalContext {
  lines: PromoLineInput[];
  enteredCodes: string[];
  customerGroupId?: string | null;
  customerOrderCount?: number;
  customerId?: string | null;
  customerEmail?: string | null;
  now?: Date;
}

export interface AppliedPromotionSummary {
  promotionId: string;
  name: string;
  code: string | null;
  type: PromotionTypeValue;
  discountMinor: number;
  freeShipping: boolean;
  lineAllocations: Record<string, number>;
}

export interface RejectedPromoCode {
  code: string;
  reason: string;
}

export interface PromoEvalResult {
  subtotalMinor: number;
  discountTotalMinor: number;
  freeShipping: boolean;
  lineDiscounts: Record<string, number>;
  appliedPromotions: AppliedPromotionSummary[];
  rejectedCodes: RejectedPromoCode[];
}

/**
 * Verilen toplam indirimi (kuruş), satırların kalan tutarlarıyla orantılı olarak
 * kuruşu kuruşuna dağıtır. Yuvarlama farkları en yüksek kesirli satırlara +1 kuruş eklenir.
 */
export function distributeDiscountAcrossLines(
  lines: ReadonlyArray<{ lineId: string; amountMinor: number }>,
  totalDiscountMinor: number
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const line of lines) {
    result[line.lineId] = 0;
  }

  const positiveLines = lines.filter((l) => l.amountMinor > 0);
  if (positiveLines.length === 0 || totalDiscountMinor <= 0) {
    return result;
  }

  const totalEligibleMinor = positiveLines.reduce((acc, l) => acc + l.amountMinor, 0);
  const targetDiscount = Math.min(Math.round(totalDiscountMinor), totalEligibleMinor);
  if (targetDiscount <= 0) {
    return result;
  }

  const shares: Array<{
    lineId: string;
    maxAmount: number;
    floored: number;
    remainder: number;
  }> = [];

  let allocatedSum = 0;
  for (const line of positiveLines) {
    const exact = (line.amountMinor * targetDiscount) / totalEligibleMinor;
    const floored = Math.min(line.amountMinor, Math.floor(exact));
    const remainder = exact - floored;
    shares.push({
      lineId: line.lineId,
      maxAmount: line.amountMinor,
      floored,
      remainder,
    });
    allocatedSum += floored;
  }

  let leftover = targetDiscount - allocatedSum;
  shares.sort((a, b) => {
    if (b.remainder !== a.remainder) return b.remainder - a.remainder;
    return b.maxAmount - a.maxAmount;
  });

  for (const share of shares) {
    if (leftover <= 0) break;
    if (share.floored < share.maxAmount) {
      share.floored += 1;
      leftover -= 1;
    }
  }

  for (const share of shares) {
    result[share.lineId] = share.floored;
  }

  return result;
}

function validateCandidate(
  candidate: PromoCandidate,
  ctx: PromoEvalContext,
  subtotalMinor: number,
  now: Date
): { valid: true; eligibleLines: PromoLineInput[] } | { valid: false; reason: string } {
  if (!candidate.isActive) {
    return { valid: false, reason: "Bu kampanya aktif değil." };
  }
  if (candidate.startsAt && now.getTime() < candidate.startsAt.getTime()) {
    return { valid: false, reason: "Kampanya başlangıç tarihi henüz gelmedi." };
  }
  if (candidate.endsAt && now.getTime() > candidate.endsAt.getTime()) {
    return { valid: false, reason: "Kampanya süresi sona erdi." };
  }
  if (candidate.usageLimit != null && candidate.usageCount >= candidate.usageLimit) {
    return { valid: false, reason: "Kampanya toplam kullanım limitine ulaştı." };
  }
  if (
    candidate.usagePerCustomer != null &&
    (candidate.customerUsageCount ?? 0) >= candidate.usagePerCustomer
  ) {
    return { valid: false, reason: "Kişi başı kampanya kullanım limitinize ulaştınız." };
  }

  const conditions = parsePromotionConditions(candidate.conditions);

  if (conditions.minSubtotalMinor && subtotalMinor < conditions.minSubtotalMinor) {
    return {
      valid: false,
      reason: "Sepet ara toplamı kampanya alt limitinin altında.",
    };
  }

  if (conditions.firstOrderOnly && (ctx.customerOrderCount ?? 0) > 0) {
    return {
      valid: false,
      reason: "Bu kampanya yalnızca ilk siparişte geçerlidir.",
    };
  }

  if (
    conditions.customerGroupIds.length > 0 &&
    (!ctx.customerGroupId || !conditions.customerGroupIds.includes(ctx.customerGroupId))
  ) {
    return {
      valid: false,
      reason: "Bu kampanya müşteri grubunuz için geçerli değil.",
    };
  }

  if (conditions.customerEmails && conditions.customerEmails.length > 0) {
    const currentEmail = ctx.customerEmail?.trim().toLowerCase();
    const allowedEmails = conditions.customerEmails.map((e) => e.trim().toLowerCase());
    if (!currentEmail || !allowedEmails.includes(currentEmail)) {
      return {
        valid: false,
        reason: "Bu kupon kodu yalnızca belirlenen e-posta adresine özeldir.",
      };
    }
  }

  if (conditions.customerIds && conditions.customerIds.length > 0) {
    const currentId = ctx.customerId?.trim();
    if (!currentId || !conditions.customerIds.includes(currentId)) {
      return {
        valid: false,
        reason: "Bu kupon kodu yalnızca belirlenen kullanıcı hesabına özeldir.",
      };
    }
  }

  const eligibleLines = ctx.lines.filter((line) => {
    if (line.quantity <= 0 || line.unitPriceMinor < 0) return false;
    const matchProduct =
      conditions.productIds.length === 0 || conditions.productIds.includes(line.productId);
    const matchCategory =
      conditions.categoryIds.length === 0 ||
      line.categoryIds.some((cid) => conditions.categoryIds.includes(cid));
    const matchVariant =
      !conditions.variantIds ||
      conditions.variantIds.length === 0 ||
      conditions.variantIds.includes(line.variantId);
    return matchProduct && matchCategory && matchVariant;
  });

  if (eligibleLines.length === 0) {
    return {
      valid: false,
      reason: "Sepetinizde bu kampanyanın kapsadığı ürün bulunmuyor.",
    };
  }

  const isKombin = Boolean(candidate.code?.startsWith("KOMBIN10"));
  const effectiveMinItemCount = isKombin
    ? Math.max(2, conditions.minItemCount ?? 2)
    : conditions.minItemCount;

  if (effectiveMinItemCount && effectiveMinItemCount > 1) {
    const distinctEligibleVariants = new Set(eligibleLines.map((l) => l.variantId)).size;
    const eligibleCount = isKombin
      ? distinctEligibleVariants
      : eligibleLines.reduce((sum, l) => sum + l.quantity, 0);

    if (eligibleCount < effectiveMinItemCount) {
      return {
        valid: false,
        reason: isKombin
          ? "Kombin seti indirimi için sepette kombine ait en az 2 parça ürün bulunmalıdır."
          : `Bu kampanya için sepetinizde en az ${effectiveMinItemCount} adet ürün bulunmalıdır.`,
      };
    }
  }

  if (candidate.type === "BUY_X_GET_Y") {
    const buyQty = candidate.buyQuantity ?? 0;
    const getQty = candidate.getQuantity ?? 0;
    const totalEligibleUnits = eligibleLines.reduce((sum, l) => sum + l.quantity, 0);
    if (buyQty < 1 || getQty < 1 || totalEligibleUnits <= buyQty) {
      return {
        valid: false,
        reason: `Kampanya için ilgili ürünlerden sepette en az ${buyQty + 1} adet bulunmalıdır.`,
      };
    }
  }

  return { valid: true, eligibleLines };
}

function computeCandidateEffect(
  candidate: PromoCandidate,
  eligibleLines: PromoLineInput[],
  remainingByLine: Record<string, number>
): {
  discountMinor: number;
  freeShipping: boolean;
  lineAllocations: Record<string, number>;
} {
  const emptyAllocations: Record<string, number> = {};
  for (const line of eligibleLines) {
    emptyAllocations[line.lineId] = 0;
  }

  if (candidate.type === "FREE_SHIPPING") {
    return {
      discountMinor: 0,
      freeShipping: true,
      lineAllocations: emptyAllocations,
    };
  }

  const eligibleRemaining = eligibleLines.map((line) => ({
    lineId: line.lineId,
    amountMinor: Math.max(0, remainingByLine[line.lineId] ?? 0),
    quantity: line.quantity,
  }));

  const totalEligibleRemaining = eligibleRemaining.reduce((sum, l) => sum + l.amountMinor, 0);
  if (totalEligibleRemaining <= 0) {
    return {
      discountMinor: 0,
      freeShipping: false,
      lineAllocations: emptyAllocations,
    };
  }

  if (candidate.type === "PERCENTAGE") {
    const rawLineDiscounts: Record<string, number> = {};
    let rawSum = 0;
    for (const item of eligibleRemaining) {
      const lineDisc = Math.min(item.amountMinor, applyBps(item.amountMinor, candidate.value));
      rawLineDiscounts[item.lineId] = lineDisc;
      rawSum += lineDisc;
    }

    if (candidate.maxDiscount != null && candidate.maxDiscount > 0 && rawSum > candidate.maxDiscount) {
      const cappedAllocations = distributeDiscountAcrossLines(
        eligibleRemaining.map((item) => ({
          lineId: item.lineId,
          amountMinor: rawLineDiscounts[item.lineId] ?? 0,
        })),
        candidate.maxDiscount
      );
      const cappedSum = Object.values(cappedAllocations).reduce((a, b) => a + b, 0);
      return {
        discountMinor: cappedSum,
        freeShipping: false,
        lineAllocations: cappedAllocations,
      };
    }

    return {
      discountMinor: rawSum,
      freeShipping: false,
      lineAllocations: rawLineDiscounts,
    };
  }

  if (candidate.type === "FIXED_AMOUNT") {
    let targetDiscount = Math.min(candidate.value, totalEligibleRemaining);
    if (candidate.maxDiscount != null && candidate.maxDiscount > 0) {
      targetDiscount = Math.min(targetDiscount, candidate.maxDiscount);
    }
    const allocations = distributeDiscountAcrossLines(eligibleRemaining, targetDiscount);
    const sum = Object.values(allocations).reduce((a, b) => a + b, 0);
    return {
      discountMinor: sum,
      freeShipping: false,
      lineAllocations: allocations,
    };
  }

  // BUY_X_GET_Y
  const buyQty = Math.max(1, candidate.buyQuantity ?? 2);
  const getQty = Math.max(1, candidate.getQuantity ?? 1);
  const discountBps = candidate.getDiscountBps ?? 10000;

  // Her uygun satırı birimlere aç (kalan tutar / miktar üzerinden efektif birim fiyat)
  const units: Array<{ lineId: string; unitEffectiveMinor: number }> = [];
  for (const item of eligibleRemaining) {
    if (item.quantity <= 0 || item.amountMinor <= 0) continue;
    const baseUnit = Math.floor(item.amountMinor / item.quantity);
    const extraUnits = item.amountMinor - baseUnit * item.quantity;
    for (let i = 0; i < item.quantity; i += 1) {
      units.push({
        lineId: item.lineId,
        unitEffectiveMinor: i < extraUnits ? baseUnit + 1 : baseUnit,
      });
    }
  }

  const totalUnits = units.length;
  const cycleSize = buyQty + getQty;
  const fullCycles = Math.floor(totalUnits / cycleSize);
  const remainder = totalUnits % cycleSize;
  const extraDiscounted = Math.max(0, remainder - buyQty);
  const discountedUnitsCount = fullCycles * getQty + extraDiscounted;

  if (discountedUnitsCount <= 0) {
    return {
      discountMinor: 0,
      freeShipping: false,
      lineAllocations: emptyAllocations,
    };
  }

  // En düşük fiyatlı birimlere indirim uygula
  units.sort((a, b) => a.unitEffectiveMinor - b.unitEffectiveMinor);

  const rawByLine: Record<string, number> = { ...emptyAllocations };
  let rawSum = 0;
  for (let i = 0; i < discountedUnitsCount && i < units.length; i += 1) {
    const unit = units[i];
    if (!unit) continue;
    const disc = applyBps(unit.unitEffectiveMinor, discountBps);
    rawByLine[unit.lineId] = (rawByLine[unit.lineId] ?? 0) + disc;
    rawSum += disc;
  }

  // Satır kalan tutarını aşmadığından emin ol
  let clampedSum = 0;
  for (const item of eligibleRemaining) {
    const current = rawByLine[item.lineId] ?? 0;
    const clamped = Math.min(item.amountMinor, current);
    rawByLine[item.lineId] = clamped;
    clampedSum += clamped;
  }

  if (
    candidate.maxDiscount != null &&
    candidate.maxDiscount > 0 &&
    clampedSum > candidate.maxDiscount
  ) {
    const cappedAllocations = distributeDiscountAcrossLines(
      eligibleRemaining.map((item) => ({
        lineId: item.lineId,
        amountMinor: rawByLine[item.lineId] ?? 0,
      })),
      candidate.maxDiscount
    );
    const cappedSum = Object.values(cappedAllocations).reduce((a, b) => a + b, 0);
    return {
      discountMinor: cappedSum,
      freeShipping: false,
      lineAllocations: cappedAllocations,
    };
  }

  return {
    discountMinor: clampedSum,
    freeShipping: false,
    lineAllocations: rawByLine,
  };
}

/**
 * Sepet satırları, girilen kupon kodları ve aday promosyonlar üzerinden
 * uygulanacak promosyonları ve satır bazlı indirim dağılımını hesaplar.
 */
export function evaluatePromotions(
  candidates: ReadonlyArray<PromoCandidate>,
  ctx: PromoEvalContext
): PromoEvalResult {
  const now = ctx.now ?? new Date();
  const initialLineAmounts: Record<string, number> = {};
  const zeroLineDiscounts: Record<string, number> = {};
  let subtotalMinor = 0;

  for (const line of ctx.lines) {
    const lineTotal = Math.max(0, line.quantity * line.unitPriceMinor);
    initialLineAmounts[line.lineId] = lineTotal;
    zeroLineDiscounts[line.lineId] = 0;
    subtotalMinor += lineTotal;
  }

  const normalizedCodes = Array.from(
    new Set(
      ctx.enteredCodes
        .map((c) => c.trim().toUpperCase())
        .filter((c) => c.length > 0)
    )
  );

  const rejectedCodes: RejectedPromoCode[] = [];
  const validEntries: Array<{
    candidate: PromoCandidate;
    eligibleLines: PromoLineInput[];
  }> = [];

  for (const code of normalizedCodes) {
    const baseCode = code.split(":")[0];
    const matched = candidates.find((c) => {
      const candCode = c.code?.trim().toUpperCase();
      return candCode === code || (candCode === baseCode && baseCode === "KOMBIN10");
    });
    if (!matched) {
      rejectedCodes.push({ code, reason: "Geçersiz kupon kodu." });
      continue;
    }
    const validation = validateCandidate(matched, ctx, subtotalMinor, now);
    if (!validation.valid) {
      rejectedCodes.push({ code, reason: validation.reason });
      continue;
    }
    validEntries.push({ candidate: matched, eligibleLines: validation.eligibleLines });
  }

  // Otomatik kampanyalar (code === null)
  for (const candidate of candidates) {
    if (candidate.code !== null && candidate.code.trim() !== "") continue;
    const validation = validateCandidate(candidate, ctx, subtotalMinor, now);
    if (validation.valid) {
      validEntries.push({ candidate, eligibleLines: validation.eligibleLines });
    }
  }

  if (validEntries.length === 0) {
    return {
      subtotalMinor,
      discountTotalMinor: 0,
      freeShipping: false,
      lineDiscounts: zeroLineDiscounts,
      appliedPromotions: [],
      rejectedCodes,
    };
  }

  // Önceliğe göre sırala (yüksek priority önce, eşitse kuponlu olanlar önce)
  validEntries.sort((a, b) => {
    if (b.candidate.priority !== a.candidate.priority) {
      return b.candidate.priority - a.candidate.priority;
    }
    const aHasCode = a.candidate.code ? 1 : 0;
    const bHasCode = b.candidate.code ? 1 : 0;
    return bHasCode - aHasCode;
  });

  // 1) Birleştirilemeyen (isCombinable = false) adayların her birini tek başına değerlendir
  const nonCombinableEntries = validEntries.filter((e) => !e.candidate.isCombinable);
  let bestNonCombinable: {
    priority: number;
    discountTotalMinor: number;
    freeShipping: boolean;
    lineDiscounts: Record<string, number>;
    appliedPromotions: AppliedPromotionSummary[];
  } | null = null;

  for (const entry of nonCombinableEntries) {
    const effect = computeCandidateEffect(
      entry.candidate,
      entry.eligibleLines,
      initialLineAmounts
    );
    if (effect.discountMinor <= 0 && !effect.freeShipping) continue;

    const lineDiscounts: Record<string, number> = { ...zeroLineDiscounts };
    for (const [lineId, amount] of Object.entries(effect.lineAllocations)) {
      lineDiscounts[lineId] = amount;
    }

    const summary: AppliedPromotionSummary = {
      promotionId: entry.candidate.id,
      name: entry.candidate.name,
      code: entry.candidate.code,
      type: entry.candidate.type,
      discountMinor: effect.discountMinor,
      freeShipping: effect.freeShipping,
      lineAllocations: effect.lineAllocations,
    };

    if (!bestNonCombinable) {
      bestNonCombinable = {
        priority: entry.candidate.priority,
        discountTotalMinor: effect.discountMinor,
        freeShipping: effect.freeShipping,
        lineDiscounts,
        appliedPromotions: [summary],
      };
    } else if (
      entry.candidate.priority > bestNonCombinable.priority ||
      (entry.candidate.priority === bestNonCombinable.priority &&
        effect.discountMinor > bestNonCombinable.discountTotalMinor)
    ) {
      bestNonCombinable = {
        priority: entry.candidate.priority,
        discountTotalMinor: effect.discountMinor,
        freeShipping: effect.freeShipping,
        lineDiscounts,
        appliedPromotions: [summary],
      };
    }
  }

  // 2) Birleştirilebilir (isCombinable = true) adayları sırayla uygula
  const combinableEntries = validEntries.filter((e) => e.candidate.isCombinable);
  let combinableResult: {
    topPriority: number;
    discountTotalMinor: number;
    freeShipping: boolean;
    lineDiscounts: Record<string, number>;
    appliedPromotions: AppliedPromotionSummary[];
  } | null = null;

  if (combinableEntries.length > 0) {
    const remaining: Record<string, number> = { ...initialLineAmounts };
    const combinedLineDiscounts: Record<string, number> = { ...zeroLineDiscounts };
    const applied: AppliedPromotionSummary[] = [];
    let totalDisc = 0;
    let freeShip = false;
    let topPriority = -Infinity;

    for (const entry of combinableEntries) {
      const effect = computeCandidateEffect(entry.candidate, entry.eligibleLines, remaining);
      if (effect.discountMinor <= 0 && !effect.freeShipping) continue;

      topPriority = Math.max(topPriority, entry.candidate.priority);
      totalDisc += effect.discountMinor;
      if (effect.freeShipping) freeShip = true;

      for (const [lineId, amount] of Object.entries(effect.lineAllocations)) {
        combinedLineDiscounts[lineId] = (combinedLineDiscounts[lineId] ?? 0) + amount;
        remaining[lineId] = Math.max(0, (remaining[lineId] ?? 0) - amount);
      }

      applied.push({
        promotionId: entry.candidate.id,
        name: entry.candidate.name,
        code: entry.candidate.code,
        type: entry.candidate.type,
        discountMinor: effect.discountMinor,
        freeShipping: effect.freeShipping,
        lineAllocations: effect.lineAllocations,
      });
    }

    if (applied.length > 0) {
      combinableResult = {
        topPriority,
        discountTotalMinor: totalDisc,
        freeShipping: freeShip,
        lineDiscounts: combinedLineDiscounts,
        appliedPromotions: applied,
      };
    }
  }

  if (bestNonCombinable && combinableResult) {
    const pickNonCombinable =
      bestNonCombinable.priority > combinableResult.topPriority ||
      (bestNonCombinable.priority === combinableResult.topPriority &&
        bestNonCombinable.discountTotalMinor >= combinableResult.discountTotalMinor);

    if (pickNonCombinable) {
      return {
        subtotalMinor,
        discountTotalMinor: bestNonCombinable.discountTotalMinor,
        freeShipping: bestNonCombinable.freeShipping,
        lineDiscounts: bestNonCombinable.lineDiscounts,
        appliedPromotions: bestNonCombinable.appliedPromotions,
        rejectedCodes,
      };
    }
    return {
      subtotalMinor,
      discountTotalMinor: combinableResult.discountTotalMinor,
      freeShipping: combinableResult.freeShipping,
      lineDiscounts: combinableResult.lineDiscounts,
      appliedPromotions: combinableResult.appliedPromotions,
      rejectedCodes,
    };
  }

  if (bestNonCombinable) {
    return {
      subtotalMinor,
      discountTotalMinor: bestNonCombinable.discountTotalMinor,
      freeShipping: bestNonCombinable.freeShipping,
      lineDiscounts: bestNonCombinable.lineDiscounts,
      appliedPromotions: bestNonCombinable.appliedPromotions,
      rejectedCodes,
    };
  }

  if (combinableResult) {
    return {
      subtotalMinor,
      discountTotalMinor: combinableResult.discountTotalMinor,
      freeShipping: combinableResult.freeShipping,
      lineDiscounts: combinableResult.lineDiscounts,
      appliedPromotions: combinableResult.appliedPromotions,
      rejectedCodes,
    };
  }

  return {
    subtotalMinor,
    discountTotalMinor: 0,
    freeShipping: false,
    lineDiscounts: zeroLineDiscounts,
    appliedPromotions: [],
    rejectedCodes,
  };
}
