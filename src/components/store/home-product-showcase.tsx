"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Flame, Sparkle, Tag, Star } from "@phosphor-icons/react";
import { ProductCard, type ProductCardData } from "@/components/store/product-card";

interface HomeProductShowcaseProps {
  products: ProductCardData[];
  title?: string;
  subtitle?: string;
  scarcityEnabled?: boolean;
  scarcityThreshold?: number;
  quickAddEnabled?: boolean;
  savingsBadgeEnabled?: boolean;
  reviewStarsEnabled?: boolean;
}

type FilterTab = "all" | "bestseller" | "newest" | "discount";

export function HomeProductShowcase({
  products,
  title = "Öne Çıkan Koleksiyonlar",
  subtitle = "Seçkin kumaşlar, zamansız kalıplar ve güncel sezon trendleri",
  scarcityEnabled = true,
  scarcityThreshold = 5,
  quickAddEnabled = true,
  savingsBadgeEnabled = true,
  reviewStarsEnabled = true,
}: HomeProductShowcaseProps) {
  const [activeTab, setActiveTab] = React.useState<FilterTab>("all");

  const filteredProducts = React.useMemo(() => {
    switch (activeTab) {
      case "bestseller":
        // Satış adedine veya compareAtPrice'a göre sırala
        return [...products].sort(
          (a, b) => (b.minPrice ?? 0) - (a.minPrice ?? 0)
        );
      case "newest":
        // En yeni ürünler
        return [...products].slice().reverse();
      case "discount":
        // İndirimli ürünler (compareAtPrice > minPrice)
        return products.filter(
          (p) =>
            p.compareAtPrice &&
            p.minPrice &&
            p.compareAtPrice > p.minPrice
        );
      case "all":
      default:
        return products;
    }
  }, [activeTab, products]);

  const displayList = filteredProducts.length > 0 ? filteredProducts : products;

  return (
    <section className="space-y-6">
      {/* Başlık ve Sekmeler Satırı */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-[var(--border)] pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--accent)]">
            <Tag className="h-3.5 w-3.5" />
            <span>Hızlı Ürün Vitrini</span>
          </div>
          <h2 className="font-[family-name:var(--font-serif)] text-2xl sm:text-3xl font-bold tracking-tight text-[var(--ink)]">
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs sm:text-sm text-muted-foreground max-w-xl">
              {subtitle}
            </p>
          )}
        </div>

        {/* Hızlı Filtre Sekmeleri (Tab Bar) */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 sm:pb-0">
          {[
            { id: "all", label: "Tüm Ürünler" },
            { id: "bestseller", label: "Çok Satanlar" },
            { id: "newest", label: "Yeni Gelenler" },
            { id: "discount", label: "Fırsat Ürünleri" },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as FilterTab)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? "bg-[var(--ink)] text-[var(--card)] shadow-xs"
                    : "bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--ink)] border border-[var(--border)]"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Ürün Izgarası: Mobilde 2 Sütun, Masaüstünde 4 Sütun (Kolay ve Hızlı Alışveriş) */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
        {displayList.slice(0, 8).map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            showScarcity={scarcityEnabled}
            scarcityThreshold={scarcityThreshold}
            showQuickAdd={quickAddEnabled}
            showSavings={savingsBadgeEnabled}
            showStars={reviewStarsEnabled}
          />
        ))}
      </div>

      {/* Alt Aksiyon Butonu */}
      <div className="pt-2 text-center">
        <Link
          href="/katalog"
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-6 py-2.5 text-xs font-bold text-[var(--ink)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all shadow-2xs"
        >
          <span>Tüm Kataloğu İncele ({products.length > 8 ? `+${products.length - 8} Ürün Daha` : "Tümü"})</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </section>
  );
}
