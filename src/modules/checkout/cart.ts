import "server-only";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import {
  CART_COOKIE,
  VISITOR_COOKIE,
  getCurrentCustomer,
} from "@/lib/auth/session";
import { extractIncludedVat } from "@/lib/money";
import { getPaymentSettings } from "@/lib/settings/service";
import {
  evaluatePromotions,
  type AppliedPromotionSummary,
  type PromoCandidate,
  type PromoLineInput,
  type RejectedPromoCode,
} from "@/modules/promotions/engine";
import {
  getAvailableShippingMethods,
  type ShippingMethodQuote,
} from "@/modules/shipping/service";
import {
  getAvailablePaymentOptions,
  normalizePaymentMethodCode,
  type AvailablePaymentOption,
} from "@/modules/payments/registry";
import type { CheckoutAddress } from "@/modules/checkout/schemas";

export interface VariantPriceCandidate {
  price: number;
  priceList: {
    id: string;
    isActive: boolean;
    customerGroupId: string | null;
    startsAt: Date | null;
    endsAt: Date | null;
    priority: number;
  };
}

/**
 * Müşteri grubuna özel veya genel aktif PriceList fiyatlarını değerlendirerek
 * varyantın geçerli birim fiyatını (kuruş) döndürür.
 */
export function resolveEffectiveVariantPrice(
  basePriceMinor: number,
  priceListEntries: ReadonlyArray<VariantPriceCandidate>,
  customerGroupId: string | null | undefined,
  now: Date = new Date()
): number {
  if (!priceListEntries || priceListEntries.length === 0) {
    return basePriceMinor;
  }

  const eligible = priceListEntries.filter((entry) => {
    const pl = entry.priceList;
    if (!pl.isActive) return false;
    if (pl.startsAt && now.getTime() < pl.startsAt.getTime()) return false;
    if (pl.endsAt && now.getTime() > pl.endsAt.getTime()) return false;
    if (pl.customerGroupId !== null && pl.customerGroupId !== customerGroupId) {
      return false;
    }
    return true;
  });

  if (eligible.length === 0) {
    return basePriceMinor;
  }

  eligible.sort((a, b) => {
    if (b.priceList.priority !== a.priceList.priority) {
      return b.priceList.priority - a.priceList.priority;
    }
    const aSpecific = a.priceList.customerGroupId ? 1 : 0;
    const bSpecific = b.priceList.customerGroupId ? 1 : 0;
    if (bSpecific !== aSpecific) return bSpecific - aSpecific;
    return a.price - b.price;
  });

  return eligible[0]?.price ?? basePriceMinor;
}

export interface CartLineSummary {
  id: string;
  variantId: string;
  productId: string;
  productSlug: string;
  title: string;
  variantTitle: string;
  sku: string | null;
  imageUrl: string | null;
  quantity: number;
  baseUnitPriceMinor: number;
  unitPriceMinor: number;
  compareAtPriceMinor: number | null;
  lineSubtotalMinor: number;
  discountMinor: number;
  lineTotalMinor: number;
  taxRateBps: number;
  taxAmountMinor: number;
  weightGrams: number;
  availableStock: number;
  trackInventory: boolean;
  allowBackorder: boolean;
  costPriceMinor: number | null;
  categoryIds: string[];
  categoryName: string;
}

export interface CartSummary {
  cartId: string;
  currency: string;
  itemCount: number;
  lines: CartLineSummary[];
  subtotalMinor: number;
  discountTotalMinor: number;
  subtotalAfterDiscountMinor: number;
  shippingTotalMinor: number;
  paymentFeeMinor: number;
  taxTotalMinor: number;
  totalMinor: number;
  totalWeightGrams: number;
  promoCodes: string[];
  appliedPromotions: AppliedPromotionSummary[];
  rejectedCodes: RejectedPromoCode[];
  freeShippingByPromo: boolean;
  availableShippingMethods: ShippingMethodQuote[];
  selectedShippingMethod: ShippingMethodQuote | null;
  availablePaymentOptions: AvailablePaymentOption[];
  selectedPaymentMethod: string;
  shippingAddress: CheckoutAddress | null;
  billingAddress: CheckoutAddress | null;
  email: string | null;
  phone: string | null;
  note: string | null;
}

/**
 * Misafir sepetindeki kalemleri ve promosyon kodlarını müşterinin mevcut açık sepetiyle birleştirir.
 */
