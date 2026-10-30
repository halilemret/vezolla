import { describe, expect, it } from "vitest";
import { extractIncludedVat } from "@/lib/money";
import {
  distributeDiscountAcrossLines,
  evaluatePromotions,
  type PromoCandidate,
  type PromoLineInput,
} from "@/modules/promotions/engine";

const SAMPLE_LINES: PromoLineInput[] = [
  {
    lineId: "line-1",
    variantId: "var-1",
    productId: "prod-1",
    categoryIds: ["cat-giyim"],
    quantity: 2,
    unitPriceMinor: 50000, // 2 * 500 TL = 1000 TL (100000 kuruş)
  },
  {
    lineId: "line-2",
    variantId: "var-2",
    productId: "prod-2",
    categoryIds: ["cat-aksesuar"],
    quantity: 1,
    unitPriceMinor: 30000, // 300 TL (30000 kuruş)
  },
];

describe("Promosyon Motoru (promotions/engine)", () => {
  it("sabit indirimi satırlara kuruşu kuruşuna dağıtır (yuvarlama kaybı olmaz)", () => {
    const lines = [
      { lineId: "a", amountMinor: 10000 },
      { lineId: "b", amountMinor: 10000 },
      { lineId: "c", amountMinor: 10000 },
    ];
    const dist = distributeDiscountAcrossLines(lines, 10000);
    const totalDistributed = (dist.a ?? 0) + (dist.b ?? 0) + (dist.c ?? 0);
    expect(totalDistributed).toBe(10000);
    expect(Object.values(dist).sort()).toEqual([3333, 3333, 3334]);
  });

  it("PERCENTAGE kuponunu maxDiscount tavanı ile uygular ve satırlara dağıtır", () => {
    const candidates: PromoCandidate[] = [
      {
        id: "promo-pct",
        name: "%20 İndirim",
        code: "BAHAR20",
        type: "PERCENTAGE",
        value: 2000, // %20
        conditions: { minSubtotalMinor: 50000 },
        maxDiscount: 20000, // En fazla 200 TL indirim
        usageCount: 0,
        isActive: true,
        isCombinable: false,
        priority: 10,
      },
    ];

    const res = evaluatePromotions(candidates, {
      lines: SAMPLE_LINES,
      enteredCodes: ["bahar20"],
    });

    // Ara toplam 1300 TL, %20 normalde 260 TL ama tavan 200 TL (20000 kuruş)
    expect(res.subtotalMinor).toBe(130000);
    expect(res.discountTotalMinor).toBe(20000);
    expect((res.lineDiscounts["line-1"] ?? 0) + (res.lineDiscounts["line-2"] ?? 0)).toBe(20000);
    expect(res.rejectedCodes).toHaveLength(0);
  });

  it("BUY_X_GET_Y (2 Alana 1 Bedava) kampanyasında en düşük fiyatlı ürünü ücretsiz yapar", () => {
    const lines: PromoLineInput[] = [
      {
        lineId: "l-shirt",
        variantId: "v-1",
        productId: "p-1",
        categoryIds: ["cat-1"],
        quantity: 2,
        unitPriceMinor: 40000, // 400 TL x 2
      },
      {
        lineId: "l-hat",
        variantId: "v-2",
        productId: "p-2",
        categoryIds: ["cat-1"],
        quantity: 1,
        unitPriceMinor: 25000, // 250 TL x 1 (en ucuz ürün)
      },
    ];

    const candidates: PromoCandidate[] = [
      {
        id: "promo-bxgy",
        name: "3 Al 2 Öde",
        code: null,
        type: "BUY_X_GET_Y",
        value: 0,
        conditions: { categoryIds: ["cat-1"] },
        buyQuantity: 2,
        getQuantity: 1,
        getDiscountBps: 10000, // %100 bedava
        usageCount: 0,
        isActive: true,
        isCombinable: false,
        priority: 5,
      },
    ];

    const res = evaluatePromotions(candidates, {
      lines,
      enteredCodes: [],
    });

    expect(res.discountTotalMinor).toBe(25000);
    expect(res.lineDiscounts["l-hat"]).toBe(25000);
    expect(res.lineDiscounts["l-shirt"]).toBe(0);
  });

  it("koşulları (ilk sipariş, müşteri grubu, kullanım limiti) doğru denetler", () => {
    const candidates: PromoCandidate[] = [
      {
        id: "promo-first",
        name: "İlk Sipariş 100 TL",
        code: "ILK100",
        type: "FIXED_AMOUNT",
        value: 10000,
        conditions: { firstOrderOnly: true },
        usageCount: 0,
        isActive: true,
        isCombinable: false,
        priority: 1,
      },
      {
        id: "promo-vip",
        name: "VIP Ücretsiz Kargo",
        code: "VIPKARGO",
        type: "FREE_SHIPPING",
        value: 0,
        conditions: { customerGroupIds: ["grp-vip"] },
        usageCount: 0,
        isActive: true,
        isCombinable: true,
        priority: 1,
      },
    ];

    // Daha önce siparişi olan ve VIP olmayan müşteri
    const rejectedRes = evaluatePromotions(candidates, {
      lines: SAMPLE_LINES,
      enteredCodes: ["ILK100", "VIPKARGO"],
      customerOrderCount: 2,
      customerGroupId: "grp-standard",
    });

    expect(rejectedRes.discountTotalMinor).toBe(0);
    expect(rejectedRes.freeShipping).toBe(false);
    expect(rejectedRes.rejectedCodes).toHaveLength(2);

    // İlk siparişi olan VIP müşteri
    const validRes = evaluatePromotions(candidates, {
      lines: SAMPLE_LINES,
      enteredCodes: ["VIPKARGO"],
      customerOrderCount: 0,
      customerGroupId: "grp-vip",
    });

    expect(validRes.freeShipping).toBe(true);
    expect(validRes.rejectedCodes).toHaveLength(0);
  });

  it("birleştirilebilir (isCombinable) indirimleri sırayla uygular ve KDV tutarını doğru ayıklar", () => {
    const candidates: PromoCandidate[] = [
      {
        id: "auto-10",
        name: "Otomatik %10",
        code: null,
        type: "PERCENTAGE",
        value: 1000,
        conditions: {},
        usageCount: 0,
        isActive: true,
        isCombinable: true,
        priority: 10,
      },
      {
        id: "coupon-50",
        name: "Ek 50 TL Kupon",
        code: "EK50",
        type: "FIXED_AMOUNT",
        value: 5000,
        conditions: {},
        usageCount: 0,
        isActive: true,
        isCombinable: true,
        priority: 5,
      },
    ];

    const lines: PromoLineInput[] = [
      {
        lineId: "single",
        variantId: "v-1",
        productId: "p-1",
        categoryIds: [],
        quantity: 1,
        unitPriceMinor: 120000, // 1.200,00 TL (%20 KDV dahil)
      },
    ];

    const res = evaluatePromotions(candidates, {
      lines,
      enteredCodes: ["EK50"],
    });

    // %10 -> 12.000 kuruş + 5.000 kuruş = 17.000 kuruş indirim
    expect(res.discountTotalMinor).toBe(17000);
    const netPayableGross = 120000 - (res.lineDiscounts["single"] ?? 0);
    expect(netPayableGross).toBe(103000);

    const vatMinor = extractIncludedVat(netPayableGross, 2000);
    expect(vatMinor).toBe(17167);
  });

  it("kullanıcıya özel e-posta kısıtlaması olan kuponu yalnızca eşleşen e-posta için uygular", () => {
    const candidates: PromoCandidate[] = [
      {
        id: "vip-coupon",
        name: "VIP Müşteri Kuponu",
        code: "VIP-OZEL",
        type: "PERCENTAGE",
        value: 1500, // %15
        conditions: {
          customerEmails: ["vip@example.com"],
        },
        usageCount: 0,
        isActive: true,
        isCombinable: false,
        priority: 10,
      },
    ];

    // 1. Yanlış e-posta ile deneme
    const failedRes = evaluatePromotions(candidates, {
      lines: SAMPLE_LINES,
      enteredCodes: ["VIP-OZEL"],
      customerEmail: "baskasi@example.com",
    });
    expect(failedRes.discountTotalMinor).toBe(0);
    expect(failedRes.rejectedCodes).toHaveLength(1);
    expect(failedRes.rejectedCodes[0]?.reason).toContain("yalnızca belirlenen e-posta adresine özeldir");

    // 2. Doğru e-posta ile deneme (büyük/küçük harf toleranslı)
    const successRes = evaluatePromotions(candidates, {
      lines: SAMPLE_LINES,
      enteredCodes: ["VIP-OZEL"],
      customerEmail: "VIP@Example.COM",
    });
    expect(successRes.discountTotalMinor).toBeGreaterThan(0);
    expect(successRes.rejectedCodes).toHaveLength(0);
  });

  it("kullanıcıya özel müşteri kimliği (customerId) kısıtlamasını doğrular", () => {
    const candidates: PromoCandidate[] = [
      {
        id: "cust-coupon",
        name: "Müşteri Özel Kuponu",
        code: "CUST-99",
        type: "FIXED_AMOUNT",
        value: 10000, // 100 TL
        conditions: {
          customerIds: ["cust-123"],
        },
        usageCount: 0,
        isActive: true,
        isCombinable: false,
        priority: 10,
      },
    ];

    // Eşleşmeyen müşteri kimliği
    const failedRes = evaluatePromotions(candidates, {
      lines: SAMPLE_LINES,
      enteredCodes: ["CUST-99"],
      customerId: "cust-999",
    });
    expect(failedRes.discountTotalMinor).toBe(0);
    expect(failedRes.rejectedCodes).toHaveLength(1);
    expect(failedRes.rejectedCodes[0]?.reason).toContain("yalnızca belirlenen kullanıcı hesabına özeldir");

    // Eşleşen müşteri kimliği
    const successRes = evaluatePromotions(candidates, {
      lines: SAMPLE_LINES,
      enteredCodes: ["CUST-99"],
      customerId: "cust-123",
    });
    expect(successRes.discountTotalMinor).toBe(10000);
    expect(successRes.rejectedCodes).toHaveLength(0);
  });
});
