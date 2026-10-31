"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Check, ShoppingBag, Sparkle } from "@phosphor-icons/react";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCart } from "@/components/store/cart-context";
import { addBundleToCartAction } from "@/modules/checkout/actions";

export interface BundleItem {
  id: string;
  title: string;
  slug: string;
  variantId: string;
  variantTitle?: string | null;
  price: number;
  compareAtPrice?: number | null;
  imageUrl?: string | null;
}

export interface BundleSectionProps {
  mainProduct: BundleItem;
  complementaryProducts: BundleItem[];
  currency?: string;
}

export function BundleSection({
  mainProduct,
  complementaryProducts,
  currency = "TRY",
}: BundleSectionProps) {
  const { openCart, refreshCart } = useCart();
  const allItems = React.useMemo(
    () => [mainProduct, ...complementaryProducts.slice(0, 2)],
    [mainProduct, complementaryProducts]
  );

  const [selectedIds, setSelectedIds] = React.useState<string[]>(() =>
    allItems.map((i) => i.id)
  );
  const [isAdding, setIsAdding] = React.useState(false);
  const [success, setSuccess] = React.useState(false);

  if (complementaryProducts.length === 0) {
    return null;
  }

  const selectedItems = allItems.filter((i) => selectedIds.includes(i.id));
  const isBundle = selectedItems.length >= 2;
  const subtotal = selectedItems.reduce((acc, i) => acc + i.price, 0);
  const discountBps = isBundle ? 1000 : 0; // Yalnızca en az 2 parça varsa %10 Set İndirimi
  const discountAmount = isBundle ? Math.round((subtotal * discountBps) / 10000) : 0;
  const finalPrice = Math.max(0, subtotal - discountAmount);

  function toggleItem(id: string) {
    if (id === mainProduct.id) return; // Ana ürün çıkarılamaz
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }

  async function handleAddBundle() {
    const variantIds = selectedItems.map((i) => i.variantId).filter(Boolean);
    if (variantIds.length === 0 || isAdding) return;
    setIsAdding(true);
    try {
      const res = await addBundleToCartAction(variantIds);
      if (res.ok) {
        setSuccess(true);
        await refreshCart();
        openCart();
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      console.error("[BundleSection] Sepete ekleme hatası:", err);
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6 shadow-xs space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-[var(--ink)]">
              Kombini Tamamla
            </h3>
            {isBundle ? (
              <Badge variant="accent" className="gap-1 font-bold">
                <Sparkle className="h-3 w-3" weight="fill" />
                %10 Set İndirimi
              </Badge>
            ) : (
              <Badge variant="neutral" className="gap-1 font-medium text-xs text-[var(--muted)]">
                <Sparkle className="h-3 w-3" />
                2+ Parçada %10 İndirim
              </Badge>
            )}
          </div>
          <p className="text-xs text-[var(--muted)] mt-0.5">
            {isBundle
              ? "Bu parçaları birlikte satın alarak mükemmel vezolla kombinini %10 indirimle oluşturun"
              : "Kombin indirimi kazanmak için en az bir tamamlayıcı parça daha seçin"}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        {/* Ürün Kartları Listesi */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          {allItems.map((item, idx) => {
            const isSelected = selectedIds.includes(item.id);
            const isMain = item.id === mainProduct.id;

            return (
              <React.Fragment key={item.id}>
                {idx > 0 && (
                  <div className="hidden sm:flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--muted)] border border-[var(--border)]">
                    <Plus className="h-4 w-4" weight="bold" />
                  </div>
                )}

                <div
                  className={`relative flex w-36 sm:w-44 flex-col rounded-[var(--radius-base,0.5rem)] border p-2.5 transition-all ${
                    isSelected
                      ? "border-[var(--accent)] bg-[var(--card)] shadow-xs ring-1 ring-[var(--accent)]/30"
                      : "border-[var(--border)] opacity-60 bg-[var(--surface)]"
                  }`}
                >
                  <label className="flex items-center gap-2 cursor-pointer mb-2">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={isMain}
                      onChange={() => toggleItem(item.id)}
                      className="h-3.5 w-3.5 rounded border-[var(--border)] text-[var(--accent)] accent-[var(--accent)] focus:ring-[var(--accent)]"
                    />
                    <span className="text-[11px] font-semibold text-[var(--ink)] truncate">
                      {isMain ? "Bu Ürün" : "Tamamlayıcı"}
                    </span>
                  </label>

                  <Link
                    href={`/urun/${item.slug}`}
                    className="relative aspect-square w-full overflow-hidden rounded-[var(--radius-base,0.375rem)] border border-[var(--border)] bg-[var(--surface)] mb-2"
                  >
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] text-[var(--muted)]">
                        Görsel Yok
                      </div>
                    )}
                  </Link>

                  <Link
                    href={`/urun/${item.slug}`}
                    className="line-clamp-2 text-xs font-medium text-[var(--ink)] hover:underline"
                    title={item.title}
                  >
                    {item.title}
                  </Link>

                  <div className="mt-2 flex items-baseline gap-1.5 font-mono text-xs">
                    <span className="font-bold text-[var(--ink)]">
                      {formatMoney(item.price, currency)}
                    </span>
                    {item.compareAtPrice && item.compareAtPrice > item.price && (
                      <span className="text-[10px] text-[var(--muted)] line-through">
                        {formatMoney(item.compareAtPrice, currency)}
                      </span>
                    )}
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* Fiyat Özeti ve 1 Tıkla Sepete Ekle */}
        <div className="flex flex-col sm:flex-row lg:flex-col justify-between items-start sm:items-center lg:items-end gap-4 rounded-[var(--radius-base,0.5rem)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 lg:min-w-64">
          <div className="space-y-1">
            <span className="text-xs text-[var(--muted)]">
              {selectedItems.length} Parça {isBundle ? "Set Toplamı" : "Toplamı"}:
            </span>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-xl font-bold tabular-nums text-[var(--ink)]">
                {formatMoney(finalPrice, currency)}
              </span>
              {isBundle && discountAmount > 0 && (
                <span className="font-mono text-xs text-[var(--muted)] line-through tabular-nums">
                  {formatMoney(subtotal, currency)}
                </span>
              )}
            </div>
            {isBundle && discountAmount > 0 ? (
              <p className="text-[11px] font-semibold text-emerald-600">
                Kombin İndirimiyle {formatMoney(discountAmount, currency)} kazandınız!
              </p>
            ) : selectedItems.length === 1 ? (
              <p className="text-[11px] font-medium text-amber-700">
                Kombin %10 indiriminden yararlanmak için en az bir tamamlayıcı parça ekleyin.
              </p>
            ) : null}
          </div>

          <Button
            type="button"
            variant="primary"
            size="md"
            disabled={isAdding || selectedItems.length === 0}
            onClick={handleAddBundle}
            className="w-full sm:w-auto gap-2 font-bold shadow-xs bg-[var(--accent)] text-[var(--accent-fg,#ffffff)] hover:opacity-90 active:scale-95 transition-all rounded-[var(--radius-base,0.375rem)] cursor-pointer"
          >
            {success ? (
              <>
                <Check className="h-4 w-4" weight="bold" />
                <span>{isBundle ? "Kombin Eklendi!" : "Ürün Eklendi!"}</span>
              </>
            ) : (
              <>
                <ShoppingBag className="h-4 w-4" />
                <span>
                  {isAdding
                    ? "Ekleniyor..."
                    : isBundle
                    ? "Kombini Sepete Ekle (%10 İndirimli)"
                    : "Seçili Ürünü Sepete Ekle"}
                </span>
              </>
            )}
          </Button>
        </div>
      </div>
    </section>
  );
}
