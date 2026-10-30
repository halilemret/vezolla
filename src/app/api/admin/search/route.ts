import { NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/auth/session";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const staff = await getCurrentStaff();
  if (!staff) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (q.length < 1) {
    return NextResponse.json({ products: [], orders: [], customers: [] });
  }

  const numericQ = Number.parseInt(q.replace(/^#/, ""), 10);

  const [products, orders, customers] = await Promise.all([
    db.product.findMany({
      where: {
        deletedAt: null,
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { slug: { contains: q, mode: "insensitive" } },
          { variants: { some: { sku: { contains: q, mode: "insensitive" } } } },
        ],
      },
      select: { id: true, title: true, status: true, totalStock: true },
      take: 6,
    }),
    db.order.findMany({
      where: {
        OR: [
          ...(Number.isFinite(numericQ) ? [{ number: numericQ }] : []),
          { email: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, number: true, email: true, total: true, paymentStatus: true },
      take: 6,
    }),
    db.customer.findMany({
      where: {
        OR: [
          { email: { contains: q, mode: "insensitive" } },
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, firstName: true, lastName: true, email: true },
      take: 6,
    }),
  ]);

  return NextResponse.json({ products, orders, customers });
}
