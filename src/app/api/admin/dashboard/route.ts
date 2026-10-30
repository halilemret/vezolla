import { NextResponse } from "next/server";
import { authenticateStaffApi } from "@/lib/auth/api-auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const { staff, errorResponse } = await authenticateStaffApi();
  if (errorResponse) return errorResponse;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [
    todayOrders,
    awaitingTransferCount,
    unfulfilledCount,
    pendingReturnsCount,
    lowStockCount,
    recentOrders,
    criticalStockItems,
  ] = await Promise.all([
    // Bugün verilen siparişler
    db.order.findMany({
      where: {
        createdAt: { gte: startOfToday },
        status: { not: "CANCELLED" },
      },
      select: { total: true },
    }),
    // Havale bekleyenler
    db.order.count({
      where: {
        status: "OPEN",
        paymentStatus: "AWAITING_TRANSFER",
      },
    }),
    // Kargolanmayı bekleyenler
    db.order.count({
      where: {
        status: "OPEN",
        paymentStatus: { in: ["PAID", "AWAITING_COD"] },
        fulfillmentStatus: { in: ["UNFULFILLED", "PREPARING", "PARTIALLY_SHIPPED"] },
      },
    }),
    // İade talepleri
    db.returnRequest.count({
      where: { status: "REQUESTED" },
    }),
    // Kritik stoktaki envanter seviyeleri (onHand <= 5)
    db.inventoryLevel.count({
      where: { onHand: { lte: 5 } },
    }),
    // Son 5 sipariş
    db.order.findMany({
      orderBy: { placedAt: "desc" },
      take: 6,
      select: {
        id: true,
        number: true,
        email: true,
        total: true,
        currency: true,
        status: true,
        paymentStatus: true,
        fulfillmentStatus: true,
        placedAt: true,
        customer: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    }),
    // Son kritik stok kayıtları
    db.inventoryLevel.findMany({
      where: { onHand: { lte: 5 } },
      include: {
        variant: {
          select: {
            id: true,
            sku: true,
            title: true,
            product: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
        warehouse: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { onHand: "asc" },
      take: 5,
    }),
  ]);

  const todayRevenue = todayOrders.reduce((acc, curr) => acc + curr.total, 0);

  return NextResponse.json({
    metrics: {
      todayOrderCount: todayOrders.length,
      todayRevenue,
      awaitingTransferCount,
      unfulfilledCount,
      pendingReturnsCount,
      lowStockCount,
    },
    recentOrders,
    criticalStockItems: criticalStockItems.map((item) => ({
      id: item.id,
      variantId: item.variantId,
      warehouseId: item.warehouseId,
      warehouseName: item.warehouse.name,
      productTitle: item.variant.product.title,
      variantTitle: item.variant.title,
      sku: item.variant.sku,
      onHand: item.onHand,
      reserved: item.reserved,
      lowStockThreshold: item.lowStockThreshold,
    })),
  });
}
