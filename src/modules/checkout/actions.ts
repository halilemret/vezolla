"use server";

import { revalidatePath } from "next/cache";
import {
  addCartItem,
  applyPromoCode,
  computeCartSummary,
  removeCartItem,
  removePromoCode,
  restoreCartFromRecoveryToken,
  updateCartCheckoutState,
  updateCartItemQuantity,
  type CartSummary,
  type ComputeCartSummaryOptions,
} from "@/modules/checkout/cart";
import {
  buildCartContractPreview,
  placeOrder,
  type PlaceOrderResult,
} from "@/modules/checkout/service";
import type { CheckoutAddress, PlaceOrderInput } from "@/modules/checkout/schemas";
import { getAbandonedCartSettings } from "@/lib/settings/service";
import { ensureRecoveryPromotion } from "@/modules/analytics/abandoned-cart";
import { resolveRecoveryCode } from "@/modules/analytics/recovery-offer";

export async function getCartSummaryAction(
  options?: ComputeCartSummaryOptions
): Promise<CartSummary> {
  return computeCartSummary(options);
}

export async function addCartItemAction(
  variantIdOrForm: string | FormData,
  quantityArg = 1
): Promise<{ ok: boolean; error?: string; summary?: CartSummary }> {
  let variantId = "";
  let quantity = quantityArg;

  if (typeof variantIdOrForm === "string") {
    variantId = variantIdOrForm.trim();
  } else {
    variantId = String(variantIdOrForm.get("variantId") ?? "").trim();
    const qRaw = Number.parseInt(String(variantIdOrForm.get("quantity") ?? "1"), 10);
    if (Number.isFinite(qRaw) && qRaw > 0) {
      quantity = qRaw;
    }
  }

  if (!variantId) {
    return { ok: false, error: "Varyant seçilmedi." };
  }

  const res = await addCartItem(variantId, quantity);
  revalidatePath("/sepet");
  revalidatePath("/odeme");
  return res;
}

export const addToCartAction = addCartItemAction;

export async function updateCartItemQuantityAction(
  cartItemIdOrVariantId: string,
  quantity: number
): Promise<{ ok: boolean; error?: string; summary?: CartSummary }> {
  const res = await updateCartItemQuantity(cartItemIdOrVariantId, quantity);
  revalidatePath("/sepet");
  revalidatePath("/odeme");
  return res;
}

export const updateCartItemAction = updateCartItemQuantityAction;

export async function removeCartItemAction(
  cartItemIdOrVariantId: string
): Promise<{ ok: boolean; error?: string; summary?: CartSummary }> {
  const res = await removeCartItem(cartItemIdOrVariantId);
  revalidatePath("/sepet");
  revalidatePath("/odeme");
  return res;
}

export const removeFromCartAction = removeCartItemAction;

export async function applyPromoCodeAction(
  codeOrForm: string | FormData
): Promise<{ ok: boolean; error?: string; summary?: CartSummary }> {
  const code =
    typeof codeOrForm === "string"
      ? codeOrForm
      : String(codeOrForm.get("code") ?? "");
  const res = await applyPromoCode(code);
  revalidatePath("/sepet");
  revalidatePath("/odeme");
  return res;
}

export async function removePromoCodeAction(
  code: string
): Promise<{ ok: boolean; summary?: CartSummary }> {
  const res = await removePromoCode(code);
  revalidatePath("/sepet");
  revalidatePath("/odeme");
  return res;
}

/**
 * Çıkış niyeti pop-up'ında kupon talebi: kupon kaydını panel oranıyla senkronlar
 * ve sunucu tarafında aktif sepete uygular. Tutar hesabı yalnızca sunucuda yapılır.
 */
export async function claimExitIntentOfferAction(): Promise<{
  ok: boolean;
  error?: string;
  code?: string;
  percent?: number | null;
}> {
  const settings = await getAbandonedCartSettings();
  if (!settings.exitIntentEnabled) {
    return { ok: false, error: "Bu teklif şu anda geçerli değil." };
  }

  const current = await computeCartSummary();
  if (current.itemCount === 0) {
    return { ok: false, error: "Sepetinizde ürün bulunmuyor." };
  }

  const promotion = await ensureRecoveryPromotion(
    resolveRecoveryCode(settings),
    settings.discountPercent
  );
  const res = await applyPromoCode(promotion.code);
  revalidatePath("/sepet");
  revalidatePath("/odeme");

  if (!res.ok) {
    return { ok: false, error: res.error ?? "Kupon uygulanamadı." };
  }
  return { ok: true, code: promotion.code, percent: promotion.percent };
}


