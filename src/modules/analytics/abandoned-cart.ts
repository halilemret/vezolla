import "server-only";
import crypto from "crypto";
import { db } from "@/lib/db";
import { sendTransactionalEmail } from "@/lib/mail";
import { sendAbandonedCartRecoverySms } from "@/lib/sms";
import { recordAudit } from "@/lib/audit";
import { formatMoney } from "@/lib/money";
import { getAbandonedCartSettings } from "@/lib/settings/service";
import type { AbandonedCartSettings } from "@/lib/settings/schemas";
import {
  RECOVERY_PROMOTION_NAME_PREFIX,
  bpsToPercent,
  formatDiscountNote,
  percentToBps,
  resolveRecoveryCode,
} from "@/modules/analytics/recovery-offer";
import { createTemporaryUserCoupon } from "@/modules/promotions/temporary-coupon";

export interface RecoveryPromotionInfo {
  code: string;
  /** Kuponun gerçek yüzde indirimi; yüzdesel olmayan kampanyalarda null */
  percent: number | null;
}

/**
 * Kupon kodunun veritabanında gerçekten var ve geçerli olmasını sağlar.
 * Kod "Sepet Kurtarma" ön ekli bir kayıtsa oran panel ayarıyla senkronlanır.
 * Yöneticinin kendi kampanyası olan bir kod ise değiştirilmez, mevcut oranı raporlanır.
 */
export async function ensureRecoveryPromotion(
  code: string,
  discountPercent: number
): Promise<RecoveryPromotionInfo> {
  const existing = await db.promotion.findUnique({ where: { code } });

  if (!existing) {
    await db.promotion.create({
      data: {
        name: `${RECOVERY_PROMOTION_NAME_PREFIX} %${discountPercent}`,
        description: "Terk edilmiş sepet e-postası ve çıkış niyeti kuponu (panelden yönetilir).",
        code,
        type: "PERCENTAGE",
        value: percentToBps(discountPercent),
        conditions: {},
        usagePerCustomer: 1,
        isActive: true,
      },
    });
    return { code, percent: discountPercent };
  }

  const isManaged = existing.name.startsWith(RECOVERY_PROMOTION_NAME_PREFIX);
  if (isManaged) {
    if (
      existing.type !== "PERCENTAGE" ||
      existing.value !== percentToBps(discountPercent) ||
      !existing.isActive
    ) {
      await db.promotion.update({
        where: { id: existing.id },
        data: {
          type: "PERCENTAGE",
          value: percentToBps(discountPercent),
          name: `${RECOVERY_PROMOTION_NAME_PREFIX} %${discountPercent}`,
          isActive: true,
        },
      });
    }
    return { code, percent: discountPercent };
  }

  return {
    code,
    percent: existing.type === "PERCENTAGE" ? bpsToPercent(existing.value) : null,
  };
}

/**
 * Vitrin pop-up'ında gösterilecek kupon kodu ve oranı, veritabanına yazmadan hesaplar.
 * Yöneticinin kendi kampanyası olan bir kod seçildiyse gerçek oranı yansıtır.
 */
export async function getRecoveryOfferPreview(
  settings: AbandonedCartSettings
): Promise<RecoveryPromotionInfo> {
  const code = resolveRecoveryCode(settings);
  const existing = await db.promotion.findUnique({
    where: { code },
    select: { name: true, type: true, value: true },
  });
  if (existing && !existing.name.startsWith(RECOVERY_PROMOTION_NAME_PREFIX)) {
    return {
      code,
      percent: existing.type === "PERCENTAGE" ? bpsToPercent(existing.value) : null,
    };
  }
  return { code, percent: settings.discountPercent };
}


export type FunnelStepKey =
  | "cart"
  | "address"
  | "shipping"
  | "payment"
  | "contracts";

export interface FunnelStage {
  step: string;
  name: string;
  count: number;
  dropOffCount: number;
  conversionRate: number; // Yüzde (%)
  dropOffRate: number; // Yüzde (%)
}

export interface FunnelAnalyticsResult {
  days: number;
  stages: FunnelStage[];
  summary: {
    totalVisitors: number;
    totalCarts: number;
    totalCheckoutsStarted: number;
    totalOrders: number;
    overallConversionRate: number;
    cartAbandonmentRate: number;
    checkoutAbandonmentRate: number;
  };
}

