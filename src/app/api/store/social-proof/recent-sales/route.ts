import { NextResponse } from "next/server";
import { db } from "@/lib/db";

import {
  type RecentSaleItem,
  maskCustomerName,
  formatTimeAgo,
} from "./helpers";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

    // Son 48 saatte tamamlanmış/ödenmiş gerçek siparişler
    const recentOrders = await db.order.findMany({
      where: {
        status: { in: ["OPEN", "COMPLETED"] },
        paymentStatus: { in: ["PAID", "AWAITING_TRANSFER", "AWAITING_COD"] },
        placedAt: { gte: fortyEightHoursAgo },
      },
      orderBy: { placedAt: "desc" },
      take: 12,
      select: {
        id: true,
        placedAt: true,
        shippingAddress: true,
        items: {
          take: 1,
          select: {
            id: true,
            title: true,
            imageUrl: true,
            productId: true,
          },
        },
      },
    });

    if (recentOrders.length === 0) {
      return NextResponse.json({ purchases: [] });
    }

    // Ürün slug'larını tek seferde topla
    const productIds = recentOrders
      .map((o) => o.items[0]?.productId)
      .filter((pid): pid is string => Boolean(pid));

    const products = productIds.length > 0
      ? await db.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, slug: true },
        })
      : [];

    const slugMap = new Map<string, string>();
    for (const p of products) {
      slugMap.set(p.id, p.slug);
    }

    const now = new Date();
    const purchases: RecentSaleItem[] = [];

    for (const order of recentOrders) {
      const item = order.items[0];
      if (!item) continue;

      const addr = (order.shippingAddress && typeof order.shippingAddress === "object"
        ? (order.shippingAddress as Record<string, unknown>)
        : {}) as {
        firstName?: string;
        lastName?: string;
        district?: string;
        city?: string;
      };

      const { customerName, location } = maskCustomerName(
        addr.firstName,
        addr.lastName,
        addr.district,
        addr.city
      );

      const slug = (item.productId && slugMap.get(item.productId)) || "";

      purchases.push({
        id: `${order.id}-${item.id}`,
        customerName: `${customerName} - ${location}`,
        city: location,
        productTitle: item.title,
        slug,
        imageUrl: item.imageUrl,
        timeAgo: formatTimeAgo(order.placedAt, now),
      });
    }

    return NextResponse.json({ purchases });
  } catch (error) {
    console.error("[recent-sales-api] Hata:", error);
    return NextResponse.json({ purchases: [] });
  }
}
