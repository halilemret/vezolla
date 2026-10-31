import "server-only";
import { db } from "@/lib/db";
import { getClubSettings } from "@/lib/settings/service";

// Puan Değeri: 10 Puan = 5 TL (1 Puan = 0.50 TL = 50 Kuruş indirim; 100 Puan = 50 TL indirim; 1.000 TL harcamaya 100 Puan)
export const POINT_VALUE_KURUS = 50;
export const PHOTO_REVIEW_POINTS = 25; // Fotoğraflı onaylanan yorum için 25 puan
export const TEXT_REVIEW_POINTS = 10; // Standart onaylanan yorum için 10 puan

/**
 * Puan Formülü: Her 1.000 TL harcama için 100 VezollaClub puanı kazanılır
 * (harcamanın %10'u kadar puan: spentAmountMinor * 0.1 / 100 = spentAmountMinor / 1000)
 */
export function calculateLoyaltyPointsEarned(spentAmountMinor: number): number {
  if (spentAmountMinor <= 0) return 0;
  return Math.floor((spentAmountMinor * 0.1) / 100);
}

/**
 * Puanların TL (kuruş) cinsinden indirim karşılığı
 * 10 Puan = 5 TL (1 Puan = 50 Kuruş; 100 Puan = 50 TL)
 */
export function calculatePointsDiscountValueMinor(
  points: number,
  pointValueKurus: number = POINT_VALUE_KURUS
): number {
  if (points <= 0) return 0;
  return points * pointValueKurus;
}

export interface LoyaltyAccountSummary {
  availablePoints: number;
  availableDiscountMinor: number;
  pendingPoints: number;
  pendingDiscountMinor: number;
  // Geriye dönük uyumluluk için alias alanlar
  points: number;
  valueMinor: number;
  transactions: Array<{
    id: string;
    points: number;
    balance: number;
    reason: string;
    status: string;
    availableAt: Date | null;
    orderId: string | null;
    reviewId: string | null;
    createdAt: Date;
  }>;
}

/**
 * Müşteriye puan kazandırır ve hesap hareketine (ledger) yazar.
 * Sipariş ilk tamamlandığında status: "PENDING", availableAt: null olarak kaydedilir.
 * PENDING iken müşterinin kullanılabilir loyaltyPoints bakiyesine eklenmez.
 * AVAILABLE ise doğrudan bakiyeye eklenir.
 */
export async function earnLoyaltyPoints(params: {
  customerId: string;
  points: number;
  reason: "ORDER_PURCHASE" | "PHOTO_REVIEW" | "TEXT_REVIEW" | "MANUAL_ADJUSTMENT";
  orderId?: string | null;
  reviewId?: string | null;
  status?: "PENDING" | "AVAILABLE";
  availableAt?: Date | null;
}): Promise<{ ok: boolean; newBalance: number; error?: string }> {
  if (params.points <= 0) {
    return { ok: false, newBalance: 0, error: "Puan miktarı pozitif olmalıdır." };
  }

  const customer = await db.customer.findUnique({
    where: { id: params.customerId },
    select: { id: true, loyaltyPoints: true },
  });

  if (!customer) {
    return { ok: false, newBalance: 0, error: "Müşteri bulunamadı." };
  }

  // Sipariş için mükerrer puan kazanımını önle
  if (params.orderId && params.reason === "ORDER_PURCHASE") {
    const existing = await db.loyaltyTransaction.findFirst({
      where: {
        orderId: params.orderId,
        reason: "ORDER_PURCHASE",
      },
    });
    if (existing) {
      return { ok: true, newBalance: customer.loyaltyPoints };
    }
  }

  // Sipariş ilk tamamlandığında varsayılan olarak PENDING ve availableAt: null kaydedilir
  const isPending =
    params.status === "PENDING" ||
    (params.status === undefined && params.reason === "ORDER_PURCHASE");

  if (isPending) {
    await db.loyaltyTransaction.create({
      data: {
        customerId: customer.id,
        points: params.points,
        balance: customer.loyaltyPoints, // Kullanılabilir bakiye henüz değişmez
        reason: params.reason,
        status: "PENDING",
        availableAt: params.availableAt ?? null,
        orderId: params.orderId ?? null,
        reviewId: params.reviewId ?? null,
      },
    });

    return { ok: true, newBalance: customer.loyaltyPoints };
  }

  const newBalance = customer.loyaltyPoints + params.points;

  await db.$transaction([
    db.customer.update({
      where: { id: customer.id },
      data: { loyaltyPoints: newBalance },
    }),
    db.loyaltyTransaction.create({
      data: {
        customerId: customer.id,
        points: params.points,
        balance: newBalance,
        reason: params.reason,
        status: "AVAILABLE",
        availableAt: null,
        orderId: params.orderId ?? null,
        reviewId: params.reviewId ?? null,
      },
    }),
  ]);

  return { ok: true, newBalance };
}

