import { describe, expect, it } from "vitest";
import {
  detectAdPlatform,
  extractAttributionFromUrl,
  matchAdMappings,
  type AdMappingRecord,
} from "@/modules/personalization/attribution";
import {
  buildProductAffinityIncrements,
  computeDecayedScore,
  computePriceBand,
  EVENT_AFFINITY_WEIGHTS,
} from "@/modules/personalization/tracker";
import {
  evaluateSegmentCondition,
  evaluateSegmentRuleGroup,
  matchVisitorSegments,
  type EvaluableSegment,
  type VisitorSegmentContext,
} from "@/modules/personalization/segments";
import {
  applyMerchandisingRules,
  scoreProductsByAffinity,
  type MerchRuleLike,
} from "@/modules/personalization/recommendations";
import { selectDeterministicVariant } from "@/modules/personalization/experiments";

describe("Zaman Azalması (computeDecayedScore) ve İlgi Profili", () => {
  it("yarı ömür (14 gün) sonunda puanı tam yarıya düşürür ve güncel davranışı öne çıkarır", () => {
    const now = new Date("2026-10-25T12:00:00Z");
    const fourteenDaysAgo = new Date("2026-10-11T12:00:00Z");
    const twentyEightDaysAgo = new Date("2026-09-27T12:00:00Z");

    expect(computeDecayedScore(10, now, now, 14)).toBeCloseTo(10, 5);
    expect(computeDecayedScore(10, fourteenDaysAgo, now, 14)).toBeCloseTo(5, 5);
    expect(computeDecayedScore(10, twentyEightDaysAgo, now, 14)).toBeCloseTo(2.5, 5);

    const recentScore = computeDecayedScore(4, new Date("2026-10-24T12:00:00Z"), now, 14);
    const oldScore = computeDecayedScore(4, twentyEightDaysAgo, now, 14);
    expect(recentScore).toBeGreaterThan(oldScore);
  });

  it("ürün özelliklerinden kategori, marka, etiket, fiyat bandı ve attr:<key> boyutlarını üretir", () => {
    const increments = buildProductAffinityIncrements(
      {
        id: "prod_1",
        brandId: "brand_keten",
        minPrice: 149900,
        categories: [{ categoryId: "cat_gomlek", isPrimary: true }],
        tags: [{ tagId: "tag_yazlik", tag: { slug: "yazlik" } }],
        attributes: [
          {
            attribute: { key: "kumas" },
            valueText: "100% Keten",
          },
        ],
      },
      EVENT_AFFINITY_WEIGHTS.add_to_cart ?? 4
    );

    expect(increments).toEqual(
      expect.arrayContaining([
        { dimension: "category", key: "cat_gomlek", delta: 4 },
        { dimension: "brand", key: "brand_keten", delta: 4 },
        { dimension: "tag", key: "tag_yazlik", delta: 4 },
        { dimension: "price_band", key: "1000_3000", delta: 4 },
        { dimension: "attr:kumas", key: "100% Keten", delta: 4 },
      ])
    );
    expect(computePriceBand(19900)).toBe("0_250");
    expect(computePriceBand(450000)).toBe("3000_plus");
  });
});

