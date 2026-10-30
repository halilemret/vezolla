import { describe, expect, it } from "vitest";
import { gzipSync, zipSync } from "fflate";
import {
  buildSampleSupplierXml,
  decompressXmlBuffer,
  inspectXmlStructure,
} from "@/modules/xml/parser";
import {
  parseAndTransformPrice,
  transformPriceMinor,
  transformProductTitle,
  transformStockQuantity,
} from "@/modules/xml/transform";
import {
  renderCustomFeedXml,
  renderGoogleMerchantXml,
  renderMetaCatalogXml,
  type ExportableProductItem,
} from "@/modules/xml/exporter";

describe("XML Yapı Çözümleyici ve Sıkıştırma Açıcı (parser.ts)", () => {
  it("örnek tedarikçi XML yapısını, alt alan yollarını ve kategorileri doğru analiz eder", () => {
    const xml = buildSampleSupplierXml();
    const inspection = inspectXmlStructure(xml);

    expect(inspection.selectedItemPath).toBe("Urunler.Urun");
    expect(inspection.itemCount).toBe(4);
    expect(inspection.fieldPaths).toContain("UrunKodu");
    expect(inspection.fieldPaths).toContain("SatisFiyati");
    expect(inspection.fieldPaths).toContain("Stok");
    expect(inspection.fieldPaths).toContain("Varyantlar.Varyant.Barkod");
    expect(inspection.fieldPaths).toContain("Ozellikler.Ozellik");
    expect(inspection.sampleItem).not.toBeNull();
    expect(inspection.sampleItem?.UrunKodu).toBe("AT-KTN-001");
    expect(inspection.categories.length).toBe(4);
    expect(
      inspection.categories.some((c) =>
        c.name.includes("Ev Tekstili > Sofra > Masa Örtüsü")
      )
    ).toBe(true);
  });

  it("farklı kök/ürün düğüm adlarını (catalog.item) ve GZIP / ZIP sıkıştırmasını çözer", () => {
    const customXml = `<?xml version="1.0" encoding="UTF-8"?>
      <catalog>
        <item>
          <id>P-100</id>
          <title>Seramik Kupa</title>
          <price>320.00</price>
          <stock>15</stock>
          <category>Mutfak</category>
        </item>
        <item>
          <id>P-101</id>
          <title>Seramik Tabak</title>
          <price>410.00</price>
          <stock>8</stock>
          <category>Mutfak</category>
        </item>
      </catalog>`;

    const gzBuffer = Buffer.from(
      gzipSync(new Uint8Array(Buffer.from(customXml, "utf-8")))
    );
    const decompressedGz = decompressXmlBuffer(gzBuffer, "urunler.xml.gz");
    const gzInspection = inspectXmlStructure(decompressedGz);

    expect(gzInspection.selectedItemPath).toBe("catalog.item");
    expect(gzInspection.itemCount).toBe(2);
    expect(gzInspection.categories).toEqual([{ name: "Mutfak", count: 2 }]);

    const zipBuffer = Buffer.from(
      zipSync({
        "tedarikci-feed.xml": new Uint8Array(Buffer.from(customXml, "utf-8")),
      })
    );
    const decompressedZip = decompressXmlBuffer(zipBuffer, "arsiv.zip");
    const zipInspection = inspectXmlStructure(decompressedZip);
    expect(zipInspection.selectedItemPath).toBe("catalog.item");
    expect(zipInspection.itemCount).toBe(2);
  });
});

describe("Fiyat, Stok ve Metin Dönüşüm Kuralları (transform.ts)", () => {
  it("döviz çarpanı, KDV ekleme, yüzde marj ve psikolojik yuvarlamayı doğru hesaplar", () => {
    // 100,00 birim (10000 kuruş) * 1.0 kur -> KDV hariç (%20 ekle = 12000) -> +%25 marj (= 15000) -> ,90 yuvarlama (= 15090)
    const result90 = parseAndTransformPrice("100,00", {
      currencyMultiplier: 1,
      sourceIncludesVat: false,
      vatRateBps: 2000,
      marginMode: "PERCENT",
      marginPercentBps: 2500,
      rounding: "90",
    });
    expect(result90).toBe(15090);

    // ,99 yuvarlama
    const result99 = transformPriceMinor(14320, {
      currencyMultiplier: 1,
      sourceIncludesVat: true,
      marginMode: "PERCENT",
      marginPercentBps: 0,
      rounding: "99",
    });
    expect(result99).toBe(14399);

    // Tam liraya yuvarlama
    const resultWhole = transformPriceMinor(14360, {
      currencyMultiplier: 1,
      sourceIncludesVat: true,
      marginMode: "PERCENT",
      marginPercentBps: 0,
      rounding: "whole",
    });
    expect(resultWhole).toBe(14400);
  });

  it("fiyat aralıklarına göre kademeli marj (TIERED) kurallarını doğru uygular", () => {
    const tieredTransform = {
      currencyMultiplier: 1,
      sourceIncludesVat: true,
      vatRateBps: 2000,
      marginMode: "TIERED" as const,
      marginPercentBps: 1000,
      marginFixedMinor: 0,
      rounding: "none" as const,
      tiers: [
        { upToMinor: 50000, percentBps: 4000, fixedMinor: 0 }, // 500 TL'ye kadar +%40
        { upToMinor: 200000, percentBps: 2000, fixedMinor: 2500 }, // 2000 TL'ye kadar +%20 + 25 TL
      ],
    };

    // 300 TL (30000 kuruş) -> 1. kademe (+%40) -> 420 TL (42000 kuruş)
    expect(transformPriceMinor(30000, tieredTransform)).toBe(42000);

    // 1000 TL (100000 kuruş) -> 2. kademe (+%20 + 25 TL) -> 1225 TL (122500 kuruş)
    expect(transformPriceMinor(100000, tieredTransform)).toBe(122500);
  });

  it("minimum stok eşiğini ve başlık önek/sonek/bul-değiştir kurallarını uygular", () => {
    expect(transformStockQuantity("2", { minStockThreshold: 3 })).toBe(0);
    expect(transformStockQuantity("3", { minStockThreshold: 3 })).toBe(3);
    expect(transformStockQuantity("12", { minStockThreshold: 3 })).toBe(12);

    const title = transformProductTitle("BYK Pamuklu Nevresim Takımı", {
      titlePrefix: "Atölye",
      titleSuffix: "Koleksiyonu",
      replacements: [{ find: "BYK", replace: "Çift Kişilik" }],
    });
    expect(title).toBe("Atölye Çift Kişilik Pamuklu Nevresim Takımı Koleksiyonu");
  });
});

