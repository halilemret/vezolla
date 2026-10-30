import { db } from "@/lib/db";
import { addCartItem } from "@/modules/checkout/cart";

export interface WishlistItemComputed {
  id: string;
  productId: string;
  collectionId: string | null;
  collectionName: string | null;
  priceWhenAdded: number | null;
  currentPrice: number;
  compareAtPrice: number | null;
  hasPriceDropped: boolean;
  priceDropMinor: number;
  priceDropPercentage: number;
  isOutOfStock: boolean;
  isLowStock: boolean;
  product: {
    id: string;
    slug: string;
    title: string;
    subtitle: string | null;
    totalStock: number;
    brandName: string | null;
    imageUrl: string | null;
    defaultVariantId: string | null;
  };
  createdAt: Date;
}

export interface WishlistCollectionSummary {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  itemCount: number;
  previewImages: string[];
  createdAt: Date;
}

/**
 * Müşterinin tüm favori ürünlerini, eklenme tarihindeki fiyatı ve
 * güncel fiyat farkını hesaplayarak döner.
 */
export async function getCustomerWishlistDetails(
  customerId: string,
  collectionIdFilter?: string | null
): Promise<{
  items: WishlistItemComputed[];
  totalCount: number;
  priceDroppedCount: number;
  outOfStockCount: number;
}> {
  const whereClause: { customerId: string; collectionId?: string | null } = {
    customerId,
  };

  if (collectionIdFilter !== undefined) {
    whereClause.collectionId = collectionIdFilter;
  }

  const items = await db.wishlistItem.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
    include: {
      collection: {
        select: {
          id: true,
          name: true,
        },
      },
      product: {
        include: {
          brand: { select: { name: true } },
          images: { orderBy: { position: "asc" }, take: 2 },
          variants: {
            where: { isActive: true },
            orderBy: { position: "asc" },
            take: 1,
          },
        },
      },
    },
  });

  let priceDroppedCount = 0;
  let outOfStockCount = 0;

  const computedItems: WishlistItemComputed[] = items.map((w) => {
    const firstVariant = w.product.variants[0];
    const currentPrice = firstVariant?.price ?? w.product.minPrice ?? 0;
    const compareAtPrice = firstVariant?.compareAtPrice ?? null;
    const priceWhenAdded = w.priceWhenAdded ?? currentPrice;

    const hasPriceDropped =
      priceWhenAdded > 0 && currentPrice < priceWhenAdded;
    const priceDropMinor = hasPriceDropped ? priceWhenAdded - currentPrice : 0;
    const priceDropPercentage =
      hasPriceDropped && priceWhenAdded > 0
        ? Math.round((priceDropMinor / priceWhenAdded) * 100)
        : 0;

    const isOutOfStock = w.product.totalStock <= 0;
    const isLowStock = !isOutOfStock && w.product.totalStock <= 3;

    if (hasPriceDropped) priceDroppedCount++;
    if (isOutOfStock) outOfStockCount++;

    return {
      id: w.id,
      productId: w.productId,
      collectionId: w.collectionId,
      collectionName: w.collection?.name ?? null,
      priceWhenAdded: w.priceWhenAdded,
      currentPrice,
      compareAtPrice,
      hasPriceDropped,
      priceDropMinor,
      priceDropPercentage,
      isOutOfStock,
      isLowStock,
      product: {
        id: w.product.id,
        slug: w.product.slug,
        title: w.product.title,
        subtitle: w.product.subtitle,
        totalStock: w.product.totalStock,
        brandName: w.product.brand?.name ?? null,
        imageUrl: w.product.images[0]?.url ?? null,
        defaultVariantId: firstVariant?.id ?? null,
      },
      createdAt: w.createdAt,
    };
  });

  return {
    items: computedItems,
    totalCount: computedItems.length,
    priceDroppedCount,
    outOfStockCount,
  };
}

/**
 * Müşterinin özel koleksiyonlarını ürün sayıları ve önizleme görselleriyle listeler.
 */
export async function getCustomerCollections(
  customerId: string
): Promise<WishlistCollectionSummary[]> {
  if (!db.wishlistCollection?.findMany) {
    return [];
  }

  const collections = await db.wishlistCollection.findMany({
    where: { customerId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    include: {
      items: {
        take: 4,
        include: {
          product: {
            include: {
              images: { orderBy: { position: "asc" }, take: 1 },
            },
          },
        },
      },
      _count: {
        select: { items: true },
      },
    },
  });

  return collections.map((col) => {
    const previewImages = col.items
      .map((it) => it.product.images[0]?.url)
      .filter((url): url is string => Boolean(url));

    return {
      id: col.id,
      name: col.name,
      description: col.description,
      isDefault: col.isDefault,
      itemCount: col._count.items,
      previewImages,
      createdAt: col.createdAt,
    };
  });
}

/**
 * Ürünü favorilere ekler veya çıkarır.
 * Eklenme anında ürünün güncel fiyatını (priceWhenAdded) kaydeder.
 */
export async function toggleCustomerWishlist(params: {
  customerId: string;
  productId: string;
  collectionId?: string | null;
}): Promise<{
  added: boolean;
  wishlistCount: number;
  item?: WishlistItemComputed;
}> {
  const { customerId, productId, collectionId } = params;

  const existing = await db.wishlistItem.findUnique({
    where: {
      customerId_productId: { customerId, productId },
    },
  });

  if (existing) {
    await db.wishlistItem.delete({
      where: { id: existing.id },
    });
    const wishlistCount = await db.wishlistItem.count({
      where: { customerId },
    });
    return { added: false, wishlistCount };
  }

  // Ürünün anlık fiyatını al
  const product = await db.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      minPrice: true,
      variants: {
        where: { isActive: true },
        orderBy: { position: "asc" },
        take: 1,
        select: { price: true },
      },
    },
  });

  if (!product) {
    throw new Error("Ürün bulunamadı.");
  }

  const effectivePrice = product.variants[0]?.price ?? product.minPrice ?? 0;

  await db.wishlistItem.create({
    data: {
      customerId,
      productId,
      collectionId: collectionId || null,
      priceWhenAdded: effectivePrice,
    },
  });

  const wishlistCount = await db.wishlistItem.count({
    where: { customerId },
  });

  return { added: true, wishlistCount };
}