export interface AbandonedCartItemDetail {
  variantId: string;
  productId: string;
  productSlug: string;
  title: string;
  variantTitle: string;
  sku: string | null;
  imageUrl: string | null;
  unitPriceMinor: number;
  quantity: number;
  totalPriceMinor: number;
}

export interface AbandonedCartRecord {
  id: string;
  customerName: string;
  email: string | null;
  phone: string | null;
  isRegisteredCustomer: boolean;
  customerId: string | null;
  visitorId: string | null;
  lastStep: FunnelStepKey;
  lastStepLabel: string;
  itemCount: number;
  totalMinor: number;
  items: AbandonedCartItemDetail[];
  abandonedAt: Date;
  updatedAt: Date;
  recoveryEmailAt: Date | null;
  recoveryEmailSentCount: number;
  recoveredAt: Date | null;
  recoveryDiscountCode: string | null;
  recoveryToken: string | null;
  recoveryStatus: "NEVER_SENT" | "SENT" | "RECOVERED";
  recoveryStatusLabel: string;
  shippingCity: string | null;
}

export interface AbandonedCartStats {
  totalAbandonedCount: number;
  totalAbandonedValueMinor: number;
  abandonmentRate: number;
  recoveryEmailSentCount: number;
  recoveredCount: number;
  recoveryRate: number;
  recoveredRevenueMinor: number;
}

export function formatStepLabel(step: string | null): string {
  switch (step) {
    case "address":
      return "Teslimat Adresi";
    case "shipping":
      return "Kargo Yöntemi";
    case "payment":
      return "Ödeme Adımı";
    case "contracts":
      return "Sözleşmeler";
    case "cart":
    default:
      return "Sepet Sayfası";
  }
}

/**
 * Ziyaretçi ve sepet dönüşüm hunisini (funnel) hesaplar.
 */
export async function getCheckoutFunnelAnalytics(days = 30): Promise<FunnelAnalyticsResult> {
  const since = new Date(Date.now() - days * 86_400_000);

  const [
    totalVisitorsCount,
    allCarts,
    completedOrdersCount,
  ] = await Promise.all([
    db.visitor.count({
      where: { lastSeenAt: { gte: since } },
    }),
    db.cart.findMany({
      where: {
        createdAt: { gte: since },
        items: { some: {} },
      },
      select: {
        id: true,
        lastStep: true,
        completedAt: true,
        shippingAddress: true,
        shippingMethodId: true,
        paymentMethod: true,
      },
    }),
    db.order.count({
      where: {
        placedAt: { gte: since },
        status: { not: "CANCELLED" },
      },
    }),
  ]);

  const totalCarts = allCarts.length;
  let reachedAddress = 0;
  let reachedShipping = 0;
  let reachedPayment = 0;
  let reachedContracts = 0;

  for (const c of allCarts) {
    const step = c.lastStep ?? "cart";
    const hasAddress = Boolean(c.shippingAddress);
    const hasShipping = Boolean(c.shippingMethodId);
    const hasPayment = Boolean(c.paymentMethod);

    if (step === "contracts" || c.completedAt) {
      reachedAddress++;
      reachedShipping++;
      reachedPayment++;
      reachedContracts++;
    } else if (step === "payment" || hasPayment) {
      reachedAddress++;
      reachedShipping++;
      reachedPayment++;
    } else if (step === "shipping" || hasShipping) {
      reachedAddress++;
      reachedShipping++;
    } else if (step === "address" || hasAddress) {
      reachedAddress++;
    }
  }

  // Sipariş adımı
  const completed = completedOrdersCount;

  // Huniyi oluştur
  const counts = [
    { step: "visitors", name: "Mağaza Ziyareti", count: Math.max(totalVisitorsCount, totalCarts) },
    { step: "cart", name: "Sepete Ekleme", count: totalCarts },
    { step: "address", name: "Teslimat Adresi", count: reachedAddress },
    { step: "shipping", name: "Kargo Seçimi", count: reachedShipping },
    { step: "payment", name: "Ödeme Tercihi", count: reachedPayment },
    { step: "completed", name: "Tamamlanan Sipariş", count: completed },
  ];

  const stages: FunnelStage[] = counts.map((curr, idx) => {
    const prev = idx > 0 ? (counts[idx - 1]?.count ?? 0) : curr.count;
    const next = idx < counts.length - 1 ? (counts[idx + 1]?.count ?? 0) : curr.count;
    const dropOffCount = Math.max(0, curr.count - next);
    const conversionRate = prev > 0 ? Math.min(100, Math.round((curr.count / prev) * 100)) : 0;
    const dropOffRate = curr.count > 0 ? Math.min(100, Math.round((dropOffCount / curr.count) * 100)) : 0;

    return {
      step: curr.step,
      name: curr.name,
      count: curr.count,
      dropOffCount: idx < counts.length - 1 ? dropOffCount : 0,
      conversionRate,
      dropOffRate: idx < counts.length - 1 ? dropOffRate : 0,
    };
  });

  const baseVisitors = Math.max(totalVisitorsCount, 1);
  const overallConversionRate = Math.round((completed / baseVisitors) * 1000) / 10;
  const abandonedCartsCount = Math.max(0, totalCarts - completed);
  const cartAbandonmentRate = totalCarts > 0 ? Math.round((abandonedCartsCount / totalCarts) * 100) : 0;
  const checkoutAbandonmentRate = reachedAddress > 0 ? Math.round(((reachedAddress - completed) / reachedAddress) * 100) : 0;

  return {
    days,
    stages,
    summary: {
      totalVisitors: totalVisitorsCount,
      totalCarts,
      totalCheckoutsStarted: reachedAddress,
      totalOrders: completed,
      overallConversionRate,
      cartAbandonmentRate,
      checkoutAbandonmentRate,
    },
  };
}