export async function previewOrderContractsAction(params: {
  email?: string;
  phone?: string;
  shippingAddress?: Partial<CheckoutAddress>;
  billingAddress?: Partial<CheckoutAddress>;
  shippingMethodId?: string;
  paymentMethod?: string;
}) {
  return buildCartContractPreview(params);
}

export async function placeOrderAction(
  inputOrForm: PlaceOrderInput | FormData
): Promise<PlaceOrderResult> {
  let payload: PlaceOrderInput;

  if (inputOrForm instanceof FormData) {
    const shippingAddress: CheckoutAddress = {
      title: String(inputOrForm.get("title") ?? "Teslimat Adresi").trim(),
      firstName: String(inputOrForm.get("firstName") ?? "").trim(),
      lastName: String(inputOrForm.get("lastName") ?? "").trim(),
      phone: String(inputOrForm.get("phone") ?? "").trim(),
      city: String(inputOrForm.get("city") ?? "").trim(),
      district: String(inputOrForm.get("district") ?? "").trim(),
      neighborhood: String(inputOrForm.get("neighborhood") ?? "").trim() || null,
      line1: String(inputOrForm.get("line1") ?? "").trim(),
      postalCode: String(inputOrForm.get("postalCode") ?? "").trim() || null,
      invoiceType:
        String(inputOrForm.get("invoiceType") ?? "INDIVIDUAL") === "CORPORATE"
          ? "CORPORATE"
          : "INDIVIDUAL",
      tckn: String(inputOrForm.get("tckn") ?? "").trim() || null,
      companyName: String(inputOrForm.get("companyName") ?? "").trim() || null,
      taxOffice: String(inputOrForm.get("taxOffice") ?? "").trim() || null,
      taxNumber: String(inputOrForm.get("taxNumber") ?? "").trim() || null,
    };

    const billingSame = inputOrForm.get("billingSameAsShipping") !== "false";

    payload = {
      email: String(inputOrForm.get("email") ?? "").trim(),
      phone: shippingAddress.phone,
      shippingAddress,
      billingSameAsShipping: billingSame,
      shippingMethodId: String(inputOrForm.get("shippingMethodId") ?? "").trim(),
      paymentMethod: (String(inputOrForm.get("paymentMethod") ?? "iyzico") as
        | "iyzico"
        | "bank_transfer"
        | "cod"
        | "credit_card"),
      customerNote: String(inputOrForm.get("customerNote") ?? "").trim() || null,
      acceptPreInformation: inputOrForm.get("acceptPreInformation") === "on" || inputOrForm.get("acceptPreInformation") === "true" ? true : (false as unknown as true),
      acceptDistanceSales: inputOrForm.get("acceptDistanceSales") === "on" || inputOrForm.get("acceptDistanceSales") === "true" ? true : (false as unknown as true),
    };
  } else {
    payload = inputOrForm;
  }

  const res = await placeOrder(payload);
  if (res.ok) {
    revalidatePath("/sepet");
    revalidatePath("/odeme");
    revalidatePath("/hesabim");
    revalidatePath("/admin/siparisler");
  }
  return res;
}

export async function saveCheckoutStepAction(input: {
  email?: string | null;
  phone?: string | null;
  lastStep?: "cart" | "address" | "shipping" | "payment" | "contracts";
  shippingAddress?: CheckoutAddress | null;
  shippingMethodId?: string | null;
  paymentMethod?: string | null;
  note?: string | null;
}) {
  return updateCartCheckoutState(input);
}

export async function restoreAbandonedCartAction(token: string, promoCode?: string) {
  const res = await restoreCartFromRecoveryToken(token, promoCode);
  if (res.ok) {
    revalidatePath("/sepet");
    revalidatePath("/odeme");
  }
  return res;
}