describe("XML Dışa Aktarma Şablonları (exporter.ts)", () => {
  const sampleExportItems: ExportableProductItem[] = [
    {
      id: "prod-1",
      sku: "AT-KTN-001",
      barcode: "8690001000011",
      title: "Doğal Taş Yıkama Keten Masa Örtüsü",
      slug: "dogal-tas-yikama-keten-masa-ortusu",
      description: "<p>%100 Anadolu keteni masa örtüsü</p>",
      brandName: "Anadolu Dokuma",
      categoryName: "Ev Tekstili > Sofra",
      priceMinor: 145000,
      compareAtPriceMinor: 179000,
      stock: 14,
      imageUrl: "/uploads/urunler/keten-ortu.jpg",
      currency: "TRY",
    },
  ];

  it("Google Merchant Center RSS 2.0 ve Meta Katalog formatında geçerli XML üretir", () => {
    const googleXml = renderGoogleMerchantXml(sampleExportItems, {
      storeName: "Atölye Mağaza",
      baseUrl: "https://ornek-magaza.com",
    });

    expect(googleXml).toContain("<g:id>AT-KTN-001</g:id>");
    expect(googleXml).toContain("<g:price>1790.00 TRY</g:price>");
    expect(googleXml).toContain("<g:sale_price>1450.00 TRY</g:sale_price>");
    expect(googleXml).toContain("<g:availability>in_stock</g:availability>");
    expect(googleXml).toContain(
      "<g:image_link>https://ornek-magaza.com/uploads/urunler/keten-ortu.jpg</g:image_link>"
    );

    const metaXml = renderMetaCatalogXml(sampleExportItems, {
      storeName: "Atölye Mağaza",
      baseUrl: "https://ornek-magaza.com",
    });
    expect(metaXml).toContain("<g:availability>in stock</g:availability>");
    expect(metaXml).toContain("<g:inventory>14</g:inventory>");
  });

  it("özel düğüm ve alan etiketli CUSTOM (Akakçe/Cimri/Bayi) XML şablonunu üretir", () => {
    const customXml = renderCustomFeedXml(sampleExportItems, {
      baseUrl: "https://ornek-magaza.com",
      template: {
        rootNode: "AkakceUrunler",
        itemNode: "Kalem",
        includeVariantsAsItems: false,
        useCdataForDescription: true,
        fields: {
          idTag: "UrunNo",
          skuTag: "StokKodu",
          barcodeTag: "EanBarkod",
          titleTag: "UrunAdi",
          descriptionTag: "Detay",
          brandTag: "Markasi",
          categoryTag: "KategoriYolu",
          priceTag: "NetFiyat",
          compareAtPriceTag: "ListeFiyati",
          stockTag: "Adet",
          urlTag: "Baglanti",
          imageTag: "GorselAdresi",
          currencyTag: "Doviz",
        },
      },
    });

    expect(customXml).toContain("<AkakceUrunler>");
    expect(customXml).toContain("<Kalem>");
    expect(customXml).toContain("<UrunNo>prod-1</UrunNo>");
    expect(customXml).toContain("<EanBarkod>8690001000011</EanBarkod>");
    expect(customXml).toContain("<NetFiyat>1450.00</NetFiyat>");
    expect(customXml).toContain("<Adet>14</Adet>");

    const parsedBack = inspectXmlStructure(customXml);
    expect(parsedBack.selectedItemPath).toBe("AkakceUrunler.Kalem");
    expect(parsedBack.itemCount).toBe(1);
  });
});
