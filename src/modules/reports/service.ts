import "server-only";
import { db } from "@/lib/db";

export interface ReportSummary {
  days: number;
  orderCount: number;
  grossRevenueMinor: number;
  refundedMinor: number;
  netRevenueMinor: number;
  estimatedCostMinor: number;
  estimatedProfitMinor: number;
  abandonedCartCount: number;
  topProducts: Array<{
    productId: string;
    title: string;
    unitsSold: number;
    revenueMinor: number;
  }>;
  couponPerformance: Array<{
    code: string;
    name: string;
    usageCount: number;
    totalDiscountMinor: number;
  }>;
  dailySeries: Array<{
    date: string;
    orders: number;
    revenueMinor: number;
  }>;
}

export async function getSalesReport(days = 30): Promise<ReportSummary> {
  const since = new Date(Date.now() - days * 86400 * 1000);

  const [orders, abandonedCartCount, promoUsages] = await Promise.all([
    db.order.findMany({
      where: {
        placedAt: { gte: since },
        status: { not: "CANCELLED" },
      },
      include: {
        items: true,
      },
      orderBy: { placedAt: "asc" },
    }),
    db.cart.count({
      where: {
        completedAt: null,
        updatedAt: { gte: since },
        items: { some: {} },
      },
    }),
    db.promotionUsage.findMany({
      where: { createdAt: { gte: since } },
      include: { promotion: { select: { name: true, code: true } } },
    }),
  ]);

  let grossRevenueMinor = 0;
  let refundedMinor = 0;
  let estimatedCostMinor = 0;

  const productMap = new Map<
    string,
    { productId: string; title: string; unitsSold: number; revenueMinor: number }
  >();
  const dayMap = new Map<string, { date: string; orders: number; revenueMinor: number }>();

  for (const order of orders) {
    grossRevenueMinor += order.total;
    refundedMinor += order.refundedTotal;

    const dayKey = order.placedAt.toISOString().slice(0, 10);
    const dayEntry = dayMap.get(dayKey) ?? { date: dayKey, orders: 0, revenueMinor: 0 };
    dayEntry.orders += 1;
    dayEntry.revenueMinor += order.total - order.refundedTotal;
    dayMap.set(dayKey, dayEntry);

    for (const item of order.items) {
      const activeQty = Math.max(0, item.quantity - item.returnedQuantity);
      if (item.costPrice) {
        estimatedCostMinor += item.costPrice * activeQty;
      }
      const key = item.productId ?? item.title;
      const existing = productMap.get(key) ?? {
        productId: key,
        title: item.title,
        unitsSold: 0,
        revenueMinor: 0,
      };
      existing.unitsSold += activeQty;
      existing.revenueMinor += item.total;
      productMap.set(key, existing);
    }
  }

  const couponMap = new Map<
    string,
    { code: string; name: string; usageCount: number; totalDiscountMinor: number }
  >();
  for (const usage of promoUsages) {
    const code = usage.code ?? usage.promotion.code ?? "OTOMATIK";
    const entry = couponMap.get(code) ?? {
      code,
      name: usage.promotion.name,
      usageCount: 0,
      totalDiscountMinor: 0,
    };
    entry.usageCount += 1;
    entry.totalDiscountMinor += usage.discountAmount;
    couponMap.set(code, entry);
  }

  const netRevenueMinor = Math.max(0, grossRevenueMinor - refundedMinor);
  const estimatedProfitMinor = netRevenueMinor - estimatedCostMinor;

  return {
    days,
    orderCount: orders.length,
    grossRevenueMinor,
    refundedMinor,
    netRevenueMinor,
    estimatedCostMinor,
    estimatedProfitMinor,
    abandonedCartCount,
    topProducts: Array.from(productMap.values())
      .sort((a, b) => b.revenueMinor - a.revenueMinor)
      .slice(0, 10),
    couponPerformance: Array.from(couponMap.values()).sort(
      (a, b) => b.totalDiscountMinor - a.totalDiscountMinor
    ),
    dailySeries: Array.from(dayMap.values()),
  };
}
