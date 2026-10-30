import type { AbandonedCartSettings } from "@/lib/settings/schemas";

export const RECOVERY_PROMOTION_NAME_PREFIX = "Sepet Kurtarma";

/**
 * Hatırlatma e-postası ve çıkış niyeti için kullanılacak kupon kodunu belirler.
 * Panelde kod yazılmışsa o kullanılır, yoksa orana göre SEPET10 gibi bir kod üretilir.
 */
export function resolveRecoveryCode(
  settings: Pick<AbandonedCartSettings, "autoDiscountCode" | "discountPercent">,
  explicitCode?: string | null
): string {
  const raw = (explicitCode ?? settings.autoDiscountCode ?? "").trim().toUpperCase();
  const cleaned = raw.replace(/[^A-Z0-9_-]/g, "");
  if (cleaned.length >= 3) return cleaned;
  return `SEPET${settings.discountPercent}`;
}

/** Yüzde değeri Promotion tablosundaki baz puana çevirir (10 => 1000). */
export function percentToBps(percent: number): number {
  return Math.round(percent * 100);
}

/** Promotion.value (baz puan) değerini okunabilir yüzdeye çevirir (1000 => 10). */
export function bpsToPercent(bps: number): number {
  return Math.round(bps) / 100;
}

export function formatDiscountNote(code: string, percent: number | null): string {
  return percent !== null
    ? `Sizin için özel %${percent} indirim tanımlandı: ${code}`
    : `Sizin için özel indirim kodu tanımlandı: ${code}`;
}