/**
 * Terk edilmiş sepetleri filtreler, sayfalar ve zenginleştirilmiş formatta listeler.
 */
export async function listAbandonedCarts(options?: {
  minAgeMinutes?: number;
  limit?: number;
  offset?: number;
  search?: string;
  stepFilter?: string;
  statusFilter?: string;
  hasEmailOnly?: boolean;
}): Promise<{
  carts: AbandonedCartRecord[];
  total: number;
  stats: AbandonedCartStats;
}> {
  const minAgeMinutes = options?.minAgeMinutes ?? 30;
  const limit = options?.limit ?? 30;
  const offset = options?.offset ?? 0;
  const search = options?.search?.trim();
  const stepFilter = options?.stepFilter?.trim();
  const statusFilter = options?.statusFilter?.trim();
  const hasEmailOnly = options?.hasEmailOnly ?? false;

  const thresholdDate = new Date(Date.now() - minAgeMinutes * 60 * 1000);

  // Genel istatistik hesaplama filtresi
  const baseWhere = {
    completedAt: null,
    items: { some: {} },
    updatedAt: { lte: thresholdDate },
  };

  // Sorgu filtresi
  const where: Record<string, unknown> = {
    ...baseWhere,
  };

  if (hasEmailOnly) {
    where.email = { not: null };
  }

  if (stepFilter && stepFilter !== "all") {
    where.lastStep = stepFilter;
  }

  if (statusFilter === "NEVER_SENT") {
    where.recoveryEmailAt = null;
  } else if (statusFilter === "SENT") {
    where.recoveryEmailAt = { not: null };
    where.recoveredAt = null;
  } else if (statusFilter === "RECOVERED") {
    where.recoveredAt = { not: null };
  }

  if (search) {
    where.OR = [
      { email: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } },
      { customer: { firstName: { contains: search, mode: "insensitive" } } },
      { customer: { lastName: { contains: search, mode: "insensitive" } } },
      { customer: { email: { contains: search, mode: "insensitive" } } },
      {
        items: {
          some: {
            variant: {
              product: {
                title: { contains: search, mode: "insensitive" },
              },
            },
          },
        },
      },
    ];
  }

  const [rawCarts, totalMatchingCount, allAbandonedForStats] = await Promise.all([
    db.cart.findMany({
      where,
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        items: {
          include: {
            variant: {
              select: {
                id: true,
                title: true,
                sku: true,
                price: true,
                product: {
                  select: {
                    id: true,
                    title: true,
                    slug: true,
                    images: { select: { url: true }, take: 1, orderBy: { position: "asc" } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
      skip: offset,
    }),
    db.cart.count({ where }),
    db.cart.findMany({
      where: baseWhere,
      select: {
        id: true,
        recoveryEmailAt: true,
        recoveredAt: true,
        items: {
          select: {
            quantity: true,
            variant: { select: { price: true } },
          },
        },
      },
    }),
  ]);

  // İstatistikleri hesapla
  let totalAbandonedValueMinor = 0;
  let recoveryEmailSentCount = 0;
  let recoveredCount = 0;
  let recoveredRevenueMinor = 0;

  for (const c of allAbandonedForStats) {
    let cartTotal = 0;
    for (const item of c.items) {
      cartTotal += item.quantity * item.variant.price;
    }
    totalAbandonedValueMinor += cartTotal;

    if (c.recoveryEmailAt) {
      recoveryEmailSentCount++;
    }
    if (c.recoveredAt) {
      recoveredCount++;
      recoveredRevenueMinor += cartTotal;
    }
  }

  const totalAbandonedCount = allAbandonedForStats.length;
  const totalCompletedCartsCount = await db.cart.count({
    where: { completedAt: { not: null } },
  });
  const allEverCarts = totalAbandonedCount + totalCompletedCartsCount;
  const abandonmentRate = allEverCarts > 0 ? Math.round((totalAbandonedCount / allEverCarts) * 100) : 0;
  const recoveryRate = recoveryEmailSentCount > 0 ? Math.round((recoveredCount / recoveryEmailSentCount) * 100) : 0;

  const stats: AbandonedCartStats = {
    totalAbandonedCount,
    totalAbandonedValueMinor,
    abandonmentRate,
    recoveryEmailSentCount,
    recoveredCount,
    recoveryRate,
    recoveredRevenueMinor,
  };

  const carts: AbandonedCartRecord[] = rawCarts.map((c) => {
    const items: AbandonedCartItemDetail[] = c.items.map((it) => {
      const p = it.variant.product;
      const unitPrice = it.variant.price;
      return {
        variantId: it.variant.id,
        productId: p.id,
        productSlug: p.slug,
        title: p.title,
        variantTitle: it.variant.title,
        sku: it.variant.sku,
        imageUrl: p.images[0]?.url ?? null,
        unitPriceMinor: unitPrice,
        quantity: it.quantity,
        totalPriceMinor: unitPrice * it.quantity,
      };
    });

    const totalMinor = items.reduce((acc, it) => acc + it.totalPriceMinor, 0);
    const step = (c.lastStep as FunnelStepKey) || "cart";

    let recoveryStatus: "NEVER_SENT" | "SENT" | "RECOVERED" = "NEVER_SENT";
    let recoveryStatusLabel = "E-posta Gönderilmedi";

    if (c.recoveredAt) {
      recoveryStatus = "RECOVERED";
      recoveryStatusLabel = "Sepet Kurtarıldı";
    } else if (c.recoveryEmailAt) {
      recoveryStatus = "SENT";
      recoveryStatusLabel = "E-posta Gönderildi";
    }

    let customerName = "Misafir Ziyaretçi";
    if (c.customer) {
      customerName = `${c.customer.firstName} ${c.customer.lastName}`.trim();
    } else if (c.shippingAddress && typeof c.shippingAddress === "object" && "firstName" in c.shippingAddress) {
      const addr = c.shippingAddress as { firstName?: string; lastName?: string; city?: string };
      if (addr.firstName) {
        customerName = `${addr.firstName} ${addr.lastName ?? ""}`.trim();
      }
    }

    let shippingCity: string | null = null;
    if (c.shippingAddress && typeof c.shippingAddress === "object" && "city" in c.shippingAddress) {
      const addr = c.shippingAddress as { city?: string };
      shippingCity = addr.city ?? null;
    }

    return {
      id: c.id,
      customerName,
      email: c.email ?? c.customer?.email ?? null,
      phone: c.phone ?? c.customer?.phone ?? null,
      isRegisteredCustomer: Boolean(c.customerId),
      customerId: c.customerId,
      visitorId: c.visitorId,
      lastStep: step,
      lastStepLabel: formatStepLabel(step),
      itemCount: items.reduce((acc, it) => acc + it.quantity, 0),
      totalMinor,
      items,
      abandonedAt: c.abandonedAt ?? c.updatedAt,
      updatedAt: c.updatedAt,
      recoveryEmailAt: c.recoveryEmailAt,
      recoveryEmailSentCount: c.recoveryEmailSentCount,
      recoveredAt: c.recoveredAt,
      recoveryDiscountCode: c.recoveryDiscountCode,
      recoveryToken: c.recoveryToken,
      recoveryStatus,
      recoveryStatusLabel,
      shippingCity,
    };
  });

  return {
    carts,
    total: totalMatchingCount,
    stats,
  };
}

/**
 * Terk edilmiş bir sepet için kurtarma linki üretir ve kurtarma e-postası gönderir.
 */
export async function sendAbandonedCartRecoveryEmail(
  cartId: string,
  options?: {
    discountCode?: string;
    customNote?: string;
    staffUserId?: string;
  }
): Promise<{ ok: boolean; error?: string; recoveryUrl?: string }> {
  const cart = await db.cart.findUnique({
    where: { id: cartId },
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, email: true } },
      items: {
        include: {
          variant: {
            select: {
              title: true,
              price: true,
              product: {
                select: {
                  title: true,
                  slug: true,
                  images: { select: { url: true }, take: 1, orderBy: { position: "asc" } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!cart) {
    return { ok: false, error: "Sepet bulunamadı." };
  }

  if (cart.completedAt) {
    return { ok: false, error: "Bu sepetin siparişi zaten tamamlanmış." };
  }

  if (cart.items.length === 0) {
    return { ok: false, error: "Sepette ürün bulunmuyor." };
  }

  const recipientEmail = (cart.email ?? cart.customer?.email)?.trim();
  if (!recipientEmail) {
    return { ok: false, error: "Sepete ait geçerli bir e-posta adresi bulunamadı." };
  }

  // Token yoksa üret
  let recoveryToken = cart.recoveryToken;
  if (!recoveryToken) {
    recoveryToken = crypto.randomBytes(16).toString("hex");
  }

  const appUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(
    /\/+$/,
    ""
  );

  const settings = await getAbandonedCartSettings();
  const requestedCode = options?.discountCode?.trim();

  let discountCode: string | undefined;
  let discountPercent: number | null = null;

  if (requestedCode && requestedCode !== "AUTO_TEMPORARY") {
    const recoveryPromotion = await ensureRecoveryPromotion(
      resolveRecoveryCode(settings, requestedCode),
      settings.discountPercent
    );
    discountCode = recoveryPromotion.code;
    discountPercent = recoveryPromotion.percent;
  } else if (settings.discountPercent > 0) {
    // Unutulan sepet için kullanıcıya özel rastgele harf ve rakamlardan oluşan geçici kupon üret
    const tempCoupon = await createTemporaryUserCoupon({
      email: recipientEmail,
      customerId: cart.customerId,
      discountPercent: settings.discountPercent,
      expiresInHours: 48,
      name: `Sepet Kurtarma (${recipientEmail})`,
      description: `Terk edilmiş sepet için 48 saat geçerli tek kullanımlık indirim kuponu.`,
    });
    discountCode = tempCoupon.code;
    discountPercent = tempCoupon.percent;
  }

  const restoreUrl = `${appUrl}/sepet?recover=${recoveryToken}${
    discountCode ? `&code=${encodeURIComponent(discountCode)}` : ""
  }`;

  // Ürün listesi HTML'i oluştur
  let cartTotalMinor = 0;
  const itemsHtmlList: string[] = [];

  for (const it of cart.items) {
    const lineTotal = it.quantity * it.variant.price;
    cartTotalMinor += lineTotal;
    const title = it.variant.product.title;
    const variantTitle = it.variant.title !== "Varsayılan" ? ` (${it.variant.title})` : "";
    const imgUrl = it.variant.product.images[0]?.url;

    itemsHtmlList.push(`
      <div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid #e4e4e7">
        ${imgUrl ? `<img src="${imgUrl}" alt="${title}" style="width:48px;height:48px;object-fit:cover;border-radius:4px" />` : ""}
        <div style="flex:1">
          <div style="font-weight:600;font-size:14px">${title}${variantTitle}</div>
          <div style="font-size:12px;color:#71717a">${it.quantity} adet × ${formatMoney(it.variant.price)}</div>
        </div>
        <div style="font-weight:600;font-size:14px">${formatMoney(lineTotal)}</div>
      </div>
    `);
  }

  let customerName = "Değerli Müşterimiz";
  if (cart.customer) {
    customerName = `${cart.customer.firstName} ${cart.customer.lastName}`.trim();
  } else if (cart.shippingAddress && typeof cart.shippingAddress === "object" && "firstName" in cart.shippingAddress) {
    const addr = cart.shippingAddress as { firstName?: string };
    if (addr.firstName) {
      customerName = addr.firstName;
    }
  }

  const discountNote = discountCode
    ? `${formatDiscountNote(discountCode, discountPercent)} (48 saat geçerlidir)`
    : "";
  const discountBlockHtml = discountCode
    ? `<div style="background:#fef3c7;border:1px solid #fde68a;padding:12px;border-radius:6px;margin:16px 0;color:#92400e">
         <strong>Size Özel İndirim:</strong> Alışverişinizi tamamlarken <strong>${discountCode}</strong> kodunu kullanarak ${
           discountPercent != null ? `%${discountPercent} ` : ""
         }indirim kazanın! Bu kupon yalnızca sizin e-posta adresiniz için 48 saat süreyle geçerlidir.
       </div>`
    : "";

  await sendTransactionalEmail({
    to: recipientEmail,
    templateKey: "abandoned_cart",
    variables: {
      customerName,
      itemsListHtml: itemsHtmlList.join(""),
      cartTotal: formatMoney(cartTotalMinor),
      restoreUrl,
      discountNote,
      discountBlockHtml,
    },
  });

  if (cart.phone && cart.customerId) {
    sendAbandonedCartRecoverySms({
      phone: cart.phone,
      customerId: cart.customerId,
      recoveryUrl: restoreUrl,
      discountCode,
    }).catch(() => {});
  }

  await db.cart.update({
    where: { id: cart.id },
    data: {
      recoveryToken,
      recoveryEmailAt: new Date(),
      recoveryEmailSentCount: { increment: 1 },
      recoveryDiscountCode: discountCode || cart.recoveryDiscountCode,
    },
  });

  if (options?.staffUserId) {
    await recordAudit({
      staffUserId: options.staffUserId,
      action: "abandoned_cart.send_email",
      entityType: "Cart",
      entityId: cart.id,
      summary: `Terk edilmiş sepet hatırlatması gönderildi: ${recipientEmail}`,
      after: {
        recipientEmail,
        discountCode: discountCode || null,
        totalMinor: cartTotalMinor,
      },
    });
  }

  return { ok: true, recoveryUrl: restoreUrl };
}

/**
 * Otomatik terk edilmiş sepet taraması yapar ve kurallara uyan sepetlere hatırlatma gönderir.
 */
export async function runAutomatedCartRecoverySweep(): Promise<{
  executed: boolean;
  eligibleCount: number;
  sentCount: number;
  reason?: string;
}> {
  const settings = await getAbandonedCartSettings();

  if (!settings.autoRecoveryEnabled) {
    return { executed: false, eligibleCount: 0, sentCount: 0, reason: "Otomatik kurtarma devre dışı." };
  }

  const cutoff = new Date(Date.now() - settings.idleMinutesBeforeAbandoned * 60 * 1000);

  const eligibleCarts = await db.cart.findMany({
    where: {
      completedAt: null,
      email: { not: null },
      items: { some: {} },
      recoveryEmailAt: null,
      updatedAt: { lte: cutoff },
    },
    take: 20,
    select: { id: true },
  });

  let sentCount = 0;
  for (const c of eligibleCarts) {
    try {
      const res = await sendAbandonedCartRecoveryEmail(c.id, {
        discountCode: settings.autoDiscountCode || undefined,
      });
      if (res.ok) {
        sentCount++;
      }
    } catch (err) {
      console.error(`Terk edilmiş sepet hatırlatması gönderilemedi (${c.id}):`, err);
    }
  }

  return {
    executed: true,
    eligibleCount: eligibleCarts.length,
    sentCount,
  };
}
