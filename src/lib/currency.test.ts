import { describe, expect, it } from "vitest";
import {
  convertCurrency,
  formatCurrencyAmount,
  SUPPORTED_CURRENCIES,
  DEFAULT_EXCHANGE_RATES,
} from "./currency";

describe("Çoklu Para Birimi Motoru (currency.ts)", () => {
  it("desteklenen para birimlerini doğru tanımlar", () => {
    expect(SUPPORTED_CURRENCIES).toEqual(["TRY", "EUR", "USD"]);
    expect(DEFAULT_EXCHANGE_RATES.TRY).toBe(1.0);
    expect(DEFAULT_EXCHANGE_RATES.EUR).toBeGreaterThan(0);
    expect(DEFAULT_EXCHANGE_RATES.USD).toBeGreaterThan(0);
  });

  it("TRY tutarını aynı şekilde döner", () => {
    const tryAmount = 145000; // 1450.00 TL
    expect(convertCurrency(tryAmount, "TRY")).toBe(145000);
  });

  it("TRY tutarını EUR ve USD kurlarına doğru çevirir", () => {
    const tryAmount = 100000; // 1000.00 TL
    // 1000 TL * 0.026 = 26.00 EUR (2600 minor)
    const eurAmount = convertCurrency(tryAmount, "EUR");
    expect(eurAmount).toBe(2600);

    // 1000 TL * 0.0285 = 28.50 USD (2850 minor)
    const usdAmount = convertCurrency(tryAmount, "USD");
    expect(usdAmount).toBe(2850);
  });

  it("özel döviz kurlarını destekler", () => {
    const customRates = {
      TRY: 1.0,
      EUR: 0.025, // 1 EUR = 40 TRY
      USD: 0.02, // 1 USD = 50 TRY
    };
    expect(convertCurrency(200000, "EUR", customRates)).toBe(5000); // 50.00 EUR
    expect(convertCurrency(200000, "USD", customRates)).toBe(4000); // 40.00 USD
  });

  it("para birimlerine göre doğru sembol ve formatlamayı uygular", () => {
    expect(formatCurrencyAmount(145000, "TRY")).toContain("₺");
    expect(formatCurrencyAmount(2600, "EUR")).toContain("€");
    expect(formatCurrencyAmount(2850, "USD")).toContain("$");
  });
});
