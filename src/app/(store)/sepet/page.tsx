import type { Metadata } from "next";
import { CheckCircle, WarningCircle, ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import { db } from "@/lib/db";
import {
  computeCartSummary,
  restoreCartFromRecoveryToken,
} from "@/modules/checkout/cart";
import { getRecommendedProducts } from "@/modules/personalization/recommendations";
import { getClubSettings } from "@/lib/settings/service";
import { ProductCard } from "@/components/store/product-card";
import { CartClient } from "./cart-client";

export const metadata: Metadata = {
  title: "Alışveriş Sepeti",
};

interface CartPageProps {
  searchParams: Promise<{ recover?: string; code?: string }>;
}

export default async function CartPage({ searchParams }: CartPageProps) {
  const params = await searchParams;
  let recoveryNotice: { ok: boolean; message: string } | null = null;

  if (params.recover) {
    const res = await restoreCartFromRecoveryToken(params.recover, params.code);
    if (res.ok) {
      recoveryNotice = {
        ok: true,
        message: res.appliedCode
          ? `Sepetiniz geri yüklendi ve ${res.appliedCode} indirim kodu uygulandı.`
          : "Sepetiniz başarıyla geri yüklendi, alışverişinize kaldığınız yerden devam edebilirsiniz.",
      };
    } else {
      recoveryNotice = {
        ok: false,
        message: res.error ?? "Sepet kurtarma bağlantısı geçersiz veya süresi dolmuş.",
      };
    }
  }

  const [summary, availablePromotions, freeShippingThresholdMethod, clubSettings] =
    await Promise.all([
      computeCartSummary(),
      db.promotion.findMany({
        where: {
          isActive: true,
          code: { not: null },
          OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }],
        },
        take: 3,
        select: { code: true, name: true, type: true, value: true },
        orderBy: { priority: "desc" },
      }),
      db.shippingMethod.findFirst({
        where: { isActive: true, freeOverAmount: { not: null } },
        orderBy: { freeOverAmount: "asc" },
        select: { freeOverAmount: true },
      }),
      getClubSettings(),
    ]);

  const cartProductIds = summary.lines.map((l) => l.productId);

  const recommended =
    cartProductIds.length > 0
      ? await getRecommendedProducts({
          source: "associated",
          productIds: cartProductIds,
          limit: 4,
        })
      : await getRecommendedProducts({
          source: "cold_start",
          limit: 4,
        });

  const filteredRecs = recommended
    .filter((p) => !cartProductIds.includes(p.id))
    .slice(0, 4);

  const promoList = availablePromotions
    .filter((p) => Boolean(p.code))
    .map((p) => ({
      code: p.code!,
      name: p.name,
      type: p.type,
      value: p.value,
    }));

  return (
    <div className="mx-auto max-w-[1360px] px-2 sm:px-4 py-2 sm:py-3 space-y-4">
      {recoveryNotice && (
        <div
          className={`flex items-center gap-3 rounded-[var(--radius-base,0.375rem)] border p-3 text-xs font-medium ${
            recoveryNotice.ok
              ? "border-emerald-200 bg-emerald-50/50 text-emerald-900"
              : "border-amber-200 bg-amber-50/50 text-amber-900"
          }`}
        >
          {recoveryNotice.ok ? (
            <CheckCircle className="h-5 w-5 shrink-0 text-emerald-600" weight="fill" />
          ) : (
            <WarningCircle className="h-5 w-5 shrink-0 text-amber-600" weight="fill" />
          )}
          <span>{recoveryNotice.message}</span>
        </div>
      )}

      {/* Kompakt Sepet Başlığı ve Güvenlik Göstergesi */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-2.5">
        <div className="flex items-baseline gap-2">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--ink)]">
            Alışveriş Sepeti
          </h1>
          <span className="text-xs font-semibold text-[var(--muted)]">
            ({summary.itemCount} Ürün)
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-400">
          <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" weight="fill" />
          <span>256-Bit SSL Güvenli Alışveriş</span>
        </div>
      </div>

      <CartClient
        initialSummary={summary}
        freeShippingThresholdMinor={freeShippingThresholdMethod?.freeOverAmount ?? 150000}
        availablePromotions={promoList}
        clubSettings={clubSettings}
      />

      {filteredRecs.length > 0 && (
        <section className="border-t border-border pt-10 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Sepetinize Uygun Öneriler
            </h2>
            <p className="text-xs text-muted-foreground">
              Birlikte tercih edilen tamamlayıcı ürünler
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {filteredRecs.map((rel) => (
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
  );
}
