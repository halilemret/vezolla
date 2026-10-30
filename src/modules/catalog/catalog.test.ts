import { describe, expect, it } from "vitest";
import {
  buildCategoryTree,
  evaluateCollectionRules,
  generateOptionCombinations,
  syncVariantMatrixWithExisting,
} from "@/modules/catalog/service";
import type { ProductOptionInput, ProductVariantInput } from "@/modules/catalog/schemas";

describe("Katalog Servisi: Varyant Kombinasyon Üretimi ve Senkronlama", () => {
  it("Renk ve Beden seçeneklerinden Kartezyen varyant kombinasyonları üretir", () => {
    const combinations = generateOptionCombinations([
      {
        name: "Renk",
        values: [{ value: "Siyah" }, { value: "Beyaz" }],
      },
      {
        name: "Beden",
        values: [{ value: "S" }, { value: "M" }, { value: "L" }],
      },
    ]);

    expect(combinations).toHaveLength(6);
    expect(combinations[0]).toEqual({
      title: "Siyah / S",
      key: "renk:siyah|beden:s",
      optionValues: [
        { optionName: "Renk", value: "Siyah" },
        { optionName: "Beden", value: "S" },
      ],
    });
    expect(combinations[5]).toEqual({
      title: "Beyaz / L",
      key: "renk:beyaz|beden:l",
      optionValues: [
        { optionName: "Renk", value: "Beyaz" },
        { optionName: "Beden", value: "L" },
      ],
    });
  });

  it("Yeni seçenek değeri eklendiğinde mevcut varyantların SKU, fiyat ve stok değerlerini korur", () => {
    const existingVariants: ProductVariantInput[] = [
      {
        id: "var-1",
        title: "Siyah / S",
        sku: "TSHIRT-BLK-S",
        barcode: "8690001",
        supplierCode: "SUP-1",
        price: 49900,
        compareAtPrice: 59900,
        costPrice: 22000,
        weightGrams: 250,
        position: 0,
        isActive: true,
        trackInventory: true,
        allowBackorder: false,
        stock: 14,
        optionValues: [
          { optionName: "Renk", value: "Siyah" },
          { optionName: "Beden", value: "S" },
        ],
      },
    ];

    const updatedOptions: ProductOptionInput[] = [
      {
        name: "Renk",
        position: 0,
        values: [{ value: "Siyah", position: 0 }],
      },
      {
        name: "Beden",
        position: 1,
        values: [
          { value: "S", position: 0 },
          { value: "M", position: 1 },
        ],
      },
    ];

    const synced = syncVariantMatrixWithExisting(updatedOptions, existingVariants, {
      defaultPrice: 45000,
      skuPrefix: "TSHIRT",
    });

    expect(synced).toHaveLength(2);
    expect(synced[0]?.id).toBe("var-1");
    expect(synced[0]?.sku).toBe("TSHIRT-BLK-S");
    expect(synced[0]?.price).toBe(49900);
    expect(synced[0]?.stock).toBe(14);

    expect(synced[1]?.title).toBe("Siyah / M");
    expect(synced[1]?.price).toBe(45000);
    expect(synced[1]?.sku).toBe("TSHIRT-SIYAH-M");
    expect(synced[1]?.stock).toBe(0);
  });
});

