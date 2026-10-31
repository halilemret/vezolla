import { describe, it, expect } from "vitest";
import {
  calculateInstallmentPlans,
  TURKISH_CARD_FAMILIES,
} from "./installments";

describe("Turkish Installment Calculation Engine (iyzico)", () => {
  it("6 büyük Türk kredi kartı ailesini eksiksiz içerir", () => {
    const plans = calculateInstallmentPlans(100000); // 1.000 TL
    expect(plans).toHaveLength(6);

    const familyIds = plans.map((p) => p.id);
    expect(familyIds).toEqual([
      "bonus",
      "world",
      "axess",
      "maximum",
      "cardfinans",
      "paraf",
    ]);
  });

  it("1, 2 ve 3 taksitlerde peşin fiyatına (%0 komisyon) hesaplar", () => {
    const priceMinor = 150000; // 1.500 TL
    const plans = calculateInstallmentPlans(priceMinor);

    for (const plan of plans) {
      const tekCekim = plan.installments.find((i) => i.count === 1);
      const taksit2 = plan.installments.find((i) => i.count === 2);
      const taksit3 = plan.installments.find((i) => i.count === 3);

      expect(tekCekim).toBeDefined();
      expect(tekCekim?.totalMinor).toBe(150000);
      expect(tekCekim?.monthlyMinor).toBe(150000);
      expect(tekCekim?.isFreeInterest).toBe(true);

      expect(taksit2).toBeDefined();
      expect(taksit2?.totalMinor).toBe(150000);
      expect(taksit2?.monthlyMinor).toBe(75000);
      expect(taksit2?.isFreeInterest).toBe(true);

      expect(taksit3).toBeDefined();
      expect(taksit3?.totalMinor).toBe(150000);
      expect(taksit3?.monthlyMinor).toBe(50000);
      expect(taksit3?.isFreeInterest).toBe(true);
    }
  });

  it("6 ve 9 taksitlerde vade farkını ve aylık tutarı doğru hesaplar", () => {
    const priceMinor = 100000; // 1.000 TL
    const plans = calculateInstallmentPlans(priceMinor);
    const bonusPlan = plans.find((p) => p.id === "bonus")!;

    const taksit6 = bonusPlan.installments.find((i) => i.count === 6)!;
    expect(taksit6.isFreeInterest).toBe(false);
    expect(taksit6.commissionPercent).toBeGreaterThan(0);
    expect(taksit6.totalMinor).toBeGreaterThan(priceMinor);
    expect(taksit6.monthlyMinor * 6).toBeCloseTo(taksit6.totalMinor, -2);

    const taksit9 = bonusPlan.installments.find((i) => i.count === 9)!;
    expect(taksit9.isFreeInterest).toBe(false);
    expect(taksit9.commissionPercent).toBeGreaterThan(taksit6.commissionPercent);
    expect(taksit9.totalMinor).toBeGreaterThan(taksit6.totalMinor);
  });

  it("0 veya eksi tutarlarda güvenli bir şekilde 0 döner", () => {
    const plans = calculateInstallmentPlans(0);
    expect(plans).toHaveLength(6);
    expect(plans[0]?.installments[0]?.monthlyMinor).toBe(0);
    expect(plans[0]?.installments[0]?.totalMinor).toBe(0);
  });
});
