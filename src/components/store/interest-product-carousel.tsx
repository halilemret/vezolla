"use client";

import * as React from "react";
import Link from "next/link";
import { CaretLeft, CaretRight, Sparkle, Fire, Eye, Crown } from "@phosphor-icons/react";
import { formatMoney } from "@/lib/money";
import { Badge } from "@/components/ui/badge";

export interface CarouselProduct {
  id: string;
  slug: string;
  title: string;
  subtitle?: string | null;
  minPrice: number;
  compareAtPrice?: number | null;
  clubPrice?: number | null;
  imageUrl?: string | null;
  brandName?: string | null;
  badge?: string | null;
}

interface InterestProductCarouselProps {
  products: CarouselProduct[];
  isReturningVisitor: boolean;
}

export function InterestProductCarousel({
  products,
  isReturningVisitor,
}: InterestProductCarouselProps) {
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [isPaused, setIsPaused] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const itemsPerView = 5;
  const maxIndex = Math.max(0, products.length - itemsPerView);

  // Belirli aralıklarla (4.5 saniye) otomatik kayma
  React.useEffect(() => {
    if (products.length <= itemsPerView || isPaused) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev >= maxIndex ? 0 : prev + 1));
    }, 4500);

    return () => clearInterval(interval);
  }, [products.length, maxIndex, isPaused]);

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev <= 0 ? maxIndex : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev >= maxIndex ? 0 : prev + 1));
  };

  if (products.length === 0) return null;

  return (
    <section
      className="my-8 rounded-[var(--radius-base,0.75rem)] border border-[var(--border)] bg-[var(--card)] p-4 sm:p-6 shadow-xs"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      aria-label="İlginizi Çekebilir"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-base,0.375rem)] bg-[var(--accent)] text-[var(--accent-fg)]">
            {isReturningVisitor ? (
              <Eye className="h-4 w-4" weight="bold" />
            ) : (
              <Fire className="h-4 w-4" weight="fill" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-[var(--ink)] sm:text-lg">
                İlginizi Çekebilir
              </h2>
              <Badge variant="neutral" className="text-[10px] font-semibold border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]">
                {isReturningVisitor ? "Sizin İçin Seçtik" : "En Çok Ziyaret Edilenler"}
              </Badge>
            </div>
            <p className="text-xs text-[var(--muted)]">
              {isReturningVisitor
                ? "Daha önce incelediğiniz parçalar ve zevkinize uygun öneriler"
                : "Vezolla müşterilerinin bu hafta en çok incelediği ve tercih ettiği parçalar"}
            </p>
          </div>
        </div>

        {/* Masaüstü Gezinme Butonları */}
        {products.length > itemsPerView && (
          <div className="hidden sm:flex items-center gap-1.5">
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Önceki ürünler"
              className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-base,0.375rem)] border border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] shadow-2xs hover:border-[var(--ink)] active:scale-95 transition-all cursor-pointer"
            >
              <CaretLeft className="h-4 w-4" weight="bold" />
            </button>
            <span className="px-1 text-xs font-mono text-[var(--muted)]">
              {currentIndex + 1} / {maxIndex + 1}
            </span>
            <button
              type="button"
              onClick={handleNext}
              aria-label="Sonraki ürünler"
              className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-base,0.375rem)] border border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] shadow-2xs hover:border-[var(--ink)] active:scale-95 transition-all cursor-pointer"
            >
              <CaretRight className="h-4 w-4" weight="bold" />
            </button>
          </div>
        )}
      </div>

      {/* Masaüstü: 5'li Kayan Pencere; Mobilde: Yatay Akıcı Kaydırma */}
      <div className="relative mt-4 overflow-hidden" ref={containerRef}>
        {/* Masaüstü Görünüm (5 Ürün) */}
        <div className="hidden sm:grid sm:grid-cols-5 gap-3.5 transition-all duration-300">
          {products
            .slice(currentIndex, currentIndex + itemsPerView)
            .concat(
              products.length < itemsPerView
                ? []
                : products.slice(
                    0,
                    Math.max(0, itemsPerView - (products.length - currentIndex))
                  )
            )
            .slice(0, itemsPerView)
            .map((item) => (
              <CarouselCard key={item.id} product={item} />
            ))}
        </div>

        {/* Mobil Görünüm (Sığdığı kadar ve parmakla kaydırma) */}
        <div className="flex sm:hidden gap-3 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory">
          {products.map((item) => (
            <div key={item.id} className="w-[160px] shrink-0 snap-start">
              <CarouselCard product={item} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CarouselCard({ product }: { product: CarouselProduct }) {
  const discountRate =
    product.compareAtPrice && product.compareAtPrice > product.minPrice
      ? Math.round(
          ((product.compareAtPrice - product.minPrice) / product.compareAtPrice) * 100
        )
      : 0;

  const clubPrice = product.clubPrice ?? null;
  const hasClubDiscount =
    typeof clubPrice === "number" && clubPrice > 0 && clubPrice < product.minPrice;

  return (
    <Link
      href={`/urun/${product.slug}`}
      className="group flex flex-col justify-between rounded-[var(--radius-base,0.5rem)] border border-[var(--border)] bg-[var(--surface)] p-2.5 transition-all hover:border-[var(--ink)] hover:shadow-xs"
    >
      <div>
        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[var(--radius-base,0.375rem)] border border-[var(--border)] bg-[var(--card)]">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.imageUrl}
              alt={product.title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-[var(--muted)]">
              Görsel yok
            </div>
          )}

          {discountRate > 0 && (
            <span className="absolute left-1.5 top-1.5 rounded-[var(--radius-base,0.25rem)] bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--accent-fg)] shadow-xs">
              %{discountRate}
            </span>
          )}

          {hasClubDiscount && (
            <span className="absolute right-1.5 top-1.5 flex items-center gap-0.5 rounded-[var(--radius-base,0.25rem)] bg-amber-500/95 text-zinc-950 px-1.5 py-0.5 text-[9px] font-bold shadow-xs">
              <Crown className="h-2.5 w-2.5 text-zinc-950" weight="fill" />
              <span>Kulüp</span>
            </span>
          )}
        </div>

        <div className="mt-2 space-y-0.5">
          {product.brandName && (
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
              {product.brandName}
            </p>
          )}
          <h3 className="line-clamp-2 text-xs font-semibold text-[var(--ink)] group-hover:text-[var(--accent)] transition-colors">
            {product.title}
          </h3>
        </div>
      </div>

      <div className="mt-2 pt-1.5 border-t border-[var(--border)]">
        <div className="flex items-baseline gap-1.5">
          <span className="text-xs font-bold text-[var(--ink)] tabular-nums">
            {formatMoney(product.minPrice, "TRY")}
          </span>
          {product.compareAtPrice && product.compareAtPrice > product.minPrice && (
            <span className="text-[10px] text-[var(--muted)] line-through tabular-nums">
              {formatMoney(product.compareAtPrice, "TRY")}
            </span>
          )}
        </div>

        {hasClubDiscount && (
          <div className="mt-1 flex items-center justify-between gap-1 rounded-[var(--radius-base,0.25rem)] border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5">
            <div className="flex items-center gap-0.5">
              <Crown className="h-2.5 w-2.5 text-amber-600 dark:text-amber-400 shrink-0" weight="fill" />
              <span className="text-[9px] font-bold text-amber-800 dark:text-amber-300">Kulüp</span>
            </div>
            <span className="text-[10px] font-black text-[var(--ink)] tabular-nums">
              {formatMoney(clubPrice, "TRY")}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}
