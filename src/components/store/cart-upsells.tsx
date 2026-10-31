"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Check, Package, Sparkle } from "@phosphor-icons/react";
import { formatMoney } from "@/lib/money";
import type { CartUpsellItem } from "@/modules/checkout/upsell";

export interface CartUpsellsProps {
  items?: CartUpsellItem[];
  onAddToCart: (variantId: string) => Promise<void> | void;
  currency?: string;
  className?: string;
  excludeVariantIds?: string[];
}

export function CartUpsells({
  items: initialItems,
  onAddToCart,
  currency = "TRY",
  className = "",
  excludeVariantIds = [],
}: CartUpsellsProps) {
  const [items, setItems] = React.useState<CartUpsellItem[]>(initialItems ?? []);
  const [loadingVariantId, setLoadingVariantId] = React.useState<string | null>(null);
  const [addedVariantId, setAddedVariantId] = React.useState<string | null>(null);

  const excludeKey = excludeVariantIds.join(",");

  React.useEffect(() => {
    if (initialItems && initialItems.length > 0) {
      setItems(initialItems);
      return;
    }

    let isMounted = true;
    async function fetchUpsells() {
      try {
        const queryParam = excludeKey ? `?exclude=${encodeURIComponent(excludeKey)}` : "";
        const res = await fetch(`/api/store/cart/upsells${queryParam}`);
        if (!res.ok) return;
        const data = (await res.json()) as { items?: CartUpsellItem[] };
        if (isMounted && data.items && Array.isArray(data.items)) {
          setItems(data.items);
        }
      } catch {
        // Hata durumunda sessizce geç
      }
    }

    void fetchUpsells();
    return () => {
      isMounted = false;
    };
  }, [initialItems, excludeKey]);

  // Sepetteki ürünleri anında hariç tut
  const visibleItems = React.useMemo(() => {
    if (excludeVariantIds.length === 0) return items;
    const excludedSet = new Set(excludeVariantIds);
    return items.filter((item) => !excludedSet.has(item.variantId));
  }, [items, excludeVariantIds]);

  if (visibleItems.length === 0) {
    return null;
  }

  async function handleAdd(variantId: string) {
    if (loadingVariantId) return; // Çift tıklama / eşzamanlı istek koruması
    setLoadingVariantId(variantId);
    try {
      await onAddToCart(variantId);
      setAddedVariantId(variantId);
      setTimeout(() => setAddedVariantId(null), 2000);
    } finally {
      setLoadingVariantId(null);
    }
  }

  return (
    <div
      className={`rounded-[var(--radius-base,0.375rem)] border border-[var(--border)] bg-[var(--card)] p-3 space-y-2 shadow-2xs ${className}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--ink)]">
          <Sparkle className="h-3.5 w-3.5 text-[var(--accent)]" weight="fill" />
          <span>Sepetinizi Tamamlayın (1-Tıkla Ekle)</span>
        </div>
        <span className="text-[10px] text-[var(--muted)] font-medium">100 - 300 TL</span>
      </div>

      <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none">
        {visibleItems.map((item) => {
          const isLoading = loadingVariantId === item.variantId;
          const isJustAdded = addedVariantId === item.variantId;

          return (
            <div
              key={item.id}
              className="flex w-44 shrink-0 flex-col justify-between rounded-[var(--radius-base,0.375rem)] border border-[var(--border)] bg-[var(--surface)] p-2 transition-all hover:border-[var(--accent)]/40"
            >
              <div className="space-y-1.5">
                <Link
                  href={`/urun/${item.slug}`}
                  className="relative aspect-square w-full overflow-hidden rounded-[var(--radius-base,0.25rem)] border border-[var(--border)] bg-[var(--card)] block"
                >
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[var(--muted)]">
                      <Package className="h-6 w-6" />
                    </div>
                  )}
                </Link>

                <div>
                  <Link
                    href={`/urun/${item.slug}`}
                    className="line-clamp-1 text-[11px] font-semibold text-[var(--ink)] hover:text-[var(--accent)] transition-colors block"
                    title={item.title}
                  >
                    {item.title}
                  </Link>

                  <div className="flex items-baseline gap-1.5 pt-0.5">
                    <span className="text-xs font-bold font-mono text-[var(--ink)] tabular-nums">
                      {formatMoney(item.priceMinor, currency)}
                    </span>
                    {item.compareAtPriceMinor &&
                      item.compareAtPriceMinor > item.priceMinor && (
                        <span className="text-[10px] text-[var(--muted)] line-through font-mono tabular-nums">
                          {formatMoney(item.compareAtPriceMinor, currency)}
                        </span>
                      )}
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => handleAdd(item.variantId)}
                  aria-label={`${item.title} ürününü sepete ekle`}
                  className={`flex h-7 w-full items-center justify-center gap-1 rounded-[var(--radius-base,0.25rem)] text-[11px] font-semibold transition-all active:scale-95 cursor-pointer ${
                    isJustAdded
                      ? "bg-emerald-600 text-white"
                      : "bg-[var(--accent)] text-[var(--accent-fg)] hover:opacity-95"
                  }`}
                >
                  {isJustAdded ? (
                    <>
                      <Check className="h-3.5 w-3.5" weight="bold" />
                      <span>Eklendi</span>
                    </>
                  ) : (
                    <>
                      <Plus className="h-3.5 w-3.5" weight="bold" />
                      <span>{isLoading ? "..." : "Ekle"}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
