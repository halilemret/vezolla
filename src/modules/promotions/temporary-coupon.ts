import "server-only";
import crypto from "crypto";
import { db } from "@/lib/db";
import { percentToBps, bpsToPercent } from "@/modules/analytics/recovery-offer";
import type { Prisma } from "@/generated/prisma/client";

// Okunabilirlik için kafa karıştıran karakterler (0, O, 1, I) hariç tutulmuştur.
const COUPON_CHARSET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

/**
 * Belirtilen ön ek ile rastgele harf ve rakamlardan oluşan kupon kodu üretir.
 * Örnek çıktı: VZ-8M3K-9R2X
 */
export function generateTemporaryCouponCode(prefix = "VZ"): string {
  const cleanPrefix = prefix.trim().toUpperCase().replace(/[^A-Z0-9]/g, "") || "VZ";
  const bytes = crypto.randomBytes(8);
  let segmentA = "";
  let segmentB = "";

  for (let i = 0; i < 4; i++) {
    const byteA = bytes[i] ?? 0;
    const byteB = bytes[i + 4] ?? 0;
    const idxA = byteA % COUPON_CHARSET.length;
    const idxB = byteB % COUPON_CHARSET.length;
    segmentA += COUPON_CHARSET[idxA] ?? "X";
    segmentB += COUPON_CHARSET[idxB] ?? "Y";
  }

  return `${cleanPrefix}-${segmentA}-${segmentB}`;
}

export interface CreateTemporaryUserCouponParams {
  email?: string | null;
  customerId?: string | null;
  discountPercent?: number;
  fixedDiscountMinor?: number;
  expiresInHours?: number;
  name?: string;
  description?: string;
  prefix?: string;
}

export interface TemporaryUserCouponResult {
  id: string;
  code: string;
  type: "PERCENTAGE" | "FIXED_AMOUNT";
  value: number;
  percent: number | null;
  startsAt: Date;
  endsAt: Date;
}

/**
 * Kullanıcıya / e-postaya özel, rastgele harf ve rakamlardan oluşan,
 * süre kısıtlı ve tek kullanımlık geçici promosyon kuponu tanımlar.
 */
export async function createTemporaryUserCoupon(
  params: CreateTemporaryUserCouponParams
): Promise<TemporaryUserCouponResult> {
  const expiresInHours = params.expiresInHours ?? 48;
  const now = new Date();
  const endsAt = new Date(now.getTime() + expiresInHours * 60 * 60 * 1000);

  const cleanEmail = params.email?.trim().toLowerCase() || null;
  const cleanCustomerId = params.customerId?.trim() || null;

  const isFixed = typeof params.fixedDiscountMinor === "number" && params.fixedDiscountMinor > 0;
  const type: "PERCENTAGE" | "FIXED_AMOUNT" = isFixed ? "FIXED_AMOUNT" : "PERCENTAGE";

  const discountPercent = params.discountPercent ?? 10;
  const value = isFixed
    ? (params.fixedDiscountMinor as number)
    : percentToBps(discountPercent);

  const defaultName = cleanEmail
    ? `Özel İndirim (${cleanEmail})`
    : "Kişiye Özel Geçici İndirim";
  const name = params.name?.trim() || defaultName;

  const defaultDesc = `Kullanıcıya özel ${expiresInHours} saat geçerli tek kullanımlık indirim kodu.`;
  const description = params.description?.trim() || defaultDesc;

  // Benzersiz kod üret (çakışma kontrolü)
  let code = "";
  let attempts = 0;
  while (attempts < 5) {
    attempts++;
    const candidateCode = generateTemporaryCouponCode(params.prefix ?? "VZ");
    const existing = await db.promotion.findUnique({
      where: { code: candidateCode },
      select: { id: true },
    });
    if (!existing) {
      code = candidateCode;
      break;
    }
  }

  if (!code) {
    code = `${params.prefix ?? "VZ"}-${Date.now().toString(36).toUpperCase()}`;
  }

  const conditionsPayload: Prisma.InputJsonValue = {
    customerEmails: cleanEmail ? [cleanEmail] : [],
    customerIds: cleanCustomerId ? [cleanCustomerId] : [],
    categoryIds: [],
    productIds: [],
    customerGroupIds: [],
    firstOrderOnly: false,
  };

  const promo = await db.promotion.create({
    data: {
      name,
      description,
      code,
      type,
      value,
      conditions: conditionsPayload,
      usageLimit: 1,
      usagePerCustomer: 1,
      startsAt: now,
      endsAt,
      isActive: true,
      isCombinable: false,
      priority: 50,
    },
  });

  return {
    id: promo.id,
    code: promo.code as string,
    type,
    value,
    percent: type === "PERCENTAGE" ? bpsToPercent(value) : null,
    startsAt: now,
    endsAt,
  };
}
