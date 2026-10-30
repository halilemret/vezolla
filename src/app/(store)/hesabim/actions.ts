"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireCustomer } from "@/lib/auth/session";
import {
  saveCustomerAddressAction,
  deleteCustomerAddressAction,
  anonymizeCustomerKvkkAction,
} from "@/modules/customers/actions";
import { createReturnRequestAction } from "@/modules/orders/actions";
import { addCartItem } from "@/modules/checkout/cart";
import {
  createCustomerCollection,
  deleteCustomerCollection,
  moveWishlistItemCollection,
  moveWishlistItemsToCartServer,
} from "@/modules/wishlist/service";

export async function updateMyProfileStoreAction(
  formData: FormData
): Promise<void> {
  const customer = await requireCustomer();
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const acceptsMarketing = formData.get("acceptsMarketing") === "on";

  if (!firstName || !lastName) return;

  await db.customer.update({
    where: { id: customer.id },
    data: {
      firstName,
      lastName,
      phone,
      acceptsMarketing,
      marketingConsentAt: acceptsMarketing ? new Date() : null,
    },
  });

  revalidatePath("/hesabim");
}

export async function saveAddressStoreFormAction(
  formData: FormData
): Promise<void> {
  await saveCustomerAddressAction(formData);
  revalidatePath("/hesabim");
}

export async function deleteAddressStoreFormAction(
  formData: FormData
): Promise<void> {
  const addressId = String(formData.get("addressId") ?? "").trim();
  if (!addressId) return;
  await deleteCustomerAddressAction(addressId);
  revalidatePath("/hesabim");
}

export async function removeWishlistItemStoreFormAction(
  formData: FormData
): Promise<void> {
  const customer = await requireCustomer();
  const wishlistItemId = String(formData.get("wishlistItemId") ?? "").trim();
  if (!wishlistItemId) return;

  await db.wishlistItem.deleteMany({
    where: {
      id: wishlistItemId,
      customerId: customer.id,
    },
  });

  revalidatePath("/hesabim");
}

export async function submitReturnStoreFormAction(
  formData: FormData
): Promise<void> {
  await createReturnRequestAction(formData);
  revalidatePath("/hesabim");
}

export async function anonymizeMyAccountStoreFormAction(
  formData: FormData
): Promise<void> {
  const confirmText = String(formData.get("confirmText") ?? "").trim();
  if (confirmText !== "ONAYLIYORUM") return;
  await anonymizeCustomerKvkkAction();
  redirect("/");
}

// Koleksiyon İşlemleri
export async function createCollectionStoreFormAction(
  formData: FormData
): Promise<void> {
  const customer = await requireCustomer();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!name) return;

  await createCustomerCollection({
    customerId: customer.id,
    name,
    description: description || null,
  });

  revalidatePath("/hesabim");
}

export async function deleteCollectionStoreFormAction(
  formData: FormData
): Promise<void> {
  const customer = await requireCustomer();
  const collectionId = String(formData.get("collectionId") ?? "").trim();
  if (!collectionId) return;

  await deleteCustomerCollection({
    customerId: customer.id,
    collectionId,
  });

  revalidatePath("/hesabim");
}

export async function moveItemCollectionStoreFormAction(
  formData: FormData
): Promise<void> {
  const customer = await requireCustomer();
  const wishlistItemId = String(formData.get("wishlistItemId") ?? "").trim();
  const collectionIdRaw = String(formData.get("collectionId") ?? "").trim();
  const collectionId = collectionIdRaw === "none" || !collectionIdRaw ? null : collectionIdRaw;

  if (!wishlistItemId) return;

  await moveWishlistItemCollection({
    customerId: customer.id,
    wishlistItemId,
    collectionId,
  });

  revalidatePath("/hesabim");
}

// Tek Tıkla Sepete Ekleme (Server-side Mutation)
export async function addWishlistItemToCartStoreAction(
  variantId: string
): Promise<{ ok: boolean; error?: string }> {
  await requireCustomer();
  const res = await addCartItem(variantId, 1);
  revalidatePath("/sepet");
  revalidatePath("/hesabim");
  return res;
}

// Toplu Sepete Ekleme (Fiyatı Düşenler veya Tüm Favoriler)
export async function addMultipleWishlistItemsToCartStoreAction(
  wishlistItemIds: string[]
): Promise<{ ok: boolean; addedCount: number; message: string }> {
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
    message: `${res.addedCount} ürün sepetinize eklendi!`,
  };
}
