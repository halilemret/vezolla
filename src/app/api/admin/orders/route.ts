import { NextResponse } from "next/server";
import { authenticateStaffApi } from "@/lib/auth/api-auth";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { errorResponse } = await authenticateStaffApi("orders.read");
  if (errorResponse) return errorResponse;

  const url = new URL(request.url);
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "20", 10) || 20));
  const status = url.searchParams.get("status");
  const paymentStatus = url.searchParams.get("paymentStatus");
  const fulfillmentStatus = url.searchParams.get("fulfillmentStatus");
  const search = url.searchParams.get("search")?.trim();

  const where: Prisma.OrderWhereInput = {};

  if (status && ["OPEN", "COMPLETED", "CANCELLED"].includes(status)) {
    where.status = status as Prisma.EnumOrderStatusFilter["equals"];
  }

  if (
    paymentStatus &&
    [
      "PENDING",
      "AWAITING_TRANSFER",
      "AWAITING_COD",
      "PAID",
      "PARTIALLY_REFUNDED",
      "REFUNDED",
      "FAILED",
      "CANCELLED",
    ].includes(paymentStatus)
  ) {
    where.paymentStatus = paymentStatus as Prisma.EnumPaymentStatusFilter["equals"];
  }

  if (
    fulfillmentStatus &&
    [
      "UNFULFILLED",
      "PREPARING",
      "PARTIALLY_SHIPPED",
      "SHIPPED",
      "DELIVERED",
      "PARTIALLY_RETURNED",
      "RETURNED",
    ].includes(fulfillmentStatus)
  ) {
    where.fulfillmentStatus = fulfillmentStatus as Prisma.EnumFulfillmentStatusFilter["equals"];
  }

  if (search) {
    const asNum = Number.parseInt(search.replace(/\D/g, ""), 10);
    const searchConditions: Prisma.OrderWhereInput[] = [
      { email: { contains: search, mode: "insensitive" } },
      { phone: { contains: search } },
      { customer: { firstName: { contains: search, mode: "insensitive" } } },
      { customer: { lastName: { contains: search, mode: "insensitive" } } },
    ];
    if (Number.isFinite(asNum) && asNum > 0) {
      searchConditions.push({ number: asNum });
    }
    where.OR = searchConditions;
  }

  const [total, orders] = await Promise.all([
    db.order.count({ where }),
    db.order.findMany({
      where,
      orderBy: { placedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        items: {
          select: {
            id: true,
            title: true,
            variantTitle: true,
            sku: true,
            quantity: true,
            unitPrice: true,
            total: true,
            imageUrl: true,
          },
        },
      },
    }),
  ]);

  return NextResponse.json({
    orders,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
