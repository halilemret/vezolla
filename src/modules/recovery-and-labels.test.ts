import { beforeEach, describe, expect, it, vi } from "vitest";

interface FakePromotion {
  id: string;
  name: string;
  code: string | null;
  type: "PERCENTAGE" | "FIXED_AMOUNT";
  value: number;
  isActive: boolean;
}

const store = vi.hoisted(() => ({ rows: new Map<string, unknown>() }));

vi.mock("@/lib/db", () => ({
  db: {
    promotion: {
      findUnique: vi.fn(async ({ where }: { where: { code: string } }) => {
        return (store.rows.get(where.code) as FakePromotion | undefined) ?? null;
      }),
      create: vi.fn(async ({ data }: { data: Omit<FakePromotion, "id"> & { code: string } }) => {
        const row = { id: `p_${data.code}`, ...data };
        store.rows.set(data.code, row);
        return row;
      }),
      update: vi.fn(
        async ({ where, data }: { where: { id: string }; data: Partial<FakePromotion> }) => {
          for (const [code, row] of store.rows) {
            const existing = row as FakePromotion;
            if (existing.id === where.id) {
              const next = { ...existing, ...data };
              store.rows.set(code, next);
              return next;
            }
          }
          throw new Error("not found");
        }
      ),
    },
  },
}));

vi.mock("@/lib/mail", () => ({ sendTransactionalEmail: vi.fn() }));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn() }));
vi.mock("@/lib/settings/service", () => ({ getAbandonedCartSettings: vi.fn() }));

import {
  bpsToPercent,
  formatDiscountNote,
  percentToBps,
  resolveRecoveryCode,
} from "@/modules/analytics/recovery-offer";
import {
  ensureRecoveryPromotion,
  getRecoveryOfferPreview,
} from "@/modules/analytics/abandoned-cart";
import {
  buildShippingLabelZpl,
  generateCarrierBarcode,
  sanitizeZplText,
  type ShippingLabelData,
} from "@/modules/shipping/carriers";
import { DEFAULT_ABANDONED_CART_SETTINGS } from "@/lib/settings/schemas";

const settings = { ...DEFAULT_ABANDONED_CART_SETTINGS, discountPercent: 15 };

describe("Dinamik terk edilmiş sepet indirim oranı", () => {
  beforeEach(() => store.rows.clear());

  it("varsayılan oran %10, çıkış niyeti açık gelir", () => {
    expect(DEFAULT_ABANDONED_CART_SETTINGS.discountPercent).toBe(10);
    expect(DEFAULT_ABANDONED_CART_SETTINGS.exitIntentEnabled).toBe(true);
  });

  it("kod boşsa orana göre SEPET{oran} üretir, doluysa temizleyip kullanır", () => {
    expect(resolveRecoveryCode(settings)).toBe("SEPET15");
    expect(resolveRecoveryCode({ ...settings, autoDiscountCode: " geridon 10! " })).toBe("GERIDON10");
    expect(resolveRecoveryCode(settings, "yaz20")).toBe("YAZ20");
  });

  it("yüzdeyi baz puana ve geri çevirir", () => {
    expect(percentToBps(15)).toBe(1500);
    expect(bpsToPercent(1500)).toBe(15);
  });

  it("e-posta notunda sabit %10 yerine gerçek oran yazar", () => {
    expect(formatDiscountNote("SEPET15", 15)).toContain("%15");
    expect(formatDiscountNote("SEPET15", 15)).not.toContain("%10");
    expect(formatDiscountNote("OZEL", null)).not.toContain("%");
  });

  it("kupon yoksa panel oranıyla oluşturur, böylece ödemede gerçekten çalışır", async () => {
    const info = await ensureRecoveryPromotion("SEPET15", 15);
    expect(info).toEqual({ code: "SEPET15", percent: 15 });
    const row = store.rows.get("SEPET15") as FakePromotion;
    expect(row.type).toBe("PERCENTAGE");
    expect(row.value).toBe(1500);
    expect(row.isActive).toBe(true);
  });

  it("panel oranı değişince yönetilen kuponu günceller", async () => {
    await ensureRecoveryPromotion("SEPET15", 15);
    await ensureRecoveryPromotion("SEPET15", 20);
    expect((store.rows.get("SEPET15") as FakePromotion).value).toBe(2000);
  });

  it("yöneticinin kendi kampanya kodunu ezmez, gerçek oranını bildirir", async () => {
    store.rows.set("YAZ20", {
      id: "p1",
      name: "Yaz Kampanyası",
      code: "YAZ20",
      type: "PERCENTAGE",
      value: 2500,
      isActive: true,
    } satisfies FakePromotion);
    const info = await ensureRecoveryPromotion("YAZ20", 10);
    expect(info.percent).toBe(25);
    expect((store.rows.get("YAZ20") as FakePromotion).value).toBe(2500);
  });

  it("önizleme veritabanına yazmaz", async () => {
    const preview = await getRecoveryOfferPreview(settings);
    expect(preview).toEqual({ code: "SEPET15", percent: 15 });
    expect(store.rows.size).toBe(0);
  });
});