describe("Reklam Kimliği ve Kaynak Yakalama (attribution)", () => {
  it("URL parametrelerinden reklam, UTM, tıklama kimlikleri ve referrer bilgisini ayıklar", () => {
    const url =
      "https://magaza.local/katalog?ad_id=meta_ad_99&adset_id=set_42&campaign_id=cmp_kis&utm_source=instagram&utm_medium=paid_social&utm_campaign=kis_koleksiyonu&utm_content=video_1&utm_term=keten&fbclid=IwAR12345";
    const touch = extractAttributionFromUrl(url, "https://instagram.com");

    expect(touch).not.toBeNull();
    expect(touch?.ad_id).toBe("meta_ad_99");
    expect(touch?.adset_id).toBe("set_42");
    expect(touch?.campaign_id).toBe("cmp_kis");
    expect(touch?.utm_source).toBe("instagram");
    expect(touch?.utm_medium).toBe("paid_social");
    expect(touch?.utm_campaign).toBe("kis_koleksiyonu");
    expect(touch?.utm_content).toBe("video_1");
    expect(touch?.utm_term).toBe("keten");
    expect(touch?.fbclid).toBe("IwAR12345");
    expect(touch?.referrer).toBe("https://instagram.com");
    expect(detectAdPlatform(touch)).toBe("META");
  });

  it("AdMapping tablosuyla eşleşerek segment ve öne çıkan ürünleri spesifiklik sırasıyla çözer", () => {
    const mappings: AdMappingRecord[] = [
      {
        id: "map_campaign",
        name: "Genel Kış Kampanyası",
        platform: "META",
        matchField: "utm_campaign",
        matchValue: "kis_koleksiyonu",
        segmentId: "seg_kis_genel",
        featuredProductIds: ["prod_c", "prod_d"],
        isActive: true,
      },
      {
        id: "map_ad_specific",
        name: "Keten Gömlek Video Reklamı",
        platform: "META",
        matchField: "ad_id",
        matchValue: "meta_ad_99",
        segmentId: "seg_keten_reklam",
        featuredProductIds: ["prod_a", "prod_b"],
        isActive: true,
      },
    ];

    const touch = extractAttributionFromUrl(
      "/?ad_id=meta_ad_99&utm_campaign=kis_koleksiyonu&utm_source=instagram"
    );
    const resolved = matchAdMappings(touch, mappings);

    expect(resolved.primaryMapping?.id).toBe("map_ad_specific");
    expect(resolved.segmentId).toBe("seg_keten_reklam");
    expect(resolved.segmentIds).toEqual(["seg_keten_reklam", "seg_kis_genel"]);
    expect(resolved.featuredProductIds).toEqual(["prod_a", "prod_b", "prod_c", "prod_d"]);
  });
});

describe("Segment Kural Motoru (segments)", () => {
  const sampleContext: VisitorSegmentContext = {
    ad_id: "ad_keten_01",
    campaign_id: "cmp_2026",
    utm_campaign: "sonbahar_2026",
    utm_source: "instagram",
    device_type: "mobile",
    city: "İstanbul",
    viewed_categories: ["cat_dis_giyim", "ceket"],
    order_count: 3,
    total_spent: 450000,
    abandoned_cart: true,
    first_visit: false,
    customer_group: "VIP",
  };

  it("tüm desteklenen kural alanlarını ve VE / VEYA (ALL / ANY) gruplarını doğru değerlendirir", () => {
    expect(
      evaluateSegmentCondition({ field: "ad_id", operator: "eq", value: "ad_keten_01" }, sampleContext)
    ).toBe(true);
    expect(
      evaluateSegmentCondition({ field: "city", operator: "eq", value: "istanbul" }, sampleContext)
    ).toBe(true);
    expect(
      evaluateSegmentCondition(
        { field: "viewed_category", operator: "eq", value: "ceket" },
        sampleContext
      )
    ).toBe(true);
    expect(
      evaluateSegmentCondition({ field: "min_orders", operator: "gte", value: 2 }, sampleContext)
    ).toBe(true);
    expect(
      evaluateSegmentCondition(
        { field: "total_spent_min", operator: "gte", value: 300000 },
        sampleContext
      )
    ).toBe(true);
    expect(
      evaluateSegmentCondition({ field: "abandoned_cart", value: true }, sampleContext)
    ).toBe(true);
    expect(
      evaluateSegmentCondition({ field: "first_visit", value: true }, sampleContext)
    ).toBe(false);
    expect(
      evaluateSegmentCondition(
        { field: "customer_group", operator: "eq", value: "VIP" },
        sampleContext
      )
    ).toBe(true);

    const allMatch = evaluateSegmentRuleGroup(
      {
        match: "ALL",
        conditions: [
          { field: "device_type", value: "mobile" },
          { field: "abandoned_cart", value: true },
          { field: "min_orders", value: 2 },
        ],
      },
      sampleContext
    );
    expect(allMatch).toBe(true);

    const anyMatch = evaluateSegmentRuleGroup(
      {
        match: "ANY",
        conditions: [
          { field: "first_visit", value: true },
          { field: "utm_source", value: "instagram" },
        ],
      },
      sampleContext
    );
    expect(anyMatch).toBe(true);
  });

  it("segmentleri priority sırasına göre döndürür ve önizleme çerezi varsa en başa alır", () => {
    const segments: EvaluableSegment[] = [
      {
        id: "seg_low",
        name: "Mobil Ziyaretçiler",
        priority: 10,
        isActive: true,
        rules: {
          match: "ALL",
          conditions: [{ field: "device_type", value: "mobile" }],
        },
      },
      {
        id: "seg_high",
        name: "Sadık VIP Sepet Terk",
        priority: 50,
        isActive: true,
        rules: {
          match: "ALL",
          conditions: [
            { field: "abandoned_cart", value: true },
            { field: "min_orders", value: 2 },
          ],
        },
      },
      {
        id: "seg_preview_only",
        name: "İlk Kez Gelenler",
        priority: 5,
        isActive: true,
        rules: {
          match: "ALL",
          conditions: [{ field: "first_visit", value: true }],
        },
      },
    ];

    const normalOrder = matchVisitorSegments(segments, sampleContext);
    expect(normalOrder.map((s) => s.id)).toEqual(["seg_high", "seg_low"]);

    const withPreview = matchVisitorSegments(segments, sampleContext, {
      previewSegmentId: "seg_preview_only",
    });
    expect(withPreview.map((s) => s.id)).toEqual([
      "seg_preview_only",
      "seg_high",
      "seg_low",
    ]);
  });
});

