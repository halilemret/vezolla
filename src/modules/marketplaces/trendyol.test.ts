import { describe, expect, it } from "vitest";
import {
  buildTrendyolProductBatch,
  parseTrendyolOrderWebhook,
  buildTrendyolTrackingPayload,
  type ExportableMarketplaceProduct,
} from "./trendyol";

describe("Trendyol Pazaryeri Entegrasyon Modülü (trendyol.ts)", () => {
  it("mağaza ürün ve varyantlarını Trendyol v2/products aktarım şemasına dönüştürür", () => {
    const products: ExportableMarketplaceProduct[] = [
      {
        id: "prod-1",
        title: "Dantelli Bralette Takım",
        description: "Zarif Fransız dantelli bralette",
        brandId: 1042,
        categoryId: 501,
        vatRate: 10,
        desi: 1,
        images: ["https://vezolla.com/img1.jpg", "https://vezolla.com/img2.jpg"],
        variants: [
          {
            id: "var-1",
            sku: "BRAL-75B-BLK",
            barcode: "869000100001",
            priceMinor: 49990, // 499.90 TL
            compareAtPriceMinor: 64990, // 649.90 TL
            stock: 12,
          },
          {
            id: "var-2",
            sku: "BRAL-80B-BLK",
            barcode: "869000100002",
            priceMinor: 49990,
            compareAtPriceMinor: null,
            stock: 8,
          },
        ],
      },
    ];

    const batch = buildTrendyolProductBatch(products);
    expect(batch.items.length).toBe(2);

    const first = batch.items[0];
    expect(first?.barcode).toBe("869000100001");
    expect(first?.title).toBe("Dantelli Bralette Takım");
    expect(first?.stockCode).toBe("BRAL-75B-BLK");
    expect(first?.salePrice).toBe(499.9);
    expect(first?.listPrice).toBe(649.9);
    expect(first?.quantity).toBe(12);
    expect(first?.currencyType).toBe("TRY");
    expect(first?.images.length).toBe(2);

    const second = batch.items[1];
    expect(second?.listPrice).toBe(499.9); // compareAtPrice olmadığında salePrice kullanılır
  });

  it("gelen geçerli Trendyol sipariş webhook paketini standart iç siparişe dönüştürür", () => {
    const sampleWebhook = {
      id: 998877,
      orderNumber: "TY-2026-1042",
      orderDate: Date.now(),
      status: "Created",
      totalPrice: 499.9,
      customerFirstName: "Ayşe",
      customerLastName: "Demir",
      customerEmail: "ayse@ornek.com",
      shipmentAddress: {
        firstName: "Ayşe",
        lastName: "Demir",
        address1: "Bağdat Cad. No: 10 Kadıköy",
        city: "İstanbul",
        district: "Kadıköy",
        phone: "05321112233",
      },
      lines: [
        {
          id: 1,
          quantity: 2,
          sku: "BRAL-75B-BLK",
          barcode: "869000100001",
          productName: "Dantelli Bralette Takım",
          price: 249.95,
        },
      ],
      cargoProviderName: "Yurtiçi Kargo",
      cargoTrackingNumber: "1234567890",
    };

    const parsed = parseTrendyolOrderWebhook(sampleWebhook);
    expect(parsed.externalOrderNumber).toBe("TY-2026-1042");
    expect(parsed.source).toBe("trendyol");
    expect(parsed.customer.firstName).toBe("Ayşe");
    expect(parsed.shippingAddress.city).toBe("İstanbul");
    expect(parsed.items.length).toBe(1);
    expect(parsed.items[0]?.quantity).toBe(2);
    expect(parsed.items[0]?.priceMinor).toBe(24995);
    expect(parsed.totalMinor).toBe(49990);
    expect(parsed.carrier).toBe("Yurtiçi Kargo");
    expect(parsed.trackingNumber).toBe("1234567890");
  });

  it("eksik alanlı webhook paketlerinde uygun hata fırlatır", () => {
    expect(() => parseTrendyolOrderWebhook(null)).toThrow("Geçersiz Trendyol webhook paketi");
    expect(() => parseTrendyolOrderWebhook({})).toThrow("orderNumber");
    expect(() =>
      parseTrendyolOrderWebhook({ orderNumber: "123", lines: [] })
    ).toThrow("lines");
  });

  it("kargo firmalarına göre doğru Trendyol providerCode üretir", () => {
    expect(buildTrendyolTrackingPayload({ trackingNumber: "123", carrier: "Yurtiçi" }).providerCode).toBe("YURTICI");
    expect(buildTrendyolTrackingPayload({ trackingNumber: "123", carrier: "Aras Kargo" }).providerCode).toBe("ARAS");
    expect(buildTrendyolTrackingPayload({ trackingNumber: "123", carrier: "MNG" }).providerCode).toBe("MNG");
    expect(buildTrendyolTrackingPayload({ trackingNumber: "123", carrier: "Sürat Kargo" }).providerCode).toBe("SURAT");
    expect(buildTrendyolTrackingPayload({ trackingNumber: "123", carrier: "Trendyol Express" }).providerCode).toBe("TRENDYOLEXPRESS");
  });
});
