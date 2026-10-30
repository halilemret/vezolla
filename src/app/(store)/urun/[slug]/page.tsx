import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Star, CheckCircle as CheckCircle2 } from "@phosphor-icons/react/dist/ssr";
import { db } from "@/lib/db";
import { getCurrentCustomer } from "@/lib/auth/session";
import { resolveEffectiveVariantPrice } from "@/modules/checkout/cart";
import { getRecommendedProducts } from "@/modules/personalization/recommendations";
import { ProductViewBeacon } from "@/components/store/visitor-tracker";
import { ProductCard } from "@/components/store/product-card";
import { Badge } from "@/components/ui/badge";
import {
  ProductDetailClient,
  ProductReviewForm,
  type ClientProductOption,
  type ClientProductVariant,
} from "./product-detail-client";

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

  const [product, customer] = await Promise.all([
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
      availableStock,
      trackInventory: v.trackInventory,
      allowBackorder: v.allowBackorder,
      optionMap,
      imageUrl: v.image?.url ?? null,
    };
  });

  const associatedProducts = await getRecommendedProducts({
    source: "associated",
    productIds: [product.id],
    limit: 5,
  });
  const relatedList = associatedProducts
    .filter((p) => p.id !== product.id)
    .slice(0, 4);

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
        />
      </div>

      <div className="mt-10 sm:mt-12 space-y-10 sm:space-y-12">
        {/* Açıklama ve Teknik Özellikler */}
        <div className="grid grid-cols-1 gap-8 border-t border-border pt-10 lg:grid-cols-12">
        <div className="lg:col-span-7 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">
            Ürün Açıklaması
          </h2>
          {product.description ? (
            <div
              className="prose prose-sm max-w-none text-foreground/90 leading-relaxed space-y-3"
              dangerouslySetInnerHTML={{ __html: product.description }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Bu ürün için detaylı açıklama yakında eklenecektir.
            </p>
          )}
        </div>

        <div className="lg:col-span-5 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">
            Ürün Özellikleri
          </h2>
          {product.attributes.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-border">
                  {product.attributes.map((attr) => {
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

                    return (
                      <tr key={attr.id} className="bg-card">
                        <th className="w-2/5 bg-muted/40 px-3.5 py-2.5 text-left font-medium text-muted-foreground">
                          {attr.attribute.label}
                        </th>
                        <td className="px-3.5 py-2.5 text-foreground">
                          {displayValue || "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-card p-4 text-xs text-muted-foreground space-y-1.5">
              <p>
                <span className="font-medium text-foreground">Kategori:</span>{" "}
                {primaryCategory?.name ?? "Genel"}
              </p>
              {product.brand && (
                <p>
                  <span className="font-medium text-foreground">Marka:</span>{" "}
                  {product.brand.name}
                </p>
              )}
              {clientVariants[0]?.sku && (
                <p>
                  <span className="font-medium text-foreground">Stok Kodu:</span>{" "}
                  {clientVariants[0].sku}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Müşteri Değerlendirmeleri */}
      <section className="border-t border-border pt-10 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
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
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="lg:col-span-7 space-y-3">
            {product.reviews.length === 0 ? (
              <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
                Bu ürün için henüz onaylanmış bir değerlendirme bulunmuyor. İlk
                değerlendirmeyi siz yazabilirsiniz.
              </div>
            ) : (
              product.reviews.map((rev) => (
                <div
                  key={rev.id}
                  className="rounded-lg border border-border bg-card p-4 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        {rev.authorName}
                      </span>
                      {rev.isVerifiedPurchase && (
                        <Badge variant="success" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Doğrulanmış Alıcı
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(rev.createdAt).toLocaleDateString("tr-TR")}
                    </span>
                  </div>

                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`h-3.5 w-3.5 ${
                          s <= rev.rating
                            ? "fill-warning text-warning"
                            : "text-muted-foreground"
                        }`}
                      />
                    ))}
                  </div>

                  {rev.title && (
                    <p className="text-sm font-medium text-foreground">
                      {rev.title}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">{rev.body}</p>
                </div>
              ))
            )}
          </div>

          <div className="lg:col-span-5">
            <ProductReviewForm
              productId={product.id}
              productSlug={product.slug}
              defaultAuthorName={
                customer
                  ? `${customer.firstName} ${customer.lastName}`.trim()
                  : undefined
              }
            />
          </div>
        </div>
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
