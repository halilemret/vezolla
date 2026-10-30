/**
 * Kuruş cinsinden tam sayıyı Türk Lirası formatında gösterir (örn: 12550 -> "125,50 ₺").
 */
export function formatMoney(amountInKurus: number | null | undefined, currency = "TRY"): string {
  if (amountInKurus === null || amountInKurus === undefined || !Number.isFinite(amountInKurus)) {
    return "0,00 ₺";
  }

  const sign = amountInKurus < 0 ? "-" : "";
  const abs = Math.abs(amountInKurus);
  const liras = Math.floor(abs / 100);
  const kurus = abs % 100;

  const formattedLira = liras.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const formattedKurus = kurus.toString().padStart(2, "0");

  const symbol = currency === "TRY" ? "₺" : currency;
  return `${sign}${formattedLira},${formattedKurus} ${symbol}`;
}