/**
 * Sipariş DELIVERED (Teslim Edildi) olduğunda veya işaretlendiğinde
 * bekleyen puanların açılma tarihini (teslimden 2 gün sonra) atar.
 */
export async function schedulePendingLoyaltyPointsForOrder(
  orderId: string,
  deliveryDate: Date = new Date()
): Promise<number> {
  const availableAt = new Date(deliveryDate.getTime() + 2 * 24 * 60 * 60 * 1000);
  const updated = await db.loyaltyTransaction.updateMany({
    where: {
      orderId,
      status: "PENDING",
      availableAt: null,
    },
    data: {
      availableAt,
    },
  });
  return updated.count;
}

/**
 * İptal edilen veya iade edilen siparişlerin bekleyen puanlarını iptal eder.
 */
export async function cancelPendingLoyaltyPointsForOrder(orderId: string): Promise<number> {
  const updated = await db.loyaltyTransaction.updateMany({
    where: {
      orderId,
      status: "PENDING",
    },
    data: {
      status: "CANCELLED",
    },
  });
  return updated.count;
}

/**
 * maturePendingLoyaltyPoints():
 * status: "PENDING" ve availableAt <= now olan kayıtları "AVAILABLE" yapar
 * ve müşterinin loyaltyPoints bakiyesine ekler (api/cron içinde çağrılır).
 */
export async function maturePendingLoyaltyPoints(
  now: Date = new Date()
): Promise<{ maturedCount: number; pointsMatured: number }> {
  const pendingTxs = await db.loyaltyTransaction.findMany({
    where: {
      status: "PENDING",
      availableAt: {
        not: null,
        lte: now,
      },
    },
    select: {
      id: true,
      customerId: true,
      points: true,
    },
  });

  if (pendingTxs.length === 0) {
    return { maturedCount: 0, pointsMatured: 0 };
  }

  let pointsMatured = 0;

  for (const tx of pendingTxs) {
    await db.$transaction(async (prisma) => {
      const cust = await prisma.customer.findUnique({
        where: { id: tx.customerId },
        select: { id: true, loyaltyPoints: true },
      });
      if (!cust) return;

      const newBalance = cust.loyaltyPoints + tx.points;

      await prisma.customer.update({
        where: { id: cust.id },
        data: { loyaltyPoints: newBalance },
      });

      await prisma.loyaltyTransaction.update({
        where: { id: tx.id },
        data: {
          status: "AVAILABLE",
          balance: newBalance,
        },
      });

      pointsMatured += tx.points;
    });
  }

  return { maturedCount: pendingTxs.length, pointsMatured };
}

/**
 * Alışverişte veya ödeme adımında puan kullanımını kaydeder.
 */
export async function redeemLoyaltyPoints(params: {
  customerId: string;
  points: number;
  orderId?: string | null;
}): Promise<{ ok: boolean; discountMinor: number; newBalance: number; error?: string }> {
  if (params.points <= 0) {
    return { ok: false, discountMinor: 0, newBalance: 0, error: "Kullanılacak puan 0'dan büyük olmalıdır." };
  }

  const customer = await db.customer.findUnique({
    where: { id: params.customerId },
    select: { id: true, loyaltyPoints: true },
  });

  if (!customer) {
    return { ok: false, discountMinor: 0, newBalance: 0, error: "Müşteri bulunamadı." };
  }

  if (customer.loyaltyPoints < params.points) {
    return {
      ok: false,
      discountMinor: 0,
      newBalance: customer.loyaltyPoints,
      error: `Yetersiz puan bakiyesi. Mevcut puanınız: ${customer.loyaltyPoints}`,
    };
  }

  const clubSettings = await getClubSettings().catch(() => null);
  const pointValue = clubSettings?.pointValueKurus ?? POINT_VALUE_KURUS;

  const newBalance = customer.loyaltyPoints - params.points;
  const discountMinor = calculatePointsDiscountValueMinor(params.points, pointValue);

  await db.$transaction([
    db.customer.update({
      where: { id: customer.id },
      data: { loyaltyPoints: newBalance },
    }),
    db.loyaltyTransaction.create({
      data: {
        customerId: customer.id,
        points: -params.points,
        balance: newBalance,
        reason: "ORDER_REDEMPTION",
        status: "AVAILABLE",
        orderId: params.orderId ?? null,
      },
    }),
  ]);

  return { ok: true, discountMinor, newBalance };
}

