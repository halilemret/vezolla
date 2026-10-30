import Link from "next/link";
import { notFound } from "next/navigation";
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

export default async function StoreCategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const category = await db.category.findUnique({
    where: { slug },
    include: {
      parent: { select: { name: true, slug: true } },
      children: {
        where: { isActive: true },
        orderBy: { position: "asc" },
      },
    },
  });

  if (!category || !category.isActive) {
    notFound();
  }

  // Kategorinin kendisi ve TÜM alt/torun kategorilerinin ID'lerini topla
  const categoryIds = await getCategoryAndDescendantIds({ id: category.id });

  const [rawProducts, resolvedSegments, merchRules, conversionSettings, ancestors, allCatsWithCounts] =
    await Promise.all([
      db.product.findMany({
        where: {
          status: "ACTIVE",
          deletedAt: null,
          categories: { some: { categoryId: { in: categoryIds } } },
        },
        include: {
          brand: { select: { name: true, slug: true } },
          images: { orderBy: { position: "asc" }, take: 2 },
          variants: { where: { isActive: true }, orderBy: { position: "asc" }, take: 3 },
        },
        orderBy: [{ totalStock: "desc" }, { salesCount: "desc" }, { createdAt: "desc" }],
        take: 60,
      }),
      resolveVisitorSegments(),
      db.merchRule.findMany({
        where: { isActive: true },
        orderBy: { priority: "desc" },
      }),
      getConversionSettings(),
      getCategoryAncestors(category.id),
      getCategoriesWithRecursiveCounts(),
    ]);

  const countMap = new Map(allCatsWithCounts.map((c) => [c.id, c.productCount]));

  const products = applyMerchandisingRules(rawProducts, {
    scope: "CATEGORY",
    categoryId: category.id,
    segmentIds: resolvedSegments.segments.map((s) => s.id),
    rules: merchRules,
  });

  return (
    <div className="space-y-6">
      <div className="border-b border-zinc-200 pb-4">
        {/* Hiyerarşik Ekmek Kırıntısı (Breadcrumb) */}
        <nav aria-label="Ekmek Kırıntısı" className="flex items-center gap-1.5 text-xs text-zinc-500 flex-wrap">
          <Link href="/katalog" className="hover:text-zinc-900 transition-colors">
            Katalog
          </Link>
          {ancestors.map((anc) => (
            <span key={anc.id} className="flex items-center gap-1.5">
              <span>/</span>
              <Link href={`/kategori/${anc.slug}`} className="hover:text-zinc-900 transition-colors">
                {anc.name}
              </Link>
            </span>
          ))}
          <span>/</span>
          <span className="font-semibold text-zinc-900">{category.name}</span>
        </nav>

        <div className="mt-2 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <h1 className="font-[family-name:var(--font-serif)] text-2xl sm:text-3xl text-zinc-900">
              {category.name}
            </h1>
            {category.description ? (
              <p className="mt-1 max-w-2xl text-xs sm:text-sm text-zinc-600">{category.description}</p>
            ) : null}
          </div>
          <span className="text-xs text-zinc-500 tabular-nums shrink-0">
            Toplam {products.length} ürün listeleniyor
          </span>
        </div>

        {/* Alt Kategoriler Çipleri (Varsa ürün sayılarıyla) */}
        {category.children.length > 0 ? (
          <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {category.children.map((sub) => {
              const subCount = countMap.get(sub.id) ?? 0;
              return (
                <Link
                  key={sub.id}
                  href={`/kategori/${sub.slug}`}
                  className="shrink-0 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:border-zinc-900 hover:bg-zinc-50 transition-colors whitespace-nowrap flex items-center gap-1.5 shadow-2xs"
                >
                  <span>{sub.name}</span>
                  {subCount > 0 ? (
                    <span className="text-[10px] text-zinc-400 tabular-nums">({subCount})</span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ) : null}
      </div>

      {products.length === 0 ? (
        <EmptyState
          title="Bu kategoride henüz yayında ürün bulunmuyor"
          description="Diğer kategorileri inceleyebilir veya tüm ürün kataloğuna dönebilirsiniz."
          actionLabel="Tüm Ürünleri Gör"
          actionHref="/katalog"
        />
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
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
    </div>
  );
}
