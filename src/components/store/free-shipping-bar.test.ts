import { describe, it, expect } from "vitest";

describe("Free Shipping Calculations (1.500 TL Eşiği)", () => {
  const THRESHOLD = 150000; // 1.500 TL (150.000 kuruş)

  function computeShippingProgress(
    subtotalMinor: number,
    thresholdMinor = THRESHOLD,
    freeShippingByPromo = false
  ) {
    const currentNet = Math.max(0, subtotalMinor);
    const isFree = freeShippingByPromo || currentNet >= thresholdMinor;
    const remainingMinor = isFree ? 0 : Math.max(0, thresholdMinor - currentNet);
    const progressPercent = isFree
      ? 100
      : currentNet <= 0
        ? 0
        : Math.min(100, Math.max(4, Math.round((currentNet / thresholdMinor) * 100)));

    return { isFree, remainingMinor, progressPercent };
  }

  it("sepet 0 TL iken ilerleme %0 ve kalan tutar 1.500 TL döner", () => {
    const res = computeShippingProgress(0);
    expect(res.isFree).toBe(false);
    expect(res.remainingMinor).toBe(150000);
    expect(res.progressPercent).toBe(0);
  });

  it("negatif tutarda 0 olarak sınırlandırır", () => {
    const res = computeShippingProgress(-5000);
    expect(res.isFree).toBe(false);
    expect(res.remainingMinor).toBe(150000);
    expect(res.progressPercent).toBe(0);
  });

  it("1.000 TL sepet tutarında kalan 500 TL ve %67 ilerleme hesaplar", () => {
    const res = computeShippingProgress(100000);
    expect(res.isFree).toBe(false);
    expect(res.remainingMinor).toBe(50000);
    expect(res.progressPercent).toBe(67);
  });

  it("tam 1.500 TL eşiğinde ücretsiz kargo kazanılır ve %100 olur", () => {
    const res = computeShippingProgress(150000);
    expect(res.isFree).toBe(true);
    expect(res.remainingMinor).toBe(0);
    expect(res.progressPercent).toBe(100);
  });

  it("1.500 TL üzeri tutarlarda ücretsiz kargo korunur", () => {
    const res = computeShippingProgress(250000);
    expect(res.isFree).toBe(true);
    expect(res.remainingMinor).toBe(0);
    expect(res.progressPercent).toBe(100);
  });

  it("kupon veya promosyon ile ücretsiz kargo tanımlandığında sepet tutarı düşük olsa bile %100 döner", () => {
    const res = computeShippingProgress(25000, THRESHOLD, true);
    expect(res.isFree).toBe(true);
    expect(res.remainingMinor).toBe(0);
    expect(res.progressPercent).toBe(100);
  });
});