/**
 * Müşterinin sadakat puanı özetini ve son hesap hareketlerini getirir.
 * { availablePoints, availableDiscountMinor, pendingPoints, pendingDiscountMinor, transactions }
 */
export async function getCustomerLoyaltySummary(
  customerId: string
): Promise<LoyaltyAccountSummary | null> {
  const customer = await db.customer.findUnique({
    where: { id: customerId },
    select: {
      loyaltyPoints: true,
      loyaltyTransactions: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          points: true,
          balance: true,
          reason: true,
          status: true,
          availableAt: true,
          orderId: true,
          reviewId: true,
          createdAt: true,
        },
      },
    },
  });

  if (!customer) return null;

  const clubSettings = await getClubSettings().catch(() => null);
  const pointValue = clubSettings?.pointValueKurus ?? POINT_VALUE_KURUS;

  const availablePoints = customer.loyaltyPoints;
  const availableDiscountMinor = calculatePointsDiscountValueMinor(availablePoints, pointValue);

  // Bekleyen (PENDING) puanların toplamı
  const pendingTransactions = customer.loyaltyTransactions.filter(
    (tx) => tx.status === "PENDING"
  );
  const pendingPoints = pendingTransactions.reduce((sum, tx) => sum + Math.max(0, tx.points), 0);
  const pendingDiscountMinor = calculatePointsDiscountValueMinor(pendingPoints, pointValue);

  return {
    availablePoints,
    availableDiscountMinor,
    pendingPoints,
    pendingDiscountMinor,
    points: availablePoints,
    valueMinor: availableDiscountMinor,
    transactions: customer.loyaltyTransactions,
  };
}

export const MAX_LOYALTY_DISCOUNT_RATIO = 0.20; // Sepet tutarının en fazla %20'si

/**
 * Sepete puan indirimi tanımlar. Sepet tutarının maksimum %20'si kuralını uygular.
 */
export async function applyLoyaltyDiscountToCart(params: {
  cartId: string;
  customerId: string;
  pointsToUse: number;
  subtotalMinor?: number;
}): Promise<{ ok: boolean; discountMinor: number; pointsApplied: number; error?: string }> {
  const customer = await db.customer.findUnique({
    where: { id: params.customerId },
    select: { loyaltyPoints: true },
  });

  if (!customer) {
    return { ok: false, discountMinor: 0, pointsApplied: 0, error: "Müşteri bulunamadı." };
  }

  if (customer.loyaltyPoints <= 0) {
    return { ok: false, discountMinor: 0, pointsApplied: 0, error: "Kullanılabilir sadakat puanınız bulunmamaktadır." };
  }

  const clubSettings = await getClubSettings().catch(() => null);
  const pointValue = clubSettings?.pointValueKurus ?? POINT_VALUE_KURUS;
  const maxRatio = (clubSettings?.maxOrderDiscountPercent ?? 20) / 100;

  // %20 tavan kuralı (veya ayarlanan yüzde)
  let maxPointsAllowed = customer.loyaltyPoints;
  if (typeof params.subtotalMinor === "number" && params.subtotalMinor > 0) {
    const maxDiscountAllowedMinor = Math.floor(params.subtotalMinor * maxRatio);
    const maxPointsByCeiling = Math.floor(maxDiscountAllowedMinor / pointValue);
    maxPointsAllowed = Math.min(customer.loyaltyPoints, maxPointsByCeiling);
  }

  const pointsToApply = Math.min(maxPointsAllowed, Math.max(0, params.pointsToUse));
  const discountAmount = calculatePointsDiscountValueMinor(pointsToApply, pointValue);

  await db.cart.update({
    where: { id: params.cartId },
    data: {
      loyaltyPointsUsed: pointsToApply,
      loyaltyDiscountAmount: discountAmount,
    },
  });

  return { ok: true, discountMinor: discountAmount, pointsApplied: pointsToApply };
}

/**
 * Sepetten sadakat puanı indirimini kaldırır.
 */
export async function removeLoyaltyDiscountFromCart(params: {
  cartId: string;
}): Promise<{ ok: boolean }> {
  await db.cart.update({
    where: { id: params.cartId },
    data: {
      loyaltyPointsUsed: 0,
      loyaltyDiscountAmount: 0,
    },
  });
  return { ok: true };
}