export async function mergeGuestCartIntoCustomerCart(
  guestCartId: string,
  customerId: string
) {
  const existingCustomerCart = await db.cart.findFirst({
    where: {
      customerId,
      completedAt: null,
      id: { not: guestCartId },
    },
    include: { items: true },
    orderBy: { updatedAt: "desc" },
  });

  if (!existingCustomerCart) {
    return db.cart.update({
      where: { id: guestCartId },
      data: {
        customerId,
        updatedAt: new Date(),
      },
    });
  }

  const guestItems = await db.cartItem.findMany({
    where: { cartId: guestCartId },
  });

  for (const gItem of guestItems) {
    const existingLine = existingCustomerCart.items.find(
      (item) => item.variantId === gItem.variantId
    );

    if (existingLine) {
      await db.cartItem.update({
        where: { id: existingLine.id },
        data: { quantity: existingLine.quantity + gItem.quantity },
      });
    } else {
      await db.cartItem.create({
        data: {
          cartId: existingCustomerCart.id,
          variantId: gItem.variantId,
          quantity: gItem.quantity,
        },
      });
    }
  }

  const guestCart = await db.cart.findUnique({
    where: { id: guestCartId },
    select: { promoCodes: true },
  });

  const mergedPromoCodes = Array.from(
    new Set([
      ...(existingCustomerCart.promoCodes ?? []),
      ...(guestCart?.promoCodes ?? []),
    ])
  );

  await db.cart.delete({ where: { id: guestCartId } }).catch(() => {});

  return db.cart.update({
    where: { id: existingCustomerCart.id },
    data: {
      promoCodes: mergedPromoCodes,
      updatedAt: new Date(),
    },
  });
}

export async function getOrCreateCart(options?: {
  createIfMissing?: boolean;
  cartId?: string | null;
}) {
  const createIfMissing = options?.createIfMissing ?? true;
  const cookieStore = await cookies();
  const cartCookieId = cookieStore.get(CART_COOKIE)?.value;
  const visitorId = cookieStore.get(VISITOR_COOKIE)?.value ?? null;
  const customer = await getCurrentCustomer();

  const targetCartId = options?.cartId?.trim();
  let cart = targetCartId
    ? await db.cart.findFirst({
        where: { id: targetCartId, completedAt: null },
      })
    : null;

  if (!cart && cartCookieId) {
    cart = await db.cart.findFirst({
      where: { id: cartCookieId, completedAt: null },
    });
  }

  if (!cart && customer) {
    cart = await db.cart.findFirst({
      where: { customerId: customer.id, completedAt: null },
      orderBy: { updatedAt: "desc" },
    });
  }

  if (!cart && visitorId) {
    cart = await db.cart.findFirst({
      where: { visitorId, completedAt: null },
      orderBy: { updatedAt: "desc" },
    });
  }

  if (cart && customer && cart.customerId !== customer.id) {
    cart = await mergeGuestCartIntoCustomerCart(cart.id, customer.id);
  }

  if (!cart && createIfMissing) {
    cart = await db.cart.create({
      data: {
        customerId: customer?.id ?? null,
        visitorId,
        email: customer?.email ?? null,
        phone: customer?.phone ?? null,
        currency: "TRY",
        promoCodes: [],
      },
    });
  }

  if (cart && cartCookieId !== cart.id) {
    try {
      cookieStore.set(CART_COOKIE, cart.id, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 30 * 86400,
      });
    } catch {
      // Server Component render sırasında cookie yazılamazsa sessizce geç
    }
  }

  return cart;
}

function computeVariantAvailableStock(variant: {
  trackInventory: boolean;
  allowBackorder: boolean;
  inventoryLevels: ReadonlyArray<{
    onHand: number;
    reserved: number;
    warehouse: { isActive: boolean };
  }>;
}): number {
  if (!variant.trackInventory || variant.allowBackorder) {
    return 999;
  }
  let available = 0;
  for (const level of variant.inventoryLevels) {
    if (!level.warehouse.isActive) continue;
    available += Math.max(0, level.onHand - level.reserved);
  }
  return available;
}

