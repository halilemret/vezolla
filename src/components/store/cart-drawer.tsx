"use client";

import * as React from "react";
import Link from "next/link";
import {
  X,
  Trash,
  ShoppingBag,
  ArrowRight,
  Package,
  LockKey,
  Sparkle,
  Crown,
} from "@phosphor-icons/react";
import { formatMoney } from "@/lib/money";
import { useCart } from "@/components/store/cart-context";
import { FreeShippingBar } from "@/components/store/free-shipping-bar";
import { CartUpsells } from "@/components/store/cart-upsells";

export function CartDrawer() {
  const { isOpen, closeCart, summary, addItem, updateQuantity, removeItem, isLoading } =
    useCart();
  const [busyLineId, setBusyLineId] = React.useState<string | null>(null);

  // Escape tuşu ile kapatma
  React.useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        closeCart();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeCart]);

  // Arka plan scroll kilidi
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const lines = summary?.lines ?? [];
  const itemCount = summary?.itemCount ?? 0;
  const currency = summary?.currency ?? "TRY";
  const subtotalMinor = summary?.subtotalMinor ?? 0;
  const discountTotalMinor = summary?.discountTotalMinor ?? 0;
  const netSubtotalMinor = summary?.subtotalAfterDiscountMinor ?? Math.max(0, subtotalMinor - discountTotalMinor);
  const totalMinor = summary?.totalMinor ?? netSubtotalMinor;
  const isFreeShipping = Boolean(summary?.freeShippingByPromo) || netSubtotalMinor >= 150000;

  // Upsell için sepet varyant ID'leri
  const cartVariantIds = React.useMemo(() => {
    return lines.map((l) => l.variantId);
  }, [lines]);

  async function handleQtyChange(lineId: string, nextQty: number) {
    setBusyLineId(lineId);
    try {
      await updateQuantity(lineId, nextQty);
    } finally {
      setBusyLineId(null);
    }
  }

  async function handleRemove(lineId: string) {
    setBusyLineId(lineId);
    try {
      await removeItem(lineId);
    } finally {
      setBusyLineId(null);
    }
  }

  async function handleAddUpsell(variantId: string) {
    await addItem(variantId, 1);
  }

  return (
    <div
      className={`fixed inset-0 z-50 transition-visibility duration-300 ${
        isOpen ? "pointer-events-auto visible" : "pointer-events-none invisible"
      }`}
      aria-hidden={!isOpen}
    >
      {/* Karartma Arka Planı (Backdrop) */}
      <div
        className={`fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity duration-300 ease-in-out ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
        onClick={closeCart}
      />

      {/* Kayar Panel (Slide-Over Drawer Container) */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Alışveriş Sepeti"
        className={`fixed inset-y-0 right-0 flex w-full max-w-md flex-col bg-[var(--surface)] text-[var(--ink)] border-l border-[var(--border)] shadow-2xl transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Çekmece Başlığı */}
        <div className="flex h-16 items-center justify-between border-b border-[var(--border)] bg-[var(--card)] px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-[var(--accent)]" weight="bold" />
            <h2 className="text-sm font-bold text-[var(--ink)]">
              Alışveriş Sepetim
            </h2>
            <span className="rounded-[var(--radius-base,0.25rem)] border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-xs font-semibold tabular-nums text-[var(--ink)]">
              {itemCount} Ürün
            </span>
          </div>

          <button
            type="button"
            onClick={closeCart}
            className="rounded-[var(--radius-base,0.25rem)] p-2 text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--ink)] transition-colors"
            aria-label="Sepeti Kapat"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Çekmece İçeriği */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4">
          {lines.length > 0 ? (
            <>
              {/* 1. Dinamik Kargo Barem Barı (1.500 TL Eşiği) */}
              <FreeShippingBar
                subtotalMinor={netSubtotalMinor}
                thresholdMinor={150000}
                freeShippingByPromo={isFreeShipping}
                currency={currency}
              />

              {/* 2. 1-Tık Tamamlayıcı Aksesuar (Upsell Carousel Strip) */}
              <CartUpsells
                onAddToCart={handleAddUpsell}
                currency={currency}
                excludeVariantIds={cartVariantIds}
              />

              {/* 3. Sepet Kalemleri Listesi */}
              <div className="divide-y divide-[var(--border)] rounded-[var(--radius-base,0.375rem)] border border-[var(--border)] bg-[var(--card)] shadow-2xs">
                {lines.map((line) => {
                  const isBusy = busyLineId === line.id || isLoading;
                  return (
                    <div
                      key={line.id}
                      className="flex gap-3 p-3 transition-colors hover:bg-[var(--surface)]/40"
                    >
                      {/* Ürün Görseli */}
                      <Link
                        href={`/urun/${line.productSlug}`}
                        onClick={closeCart}
                        className="relative h-20 w-16 shrink-0 overflow-hidden rounded-[var(--radius-base,0.25rem)] border border-[var(--border)] bg-[var(--surface)]"
                      >
                        {line.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={line.imageUrl}
                            alt={line.title}
                            className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[var(--muted)]">
                            <Package className="h-5 w-5" />
                          </div>
                        )}
                      </Link>

                      {/* Başlık, Varyant & Fiyat */}
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            href={`/urun/${line.productSlug}`}
                            onClick={closeCart}
                            className="line-clamp-2 text-xs font-semibold text-[var(--ink)] hover:text-[var(--accent)] transition-colors leading-snug"
                          >
                            {line.title}
                          </Link>

                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleRemove(line.id)}
                            className="rounded p-1 text-[var(--muted)] hover:text-rose-600 transition-colors"
                            aria-label="Ürünü sepetten kaldır"
                          >
                            <Trash className="h-4 w-4" />
                          </button>
                        </div>

                        {line.variantTitle ? (
                          <p className="text-[11px] text-[var(--muted)]">
                            Seçim: {line.variantTitle}
                          </p>
                        ) : null}

                        <div className="flex items-center justify-between pt-1">
                          {/* Miktar Sayacı */}
                          <div className="flex items-center rounded-[var(--radius-base,0.25rem)] border border-[var(--border)] bg-[var(--surface)]">
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleQtyChange(line.id, line.quantity - 1)}
                              className="h-6 w-6 flex items-center justify-center text-xs font-bold text-[var(--ink)] hover:bg-[var(--card)] disabled:opacity-50 transition-colors"
                              aria-label={line.quantity <= 1 ? "Ürünü sepetten kaldır" : "Miktarı azalt"}
                            >
                              -
                            </button>
                            <span className="w-6 text-center text-xs font-bold font-mono tabular-nums text-[var(--ink)]">
                              {line.quantity}
                            </span>
                            <button
                              type="button"
                              disabled={
                                isBusy ||
                                (line.trackInventory &&
                                  !line.allowBackorder &&
                                  line.quantity >= line.availableStock)
                              }
                              onClick={() => handleQtyChange(line.id, line.quantity + 1)}
                              className="h-6 w-6 flex items-center justify-center text-xs font-bold text-[var(--ink)] hover:bg-[var(--card)] disabled:opacity-50 transition-colors"
                              aria-label="Miktarı artır"
                            >
                              +
                            </button>
                          </div>

                          {/* Satır Fiyatı */}
                          <div className="text-right">
                            <p className="text-xs font-bold font-mono tabular-nums text-[var(--ink)]">
                              {formatMoney(line.lineTotalMinor, currency)}
                            </p>
                            {line.isClubPriceApplied && (
                              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-600 dark:text-amber-400">
                                <Crown className="h-2.5 w-2.5" weight="fill" />
                                <span>Kulüp</span>
                              </span>
                            )}
                            {line.discountMinor > 0 && (
                              <p className="text-[10px] text-[var(--muted)] line-through font-mono tabular-nums">
                                {formatMoney(line.lineSubtotalMinor, currency)}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            /* Boş Sepet Durumu */
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--surface)] border border-[var(--border)] text-[var(--muted)]">
                <ShoppingBag className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-[var(--ink)]">
                  Sepetiniz şu anda boş
                </h3>
                <p className="text-xs text-[var(--muted)] max-w-xs">
                  Katalogdaki ürünleri inceleyerek beğendiklerinizi sepetinize ekleyebilirsiniz.
                </p>
              </div>
              <Link
                href="/katalog"
                onClick={closeCart}
                className="inline-flex h-9 items-center justify-center rounded-[var(--radius-base,0.375rem)] bg-[var(--accent)] px-4 text-xs font-semibold text-[var(--accent-fg)] hover:opacity-95 transition-opacity"
              >
                Alışverişe Başla
              </Link>
            </div>
          )}
        </div>

        {/* Çekmece Alt Bölümü (Footer / Toplam & Aksiyonlar) */}
        {lines.length > 0 && (
          <div className="border-t border-[var(--border)] bg-[var(--card)] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-6 space-y-3 shadow-lg">
            {/* Ara Toplam & Kargo */}
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-[var(--muted)]">
                <span>Ara Toplam</span>
                <span className="font-semibold font-mono text-[var(--ink)] tabular-nums">
                  {formatMoney(subtotalMinor, currency)}
                </span>
              </div>

              {discountTotalMinor > 0 && (
                <div className="flex justify-between font-semibold text-emerald-700 dark:text-emerald-400">
                  <span>İndirim Toplamı</span>
                  <span className="font-mono tabular-nums">
                    -{formatMoney(discountTotalMinor, currency)}
                  </span>
                </div>
              )}

              <div className="flex justify-between text-[var(--muted)]">
                <span>Kargo</span>
                <span className="font-semibold text-[var(--ink)]">
                  {isFreeShipping ? "Ücretsiz Kargo" : "Ödeme Adımında Hesaplanır"}
                </span>
              </div>

              <div className="flex justify-between border-t border-[var(--border)] pt-2 text-sm font-bold text-[var(--ink)]">
                <span>Genel Toplam</span>
                <span className="font-mono text-base tabular-nums">
                  {formatMoney(totalMinor, currency)}
                </span>
              </div>

              {/* VezollaClub Sadakat Puanı Kazanım Rozeti */}
              {(() => {
                const priceInTl = Math.round(totalMinor / 100);
                const clubPoints = Math.max(1, Math.round(priceInTl * 0.1));
                const cashValueTl = Math.round(clubPoints * 0.5);
                return (
                  <div className="flex items-center gap-1.5 rounded-md border border-amber-200 dark:border-amber-800/60 bg-amber-50/70 dark:bg-amber-950/30 px-2.5 py-1.5 text-[11px] text-amber-950 dark:text-amber-200">
                    <Sparkle className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" weight="fill" />
                    <span>
                      Bu siparişten <strong>{clubPoints} VezollaClub Puanı</strong> ({cashValueTl} TL) Kazanacaksınız.
                    </span>
                  </div>
                );
              })()}
            </div>

            {/* Aksiyon Butonları */}
            <div className="space-y-2 pt-1">
              <Link
                href="/odeme"
                onClick={closeCart}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-base,0.375rem)] bg-[var(--accent)] px-4 text-xs sm:text-sm font-bold text-[var(--accent-fg)] shadow-sm hover:opacity-95 active:scale-98 transition-all"
              >
                <LockKey className="h-4 w-4" weight="bold" />
                <span>Güvenle Ödemeye Geç</span>
                <ArrowRight className="h-4 w-4" weight="bold" />
              </Link>

              <Link
                href="/sepet"
                onClick={closeCart}
                className="flex h-9 w-full items-center justify-center rounded-[var(--radius-base,0.375rem)] border border-[var(--border)] bg-[var(--surface)] text-xs font-semibold text-[var(--ink)] hover:bg-[var(--card)] transition-colors"
              >
                Sepeti Görüntüle
              </Link>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
