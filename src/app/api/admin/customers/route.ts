import { NextResponse } from "next/server";
import { authenticateStaffApi } from "@/lib/auth/api-auth";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { errorResponse } = await authenticateStaffApi("customers.read");
  if (errorResponse) return errorResponse;

  const url = new URL(request.url);
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "20", 10) || 20));
  const search = url.searchParams.get("search")?.trim();

  const where: Prisma.CustomerWhereInput = {};

  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { phone: { contains: search } },
    ];
  }

  const [total, customers] = await Promise.all([
    db.customer.count({ where }),
    db.customer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: { orders: true },
        },
        orders: {
          where: { status: { not: "CANCELLED" } },
          select: { total: true },
        },
      },
    }),
  ]);

  return NextResponse.json({
    customers: customers.map((c) => ({
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email,
      phone: c.phone,
      isActive: c.isActive,
      createdAt: c.createdAt,
      orderCount: c._count.orders,
      totalSpent: c.orders.reduce((sum, o) => sum + o.total, 0),
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