export async function addCartItem(
  variantId: string,
  quantity = 1
): Promise<{ ok: boolean; error?: string; summary?: CartSummary }> {
  if (quantity < 1) {
    return { ok: false, error: "Miktar en az 1 olmalıdır." };
  }

  const variant = await db.productVariant.findUnique({
    where: { id: variantId },
    include: {
      product: { select: { id: true, status: true, deletedAt: true, title: true } },
      inventoryLevels: {
        include: { warehouse: { select: { isActive: true } } },
      },
    },
  });

  if (
    !variant ||
    !variant.isActive ||
    variant.product.deletedAt !== null ||
    variant.product.status !== "ACTIVE"
  ) {
    return { ok: false, error: "Bu ürün şu anda satışta değil." };
  }

  const available = computeVariantAvailableStock(variant);
  const cart = await getOrCreateCart({ createIfMissing: true });
  if (!cart) {
    return { ok: false, error: "Sepet oluşturulamadı." };
  }

  const existingItem = await db.cartItem.findUnique({
    where: {
      cartId_variantId: {
        cartId: cart.id,
        variantId: variant.id,
      },
    },
  });

  const targetQuantity = (existingItem?.quantity ?? 0) + quantity;
  if (variant.trackInventory && !variant.allowBackorder && targetQuantity > available) {
    return {
      ok: false,
      error:
        available <= 0
          ? "Bu varyantın stoğu tükendi."
          : `Stokta en fazla ${available} adet ürün bulunuyor.`,
    };
  }

  await db.cartItem.upsert({
    where: {
      cartId_variantId: {
        cartId: cart.id,
        variantId: variant.id,
      },
    },
    create: {
      cartId: cart.id,
      variantId: variant.id,
      quantity: targetQuantity,
    },
    update: {
      quantity: targetQuantity,
    },
  });

  await db.cart.update({
    where: { id: cart.id },
    data: { updatedAt: new Date() },
  });

  const summary = await computeCartSummary({ cartId: cart.id });
  return { ok: true, summary };
}

export async function updateCartItemQuantity(
  cartItemIdOrVariantId: string,
  quantity: number
): Promise<{ ok: boolean; error?: string; summary?: CartSummary }> {
  const cart = await getOrCreateCart({ createIfMissing: false });
  if (!cart) {
    return { ok: false, error: "Sepet bulunamadı." };
  }

  const item = await db.cartItem.findFirst({
    where: {
      cartId: cart.id,
      OR: [{ id: cartItemIdOrVariantId }, { variantId: cartItemIdOrVariantId }],
    },
    include: {
      variant: {
        include: {
          inventoryLevels: {
            include: { warehouse: { select: { isActive: true } } },
          },
        },
      },
    },
  });

  if (!item) {
    return { ok: false, error: "Sepet satırı bulunamadı." };
  }

  if (quantity <= 0) {
    await db.cartItem.delete({ where: { id: item.id } });
    const summary = await computeCartSummary({ cartId: cart.id });
    return { ok: true, summary };
  }

  const available = computeVariantAvailableStock(item.variant);
  if (item.variant.trackInventory && !item.variant.allowBackorder && quantity > available) {
    return {
      ok: false,
      error: `Bu üründen stokta en fazla ${available} adet bulunuyor.`,
    };
  }

  await db.cartItem.update({
    where: { id: item.id },
    data: { quantity },
  });

  const summary = await computeCartSummary({ cartId: cart.id });
  return { ok: true, summary };
}

export async function removeCartItem(
  cartItemIdOrVariantId: string
): Promise<{ ok: boolean; error?: string; summary?: CartSummary }> {
  const cart = await getOrCreateCart({ createIfMissing: false });
  if (!cart) {
    return { ok: false, error: "Sepet bulunamadı." };
  }

  await db.cartItem.deleteMany({
    where: {
      cartId: cart.id,
      OR: [{ id: cartItemIdOrVariantId }, { variantId: cartItemIdOrVariantId }],
    },
  });

  const summary = await computeCartSummary({ cartId: cart.id });
  return { ok: true, summary };
}

