import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCategoryAndDescendantIds } from "@/modules/catalog/service";
import type { Prisma } from "@/generated/prisma/client";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();

  if (q.length < 1) {
    return NextResponse.json({ products: [], categories: [], total: 0 });
  }

  // Türkçe büyük/küçük harf varyasyonları
  const qLower = q.toLocaleLowerCase("tr");

  const whereProduct: Prisma.ProductWhereInput = {
    status: "ACTIVE",
    deletedAt: null,
    OR: [
      { title: { contains: q, mode: "insensitive" } },
      { subtitle: { contains: q, mode: "insensitive" } },
      { searchText: { contains: qLower, mode: "insensitive" } },
      { brand: { name: { contains: q, mode: "insensitive" } } },
      { categories: { some: { category: { name: { contains: q, mode: "insensitive" } } } } },
      {
        variants: {
          some: {
            OR: [
              { sku: { contains: q, mode: "insensitive" } },
              { barcode: { contains: q, mode: "insensitive" } },
            ],
          },
        },
      },
    ],
  };

  const [matchingProducts, matchingCategories, totalProducts] = await Promise.all([
    db.product.findMany({
      where: whereProduct,
      select: {
        id: true,
        title: true,
        slug: true,
        minPrice: true,
        maxPrice: true,
        totalStock: true,
        brand: { select: { name: true, slug: true } },
        images: {
          take: 1,
          orderBy: { position: "asc" },
          select: { url: true, alt: true },
        },
        variants: {
          where: { isActive: true },
          take: 1,
          orderBy: { price: "asc" },
          select: { price: true, compareAtPrice: true },
        },
        categories: {
          take: 1,
          select: { category: { select: { name: true, slug: true } } },
        },
      },
      orderBy: [{ totalStock: "desc" }, { salesCount: "desc" }, { createdAt: "desc" }],
      take: 8,
    }),
    db.category.findMany({
      where: {
        isActive: true,
        name: { contains: q, mode: "insensitive" },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        parent: { select: { name: true } },
      },
      take: 4,
    }),
    db.product.count({ where: whereProduct }),
  ]);

  // Eşleşen kategoriler için alt dallardaki ürün sayılarını hesaplayalım
  const categoriesWithCounts = await Promise.all(
    matchingCategories.map(async (cat) => {
      const descendantIds = await getCategoryAndDescendantIds({ id: cat.id });
      const count = await db.product.count({
        where: {
          status: "ACTIVE",
          deletedAt: null,
          categories: { some: { categoryId: { in: descendantIds } } },
        },
      });
      return {
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        parentName: cat.parent?.name ?? null,
        productCount: count,
      };
    })
  );

  const formattedProducts = matchingProducts.map((p) => {
    const primaryImage = p.images[0]?.url ?? null;
    const primaryVariant = p.variants[0] ?? null;
    const price = primaryVariant?.price ?? p.minPrice ?? 0;
    const compareAtPrice = primaryVariant?.compareAtPrice ?? null;
    const categoryName = p.categories[0]?.category.name ?? null;

    return {
      id: p.id,
      title: p.title,
      slug: p.slug,
      minPrice: p.minPrice,
      maxPrice: p.maxPrice,
      totalStock: p.totalStock,
      brandName: p.brand?.name ?? null,
      categoryName,
      imageUrl: primaryImage,
      imageAlt: p.images[0]?.alt ?? p.title,
      price,
      compareAtPrice,
    };
  });

  return NextResponse.json(
    {
      products: formattedProducts,
      categories: categoriesWithCounts,
      total: totalProducts,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    }
  );
}
