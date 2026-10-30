import { NextResponse } from "next/server";
import { authenticateStaffApi } from "@/lib/auth/api-auth";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { errorResponse } = await authenticateStaffApi("catalog.read");
  if (errorResponse) return errorResponse;

  const url = new URL(request.url);
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "20", 10) || 20));
  const search = url.searchParams.get("search")?.trim();
  const categoryId = url.searchParams.get("categoryId");
  const stockFilter = url.searchParams.get("stock"); // "low", "out", "all"

  const where: Prisma.ProductWhereInput = {};

  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { slug: { contains: search, mode: "insensitive" } },
      { variants: { some: { sku: { contains: search, mode: "insensitive" } } } },
      { variants: { some: { barcode: { contains: search } } } },
    ];
  }

  if (categoryId) {
    where.categories = {
      some: { categoryId },
    };
  }

  if (stockFilter === "out") {
    where.totalStock = { lte: 0 };
  } else if (stockFilter === "low") {
    where.totalStock = { gt: 0, lte: 5 };
  }

  const [total, products] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        images: {
          orderBy: { position: "asc" },
          take: 1,
        },
        variants: {
          select: {
            id: true,
            title: true,
            sku: true,
            barcode: true,
            price: true,
            compareAtPrice: true,
            isActive: true,
            inventoryLevels: {
              select: {
                id: true,
                warehouseId: true,
                onHand: true,
                reserved: true,
              },
            },
          },
        },
        categories: {
          include: {
            category: { select: { id: true, name: true } },
          },
        },
      },
    }),
  ]);

  return NextResponse.json({
    products: products.map((p) => {
      const minPrice = p.minPrice ?? (p.variants.length > 0 ? Math.min(...p.variants.map((v) => v.price)) : 0);
      const maxPrice = p.maxPrice ?? (p.variants.length > 0 ? Math.max(...p.variants.map((v) => v.price)) : 0);

      return {
        id: p.id,
        title: p.title,
        slug: p.slug,
        status: p.status,
        isActive: p.status === "ACTIVE",
        totalStock: p.totalStock,
        primaryImage: p.images[0]?.url ?? null,
        categories: p.categories.map((c) => c.category.name),
        variantCount: p.variants.length,
        minPrice,
        maxPrice,
        variants: p.variants,
      };
    }),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