export async function applyPromoCode(
  rawCode: string
): Promise<{ ok: boolean; error?: string; summary?: CartSummary }> {
  const code = rawCode.trim().toUpperCase();
  if (!code) {
    return { ok: false, error: "Lütfen bir kupon kodu giriniz." };
  }

  const cart = await getOrCreateCart({ createIfMissing: true });
  if (!cart) {
    return { ok: false, error: "Sepet bulunamadı." };
  }

  const promo = await db.promotion.findUnique({
    where: { code },
  });

  if (!promo || !promo.isActive) {
    return { ok: false, error: "Geçersiz veya süresi dolmuş kupon kodu." };
  }

  const nextCodes = Array.from(
    new Set([...cart.promoCodes.map((c) => c.toUpperCase()), code])
  );

  await db.cart.update({
    where: { id: cart.id },
    data: { promoCodes: nextCodes },
  });

  const summary = await computeCartSummary({ cartId: cart.id });
  const rejected = summary.rejectedCodes.find((r) => r.code === code);
  if (rejected) {
    await db.cart.update({
      where: { id: cart.id },
      data: {
        promoCodes: cart.promoCodes.filter((c) => c.toUpperCase() !== code),
      },
    });
    const revertedSummary = await computeCartSummary({ cartId: cart.id });
    return { ok: false, error: rejected.reason, summary: revertedSummary };
  }

  return { ok: true, summary };
}

export async function removePromoCode(
  rawCode: string
): Promise<{ ok: boolean; summary?: CartSummary }> {
  const code = rawCode.trim().toUpperCase();
  const cart = await getOrCreateCart({ createIfMissing: false });
  if (!cart) {
    return { ok: true };
  }

  const nextCodes = cart.promoCodes.filter((c) => c.toUpperCase() !== code);
  await db.cart.update({
    where: { id: cart.id },
    data: { promoCodes: nextCodes },
  });

  const summary = await computeCartSummary({ cartId: cart.id });
  return { ok: true, summary };
}

export interface ComputeCartSummaryOptions {
  cartId?: string;
  shippingMethodId?: string | null;
  paymentMethod?: string | null;
  shippingCity?: string | null;
  customerIdOverride?: string | null;
}

