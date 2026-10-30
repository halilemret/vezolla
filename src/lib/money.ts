/**
 * Para birimi ve vergi yardımcıları.
 * Tüm parasal değerler veritabanında kuruş (tam sayı, Int) olarak saklanır.
 * Örn: 149,90 TL -> 14990
 */

const TR_FORMATTER = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMoney(amountMinor: number, currency = "TRY"): string {
  const major = amountMinor / 100;
  if (currency === "TRY") {
    return TR_FORMATTER.format(major);
  }
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(major);
}

export function formatMoneyCompact(amountMinor: number): string {
  const major = amountMinor / 100;
  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(major);
}

/**
 * Kullanıcının girdiği "149,90" veya "1.250,50" veya "149.90" metnini kuruşa çevirir.
 */
export function parseMoneyInput(raw: string | number): number {
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) return 0;
    return Math.round(raw * 100);
  }
  const trimmed = raw.trim().replace(/\s+/g, "").replace(/[₺TL]/gi, "");
  if (!trimmed) return 0;

  // Hem nokta hem virgül varsa son ayraç ondalık ayracıdır
  const lastComma = trimmed.lastIndexOf(",");
  const lastDot = trimmed.lastIndexOf(".");
  let normalized = trimmed;

  if (lastComma > lastDot) {
    normalized = trimmed.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma && lastComma !== -1) {
    normalized = trimmed.replace(/,/g, "");
  } else if (lastComma !== -1) {
    normalized = trimmed.replace(",", ".");
  }

  const num = Number(normalized);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 100);
}

/**
 * Baz puan uygular (10000 bps = %100, 1500 bps = %15).
 */
export function applyBps(amountMinor: number, bps: number): number {
  return Math.round((amountMinor * bps) / 10000);
}

/**
 * KDV dahil fiyattan içindeki KDV tutarını ayıklar.
 * rateBps: 2000 = %20 KDV -> KDV = toplam - toplam / 1.20
 */
export function extractIncludedVat(grossMinor: number, rateBps: number): number {
  if (rateBps <= 0 || grossMinor <= 0) return 0;
  const net = Math.round((grossMinor * 10000) / (10000 + rateBps));
  return Math.max(0, grossMinor - net);
}

/**
 * KDV hariç tutara KDV ekler.
 */
export function addVat(netMinor: number, rateBps: number): number {
  if (rateBps <= 0) return netMinor;
  return Math.round((netMinor * (10000 + rateBps)) / 10000);
}

/**
 * Psikolojik fiyat yuvarlama:
 * - "none": dokunma
 * - "90": sonunu ,90 kuruşa tamamla (örn. 14320 -> 14390)
 * - "99": sonunu ,99 kuruşa tamamla (örn. 14320 -> 14399)
 * - "whole": tam liraya yuvarla (örn. 14320 -> 14300)
 */
export function roundPriceMinor(
  amountMinor: number,
  mode: "none" | "90" | "99" | "whole"
): number {
  if (amountMinor <= 0 || mode === "none") return Math.max(0, Math.round(amountMinor));
  const lira = Math.floor(amountMinor / 100);
  if (mode === "whole") {
    return Math.round(amountMinor / 100) * 100;
  }
  if (mode === "90") {
    return lira * 100 + 90;
  }
  if (mode === "99") {
    return lira * 100 + 99;
  }
  return amountMinor;
}
