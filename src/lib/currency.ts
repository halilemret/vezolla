export type SupportedCurrency = "TRY" | "EUR" | "USD";

export const SUPPORTED_CURRENCIES: SupportedCurrency[] = ["TRY", "EUR", "USD"];
export const CURRENCY_COOKIE = "user_currency";

/**
 * Baz para birimi TRY'dir.
 * 1 TRY'nin hedef para birimindeki karşılığı (1 TRY = X EUR, 1 TRY = Y USD).
 * 1 EUR ~ 38.50 TRY -> 1 TRY ~ 0.026 EUR
 * 1 USD ~ 35.00 TRY -> 1 TRY ~ 0.0285 USD
 */
export const DEFAULT_EXCHANGE_RATES: Record<SupportedCurrency, number> = {
  TRY: 1.0,
  EUR: 0.026,
  USD: 0.0285,
};

export const CURRENCY_SYMBOLS: Record<SupportedCurrency, string> = {
  TRY: "₺",
  EUR: "€",
  USD: "$",
};

/**
 * TRY cinsindeki kuruş tutarını hedef para birimine çevirir (sent/kuruş cinsinden).
 */
export function convertCurrency(
  amountMinorTRY: number,
  targetCurrency: SupportedCurrency = "TRY",
  customRates?: Record<SupportedCurrency, number>
): number {
  if (targetCurrency === "TRY") {
    return Math.round(amountMinorTRY);
  }
  const rates = customRates ?? DEFAULT_EXCHANGE_RATES;
  const rate = rates[targetCurrency] ?? 1.0;
  return Math.round(amountMinorTRY * rate);
}

/**
 * İlgili para birimine göre formatlanmış metin üretir.
 */
export function formatCurrencyAmount(
  amountMinor: number,
  currency: SupportedCurrency = "TRY"
): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? "₺";
  const major = amountMinor / 100;

  const formattedNumber = new Intl.NumberFormat(
    currency === "TRY" ? "tr-TR" : currency === "EUR" ? "de-DE" : "en-US",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  ).format(major);

  if (currency === "USD") {
    return `$${formattedNumber}`;
  }
  if (currency === "EUR") {
    return `${formattedNumber} €`;
  }
  return `${formattedNumber} ₺`;
}