export async function computeCartSummary(
  options?: string | ComputeCartSummaryOptions
): Promise<CartSummary> {
  const opts: ComputeCartSummaryOptions =
    typeof options === "string" ? { cartId: options } : (options ?? {});

  let cartId = opts.cartId;
  if (!cartId) {
    const activeCart = await getOrCreateCart({ createIfMissing: false });
    cartId = activeCart?.id;
  }

  const [paymentSettings, defaultTaxClass, currentCustomer] = await Promise.all([
    getPaymentSettings(),
    db.taxClass.findFirst({ where: { isDefault: true } }),
    getCurrentCustomer(),
  ]);

  const defaultTaxRateBps = defaultTaxClass?.rateBps ?? 2000;

  if (!cartId) {
    const emptyShipping = await getAvailableShippingMethods({
      city: opts.shippingCity ?? null,
      subtotalAfterDiscountMinor: 0,
      totalWeightGrams: 0,
      promoFreeShipping: false,
    });
    const emptyPaymentOptions = getAvailablePaymentOptions(paymentSettings, 0);
    return {
      cartId: "",
      currency: "TRY",
      itemCount: 0,
      lines: [],
      subtotalMinor: 0,
      discountTotalMinor: 0,
      subtotalAfterDiscountMinor: 0,
      shippingTotalMinor: emptyShipping[0]?.effectivePriceMinor ?? 0,
      paymentFeeMinor: 0,
      taxTotalMinor: 0,
      totalMinor: 0,
      totalWeightGrams: 0,
      promoCodes: [],
      appliedPromotions: [],
      rejectedCodes: [],
      freeShippingByPromo: false,
      availableShippingMethods: emptyShipping,
      selectedShippingMethod: emptyShipping[0] ?? null,
      availablePaymentOptions: emptyPaymentOptions,
      selectedPaymentMethod: "iyzico",
      shippingAddress: null,
      billingAddress: null,
      email: currentCustomer?.email ?? null,
      phone: currentCustomer?.phone ?? null,
      note: null,
    };
  }

  const cart = await db.cart.findUnique({
    where: { id: cartId },
    include: {
      customer: {
        select: {
          id: true,
          email: true,
          groupId: true,
          orderCount: true,
        },
      },
      items: {
        orderBy: { createdAt: "asc" },
        include: {
          variant: {
            include: {
              image: { select: { url: true } },
              inventoryLevels: {
                include: {
                  warehouse: { select: { isActive: true } },
                },
              },
              priceListPrices: {
                include: {
                  priceList: {
                    select: {
                      id: true,
                      isActive: true,
                      customerGroupId: true,
                      startsAt: true,
                      endsAt: true,
                      priority: true,
                    },
                  },
                },
              },
              product: {
                include: {
                  images: {
                    orderBy: { position: "asc" },
                    take: 1,
                    select: { url: true },
                  },
                  taxClass: { select: { rateBps: true } },
                  categories: {
                    include: {
                      category: { select: { id: true, name: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!cart) {
    return computeCartSummary({ ...opts, cartId: undefined });
  }

  let customerGroupId = cart.customer?.groupId ?? currentCustomer?.groupId ?? null;
  let customerOrderCount = cart.customer?.orderCount ?? 0;
  const effectiveCustomerId =
    opts.customerIdOverride ?? cart.customerId ?? currentCustomer?.id ?? null;

  if (effectiveCustomerId && !cart.customer) {
    const dbCust = await db.customer.findUnique({
      where: { id: effectiveCustomerId },
      select: { groupId: true, orderCount: true },
    });
    if (dbCust) {
      customerGroupId = dbCust.groupId;
      customerOrderCount = dbCust.orderCount;
    }
  }

  const now = new Date();
  const promoLines: PromoLineInput[] = [];
  const rawLines: Array<{
    cartItemId: string;
    variantId: string;
    productId: string;
    productSlug: string;
    title: string;
    variantTitle: string;
    sku: string | null;
    imageUrl: string | null;
    quantity: number;
    baseUnitPriceMinor: number;
    unitPriceMinor: number;
    compareAtPriceMinor: number | null;
    taxRateBps: number;
    weightGrams: number;
    availableStock: number;
    trackInventory: boolean;
    allowBackorder: boolean;
    costPriceMinor: number | null;
    categoryIds: string[];
    categoryName: string;
  }> = [];

  for (const item of cart.items) {
    const v = item.variant;
    const p = v.product;
    const unitPriceMinor = resolveEffectiveVariantPrice(
      v.price,
      v.priceListPrices,
      customerGroupId,
      now
    );
    const categoryIds = p.categories.map((c) => c.categoryId);
    const primaryCat =
      p.categories.find((c) => c.isPrimary)?.category.name ??
      p.categories[0]?.category.name ??
      "Genel";
    const imageUrl = v.image?.url ?? p.images[0]?.url ?? null;
    const taxRateBps = p.taxClass?.rateBps ?? defaultTaxRateBps;
    const weightGrams = v.weightGrams ?? p.weightGrams ?? 500;
    const availableStock = computeVariantAvailableStock(v);

    promoLines.push({
      lineId: item.id,
      variantId: v.id,
      productId: p.id,
      categoryIds,
      quantity: item.quantity,
      unitPriceMinor,
    });

    rawLines.push({
      cartItemId: item.id,
      variantId: v.id,
      productId: p.id,
      productSlug: p.slug,
      title: p.title,
      variantTitle: v.title,
      sku: v.sku,
      imageUrl,
      quantity: item.quantity,
      baseUnitPriceMinor: v.price,
      unitPriceMinor,
      compareAtPriceMinor: v.compareAtPrice,
      taxRateBps,
      weightGrams,
      availableStock,
      trackInventory: v.trackInventory,
      allowBackorder: v.allowBackorder,
      costPriceMinor: v.costPrice,
      categoryIds,
      categoryName: primaryCat,
    });
  }

  // Aktif promosyonları ve müşteri kullanım sayılarını çek
  const promotions = await db.promotion.findMany({
    where: {
      OR: [
        { isActive: true },
        ...(cart.promoCodes.length > 0 ? [{ code: { in: cart.promoCodes } }] : []),
      ],
    },
  });

  const customerEmail = (cart.email ?? currentCustomer?.email ?? "").trim().toLowerCase();
  const usageCountsByPromo: Record<string, number> = {};

  if (promotions.length > 0 && (effectiveCustomerId || customerEmail)) {
    const usages = await db.promotionUsage.groupBy({
      by: ["promotionId"],
      where: {
        promotionId: { in: promotions.map((p) => p.id) },
        OR: [
          ...(effectiveCustomerId ? [{ customerId: effectiveCustomerId }] : []),
          ...(customerEmail ? [{ email: customerEmail }] : []),
        ],
      },
      _count: { id: true },
    });
    for (const u of usages) {
      usageCountsByPromo[u.promotionId] = u._count.id;
    }
  }

  const promoCandidates: PromoCandidate[] = promotions.map((p) => ({
    id: p.id,
    name: p.name,
    code: p.code,
    type: p.type,
    value: p.value,
    conditions: p.conditions,
    buyQuantity: p.buyQuantity,
    getQuantity: p.getQuantity,
    getDiscountBps: p.getDiscountBps,
    maxDiscount: p.maxDiscount,
    usageLimit: p.usageLimit,
    usagePerCustomer: p.usagePerCustomer,
    usageCount: p.usageCount,
    customerUsageCount: usageCountsByPromo[p.id] ?? 0,
    startsAt: p.startsAt,
    endsAt: p.endsAt,
    isActive: p.isActive,
    isCombinable: p.isCombinable,
    priority: p.priority,
  }));

  const promoEval = evaluatePromotions(promoCandidates, {
    lines: promoLines,
    enteredCodes: cart.promoCodes,
    customerGroupId,
    customerOrderCount,
    customerId: effectiveCustomerId,
    customerEmail: customerEmail || undefined,
    now,
  });

  const lines: CartLineSummary[] = [];
  let itemCount = 0;
  let totalWeightGrams = 0;
  let taxTotalMinor = 0;

  for (const r of rawLines) {
    const lineSubtotalMinor = r.quantity * r.unitPriceMinor;
    const discountMinor = Math.min(
      lineSubtotalMinor,
      promoEval.lineDiscounts[r.cartItemId] ?? 0
    );
    const lineTotalMinor = Math.max(0, lineSubtotalMinor - discountMinor);
    const taxAmountMinor = extractIncludedVat(lineTotalMinor, r.taxRateBps);

    itemCount += r.quantity;
    totalWeightGrams += r.weightGrams * r.quantity;
    taxTotalMinor += taxAmountMinor;

    lines.push({
      id: r.cartItemId,
      variantId: r.variantId,
      productId: r.productId,
      productSlug: r.productSlug,
      title: r.title,
      variantTitle: r.variantTitle,
      sku: r.sku,
      imageUrl: r.imageUrl,
      quantity: r.quantity,
      baseUnitPriceMinor: r.baseUnitPriceMinor,
      unitPriceMinor: r.unitPriceMinor,
      compareAtPriceMinor: r.compareAtPriceMinor,
      lineSubtotalMinor,
      discountMinor,
      lineTotalMinor,
      taxRateBps: r.taxRateBps,
      taxAmountMinor,
      weightGrams: r.weightGrams,
      availableStock: r.availableStock,
      trackInventory: r.trackInventory,
      allowBackorder: r.allowBackorder,
      costPriceMinor: r.costPriceMinor,
      categoryIds: r.categoryIds,
      categoryName: r.categoryName,
    });
  }

  const subtotalMinor = promoEval.subtotalMinor;
  const discountTotalMinor = promoEval.discountTotalMinor;
  const subtotalAfterDiscountMinor = Math.max(0, subtotalMinor - discountTotalMinor);

  const savedShippingAddr =
    cart.shippingAddress && typeof cart.shippingAddress === "object"
      ? (cart.shippingAddress as unknown as CheckoutAddress)
      : null;
  const savedBillingAddr =
    cart.billingAddress && typeof cart.billingAddress === "object"
      ? (cart.billingAddress as unknown as CheckoutAddress)
      : null;

  const targetCity = opts.shippingCity ?? savedShippingAddr?.city ?? null;
  const availableShippingMethods = await getAvailableShippingMethods({
    city: targetCity,
    subtotalAfterDiscountMinor,
    totalWeightGrams,
    promoFreeShipping: promoEval.freeShipping,
  });

  const desiredShippingId = opts.shippingMethodId ?? cart.shippingMethodId ?? null;
  const selectedShippingMethod =
    (desiredShippingId
      ? availableShippingMethods.find((m) => m.id === desiredShippingId)
      : undefined) ??
    availableShippingMethods[0] ??
    null;

  const shippingTotalMinor =
    lines.length > 0 ? (selectedShippingMethod?.effectivePriceMinor ?? 0) : 0;

  const availablePaymentOptions = getAvailablePaymentOptions(
    paymentSettings,
    subtotalAfterDiscountMinor
  );
  const desiredPaymentMethod = normalizePaymentMethodCode(
    opts.paymentMethod ?? cart.paymentMethod ?? "iyzico"
  );
  const matchedPayOpt =
    availablePaymentOptions.find(
      (p) => p.code === desiredPaymentMethod && p.available
    ) ??
    availablePaymentOptions.find((p) => p.available) ??
    availablePaymentOptions[0];

  const selectedPaymentMethod = matchedPayOpt?.code ?? desiredPaymentMethod;
  const paymentFeeMinor =
    lines.length > 0 && selectedPaymentMethod === "cod"
      ? (matchedPayOpt?.feeMinor ?? paymentSettings.codFeeMinor)
      : 0;

  const totalMinor =
    lines.length > 0
      ? subtotalAfterDiscountMinor + shippingTotalMinor + paymentFeeMinor
      : 0;

  return {
    cartId: cart.id,
    currency: cart.currency,
    itemCount,
    lines,
    subtotalMinor,
    discountTotalMinor,
    subtotalAfterDiscountMinor,
    shippingTotalMinor,
    paymentFeeMinor,
    taxTotalMinor,
    totalMinor,
    totalWeightGrams,
    promoCodes: cart.promoCodes,
    appliedPromotions: promoEval.appliedPromotions,
    rejectedCodes: promoEval.rejectedCodes,
    freeShippingByPromo: promoEval.freeShipping,
    availableShippingMethods,
    selectedShippingMethod,
    availablePaymentOptions,
    selectedPaymentMethod,
    shippingAddress: savedShippingAddr,
    billingAddress: savedBillingAddr,
    email: cart.email ?? currentCustomer?.email ?? null,
    phone: cart.phone ?? currentCustomer?.phone ?? null,
    note: cart.note ?? null,
  };
}

export const getCartSummary = computeCartSummary;

export async function updateCartCheckoutState(input: {
  email?: string | null;
  phone?: string | null;
  lastStep?: "cart" | "address" | "shipping" | "payment" | "contracts";
  shippingAddress?: CheckoutAddress | null;
  shippingMethodId?: string | null;
  paymentMethod?: string | null;
  note?: string | null;
}): Promise<{ ok: boolean; cartId?: string; error?: string }> {
  const cart = await getOrCreateCart({ createIfMissing: false });
  if (!cart) {
    return { ok: false, error: "Aktif sepet bulunamadı." };
  }

  const updateData: {
    email?: string | null;
    phone?: string | null;
    lastStep?: string;
    shippingAddress?: Prisma.InputJsonValue;
    shippingMethodId?: string | null;
    paymentMethod?: string | null;
    note?: string | null;
  } = {};

  if (input.email !== undefined) updateData.email = input.email ? input.email.trim() : null;
  if (input.phone !== undefined) updateData.phone = input.phone ? input.phone.trim() : null;
  if (input.lastStep !== undefined) updateData.lastStep = input.lastStep;
  if (input.shippingAddress !== undefined) {
    updateData.shippingAddress = input.shippingAddress as unknown as Prisma.InputJsonValue;
  }
  if (input.shippingMethodId !== undefined) updateData.shippingMethodId = input.shippingMethodId;
  if (input.paymentMethod !== undefined) updateData.paymentMethod = input.paymentMethod;
  if (input.note !== undefined) updateData.note = input.note;

  await db.cart.update({
    where: { id: cart.id },
    data: updateData,
  });

  return { ok: true, cartId: cart.id };
}

export async function restoreCartFromRecoveryToken(
  token: string,
  promoCode?: string
): Promise<{ ok: boolean; cartId?: string; error?: string; appliedCode?: string }> {
  const cleanToken = token.trim();
  if (!cleanToken) {
    return { ok: false, error: "Geçersiz kurtarma anahtarı." };
  }

  const cart = await db.cart.findFirst({
    where: {
      recoveryToken: cleanToken,
      completedAt: null,
    },
    include: {
      items: true,
    },
  });

  if (!cart) {
    return { ok: false, error: "Kurtarılacak sepet bulunamadı veya sipariş zaten tamamlanmış." };
  }

  try {
    const cookieStore = await cookies();
    cookieStore.set(CART_COOKIE, cart.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 30 * 86400,
    });
  } catch {
    // İstek bağlamı dışındaki çağrılarda (test/CLI) sessizce geç
  }

  const updateData: {
    recoveredAt: Date;
    promoCodes?: string[];
  } = {
    recoveredAt: new Date(),
  };

  let appliedCode: string | undefined = undefined;
  if (promoCode && promoCode.trim()) {
    const code = promoCode.trim().toUpperCase();
    if (!cart.promoCodes.includes(code)) {
      updateData.promoCodes = [...cart.promoCodes, code];
      appliedCode = code;
    }
  }

  await db.cart.update({
    where: { id: cart.id },
    data: updateData,
  });

  return { ok: true, cartId: cart.id, appliedCode };
}