const baseLabel: ShippingLabelData = {
  carrierCode: "yurtici",
  barcode: "YK0000100101",
  orderNumber: 1001,
  sender: {
    name: "Atölye Mağaza",
    line1: "Örnek Sk. No 4",
    district: "Kadıköy",
    city: "İstanbul",
    phone: "02120000000",
  },
  recipient: {
    name: "Ayşe Yılmaz",
    line1: "Gül Mah. 12. Sk. No 3 D 5",
    district: "Çankaya",
    city: "Ankara",
    phone: "05320000000",
  },
  codAmountMinor: null,
  itemSummary: "2x Seramik Kupa; 1x Tabak",
};

describe("Kargo barkodu ve ZPL etiketi", () => {
  it("firma önekli, deterministik ve kontrol haneli barkod üretir", () => {
    const a = generateCarrierBarcode("yurtici", 1001, 1);
    expect(a).toMatch(/^YK\d{11}$/);
    expect(generateCarrierBarcode("yurtici", 1001, 1)).toBe(a);
    expect(generateCarrierBarcode("yurtici", 1001, 2)).not.toBe(a);
    expect(generateCarrierBarcode("aras", 1001, 1).startsWith("AR")).toBe(true);
    expect(generateCarrierBarcode("mng", 1001, 1).startsWith("MN")).toBe(true);
    expect(generateCarrierBarcode("bilinmeyen", 1001, 1).startsWith("KR")).toBe(true);
  });

  it("geçerli bir ZPL II etiketi üretir (^XA ... ^XZ, Code 128, UTF-8)", () => {
    const zpl = buildShippingLabelZpl(baseLabel);
    expect(zpl.startsWith("^XA")).toBe(true);
    expect(zpl.trimEnd().endsWith("^XZ")).toBe(true);
    expect(zpl).toContain("^CI28");
    expect(zpl).toContain("^PW812");
    expect(zpl).toContain("^BCN,170,N,N,N^FDYK0000100101^FS");
    expect(zpl).toContain("Çankaya / Ankara");
    expect(zpl).not.toContain("KAPIDA ODEME");
    expect(zpl).not.toContain("\u2014");
  });

  it("kapıda ödemede tahsilat tutarını ters renk kutusunda basar", () => {
    const zpl = buildShippingLabelZpl({ ...baseLabel, codAmountMinor: 123456 });
    expect(zpl).toContain("^FR^FDKAPIDA ODEME: 1.234,56 TL^FS");
  });

  it("ZPL kontrol karakterlerini alan içeriğinden temizler", () => {
    expect(sanitizeZplText("Ev ^FO0,0 ~DG\\x")).not.toMatch(/[\^~\\]/);
    const zpl = buildShippingLabelZpl({
      ...baseLabel,
      recipient: { ...baseLabel.recipient, name: "Ali ^XZ Veli" },
    });
    expect(zpl.match(/\^XZ/g)).toHaveLength(1);
  });

  it("dış termal etikette mahremiyet garantisi: ürün adı yerine daima nötr 'Giyim / Tekstil Ürünü' basar", () => {
    const zpl = buildShippingLabelZpl({
      ...baseLabel,
      itemSummary: "1x Dantelli Transparan Babydoll - Bordo",
    });
    expect(zpl).toContain("Giyim / Tekstil Ürünü");
    expect(zpl).not.toContain("Dantelli");
    expect(zpl).not.toContain("Babydoll");
  });
});
