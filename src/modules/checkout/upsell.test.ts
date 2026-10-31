import { describe, it, expect, vi } from "vitest";
import { getCartUpsellProducts } from "./upsell";
import { db } from "@/lib/db";

describe("Cart Upsells Module", () => {
  it("veritabanındaki uygun ürünleri CartUpsellItem formatında döner", async () => {
    // db.product.findMany mock
    const mockProducts = [
      {
        id: "prod-1",
        title: "Organik Pamuk Yıkama Filesi",
        slug: "organik-pamuk-yikama-filesi",
        minPrice: 12900,
        variants: [
          {
            id: "var-1",
            price: 12900,
            compareAtPrice: 14900,
          },
        ],
        images: [{ url: "https://example.com/washbag.jpg" }],
      },
      {
        id: "prod-2",
        title: "Bambu Lifli Patik Çorap",
        slug: "bambu-lifli-patik-corap",
        minPrice: 18900,
        variants: [
          {
            id: "var-2",
            price: 18900,
            compareAtPrice: null,
          },
        ],
        images: [{ url: "https://example.com/socks.jpg" }],
      },
    ];

    const findManySpy = vi
      .spyOn(db.product, "findMany")
      // @ts-expect-error Mocking db response
      .mockResolvedValueOnce(mockProducts);

    const items = await getCartUpsellProducts({
      excludeVariantIds: ["already-in-cart"],
      limit: 2,
    });

    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({
      id: "prod-1",
      variantId: "var-1",
      title: "Organik Pamuk Yıkama Filesi",
      priceMinor: 12900,
      compareAtPriceMinor: 14900,
      imageUrl: "https://example.com/washbag.jpg",
      slug: "organik-pamuk-yikama-filesi",
    });

    findManySpy.mockRestore();
  });

  it("varyantı olmayan ürünleri güvenli biçimde eler", async () => {
    const mockProducts = [
      {
        id: "prod-no-var",
        title: "Varyantsız Ürün",
        slug: "varyantsiz",
        minPrice: 15000,
        variants: [],
        images: [],
      },
    ];

    const findManySpy = vi
      .spyOn(db.product, "findMany")
      // @ts-expect-error Mocking db response with subset
      .mockResolvedValueOnce(mockProducts)
      .mockResolvedValueOnce([]);

    const items = await getCartUpsellProducts();
    expect(items).toHaveLength(0);

    findManySpy.mockRestore();
  });

  it("excludeVariantIds parametresi ile çağrıldığında Prisma sorgusuna variants.some koşulunu ekler", async () => {
    let capturedArgs: unknown = null;
    const findManySpy = vi
      .spyOn(db.product, "findMany")
      // @ts-expect-error Mocking db response
      .mockImplementationOnce((args) => {
        capturedArgs = args;
        return Promise.resolve([]);
      })
      .mockResolvedValueOnce([]);

    await getCartUpsellProducts({
      excludeVariantIds: ["var-excluded-1", "var-excluded-2"],
    });

    expect(capturedArgs).toBeDefined();
    // @ts-expect-error Checking capturedArgs
    expect(capturedArgs?.where?.variants?.some).toEqual({
      isActive: true,
      id: { notIn: ["var-excluded-1", "var-excluded-2"] },
    });

    findManySpy.mockRestore();
  });
});