describe("Katalog Servisi: Otomatik Koleksiyon Kural Değerlendirici", () => {
  const sampleProduct = {
    title: "Merinos Yün Kazak",
    minPrice: 125000,
    maxPrice: 145000,
    totalStock: 18,
    brandId: "brand-1",
    brandName: "Kuzey Atölye",
    brandSlug: "kuzey-atolye",
    tags: ["Kışlık", "Yün", "İndirim"],
  };

  it("matchAll=true iken fiyat, etiket, marka ve stok kurallarının tamamı sağlandığında eşleşir", () => {
    const matched = evaluateCollectionRules(
      sampleProduct,
      [
        { field: "price", operator: "gte", value: 100000 },
        { field: "tag", operator: "eq", value: "yün" },
        { field: "brand", operator: "eq", value: "Kuzey Atölye" },
        { field: "stock", operator: "gt", value: 5 },
      ],
      true
    );

    expect(matched).toBe(true);
  });

  it("matchAll=true iken kurallardan biri sağlanmadığında false döner", () => {
    const matched = evaluateCollectionRules(
      sampleProduct,
      [
        { field: "price", operator: "gte", value: 100000 },
        { field: "stock", operator: "gt", value: 50 },
      ],
      true
    );

    expect(matched).toBe(false);
  });

  it("matchAll=false iken en az bir kural sağlandığında true döner", () => {
    const matched = evaluateCollectionRules(
      sampleProduct,
      [
        { field: "brand", operator: "eq", value: "Başka Marka" },
        { field: "tag", operator: "eq", value: "İndirim" },
      ],
      false
    );

    expect(matched).toBe(true);
  });
});

describe("Katalog Servisi: Kategori Ağacı Oluşturma", () => {
  it("Üst-alt kategorilerden doğru derinlik ve yol bilgisiyle ağaç oluşturur", () => {
    const tree = buildCategoryTree([
      {
        id: "cat-root",
        name: "Giyim",
        slug: "giyim",
        description: null,
        parentId: null,
        position: 0,
        imageUrl: null,
        isActive: true,
        seoTitle: null,
        seoDescription: null,
        _count: { products: 5 },
      },
      {
        id: "cat-child",
        name: "Triko",
        slug: "triko",
        description: null,
        parentId: "cat-root",
        position: 0,
        imageUrl: null,
        isActive: true,
        seoTitle: null,
        seoDescription: null,
        _count: { products: 3 },
      },
    ]);

    expect(tree).toHaveLength(1);
    expect(tree[0]?.children).toHaveLength(1);
    expect(tree[0]?.children[0]?.depth).toBe(1);
    expect(tree[0]?.children[0]?.pathNames).toEqual(["Giyim", "Triko"]);
  });

  it("Çok seviyeli hiyerarşide (Kadın Giyim -> Dış Giyim -> Trençkot) tüm alt kategoriler doğru bağlanır", () => {
    const tree = buildCategoryTree([
      {
        id: "cat-kadin-giyim",
        name: "Kadın Giyim",
        slug: "kadin-giyim",
        description: null,
        parentId: null,
        position: 0,
        imageUrl: null,
        isActive: true,
        seoTitle: null,
        seoDescription: null,
        _count: { products: 0 },
      },
      {
        id: "cat-dis-giyim",
        name: "Dış Giyim",
        slug: "dis-giyim",
        description: null,
        parentId: "cat-kadin-giyim",
        position: 0,
        imageUrl: null,
        isActive: true,
        seoTitle: null,
        seoDescription: null,
        _count: { products: 0 },
      },
      {
        id: "cat-trenckot",
        name: "Trençkot",
        slug: "trenckot",
        description: null,
        parentId: "cat-dis-giyim",
        position: 0,
        imageUrl: null,
        isActive: true,
        seoTitle: null,
        seoDescription: null,
        _count: { products: 5 },
      },
    ]);

    expect(tree).toHaveLength(1);
    const root = tree[0];
    expect(root?.name).toBe("Kadın Giyim");
    expect(root?.children).toHaveLength(1);

    const sub = root?.children[0];
    expect(sub?.name).toBe("Dış Giyim");
    expect(sub?.children).toHaveLength(1);

    const leaf = sub?.children[0];
    expect(leaf?.name).toBe("Trençkot");
    expect(leaf?.productCount).toBe(5);
    expect(leaf?.depth).toBe(2);
    expect(leaf?.pathNames).toEqual(["Kadın Giyim", "Dış Giyim", "Trençkot"]);
  });
});