describe("Sıralama ve Öne Çıkarma Kuralları (applyMerchandisingRules)", () => {
  it("PIN, BOOST, BURY, HIDE kurallarını ve stokta olmayan ürünleri sona itmeyi uygular", () => {
    const products = [
      { id: "p_normal_1", totalStock: 10, baseScore: 50 },
      { id: "p_out_of_stock", totalStock: 0, baseScore: 999 },
      { id: "p_to_bury", totalStock: 8, baseScore: 80 },
      { id: "p_to_boost", totalStock: 5, baseScore: 20 },
      { id: "p_to_pin", totalStock: 3, baseScore: 10 },
      { id: "p_to_hide", totalStock: 15, baseScore: 500 },
    ];

    const rules: MerchRuleLike[] = [
      {
        id: "r_pin",
        scope: "HOME",
        action: "PIN",
        productIds: ["p_to_pin"],
        priority: 10,
        isActive: true,
      },
      {
        id: "r_boost",
        scope: "ALL",
        segmentId: "seg_vip",
        action: "BOOST",
        productIds: ["p_to_boost"],
        weight: 3,
        priority: 8,
        isActive: true,
      },
      {
        id: "r_bury",
        scope: "HOME",
        action: "BURY",
        productIds: ["p_to_bury"],
        weight: 4,
        priority: 5,
        isActive: true,
      },
      {
        id: "r_hide",
        scope: "ALL",
        action: "HIDE",
        productIds: ["p_to_hide"],
        priority: 20,
        isActive: true,
      },
    ];

    const result = applyMerchandisingRules(products, {
      scope: "HOME",
      segmentIds: ["seg_vip"],
      rules,
    });

    const ids = result.map((p) => p.id);
    expect(ids).not.toContain("p_to_hide");
    expect(ids).toEqual([
      "p_to_pin",
      "p_to_boost",
      "p_normal_1",
      "p_to_bury",
      "p_out_of_stock",
    ]);
  });

  it("ziyaretçi ilgi profiline göre ürünleri puanlar ve deterministik A/B varyantı seçer", () => {
    const now = new Date("2026-10-25T12:00:00Z");
    const scored = scoreProductsByAffinity(
      [
        { id: "p1", brandId: "b_other", categories: [{ categoryId: "c_other" }] },
        { id: "p2", brandId: "b_fav", categories: [{ categoryId: "c_fav" }] },
      ],
      [
        { dimension: "category", key: "c_fav", score: 10, updatedAt: now },
        { dimension: "brand", key: "b_fav", score: 5, updatedAt: now },
      ],
      now
    );

    expect(scored[1]?.baseScore).toBeGreaterThan(scored[0]?.baseScore ?? 0);

    const variants = [
      { id: "var_a", weight: 50 },
      { id: "var_b", weight: 50 },
    ];
    const firstCall = selectDeterministicVariant("exp_1", "vis_123", variants);
    const secondCall = selectDeterministicVariant("exp_1", "vis_123", variants);
    expect(firstCall?.id).toBe(secondCall?.id);
  });
});