/**
 * Favori ürünün ait olduğu koleksiyonu değiştirir.
 */
export async function moveWishlistItemCollection(params: {
  customerId: string;
  wishlistItemId: string;
  collectionId: string | null;
}): Promise<void> {
  const { customerId, wishlistItemId, collectionId } = params;

  // Koleksiyon ID verilmişse, müşteriye ait olup olmadığını doğrula
  if (collectionId) {
    const col = await db.wishlistCollection.findFirst({
      where: { id: collectionId, customerId },
    });
    if (!col) {
      throw new Error("Hedef koleksiyon bulunamadı.");
    }
  }

  await db.wishlistItem.updateMany({
    where: {
      id: wishlistItemId,
      customerId,
    },
    data: {
      collectionId,
    },
  });
}

/**
 * Yeni koleksiyon oluşturur (örn: "Yaz Kombinleri", "Ev Hediyeleri").
 */
export async function createCustomerCollection(params: {
  customerId: string;
  name: string;
  description?: string | null;
}): Promise<WishlistCollectionSummary> {
  const { customerId, name, description } = params;
  const cleanName = name.trim();
  if (!cleanName) {
    throw new Error("Koleksiyon adı boş bırakılamaz.");
  }

  const col = await db.wishlistCollection.create({
    data: {
      customerId,
      name: cleanName,
      description: description?.trim() || null,
    },
  });

  return {
    id: col.id,
    name: col.name,
    description: col.description,
    isDefault: false,
    itemCount: 0,
    previewImages: [],
    createdAt: col.createdAt,
  };
}

/**
 * Koleksiyonu siler (İçindeki ürünler koleksiyonsuz olarak favorilerde kalır).
 */
export async function deleteCustomerCollection(params: {
  customerId: string;
  collectionId: string;
}): Promise<void> {
  const { customerId, collectionId } = params;
  await db.wishlistCollection.deleteMany({
    where: {
      id: collectionId,
      customerId,
    },
  });
}

/**
 * Seçilen favori ürünleri topluca sepete aktarır.
 */
export async function moveWishlistItemsToCartServer(params: {
  customerId: string;
  wishlistItemIds: string[];
}): Promise<{ addedCount: number; errors: string[] }> {
  const { customerId, wishlistItemIds } = params;

  const items = await db.wishlistItem.findMany({
    where: {
      id: { in: wishlistItemIds },
      customerId,
    },
    include: {
      product: {
        include: {
          variants: {
            where: { isActive: true },
            orderBy: { position: "asc" },
            take: 1,
          },
        },
      },
    },
  });

  let addedCount = 0;
  const errors: string[] = [];

  for (const item of items) {
    const defaultVariant = item.product.variants[0];
    if (!defaultVariant) {
      errors.push(`${item.product.title}: Uygun varyant bulunamadı.`);
      continue;
    }

    try {
      const res = await addCartItem(defaultVariant.id, 1);
      if (res.ok) {
        addedCount++;
      } else {
        errors.push(`${item.product.title}: ${res.error ?? "Sepete eklenemedi."}`);
      }
    } catch (e) {
      errors.push(
        `${item.product.title}: ${e instanceof Error ? e.message : "Hata oluştu."}`
      );
    }
  }

  return { addedCount, errors };
}

/**
 * Misafir kullanıcının tarayıcısında (localStorage) biriktirdiği
 * favorileri giriş anında veritabanı hesabıyla birleştirir.
 */
export async function syncGuestWishlistToAccount(params: {
  customerId: string;
  productIds: string[];
}): Promise<number> {
  const { customerId, productIds } = params;
  if (!productIds || productIds.length === 0) return 0;

  const validProducts = await db.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      minPrice: true,
      variants: {
        where: { isActive: true },
        orderBy: { position: "asc" },
        take: 1,
        select: { price: true },
      },
    },
  });

  let syncedCount = 0;
  for (const prod of validProducts) {
    const existing = await db.wishlistItem.findUnique({
      where: {
        customerId_productId: { customerId, productId: prod.id },
      },
    });

    if (!existing) {
      const effectivePrice = prod.variants[0]?.price ?? prod.minPrice ?? 0;
      await db.wishlistItem.create({
        data: {
          customerId,
          productId: prod.id,
          priceWhenAdded: effectivePrice,
        },
      });
      syncedCount++;
    }
  }

  return syncedCount;
}
