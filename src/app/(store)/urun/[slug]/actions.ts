"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentCustomer } from "@/lib/auth/session";
import { createBackInStockRequest } from "@/modules/inventory/service";
import { submitProductReview } from "@/modules/content/service";
import { toggleCustomerWishlist } from "@/modules/wishlist/service";

export async function requestBackInStockStoreAction(
  variantId: string,
  email: string
): Promise<{ ok: boolean; message: string }> {
  const cleanEmail = email.trim().toLowerCase();
  if (!variantId || !cleanEmail || !cleanEmail.includes("@")) {
    return {
      ok: false,
      message: "Lütfen geçerli bir e-posta adresi giriniz.",
    };
  }

  try {
    await createBackInStockRequest(variantId, cleanEmail);
    return {
      ok: true,
      message: "Talebiniz alındı. Ürün stoğa girdiğinde e-posta ile bilgilendirileceksiniz.",
    };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error
          ? err.message
          : "Talep kaydedilirken bir sorun oluştu.",
    };
  }
}

export async function toggleWishlistStoreAction(
  productId: string,
  variantId?: string | null
): Promise<{ ok: boolean; added: boolean; requiresAuth?: boolean; message: string }> {
  const customer = await getCurrentCustomer();
  if (!customer) {
    return {
      ok: true,
      added: true,
      requiresAuth: true,
      message: "Favori tercihiniz tarayıcınıza kaydedildi.",
    };
  }

  try {
    const res = await toggleCustomerWishlist({
      customerId: customer.id,
      productId,
    });
    revalidatePath("/hesabim");
    return {
      ok: true,
      added: res.added,
      message: res.added
        ? "Ürün favorilerinize eklendi! ❤️"
        : "Ürün favorilerinizden çıkarıldı.",
    };
  } catch (err) {
    return {
      ok: false,
      added: false,
      message: err instanceof Error ? err.message : "İşlem tamamlanamadı.",
    };
  }
}

export async function submitProductReviewStoreAction(
  formData: FormData
): Promise<{ ok: boolean; message: string }> {
  const productId = String(formData.get("productId") ?? "").trim();
  const productSlug = String(formData.get("productSlug") ?? "").trim();
  const authorName = String(formData.get("authorName") ?? "").trim();
  const ratingRaw = Number.parseInt(String(formData.get("rating") ?? "5"), 10);
  const title = String(formData.get("title") ?? "").trim() || undefined;
  const body = String(formData.get("body") ?? "").trim();

  const heightRaw = Number.parseInt(String(formData.get("heightCm") ?? ""), 10);
  const weightRaw = Number.parseInt(String(formData.get("weightKg") ?? ""), 10);
  const sizePurchased = String(formData.get("sizePurchased") ?? "").trim() || undefined;
  const fitRating = String(formData.get("fitRating") ?? "").trim() || undefined;
  const rawImageVal = String(formData.get("imageUrl") ?? "").trim();
  const images = rawImageVal
    ? rawImageVal
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  if (!productId || !authorName || !body) {
    return {
      ok: false,
      message: "Lütfen adınızı ve yorum metninizi eksiksiz doldurunuz.",
    };
  }

  const customer = await getCurrentCustomer();

  try {
    await submitProductReview({
      productId,
      customerId: customer?.id ?? null,
      authorName,
      rating: Number.isFinite(ratingRaw) ? Math.min(5, Math.max(1, ratingRaw)) : 5,
      title,
      body,
      heightCm: Number.isFinite(heightRaw) ? heightRaw : null,
      weightKg: Number.isFinite(weightRaw) ? weightRaw : null,
      sizePurchased,
      fitRating,
      images,
    });

    if (productSlug) {
      revalidatePath(`/urun/${productSlug}`);
    }
    return {
      ok: true,
      message: "Yorumunuz alındı. Editör onayından sonra ürün sayfasında yayınlanacaktır.",
    };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error
          ? err.message
          : "Yorum gönderilirken bir hata oluştu.",
    };
  }
}
