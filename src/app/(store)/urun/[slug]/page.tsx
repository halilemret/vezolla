import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Star, CheckCircle as CheckCircle2 } from "@phosphor-icons/react/dist/ssr";
import { db } from "@/lib/db";
import { getCurrentCustomer } from "@/lib/auth/session";
import { getInstallmentSettings, getClubSettings } from "@/lib/settings/service";
import { resolveEffectiveVariantPrice } from "@/modules/checkout/cart";
import { getRecommendedProducts } from "@/modules/personalization/recommendations";
import { ProductViewBeacon } from "@/components/store/visitor-tracker";
import { ProductCard } from "@/components/store/product-card";
import { Badge } from "@/components/ui/badge";
import {
  ProductDetailClient,
  type ClientProductOption,
  type ClientProductVariant,
} from "./product-detail-client";
import { BundleSection, type BundleItem } from "@/components/store/bundle-section";
import { ProductReviewsFiltered } from "@/components/store/product-reviews-filtered";
import { ProductAccordion } from "@/components/store/product-accordion";

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await db.product.findUnique({
    where: { slug },
    select: {
      title: true,
      subtitle: true,
      seoTitle: true,
      seoDescription: true,
      deletedAt: true,
      status: true,
    },
  });

  if (!product || product.deletedAt !== null) {
    return { title: "Ürün Bulunamadı" };
  }

  return {
    title: product.seoTitle || product.title,
    description: product.seoDescription || product.subtitle || undefined,
  };
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const { slug } = await params;

  const [product, customer, installmentSettings, clubSettings] =
    await Promise.all([
    db.product.findUnique({
      where: { slug },
      include: {
        brand: { select: { id: true, name: true, slug: true } },
        images: { orderBy: { position: "asc" } },
        categories: {
          include: {
            category: { select: { id: true, name: true, slug: true } },
          },
        },
        options: {
          orderBy: { position: "asc" },
          include: {
            values: { orderBy: { position: "asc" } },
          },
        },
        variants: {
          where: { isActive: true },
          orderBy: { position: "asc" },
          include: {
            image: { select: { url: true } },
            optionValues: {
              include: {
                optionValue: {
                  include: { option: { select: { name: true } } },
                },
              },
            },
            inventoryLevels: {
              include: {
                warehouse: { select: { isActive: true } },
              },
            },
            priceListPrices: {
              include: {
                priceList: {
                  select: {
                    id: true,
                    isActive: true,
                    customerGroupId: true,
                    startsAt: true,
                    endsAt: true,
                    priority: true,
                  },
                },
              },
            },
          },
        },
        attributes: {
          include: {
            attribute: true,
          },
          orderBy: {
            attribute: { position: "asc" },
          },
        },
        reviews: {
          where: { status: "APPROVED" },
          orderBy: { createdAt: "desc" },
          take: 30,
        },
      },
    }),
    getCurrentCustomer(),
    getInstallmentSettings(),
    getClubSettings(),
  ]);

  if (!product || product.deletedAt !== null || product.status !== "ACTIVE") {
    notFound();
  }

  const wishlistedCount = customer
    ? await db.wishlistItem.count({
        where: {
          customerId: customer.id,
          productId: product.id,
        },
      })
    : 0;

  const primaryCategory =
    product.categories.find((c) => c.isPrimary)?.category ??
    product.categories[0]?.category ??
    null;

  const now = new Date();
  const clientOptions: ClientProductOption[] = product.options.map((opt) => ({
    id: opt.id,
    name: opt.name,
    values: opt.values.map((v) => ({ id: v.id, value: v.value })),
  }));

  const clientVariants: ClientProductVariant[] = product.variants.map((v) => {
    const effectivePrice = resolveEffectiveVariantPrice(
      v.price,
      v.priceListPrices,
      customer?.groupId ?? null,
      now
    );

    let availableStock = 0;
    if (!v.trackInventory || v.allowBackorder) {
      availableStock = 999;
    } else {
      for (const lvl of v.inventoryLevels) {
        if (!lvl.warehouse.isActive) continue;
        availableStock += Math.max(0, lvl.onHand - lvl.reserved);
      }
    }

    const optionMap: Record<string, string> = {};
    for (const ov of v.optionValues) {
      optionMap[ov.optionValue.option.name] = ov.optionValue.value;
    }

    return {
      id: v.id,
      title: v.title,
      sku: v.sku,
      barcode: v.barcode,
      effectivePrice,
      compareAtPrice: v.compareAtPrice,
      clubPrice: v.clubPrice ?? product.clubPrice ?? null,
      availableStock,
      trackInventory: v.trackInventory,
      allowBackorder: v.allowBackorder,
      optionMap,
      imageUrl: v.image?.url ?? null,
    };
  });

  // Kombini Tamamla: Aynı veya bağlı kategoriden ürünleri eşle
  const currentCategoryIds = product.categories.map((c) => c.categoryId);
  let bundleCandidates = await db.product.findMany({
    where: {
      id: { not: product.id },
      status: "ACTIVE",
      deletedAt: null,
      totalStock: { gt: 0 },
      categories: {
        some: {
          categoryId: { in: currentCategoryIds },
        },
      },
    },
    take: 4,
    orderBy: [{ totalStock: "desc" }, { createdAt: "desc" }],
    include: {
      brand: { select: { name: true } },
      images: { orderBy: { position: "asc" }, take: 1 },
      variants: { where: { isActive: true }, take: 1 },
    },
  });

  if (bundleCandidates.length < 2) {
    const fallbackCandidates = await db.product.findMany({
      where: {
        id: { not: product.id },
        status: "ACTIVE",
        deletedAt: null,
        totalStock: { gt: 0 },
      },
      take: 4,
      orderBy: { createdAt: "desc" },
      include: {
        brand: { select: { name: true } },
        images: { orderBy: { position: "asc" }, take: 1 },
        variants: { where: { isActive: true }, take: 1 },
      },
    });
    bundleCandidates = [
      ...bundleCandidates,
      ...fallbackCandidates.filter((f) => !bundleCandidates.some((b) => b.id === f.id)),
    ].slice(0, 4);
  }

  const relatedList = bundleCandidates.map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    subtitle: p.subtitle,
    minPrice: p.minPrice ?? 0,
    maxPrice: p.maxPrice ?? 0,
    totalStock: p.totalStock ?? 0,
    brand: p.brand,
    images: p.images,
    variants: p.variants,
  }));

  const avgRating =
    product.reviews.length > 0
      ? product.reviews.reduce((sum, r) => sum + r.rating, 0) /
        product.reviews.length
      : null;

  const lowPriceMinor = product.minPrice ?? clientVariants[0]?.effectivePrice ?? 0;
  const highPriceMinor = product.maxPrice ?? lowPriceMinor;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.seoDescription || product.subtitle || product.title,
    sku: clientVariants[0]?.sku ?? product.id,
    brand: product.brand
      ? { "@type": "Brand", name: product.brand.name }
      : undefined,
    image: product.images.map((i) => i.url),
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "TRY",
      lowPrice: (lowPriceMinor / 100).toFixed(2),
      highPrice: (highPriceMinor / 100).toFixed(2),
      availability:
        product.totalStock > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
    },
    ...(avgRating
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: avgRating.toFixed(1),
            reviewCount: product.reviews.length,
          },
        }
      : {}),
  };

  return (
    <div className="mx-auto max-w-[1360px] px-4 pt-2.5 pb-12 sm:px-6 sm:pt-3.5 sm:pb-16">
      <ProductViewBeacon
        productId={product.id}
        variantId={clientVariants[0]?.id}
        categoryId={primaryCategory?.id}
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Kategori Ağacı / Breadcrumb */}
      <nav
        aria-label="Sayfa yolu"
        className="flex flex-wrap items-center gap-1.5 py-1 text-xs text-muted-foreground"
      >
        <Link href="/" className="transition-colors hover:text-foreground">
          Ana Sayfa
        </Link>
        <span>/</span>
        <Link href="/katalog" className="transition-colors hover:text-foreground">
          Katalog
        </Link>
        {primaryCategory && (
          <>
            <span>/</span>
            <Link
              href={`/kategori/${primaryCategory.slug}`}
              className="transition-colors hover:text-foreground"
            >
              {primaryCategory.name}
            </Link>
          </>
        )}
        <span>/</span>
        <span className="font-medium text-foreground">{product.title}</span>
      </nav>

      {/* Ürün Galeri + Varyant ve Sepet Alanı */}
      <div className="mt-2.5 sm:mt-3">
        <ProductDetailClient
          productId={product.id}
          productSlug={product.slug}
          productTitle={product.title}
          subtitle={product.subtitle}
          brandName={product.brand?.name ?? null}
          images={product.images.map((i) => ({
            id: i.id,
            url: i.url,
            alt: i.alt,
          }))}
          options={clientOptions}
          variants={clientVariants}
          initialWishlisted={wishlistedCount > 0}
          customerEmail={customer?.email ?? null}
          installmentSettings={installmentSettings}
          sizeGuideType={product.sizeGuideType}
          sizeGuideData={product.sizeGuideData}
          categoryName={primaryCategory?.name ?? null}
          productClubPrice={product.clubPrice}
          isCustomerLoggedIn={Boolean(customer)}
          clubSettings={clubSettings}
        />
      </div>

      <div className="mt-10 sm:mt-12 space-y-10 sm:space-y-12">
        {/* Açıklama, Özellikler ve Gizli Paketleme Açılır Sekmeler */}
        <section className="border-t border-border pt-8">
          <ProductAccordion
            description={product.description}
            attributes={product.attributes.map((attr) => {
              let displayValue = attr.valueText ?? "";
              if (
                attr.attribute.kind === "NUMBER" &&
                attr.valueNumber !== null
              ) {
                displayValue = `${attr.valueNumber}${
                  attr.attribute.unit ? ` ${attr.attribute.unit}` : ""
                }`;
              } else if (
                attr.attribute.kind === "BOOLEAN" &&
                attr.valueBool !== null
              ) {
                displayValue = attr.valueBool ? "Evet" : "Hayır";
              } else if (attr.valueList.length > 0) {
                displayValue = attr.valueList.join(", ");
              }
              return {
                id: attr.id,
                label: attr.attribute.label,
                value: displayValue || "-",
              };
            })}
            brandName={product.brand?.name ?? null}
            categoryName={primaryCategory?.name ?? null}
          />
        </section>

      {/* Kombini Tamamla (Bundle / Frequently Bought Together) */}
      {relatedList.length > 0 && (
        <section className="border-t border-border pt-10">
          <BundleSection
            mainProduct={{
              id: product.id,
              title: product.title,
              slug: product.slug,
              variantId: clientVariants[0]?.id ?? "",
              variantTitle: clientVariants[0]?.title ?? null,
              price: clientVariants[0]?.effectivePrice ?? product.minPrice ?? 0,
              compareAtPrice: clientVariants[0]?.compareAtPrice ?? null,
              imageUrl: product.images[0]?.url ?? null,
            }}
            complementaryProducts={relatedList.slice(0, 2).map((rel) => ({
              id: rel.id,
              title: rel.title,
              slug: rel.slug,
              variantId: rel.variants[0]?.id ?? "",
              variantTitle: null,
              price: rel.minPrice ?? 0,
              compareAtPrice: rel.variants[0]?.compareAtPrice ?? null,
              imageUrl: rel.images[0]?.url ?? null,
            }))}
          />
        </section>
      )}

      {/* Müşteri Değerlendirmeleri (Fotoğraflı & Beden/Kalıp Filtreli) */}
      <section className="border-t border-border pt-10 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Müşteri Değerlendirmeleri ({product.reviews.length})
          </h2>
          {avgRating !== null && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Ortalama Puan: {avgRating.toFixed(1)} / 5.0
            </p>
          )}
        </div>

        <ProductReviewsFiltered
          productId={product.id}
          productSlug={product.slug}
          reviews={product.reviews.map((rev) => ({
            id: rev.id,
            authorName: rev.authorName,
            rating: rev.rating,
            title: rev.title,
            body: rev.body,
            createdAt: rev.createdAt,
            isVerifiedPurchase: rev.isVerifiedPurchase,
            heightCm: rev.heightCm,
            weightKg: rev.weightKg,
            sizePurchased: rev.sizePurchased,
            fitRating: rev.fitRating,
            images: rev.images,
            reply: rev.reply,
          }))}
          defaultAuthorName={
            customer
              ? `${customer.firstName} ${customer.lastName}`.trim()
              : undefined
          }
          availableSizes={clientVariants.map((v) => v.title)}
        />
      </section>

      {/* İlişkili / Birlikte İncelenen Ürünler */}
      {relatedList.length > 0 && (
        <section className="border-t border-border pt-10 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Birlikte İncelenen ve Tamamlayıcı Ürünler
              </h2>
              <p className="text-xs text-muted-foreground">
                Bu ürünü inceleyen ziyaretçilerin ilgi gösterdiği diğer ürünler
              </p>
            </div>
            <Link
              href="/katalog"
              className="text-xs font-medium text-primary hover:underline"
            >
              Tümünü Gör
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {relatedList.map((rel) => (
              <ProductCard
                key={rel.id}
                product={{
                  id: rel.id,
                  slug: rel.slug,
                  title: rel.title,
                  subtitle: rel.subtitle,
                  minPrice: rel.minPrice,
                  maxPrice: rel.maxPrice,
                  totalStock: rel.totalStock,
                  brandName: rel.brand?.name ?? null,
                  imageUrl: rel.images[0]?.url ?? null,
                  compareAtPrice: rel.variants[0]?.compareAtPrice ?? null,
                  clubPrice: rel.variants[0]?.clubPrice ?? null,
                  variants: rel.variants,
                }}
              />
            ))}
          </div>
        </section>
      )}
      </div>
    </div>
  );
}
