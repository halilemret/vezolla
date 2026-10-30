import Link from "next/link";
import { db } from "@/lib/db";
import { resolveVisitorSegments } from "@/modules/personalization/segments";
import { applyMerchandisingRules } from "@/modules/personalization/recommendations";
import {
  getCategoryAndDescendantIds,
  getCategoryAncestors,
  getCategoriesWithRecursiveCounts,
} from "@/modules/catalog/service";
import { getConversionSettings } from "@/lib/settings/service";
import { ProductCard } from "@/components/store/product-card";
import { EmptyState } from "@/components/ui/empty-state";
import { CatalogClient } from "@/components/store/catalog-client";
import type { Prisma } from "@/generated/prisma/client";

export default async function StoreCatalogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const categorySlug = typeof params.kategori === "string" ? params.kategori.trim() : "";
  const brandSlug = typeof params.marka === "string" ? params.marka.trim() : "";
  const inStockOnly = params.stokta === "1";
  const sort = typeof params.sirala === "string" ? params.sirala : "onerilen";
  const minLira = params.min ? Number(params.min) : null;
  const maxLira = params.max ? Number(params.max) : null;
  const page = Math.max(1, Number(params.sayfa) || 1);
  const pageSize = 24;

  // Özel alan filtreleri: attr_<key>=<value>
  const attrFilters: Array<{ key: string; value: string }> = [];
  const currentAttrFilters: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (k.startsWith("attr_") && typeof v === "string" && v.trim() !== "") {
      const key = k.slice(5);
      const val = v.trim();
      attrFilters.push({ key, value: val });
      currentAttrFilters[key] = val;
    }
  }

  const andConditions: Prisma.ProductWhereInput[] = [
    { status: "ACTIVE" },
    { deletedAt: null },
  ];

  if (q) {
    const qLower = q.toLocaleLowerCase("tr");
    andConditions.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { subtitle: { contains: q, mode: "insensitive" } },
        { searchText: { contains: qLower, mode: "insensitive" } },
        { brand: { name: { contains: q, mode: "insensitive" } } },
        { variants: { some: { sku: { contains: q, mode: "insensitive" } } } },
      ],
    });
  }

  // Seçilen kategori varsa, o kategori ve TÜM alt/torun kategorilerini sorguya dahil et
  let activeCategory: { id: string; name: string; slug: string } | null = null;
  let categoryAncestors: Array<{ id: string; name: string; slug: string }> = [];

  if (categorySlug) {
    activeCategory = await db.category.findUnique({
      where: { slug: categorySlug },
      select: { id: true, name: true, slug: true },
    });

    if (activeCategory) {
      const [categoryIds, ancestors] = await Promise.all([
        getCategoryAndDescendantIds({ id: activeCategory.id }),
        getCategoryAncestors(activeCategory.id),
      ]);
      categoryAncestors = ancestors;

      andConditions.push({
        categories: { some: { categoryId: { in: categoryIds } } },
      });
    } else {
      andConditions.push({
        categories: { some: { category: { slug: categorySlug } } },
      });
    }
  }

  if (brandSlug) {
    andConditions.push({
      brand: { slug: brandSlug },
    });
  }

  if (inStockOnly) {
    andConditions.push({
      totalStock: { gt: 0 },
    });
  }

  if (minLira !== null && Number.isFinite(minLira) && minLira > 0) {
    andConditions.push({
      minPrice: { gte: Math.round(minLira * 100) },
    });
  }

  if (maxLira !== null && Number.isFinite(maxLira) && maxLira > 0) {
    andConditions.push({
      minPrice: { lte: Math.round(maxLira * 100) },
    });
  }

  for (const af of attrFilters) {
    andConditions.push({
      attributes: {
        some: {
          attribute: { key: af.key },
          OR: [
            { valueText: { equals: af.value, mode: "insensitive" } },
            { valueList: { has: af.value } },
          ],
        },
      },
    });
  }

  const orderBy: Prisma.ProductOrderByWithRelationInput[] =
    sort === "fiyat-artan"
      ? [{ minPrice: "asc" }]
      : sort === "fiyat-azalan"
        ? [{ minPrice: "desc" }]
        : sort === "yeni"
          ? [{ createdAt: "desc" }]
          : sort === "cok-satan"
            ? [{ salesCount: "desc" }]
            : [{ totalStock: "desc" }, { salesCount: "desc" }, { createdAt: "desc" }];

  const skip = (page - 1) * pageSize;

  const [
    rawProducts,
    totalCount,
    categoriesWithCounts,
    brands,
    filterableAttributes,
    resolvedSegments,
    merchRules,
    conversionSettings,
  ] = await Promise.all([
    db.product.findMany({
      where: { AND: andConditions },
      include: {
        brand: { select: { name: true, slug: true } },
        images: { orderBy: { position: "asc" }, take: 2 },
        variants: { where: { isActive: true }, orderBy: { position: "asc" }, take: 3 },
      },
      orderBy,
      skip,
      take: pageSize,
    }),
    db.product.count({
      where: { AND: andConditions },
    }),
    getCategoriesWithRecursiveCounts(),
    db.brand.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true },
    }),
    db.attributeDefinition.findMany({
      where: { isFilterable: true },
      orderBy: { position: "asc" },
    }),
    resolveVisitorSegments(),
    db.merchRule.findMany({
      where: { isActive: true },
      orderBy: { priority: "desc" },
    }),
    getConversionSettings(),
  ]);

  // "onerilen" sıralamada ziyaretçinin segmentine ve arama sorgusuna göre MerchRule uygula
  const products =
    sort === "onerilen"
      ? applyMerchandisingRules(rawProducts, {
          scope: q ? "SEARCH" : "CATEGORY",
          segmentIds: resolvedSegments.segments.map((s) => s.id),
          searchTerm: q || null,
          rules: merchRules,
        })
      : rawProducts;

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <CatalogClient
      totalCount={totalCount}
      currentPage={page}
      totalPages={totalPages}
      pageSize={pageSize}
      activeCategory={activeCategory}
      categoryAncestors={categoryAncestors}
      categories={categoriesWithCounts}
      brands={brands}
      filterableAttributes={filterableAttributes}
      currentQuery={q}
      currentSort={sort}
      currentCategorySlug={categorySlug}
      currentBrandSlug={brandSlug}
      currentInStockOnly={inStockOnly}
      currentMinLira={minLira}
      currentMaxLira={maxLira}
      currentAttrFilters={currentAttrFilters}
    >
      {products.length === 0 ? (
        <EmptyState
          title="Seçilen filtrelere uygun ürün bulunamadı"
          description="Arama kelimesini veya aktif filtreleri temizleyerek tüm kataloğu görüntüleyebilirsiniz."
          actionLabel="Filtreleri Temizle"
          actionHref="/katalog"
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              showScarcity={conversionSettings.scarcityWarningEnabled}
              scarcityThreshold={conversionSettings.scarcityStockThreshold}
              showQuickAdd={conversionSettings.quickAddToCartEnabled}
              showSavings={conversionSettings.showSavingsBadge}
              showStars={conversionSettings.showReviewStars}
            />
          ))}
        </div>
      )}
    </CatalogClient>
  );
}
