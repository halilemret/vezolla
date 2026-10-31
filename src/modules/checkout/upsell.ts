import "server-only";
import { db } from "@/lib/db";

export interface CartUpsellItem {
  id: string;
  variantId: string;
  title: string;
  priceMinor: number;
  compareAtPriceMinor: number | null;
  imageUrl: string | null;
  slug: string;
}

/**
 * Sepete tamamlayıcı olarak 100-300 TL (10.000-30.000 kuruş) bandındaki
 * 2-4 aksesuar / tamamlayıcı ürünü getirir. Sepetteki ürünler filtrelenir.
 */
export interface GetCartUpsellOptions {
  excludeVariantIds?: string[];
  excludeProductIds?: string[];
  cartCategoryIds?: string[];
  visitorId?: string | null;
  customerId?: string | null;
  limit?: number;
}

/**
 * Sepetteki "Sepetinizi Tamamlayın" önerileri:
 * 1. Müşterinin / ziyaretçinin daha önce gezdiği ürünler
 * 2. İndirimdeki fırsat ürünleri (compareAtPrice > price)
 * 3. Sepetteki ürünlerle aynı/üst kategorideki ürünler
 * 4. 100-300 TL aralığındaki sepet tamamlayıcı aksesuarlar
 */
export async function getCartUpsellProducts(
  options?: GetCartUpsellOptions
): Promise<CartUpsellItem[]> {
  const excludeVariantIds = options?.excludeVariantIds ?? [];
  const excludeProductIds = options?.excludeProductIds ?? [];
  const limit = options?.limit ?? 4;

  const variantCondition =
    excludeVariantIds.length > 0
      ? {
          variants: {
            some: {
              isActive: true,
              id: { notIn: excludeVariantIds },
            },
          },
        }
      : {};

  const productExcludeCondition =
    excludeProductIds.length > 0
      ? { id: { notIn: excludeProductIds } }
      : {};

  // 1. Ziyaretçinin daha önce gezdiği ürünler
  const visitedProductIds: string[] = [];
  if (options?.visitorId) {
    try {
      const views = await db.visitorEvent.findMany({
        where: {
          visitorId: options.visitorId,
          type: { in: ["view_product", "product_view"] },
          productId: { not: null },
        },
        take: 8,
        orderBy: { createdAt: "desc" },
        select: { productId: true },
      });
      for (const v of views) {
        if (
          v.productId &&
          !visitedProductIds.includes(v.productId) &&
          !excludeProductIds.includes(v.productId)
        ) {
          visitedProductIds.push(v.productId);
        }
      }
    } catch {
      // Hata durumunda sessizce geç
    }
  }

  // 2. Çoklu kriterli akıllı arama
  // a) Daha önce ziyaret edilmiş veya aynı kategorideki veya indirimli ürünler
  const orFilters = [];

  if (visitedProductIds.length > 0) {
    orFilters.push({ id: { in: visitedProductIds } });
  }

  if (options?.cartCategoryIds && options.cartCategoryIds.length > 0) {
    orFilters.push({
      categories: {
        some: {
          categoryId: { in: options.cartCategoryIds },
        },
      },
    });
  }

  // İndirimli ürünler
  orFilters.push({
    variants: {
      some: {
        isActive: true,
        compareAtPrice: { not: null },
      },
    },
  });

  // 100 - 300 TL tamamlayıcı bandı
  orFilters.push({
    minPrice: { gte: 10000, lte: 30000 },
  });

  let products = await db.product.findMany({
    where: {
      status: "ACTIVE",
      deletedAt: null,
      totalStock: { gt: 0 },
      ...productExcludeCondition,
      ...variantCondition,
      ...(orFilters.length > 0 ? { OR: orFilters } : {}),
    },
    take: limit * 2,
    orderBy: [{ totalStock: "desc" }, { createdAt: "desc" }],
    include: {
      variants: {
        where: {
          isActive: true,
          ...(excludeVariantIds.length > 0 ? { id: { notIn: excludeVariantIds } } : {}),
        },
        take: 1,
      },
      images: {
        take: 1,
        orderBy: { position: "asc" },
        select: { url: true },
      },
    },
  });

  // Eğer 100-300 TL bandında yeterli ürün yoksa (örn: test ortamı), esnek aralık
  if (products.length < 2) {
    products = await db.product.findMany({
      where: {
        status: "ACTIVE",
        deletedAt: null,
        totalStock: { gt: 0 },
        ...variantCondition,
      },
      take: limit * 2,
      orderBy: { minPrice: "asc" },
      include: {
        variants: {
          where: {
            isActive: true,
            ...(excludeVariantIds.length > 0 ? { id: { notIn: excludeVariantIds } } : {}),
          },
          take: 1,
        },
        images: {
          take: 1,
          orderBy: { position: "asc" },
          select: { url: true },
        },
      },
    });
  }

  const items: CartUpsellItem[] = [];

  for (const p of products) {
    const v = p.variants[0];
    if (!v) continue;

    items.push({
      id: p.id,
      variantId: v.id,
      title: p.title,
      priceMinor: v.price,
      compareAtPriceMinor: v.compareAtPrice,
      imageUrl: p.images[0]?.url ?? null,
      slug: p.slug,
    });

    if (items.length >= limit) break;
  }

  return items;
}
