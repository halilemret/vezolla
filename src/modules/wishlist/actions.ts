"use server";

import { revalidatePath } from "next/cache";
import { getCurrentCustomer, requireCustomer } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  toggleCustomerWishlist,
  createCustomerCollection,
  deleteCustomerCollection,
  moveWishlistItemCollection,
  moveWishlistItemsToCartServer,
  syncGuestWishlistToAccount,
} from "./service";

export interface ToggleWishlistResult {
  ok: boolean;
  added: boolean;
  isWishlisted: boolean;
  wishlistCount: number;
  requiresAuth?: boolean;
  message: string;
}

/**
 * Ürünü favorilere ekler veya çıkarır.
 */
export async function toggleWishlistAction(
  productId: string,
  collectionId?: string | null
): Promise<ToggleWishlistResult> {
  const customer = await getCurrentCustomer();
  if (!customer) {
    // Giriş yapmamış müşteri için bildirim
    return {
      ok: true,
      added: true,
      isWishlisted: true,
      wishlistCount: 1,
      requiresAuth: true,
      message: "Favorilere eklendi! (Giriş yaparak tüm cihazlarınızda eşitleyebilirsiniz)",
    };
  }

  try {
    const res = await toggleCustomerWishlist({
      customerId: customer.id,
      productId,
      collectionId,
    });

    revalidatePath("/hesabim");

    return {
      ok: true,
      added: res.added,
      isWishlisted: res.added,
      wishlistCount: res.wishlistCount,
      message: res.added
        ? "Ürün favorilerinize eklendi! ❤️"
        : "Ürün favorilerinizden çıkarıldı.",
    };
  } catch (error) {
    return {
      ok: false,
      added: false,
      isWishlisted: false,
      wishlistCount: 0,
      message: error instanceof Error ? error.message : "İşlem tamamlanamadı.",
    };
  }
}

/**
 * Favori öğeyi siler.
 */
export async function removeWishlistItemAction(
  wishlistItemId: string
): Promise<{ ok: boolean; message: string }> {
  const customer = await requireCustomer();
  await db.wishlistItem.deleteMany({
    where: {
      id: wishlistItemId,
      customerId: customer.id,
    },
  });
  revalidatePath("/hesabim");
  return { ok: true, message: "Ürün favorilerden kaldırıldı." };
}

/**
 * Favori öğenin koleksiyonunu günceller.
 */
export async function moveToCollectionAction(
  wishlistItemId: string,
  collectionId: string | null
): Promise<{ ok: boolean; message: string }> {
  const customer = await requireCustomer();
  try {
    await moveWishlistItemCollection({
      customerId: customer.id,
      wishlistItemId,
      collectionId,
    });
    revalidatePath("/hesabim");
    return { ok: true, message: "Koleksiyon güncellendi." };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Taşıma işlemi başarısız.",
    };
  }
}

/**
 * Yeni koleksiyon oluşturur.
 */
export async function createCollectionAction(
  name: string,
  description?: string | null
): Promise<{ ok: boolean; message: string; collectionId?: string }> {
  const customer = await requireCustomer();
  try {
    const col = await createCustomerCollection({
      customerId: customer.id,
      name,
      description,
    });
    revalidatePath("/hesabim");
    return {
      ok: true,
      message: `"${col.name}" koleksiyonu oluşturuldu!`,
      collectionId: col.id,
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Koleksiyon oluşturulamadı.",
    };
  }
}

/**
 * Koleksiyonu siler.
 */
export async function deleteCollectionAction(
  collectionId: string
): Promise<{ ok: boolean; message: string }> {
  const customer = await requireCustomer();
  await deleteCustomerCollection({
    customerId: customer.id,
    collectionId,
  });
  revalidatePath("/hesabim");
  return { ok: true, message: "Koleksiyon silindi." };
}

/**
 * Seçilen favori ürünleri toplu sepete taşır.
 */
export async function moveWishlistItemsToCartAction(
  wishlistItemIds: string[]
): Promise<{ ok: boolean; addedCount: number; errors: string[]; message: string }> {
  const customer = await requireCustomer();
  const res = await moveWishlistItemsToCartServer({
    customerId: customer.id,
    wishlistItemIds,
  });
  revalidatePath("/sepet");
  revalidatePath("/hesabim");

  return {
    ok: res.addedCount > 0,
    addedCount: res.addedCount,
    errors: res.errors,
    message:
      res.addedCount > 0
        ? `${res.addedCount} ürün başarıyla sepete eklendi!`
        : "Ürünler sepete eklenemedi.",
  };
}

/**
 * Giriş yapmış kullanıcının favori ürün ID'lerini ve koleksiyonlarını döner.
 */
export async function getCustomerWishlistStateAction(): Promise<{
  productIds: string[];
  collections: Array<{ id: string; name: string }>;
}> {
  const customer = await getCurrentCustomer();
  if (!customer) {
    return { productIds: [], collections: [] };
  }

  const [items, collections] = await Promise.all([
    db.wishlistItem?.findMany
      ? db.wishlistItem.findMany({
          where: { customerId: customer.id },
          select: { productId: true },
        })
      : Promise.resolve([]),
    db.wishlistCollection?.findMany
      ? db.wishlistCollection.findMany({
          where: { customerId: customer.id },
          select: { id: true, name: true },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
  ]);

  return {
    productIds: items.map((i) => i.productId),
    collections,
  };
}

/**
 * Misafir favorilerini kullanıcı hesabına eşitler.
 */
export async function syncGuestWishlistAction(
  productIds: string[]
): Promise<{ ok: boolean; syncedCount: number }> {
  const customer = await getCurrentCustomer();
  if (!customer) return { ok: false, syncedCount: 0 };

  const syncedCount = await syncGuestWishlistToAccount({
    customerId: customer.id,
    productIds,
  });

  revalidatePath("/hesabim");
  return { ok: true, syncedCount };
}
