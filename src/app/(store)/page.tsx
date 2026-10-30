import * as React from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { Clock, ShieldCheck, CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { db } from "@/lib/db";
import { VISITOR_COOKIE, getCurrentCustomer } from "@/lib/auth/session";
import {
  extractAttributionFromUrl,
  resolveVisitorAttribution,
} from "@/modules/personalization/attribution";
import { resolveVisitorSegments } from "@/modules/personalization/segments";
import {
  getRecommendedProducts,
  type RecommendationSource,
} from "@/modules/personalization/recommendations";
import { selectDeterministicVariant } from "@/modules/personalization/experiments";
import { getConversionSettings } from "@/lib/settings/service";
import { ProductCard } from "@/components/store/product-card";
import { TrustBadges } from "@/components/store/trust-badges";
import { FlashDealsBanner } from "@/components/store/flash-deals-banner";
import { HomeProductShowcase } from "@/components/store/home-product-showcase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export default async function StoreHomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const visitorId = cookieStore.get(VISITOR_COOKIE)?.value ?? null;
  const customer = await getCurrentCustomer();

  const landingTouch = extractAttributionFromUrl(params);
  const [
    resolvedSegments,
    resolvedAd,
    conversionSettings,
    blocks,
    topCategories,
    reviewStats,
    showcaseProducts,
  ] = await Promise.all([
    resolveVisitorSegments({
      visitorId,
      customerId: customer?.id ?? null,
      touch: landingTouch,
    }),
    resolveVisitorAttribution({
      visitorId,
      touch: landingTouch,
    }),
    getConversionSettings(),
    db.homeBlock.findMany({
      where: { page: "home", isActive: true },
      include: {
        variants: {
          include: { segment: true },
          orderBy: { createdAt: "asc" },
        },
        experiments: {
          where: { status: "RUNNING" },
          include: { variants: true },
          take: 1,
        },
      },
      orderBy: { position: "asc" },
    }),
    db.category.findMany({
      where: { isActive: true, parentId: null },
      orderBy: { position: "asc" },
      take: 12,
    }),
    db.review.aggregate({
      where: { status: "APPROVED" },
      _avg: { rating: true },
      _count: { id: true },
    }),
    getRecommendedProducts({
      source: "cold_start",
      visitorId,
      customerId: customer?.id ?? null,
      touch: landingTouch,
      limit: 12,
    }),
  ]);

  const hasHeroBlock = blocks.some((b) => b.type === "hero_banner");

  const activeSegmentIds = resolvedSegments.segments.map((s) => s.id);
  const primarySegment = resolvedSegments.primarySegment;

  // Eğer reklama tıklandığında özel ürünler eşleşmişse (ad_id, campaign_id, utm_campaign)
  const adFeaturedProducts =
    resolvedAd.featuredProductIds.length > 0
      ? await getRecommendedProducts({
          source: "ad_campaign",
          visitorId,
          customerId: customer?.id ?? null,
          touch: landingTouch,
          segmentIds: activeSegmentIds,
          limit: 4,
          strictSource: true,
        })
      : [];

  return (
    <div className="space-y-12">
      {/* Reklam kimliğinden gelen ziyaretçiye özel kampanya bandı */}
      {resolvedAd.primaryMapping && adFeaturedProducts.length > 0 ? (
        <section className="rounded-md border border-[#fed7aa] bg-[#fff7ed] p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <Badge variant="accent">Kampanya Seçkisi: {resolvedAd.primaryMapping.name}</Badge>
              <h2 className="mt-1.5 font-[family-name:var(--font-serif)] text-2xl text-zinc-900">
                İlgilendiğiniz Reklamdaki Ürünler ve Tamamlayıcıları
              </h2>
            </div>
            <Link href="/katalog" className="text-xs font-medium text-[#9a3412] hover:underline">
              Tüm Kataloğu Gör
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
            {adFeaturedProducts.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                showScarcity={conversionSettings.scarcityWarningEnabled}
                scarcityThreshold={conversionSettings.scarcityStockThreshold}
                showQuickAdd={conversionSettings.quickAddToCartEnabled}
                showSavings={conversionSettings.showSavingsBadge}
                showStars={conversionSettings.showReviewStars}
              />
            ))}
          </div>
        </section>
      ) : null}

      {blocks.length === 0 ? (
        showcaseProducts.length > 0 ? (
          <HomeProductShowcase
            products={showcaseProducts}
            title="Öne Çıkan Seçkiler"
            subtitle="Çok satanlar, yeni gelenler ve anlık indirimli parçalar"
            scarcityEnabled={conversionSettings.scarcityWarningEnabled}
            scarcityThreshold={conversionSettings.scarcityStockThreshold}
            quickAddEnabled={conversionSettings.quickAddToCartEnabled}
            savingsBadgeEnabled={conversionSettings.showSavingsBadge}
            reviewStarsEnabled={conversionSettings.showReviewStars}
          />
        ) : (
          <EmptyState
            title="Vitrin ana sayfası henüz yapılandırılmadı"
            description="Yönetim panelindeki Blok Düzenleyici ekranından karşılama alanı, kişiselleştirilmiş ürün şeritleri ve kategori vitrinleri ekleyebilirsiniz."
            actionLabel="Blok Düzenleyiciyi Aç"
            actionHref="/admin/icerik/bloklar"
          />
        )
      ) : (
        <>
          {!hasHeroBlock && showcaseProducts.length > 0 ? (
            <HomeProductShowcase
              products={showcaseProducts}
              title="Öne Çıkan Seçkiler"
              subtitle="Çok satanlar, yeni gelenler ve anlık indirimli parçalar"
              scarcityEnabled={conversionSettings.scarcityWarningEnabled}
              scarcityThreshold={conversionSettings.scarcityStockThreshold}
              quickAddEnabled={conversionSettings.quickAddToCartEnabled}
              savingsBadgeEnabled={conversionSettings.showSavingsBadge}
              reviewStarsEnabled={conversionSettings.showReviewStars}
            />
          ) : null}
          {blocks.map(async (block) => {
          // 1. Önce ziyaretçinin eşleştiği en yüksek öncelikli segmente ait varyantı ara
          let chosenVariant = null;
          for (const segId of activeSegmentIds) {
            const match = block.variants.find((v) => v.segmentId === segId);
            if (match) {
              chosenVariant = match;
              break;
            }
          }

          // 2. Segment varyantı yoksa ve çalışan A/B testi varsa deterministik varyant ata
          const runningExp = block.experiments[0];
          if (!chosenVariant && runningExp && runningExp.variants.length > 1) {
            const assigned = selectDeterministicVariant(
              runningExp.id,
              visitorId ?? "anon",
              runningExp.variants
            );
            if (assigned) {
              chosenVariant = block.variants.find((v) => v.id === assigned.id) ?? null;
            }
          }

          // 3. Hiçbiri yoksa varsayılan varyantı (segmentId === null) kullan
          if (!chosenVariant) {
            chosenVariant =
              block.variants.find((v) => v.segmentId === null) ?? block.variants[0] ?? null;
          }

          if (!chosenVariant || chosenVariant.isHidden) {
            return null;
          }

          const cfg =
            chosenVariant.config &&
            typeof chosenVariant.config === "object" &&
            !Array.isArray(chosenVariant.config)
              ? (chosenVariant.config as Record<string, unknown>)
              : {};

          if (block.type === "hero_banner") {
            const headline = String(cfg.headline ?? "Yeni Sezon Seçkisi");
            const subheadline = String(cfg.subheadline ?? "");
            const ctaLabel = String(cfg.ctaLabel ?? "Kataloğu İncele");
            const ctaHref = String(cfg.ctaHref ?? "/katalog");
            const imageUrl = String(cfg.imageUrl ?? "");

            return (
              <React.Fragment key={block.id}>
                <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-xs">
                  <div className="grid items-center gap-8 p-6 sm:p-10 lg:grid-cols-12">
                    <div className={imageUrl ? "lg:col-span-7 space-y-5" : "lg:col-span-12 max-w-2xl space-y-5"}>
                      <div className="flex flex-wrap items-center gap-2">
                        {chosenVariant.segment ? (
                          <span className="rounded-md bg-[var(--surface)] border border-[var(--border)] px-2.5 py-1 text-xs font-semibold text-[var(--ink)]">
                            {chosenVariant.segment.name}
                          </span>
                        ) : primarySegment ? (
                          <span className="rounded-md bg-[var(--surface)] border border-[var(--border)] px-2.5 py-1 text-xs font-semibold text-[var(--ink)]">
                            {primarySegment.name}
                          </span>
                        ) : (
                          <span className="rounded-md bg-[var(--surface)] border border-[var(--border)] px-2.5 py-1 text-xs font-semibold text-[var(--ink)]">
                            Yeni Sezon Özel Koleksiyon
                          </span>
                        )}
                        <span className="rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                          Ücretsiz Kargo Fırsatı
                        </span>
                      </div>

                      <h1 className="font-[family-name:var(--font-serif)] text-3xl font-bold tracking-tight text-[var(--ink)] sm:text-5xl sm:leading-[1.15]">
                        {headline}
                      </h1>
                      {subheadline ? (
                        <p className="text-sm leading-relaxed text-muted-foreground sm:text-base max-w-xl">
                          {subheadline}
                        </p>
                      ) : null}

                      <div className="flex flex-wrap items-center gap-3 pt-2">
                        <Link href={ctaHref}>
                          <Button size="lg" className="rounded-xl px-7 text-sm font-bold shadow-md shadow-zinc-900/10">
                            {ctaLabel}
                          </Button>
                        </Link>
                        <Link href="/katalog?filter=bestseller">
                          <Button variant="outline" size="lg" className="rounded-xl px-6 text-sm font-semibold">
                            En Çok Satan Ürünler
                          </Button>
                        </Link>
                      </div>

                      {/* Doğrulanmış Güven Göstergeleri */}
                      <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-[var(--border)] text-xs font-medium text-muted-foreground">
                        {reviewStats._count.id > 0 && reviewStats._avg.rating ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-amber-500 font-bold">★★★★★</span>
                            <span className="font-bold text-[var(--ink)]">
                              {reviewStats._avg.rating.toFixed(1)}/5
                            </span>
                            <span className="text-muted-foreground">
                              ({reviewStats._count.id} Doğrulanmış Değerlendirme)
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-[var(--ink)]">
                            <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" weight="fill" />
                            <span className="font-semibold">%100 Doğrulanmış Müşteri Memnuniyeti</span>
                          </div>
                        )}
                        <span className="text-[var(--border)]">|</span>
                        <div className="flex items-center gap-1.5 text-[var(--ink)]">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span>Saat 16:00'ya Kadar Aynı Gün Sevk</span>
                        </div>
                        <span className="text-[var(--border)] hidden sm:inline">|</span>
                        <div className="flex items-center gap-1.5 text-[var(--ink)] hidden sm:inline-flex">
                          <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span>256-Bit Güvenli Ödeme</span>
                        </div>
                      </div>
                    </div>

                    {imageUrl ? (
                      <div className="lg:col-span-5 relative group">
                        <div className="relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-md">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={imageUrl}
                            alt={headline}
                            className="aspect-[4/3] w-full object-contain p-6 bg-[var(--surface)] transition-transform duration-700 group-hover:scale-105"
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                </section>

                <TrustBadges
                  enabled={conversionSettings.trustBadgesEnabled}
                  badge1Title={conversionSettings.trustBadge1Title}
                  badge1Desc={conversionSettings.trustBadge1Desc}
                  badge2Title={conversionSettings.trustBadge2Title}
                  badge2Desc={conversionSettings.trustBadge2Desc}
                  badge3Title={conversionSettings.trustBadge3Title}
                  badge3Desc={conversionSettings.trustBadge3Desc}
                  badge4Title={conversionSettings.trustBadge4Title}
                  badge4Desc={conversionSettings.trustBadge4Desc}
                />

                <FlashDealsBanner
                  enabled={conversionSettings.flashDealsEnabled}
                  badgeText={conversionSettings.flashDealsBadgeText}
                  title={conversionSettings.flashDealsTitle}
                  promoCode={conversionSettings.flashDealsPromoCode}
                  durationHours={conversionSettings.flashDealsDurationHours}
                  targetHref={conversionSettings.flashDealsTargetHref}
                />

                {/* Hızlı Ürün Keşfi / Vitrin: Müşterinin ilk girişte tek tıkla ürünleri görüp sepete atabilmesi için */}
                {showcaseProducts.length > 0 ? (
                  <HomeProductShowcase
                    products={showcaseProducts}
                    title="Öne Çıkan Seçkiler"
                    subtitle="Çok satanlar, yeni gelenler ve anlık indirimli parçalar"
                    scarcityEnabled={conversionSettings.scarcityWarningEnabled}
                    scarcityThreshold={conversionSettings.scarcityStockThreshold}
                    quickAddEnabled={conversionSettings.quickAddToCartEnabled}
                    savingsBadgeEnabled={conversionSettings.showSavingsBadge}
                    reviewStarsEnabled={conversionSettings.showReviewStars}
                  />
                ) : null}
              </React.Fragment>
            );
          }

          if (block.type === "product_rail") {
            const title = String(cfg.title ?? block.name);
            const subtitle = String(cfg.subtitle ?? "");
            const source = String(cfg.source ?? "cold_start") as RecommendationSource;
            const categoryId = cfg.categoryId ? String(cfg.categoryId) : null;
            const collectionId = cfg.collectionId ? String(cfg.collectionId) : null;
            const limit = Number(cfg.limit ?? 8);
            const hideIfEmpty = cfg.hideIfEmpty !== false;

            const products = await getRecommendedProducts({
              source,
              visitorId,
              customerId: customer?.id ?? null,
              touch: landingTouch,
              segmentIds: activeSegmentIds,
              categoryId,
              collectionId,
              limit,
              strictSource: source === "recently_viewed" || source === "abandoned_cart",
            });

            if (products.length === 0 && hideIfEmpty) {
              return null;
            }

            return (
              <section key={block.id} className="space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-2 border-b border-zinc-200 pb-3">
                  <div>
                    <h2 className="font-[family-name:var(--font-serif)] text-2xl text-zinc-900">
                      {title}
                    </h2>
                    {subtitle ? <p className="text-xs text-zinc-600">{subtitle}</p> : null}
                  </div>
                  <Link href="/katalog" className="text-xs font-medium text-[#9a3412] hover:underline">
                    Tümünü İncele
                  </Link>
                </div>

                {products.length === 0 ? (
                  <p className="text-xs text-zinc-600">Bu bölümde henüz gösterilecek ürün yok.</p>
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
              </section>
            );
          }

          if (block.type === "category_grid") {
            const title = String(cfg.title ?? "Kategoriler");
            const subtitle = String(cfg.subtitle ?? "");
            const limit = Number(cfg.limit ?? 6);
            const cats = topCategories.slice(0, limit);

            if (cats.length === 0) return null;

            return (
              <section key={block.id} className="space-y-4">
                <div className="border-b border-zinc-200 pb-3">
                  <h2 className="font-[family-name:var(--font-serif)] text-2xl text-zinc-900">
                    {title}
                  </h2>
                  {subtitle ? <p className="text-xs text-zinc-600">{subtitle}</p> : null}
                </div>
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                  {cats.map((c) => (
                    <Link
                      key={c.id}
                      href={`/kategori/${c.slug}`}
                      className="flex items-center justify-between rounded-md border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-400"
                    >
                      <div>
                        <h3 className="text-sm font-semibold text-zinc-900">{c.name}</h3>
                        {c.description ? (
                          <p className="mt-0.5 line-clamp-1 text-xs text-zinc-600">
                            {c.description}
                          </p>
                        ) : null}
                      </div>
                      <span className="text-xs font-medium text-[#9a3412]">İncele</span>
                    </Link>
                  ))}
                </div>
              </section>
            );
          }

          if (block.type === "split_callout") {
            const title = String(cfg.title ?? block.name);
            const body = String(cfg.body ?? "");
            const ctaLabel = String(cfg.ctaLabel ?? "Ürünleri Gör");
            const ctaHref = String(cfg.ctaHref ?? "/katalog");

            return (
              <section
                key={block.id}
                className="rounded-md border border-zinc-200 bg-white p-6 sm:p-8"
              >
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div className="max-w-xl space-y-1.5">
                    <h2 className="font-[family-name:var(--font-serif)] text-2xl text-zinc-900">
                      {title}
                    </h2>
                    <p className="text-sm text-zinc-600">{body}</p>
                  </div>
                  <Link href={ctaHref}>
                    <Button variant="outline">{ctaLabel}</Button>
                  </Link>
                </div>
              </section>
            );
          }

          if (block.type === "rich_text") {
            const title = String(cfg.title ?? "");
            const html = String(cfg.html ?? "");
            return (
              <section
                key={block.id}
                className="rounded-md border border-zinc-200 bg-white p-6 space-y-2"
              >
                {title ? (
                  <h2 className="font-[family-name:var(--font-serif)] text-xl text-zinc-900">
                    {title}
                  </h2>
                ) : null}
                <div
                  className="prose prose-sm max-w-none text-zinc-700"
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              </section>
            );
          }

          return null;
        })}
        </>
      )}
    </div>
  );
}
