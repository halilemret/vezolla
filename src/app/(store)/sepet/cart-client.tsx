"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Trash as Trash2,
  Tag,
  ArrowRight,
  Package,
  X,
  Truck,
  Check,
  CheckCircle,
  ShieldCheck,
  LockKey,
  Clock,
  ArrowCounterClockwise,
  CaretDown,
  WarningCircle,
  Sparkle,
  Crown,
} from "@phosphor-icons/react";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import {
  addCartItemAction,
  updateCartItemQuantityAction,
  removeCartItemAction,
  applyPromoCodeAction,
  removePromoCodeAction,
} from "@/modules/checkout/actions";
import { FreeShippingBar } from "@/components/store/free-shipping-bar";
import { CartUpsells } from "@/components/store/cart-upsells";
import type { CartSummary } from "@/modules/checkout/cart";
import type { ClubSettings } from "@/lib/settings/schemas";

export interface AvailablePromo {
  code: string;
  name: string;
  type: string;
  value: number;
}

export interface CartClientProps {
  initialSummary: CartSummary;
  freeShippingThresholdMinor?: number;
  availablePromotions?: AvailablePromo[];
  clubSettings?: ClubSettings | null;
}

export function CartClient({
  initialSummary,
  freeShippingThresholdMinor = 150000,
  availablePromotions = [],
  clubSettings,
}: CartClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [summary, setSummary] = React.useState<CartSummary>(initialSummary);
  const [busyLineId, setBusyLineId] = React.useState<string | null>(null);
  const [promoInput, setPromoInput] = React.useState("");
  const [promoBusy, setPromoBusy] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isPromoOpen, setIsPromoOpen] = React.useState(
    initialSummary.appliedPromotions.length > 0
  );

  React.useEffect(() => {
    if (searchParams.get("error") === "min_order") {
      setErrorMessage(
        `Ödemeye geçebilmek için sepet tutarınız en az ${formatMoney(
          initialSummary.minOrderSubtotalMinor,
          initialSummary.currency
        )} olmalıdır.`
      );
    }
  }, [searchParams, initialSummary.minOrderSubtotalMinor, initialSummary.currency]);

  // 15 Dakikalık Sepet Rezervasyon Sayacı (Urgency / Conversion Trigger)
  const [timeLeftSeconds, setTimeLeftSeconds] = React.useState<number>(14 * 60 + 59);

  React.useEffect(() => {
    setSummary(initialSummary);
  }, [initialSummary]);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeftSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedTimer = React.useMemo(() => {
    const mins = Math.floor(timeLeftSeconds / 60);
    const secs = timeLeftSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }, [timeLeftSeconds]);

  // Ücretsiz Kargo İlerleme Hesaplaması
  const currentNetSubtotal = Math.max(
    0,
    summary.subtotalMinor - summary.discountTotalMinor
  );
  const isFreeShipping =
    currentNetSubtotal >= freeShippingThresholdMinor ||
    Boolean(summary.freeShippingByPromo);

  const cartVariantIds = React.useMemo(
    () => summary.lines.map((l) => l.variantId),
    [summary.lines]
  );

  const remainingForFreeShipping = isFreeShipping
    ? 0
    : Math.max(0, freeShippingThresholdMinor - currentNetSubtotal);

  const shippingProgressPercent = isFreeShipping
    ? 100
    : Math.min(
        100,
        Math.max(10, Math.round((currentNetSubtotal / freeShippingThresholdMinor) * 100))
      );

  async function handleQuantityChange(lineId: string, nextQuantity: number) {
    setBusyLineId(lineId);
    setErrorMessage(null);
    try {
      const res = await updateCartItemQuantityAction(lineId, nextQuantity);
      if (!res.ok) {
        setErrorMessage(res.error ?? "Miktar güncellenemedi.");
      } else if (res.summary) {
        setSummary(res.summary);
        router.refresh();
      }
    } finally {
      setBusyLineId(null);
    }
  }

  async function handleRemoveLine(lineId: string) {
    setBusyLineId(lineId);
    setErrorMessage(null);
    try {
      const res = await removeCartItemAction(lineId);
      if (!res.ok) {
        setErrorMessage(res.error ?? "Ürün sepetten çıkarılamadı.");
      } else if (res.summary) {
        setSummary(res.summary);
        router.refresh();
      }
    } finally {
      setBusyLineId(null);
    }
  }

  async function handleApplyPromo(e?: React.FormEvent, directCode?: string) {
    if (e) e.preventDefault();
    const codeToApply = (directCode || promoInput).trim();
    if (!codeToApply) return;

    setPromoBusy(true);
    setErrorMessage(null);
    try {
      const res = await applyPromoCodeAction(codeToApply);
      if (!res.ok) {
        setErrorMessage(res.error ?? "Kupon kodu uygulanamadı.");
      } else {
        setPromoInput("");
        setIsPromoOpen(true);
        if (res.summary) setSummary(res.summary);
        router.refresh();
      }
    } finally {
      setPromoBusy(false);
    }
  }

  async function handleRemovePromo(code: string) {
    setPromoBusy(true);
    setErrorMessage(null);
    try {
      const res = await removePromoCodeAction(code);
      if (res.summary) setSummary(res.summary);
      router.refresh();
    } finally {
      setPromoBusy(false);
    }
  }

  async function handleAddUpsell(variantId: string) {
    setErrorMessage(null);
    try {
      const res = await addCartItemAction(variantId, 1);
      if (!res.ok) {
        setErrorMessage(res.error ?? "Ürün sepete eklenemedi.");
      } else if (res.summary) {
        setSummary(res.summary);
        router.refresh();
      }
    } catch {
      setErrorMessage("Ürün eklenirken bir hata oluştu.");
    }
  }

  if (summary.lines.length === 0) {
    return (
      <EmptyState
        title="Sepetiniz şu anda boş"
        description="Katalogdaki ürünleri inceleyerek beğendiklerinizi sepetinize ekleyebilirsiniz."
        actionLabel="Alışverişe Başla"
        actionHref="/katalog"
      />
    );
  }

  return (
    <div className="relative pb-24 lg:pb-0">
      {/* 2 SÜTUNLU ANA GRID (Masaüstünde Sağ Panel En Tepeden Başlar) */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 items-start">
        {/* SOL KOLON: Bildirim Barları + Sepet Kalemleri */}
        <div className="lg:col-span-8 space-y-3">
          {/* Hata Bildirimi */}
          {errorMessage && (
            <div className="rounded-[var(--radius-base,0.5rem)] border border-rose-300 bg-rose-50/80 px-3.5 py-2.5 text-xs font-semibold text-rose-950 shadow-2xs">
              {errorMessage}
            </div>
          )}

          {/* 1. Sepet Rezervasyon Sayacı (Tema Renkleriyle Tam Uyumlu & Zarif) */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-base,0.5rem)] border border-[var(--border)] bg-[var(--card)] px-3.5 py-2 text-xs shadow-2xs">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 shrink-0 text-[var(--accent)]" weight="bold" />
              <span className="font-medium text-[var(--ink)]">
                Sepetinizdeki ürünler yüksek talep nedeniyle adınıza rezerve edilmiştir.
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[11px] font-medium text-[var(--muted)]">
                Kalan Süre:
              </span>
              <span className="rounded-[var(--radius-base,0.25rem)] border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 font-mono text-xs font-bold text-[var(--accent)] tabular-nums">
                {formattedTimer}
              </span>
            </div>
          </div>

          {/* 2. Dinamik Kargo Barem Barı (1.500 TL Eşiği) */}
          <FreeShippingBar
            subtotalMinor={currentNetSubtotal}
            thresholdMinor={freeShippingThresholdMinor}
            freeShippingByPromo={isFreeShipping}
            currency={summary.currency}
          />

          {/* 1-Tık Tamamlayıcı Aksesuar (Upsell) */}
          <CartUpsells
            onAddToCart={handleAddUpsell}
            currency={summary.currency}
            excludeVariantIds={cartVariantIds}
          />

          {/* 3. Sepet Kalemleri */}
          <div className="divide-y divide-[var(--border)] rounded-[var(--radius-base,0.75rem)] border border-[var(--border)] bg-[var(--card)] shadow-xs">
            {summary.lines.map((line) => {
              const isBusy = busyLineId === line.id;
              const isLowStock =
                line.trackInventory &&
                !line.allowBackorder &&
                line.availableStock <= 3;

              return (
                <div
                  key={line.id}
                  className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between transition-colors hover:bg-[var(--surface)]/50"
                >
                  <div className="flex items-start gap-3">
                    <Link
                      href={`/urun/${line.productSlug}`}
                      className="relative h-20 w-16 shrink-0 overflow-hidden rounded-[var(--radius-base,0.375rem)] border border-[var(--border)] bg-[var(--surface)]"
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

                    <div className="space-y-0.5">
                      <Link
                        href={`/urun/${line.productSlug}`}
                        className="text-xs sm:text-sm font-semibold text-[var(--ink)] hover:underline line-clamp-2"
                      >
                        {line.title}
                      </Link>

                      <p className="text-[11px] text-[var(--muted)]">
                        {line.variantTitle ? `Seçim: ${line.variantTitle}` : ""}
                        {line.sku ? ` • SKU: ${line.sku}` : ""}
                      </p>

                      {/* Stok Aciliyet Rozeti */}
                      {isLowStock && (
                        <div className="inline-flex items-center gap-1 rounded-[var(--radius-base,0.25rem)] bg-[var(--surface)] border border-[var(--border)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--accent)]">
                          <Clock className="h-3 w-3 text-[var(--accent)]" />
                          <span>Son {line.availableStock} ürün kaldı!</span>
                        </div>
                      )}

                      <div className="flex flex-wrap items-baseline gap-2 pt-0.5">
                        <span className="text-xs font-semibold tabular-nums text-[var(--ink)]">
                          Birim: {formatMoney(line.unitPriceMinor, summary.currency)}
                        </span>
                        {line.compareAtPriceMinor && line.compareAtPriceMinor > line.unitPriceMinor && (
                          <span className="text-[11px] text-[var(--muted)] line-through tabular-nums">
                            {formatMoney(line.compareAtPriceMinor, summary.currency)}
                          </span>
                        )}
                        {line.isClubPriceApplied && (
                          <span className="inline-flex items-center gap-1 rounded-[var(--radius-base,0.25rem)] bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300">
                            <Crown className="h-3 w-3 text-amber-600 dark:text-amber-400 shrink-0" weight="fill" />
                            <span>Kulüp Özel</span>
                          </span>
                        )}
                        {line.discountMinor > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-[var(--radius-base,0.25rem)] bg-[var(--surface)] border border-[var(--border)] px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600">
                            -{formatMoney(line.discountMinor, summary.currency)} İndirim
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Adet Arttırma / Azaltma ve Satır Toplamı */}
                  <div className="flex items-center justify-between gap-4 sm:justify-end">
                    <div className="flex items-center rounded-[var(--radius-base,0.375rem)] border border-[var(--border)] bg-[var(--surface)]">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                          handleQuantityChange(line.id, line.quantity - 1)
                        }
                        className="h-7 w-7 flex items-center justify-center text-xs font-bold text-[var(--ink)] hover:bg-[var(--card)] disabled:opacity-50 transition-colors"
                        aria-label="Miktarı azalt"
                      >
                        -
                      </button>
                      <span className="w-7 text-center text-xs font-bold tabular-nums text-[var(--ink)]">
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
                        onClick={() =>
                          handleQuantityChange(line.id, line.quantity + 1)
                        }
                        className="h-7 w-7 flex items-center justify-center text-xs font-bold text-[var(--ink)] hover:bg-[var(--card)] disabled:opacity-50 transition-colors"
                        aria-label="Miktarı artır"
                      >
                        +
                      </button>
                    </div>

                    <div className="w-24 text-right">
                      <p className="text-sm font-bold tabular-nums text-[var(--ink)]">
                        {formatMoney(line.lineTotalMinor, summary.currency)}
                      </p>
                      {line.discountMinor > 0 && (
                        <p className="text-[11px] text-[var(--muted)] line-through tabular-nums">
                          {formatMoney(line.lineSubtotalMinor, summary.currency)}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleRemoveLine(line.id)}
                      className="rounded-[var(--radius-base,0.25rem)] p-1.5 text-[var(--muted)] hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 transition-colors"
                      aria-label="Ürünü sepetten kaldır"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SAĞ KOLON: MASAÜSTÜ SABİT SİPARİŞ ÖZETİ (STICKY & ABOVE THE FOLD) */}
        <div className="lg:col-span-4 sticky top-20 space-y-3 self-start">
          <div className="rounded-[var(--radius-base,0.75rem)] border border-[var(--border)] bg-[var(--card)] p-4 space-y-3 shadow-sm">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
              <h2 className="text-sm font-bold text-[var(--ink)]">
                Sipariş Özeti
              </h2>
              <span className="text-xs font-medium text-[var(--muted)]">
                {summary.itemCount} Ürün
              </span>
            </div>

            {/* Toplam Kazanç Vurgusu */}
            {summary.discountTotalMinor > 0 && (
              <div className="flex items-center gap-1.5 rounded-[var(--radius-base,0.375rem)] bg-[var(--surface)] border border-[var(--border)] p-2 text-xs font-semibold text-[var(--ink)]">
                <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" weight="fill" />
                <span>
                  Toplam{" "}
                  <strong className="font-bold text-emerald-700 dark:text-emerald-400">
                    {formatMoney(summary.discountTotalMinor, summary.currency)}
                  </strong>{" "}
                  kazanç sağladınız!
                </span>
              </div>
            )}

            {/* Tutar Dökümü */}
            <dl className="space-y-1.5 text-xs">
              <div className="flex justify-between text-[var(--muted)]">
                <dt>Ara Toplam ({summary.itemCount} ürün)</dt>
                <dd className="tabular-nums font-semibold text-[var(--ink)]">
                  {formatMoney(summary.subtotalMinor, summary.currency)}
                </dd>
              </div>

              {summary.discountTotalMinor > 0 && (
                <div className="flex justify-between font-bold text-emerald-700 dark:text-emerald-400">
                  <dt>İndirim Toplamı</dt>
                  <dd className="tabular-nums">
                    -{formatMoney(summary.discountTotalMinor, summary.currency)}
                  </dd>
                </div>
              )}

              <div className="flex justify-between text-[var(--muted)]">
                <dt>Kargo Ücreti</dt>
                <dd className="tabular-nums font-semibold text-[var(--ink)]">
                  {isFreeShipping ? (
                    <span className="font-bold text-[var(--ink)]">
                      Ücretsiz Kargo
                    </span>
                  ) : (
                    formatMoney(summary.shippingTotalMinor, summary.currency)
                  )}
                </dd>
              </div>

              <div className="flex justify-between text-[11px] text-[var(--muted)]">
                <dt>Dahil KDV</dt>
                <dd className="tabular-nums">
                  {formatMoney(summary.taxTotalMinor, summary.currency)}
                </dd>
              </div>

              <div className="flex justify-between border-t border-[var(--border)] pt-2 text-sm font-bold text-[var(--ink)]">
                <dt>Genel Toplam</dt>
                <dd className="tabular-nums text-base font-extrabold text-[var(--ink)]">
                  {formatMoney(summary.totalMinor, summary.currency)}
                </dd>
              </div>

              {/* VezollaClub Sadakat Puanı Kazanım Rozeti */}
              {(() => {
                if (clubSettings && !clubSettings.cartShowEarningBadge) return null;
                const priceInTl = Math.round(summary.totalMinor / 100);
                const earnRate = (clubSettings?.earningRatePercent ?? 10) / 100;
                const clubPoints = Math.max(1, Math.round(priceInTl * earnRate));
                const pointValueKurus = clubSettings?.pointValueKurus ?? 50;
                const cashValueTl = Math.round((clubPoints * pointValueKurus) / 100);

                const template =
                  clubSettings?.cartEarningBadgeTemplate ??
                  "Bu alışverişinizden {points} VezollaClub Puanı ({value} TL Değerinde) Kazanacaksınız.";

                const renderedText = template
                  .replace("{points}", `${clubPoints} VezollaClub Puanı`)
                  .replace("{value}", String(cashValueTl));

                return (
                  <div className="flex items-center gap-2 rounded-[var(--radius-base,0.375rem)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--ink)]">
                    <Sparkle className="h-4 w-4 shrink-0 text-[var(--accent)]" weight="fill" />
                    <span>{renderedText}</span>
                  </div>
                );
              })()}
            </dl>

            {/* Minimum Sepet Tutarı Uyarısı */}
            {!summary.isMinOrderSubtotalMet && summary.minOrderSubtotalMinor > 0 ? (
              <div className="rounded-[var(--radius-base,0.5rem)] border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-amber-900">
                  <WarningCircle className="h-4 w-4 text-amber-700 shrink-0" weight="fill" />
                  <span>Minimum Sipariş Tutarı: {formatMoney(summary.minOrderSubtotalMinor, summary.currency)}</span>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-800">
                  Siparişi tamamlayabilmek için sepetinize en az{" "}
                  <strong>{formatMoney(summary.minOrderRemainingMinor, summary.currency)}</strong> değerinde daha ürün eklemelisiniz.
                </p>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-amber-200">
                  <div
                    className="h-full bg-amber-600 transition-all duration-300"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round((currentNetSubtotal / summary.minOrderSubtotalMinor) * 100)
                      )}%`,
                    }}
                  />
                </div>
              </div>
            ) : null}

            {/* BÜYÜK ÖDEME BUTONU (HEMEN TOPLAMIN ALTINDA - SCROLLSUZ GÖRÜNÜR) */}
            {summary.isMinOrderSubtotalMet ? (
              <Link
                href="/odeme"
                className="group flex h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-base,0.5rem)] bg-[var(--accent)] px-4 text-xs sm:text-sm font-bold text-[var(--accent-fg,#ffffff)] shadow-md hover:opacity-95 active:scale-98 transition-all"
              >
                <LockKey className="h-4 w-4" weight="bold" />
                <span>Güvenle Ödemeye Geç</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            ) : (
              <div
                title={`Minimum sipariş tutarı: ${formatMoney(summary.minOrderSubtotalMinor, summary.currency)}`}
                className="flex h-11 w-full cursor-not-allowed items-center justify-center gap-2 rounded-[var(--radius-base,0.5rem)] border border-zinc-200 bg-zinc-100 px-4 text-xs sm:text-sm font-semibold text-zinc-500 shadow-none select-none"
              >
                <LockKey className="h-4 w-4" weight="bold" />
                <span>Minimum Tutar Karşılanmadı</span>
              </div>
            )}

            {/* Kupon Kodu Bölümü (Kompakt / Akordeon) */}
            <div className="border-t border-[var(--border)] pt-2.5">
              {!isPromoOpen ? (
                <button
                  type="button"
                  onClick={() => setIsPromoOpen(true)}
                  className="flex w-full items-center justify-between text-xs font-semibold text-[var(--accent)] hover:underline"
                >
                  <span className="flex items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5" />
                    İndirim Kuponu Ekle
                  </span>
                  <CaretDown className="h-3 w-3" />
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="promo-code"
                      className="text-[11px] font-semibold text-[var(--ink)] flex items-center gap-1"
                    >
                      <Tag className="h-3 w-3 text-[var(--accent)]" />
                      İndirim Kuponu Kodu
                    </label>
                    {summary.appliedPromotions.length === 0 && (
                      <button
                        type="button"
                        onClick={() => setIsPromoOpen(false)}
                        className="text-[10px] text-[var(--muted)] hover:text-[var(--ink)]"
                      >
                        Kapat
                      </button>
                    )}
                  </div>

                  <form onSubmit={handleApplyPromo} className="flex gap-1.5">
                    <Input
                      id="promo-code"
                      value={promoInput}
                      onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                      placeholder="KOD"
                      className="h-8 flex-1 font-mono uppercase text-xs border-[var(--border)] bg-[var(--surface)] text-[var(--ink)]"
                    />
                    <Button
                      type="submit"
                      variant="outline"
                      size="sm"
                      disabled={promoBusy || !promoInput.trim()}
                      className="h-8 font-semibold text-xs px-2.5 border-[var(--border)]"
                    >
                      Uygula
                    </Button>
                  </form>

                  {/* Uygulanan Promosyonlar */}
                  {summary.appliedPromotions.length > 0 && (
                    <div className="space-y-1 pt-1">
                      {summary.appliedPromotions.map((promo) => (
                        <div
                          key={promo.promotionId}
                          className="flex items-center justify-between rounded-[var(--radius-base,0.25rem)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs"
                        >
                          <div className="flex items-center gap-1 font-medium text-[var(--ink)] text-[11px]">
                            <Tag className="h-3 w-3 text-[var(--accent)]" />
                            <span>{promo.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold tabular-nums text-[var(--ink)] text-xs">
                              -{formatMoney(promo.discountMinor, summary.currency)}
                            </span>
                            {promo.code && (
                              <button
                                type="button"
                                onClick={() => handleRemovePromo(promo.code!)}
                                className="rounded p-0.5 text-[var(--muted)] hover:text-rose-600"
                                aria-label="Kuponu kaldır"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Mağaza İçi Hızlı Kupon Önerileri */}
                  {availablePromotions.length > 0 && (
                    <div className="pt-0.5 space-y-1">
                      <span className="text-[10px] text-[var(--muted)] font-medium">
                        Aktif Kuponlar:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {availablePromotions.map((p) => (
                          <button
                            key={p.code}
                            type="button"
                            onClick={() => handleApplyPromo(undefined, p.code)}
                            className="inline-flex items-center gap-1 rounded-[var(--radius-base,0.25rem)] bg-[var(--surface)] border border-dashed border-[var(--border)] px-1.5 py-0.5 text-[10px] font-mono font-semibold text-[var(--ink)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                          >
                            <Tag className="h-2.5 w-2.5 text-[var(--accent)]" />
                            <span>{p.code}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Güven Rozetleri */}
            <div className="border-t border-[var(--border)] pt-2.5 space-y-1.5 text-[11px] text-[var(--muted)]">
              <div className="flex items-center gap-1.5 font-medium">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" weight="fill" />
                <span>256-Bit SSL Şifreli Güvenli Ödeme</span>
              </div>
              <div className="flex items-center gap-1.5 font-medium">
                <Truck className="h-3.5 w-3.5 text-[var(--accent)] shrink-0" />
                <span>Hızlı & Gizli Paketleme Garantisi</span>
              </div>
              <div className="flex items-center gap-1.5 font-medium">
                <ArrowCounterClockwise className="h-3.5 w-3.5 text-[var(--accent)] shrink-0" />
                <span>14 Gün Koşulsuz Kolay İade</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MOBİL SABİT ALT SATIN ALMA BARI (LG:HIDDEN) */}
      <aside
        aria-label="Mobil Hızlı Satın Alma"
        className="fixed bottom-0 inset-x-0 z-50 lg:hidden border-t border-[var(--border)] bg-[var(--surface)] p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-xl"
      >
        <div className="mx-auto flex max-w-md items-center justify-between gap-3">
          {/* Sol Taraf: Tutar ve Tasarruf Özeti */}
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className="text-[10px] font-medium text-[var(--muted)] uppercase tracking-wider">
                Toplam
              </span>
              {summary.discountTotalMinor > 0 && (
                <span className="rounded-[var(--radius-base,0.25rem)] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 px-1.5 py-0.2 text-[9px] font-bold">
                  {formatMoney(summary.discountTotalMinor, summary.currency)} Kazanç
                </span>
              )}
            </div>
            <p className="text-base font-bold tabular-nums text-[var(--ink)] leading-tight truncate">
              {formatMoney(summary.totalMinor, summary.currency)}
            </p>
            <p className="text-[10px] font-medium text-[var(--muted)] truncate">
              {isFreeShipping ? "Ücretsiz Kargo" : "+ Kargo Dahil"}
            </p>
          </div>

          {/* Sağ Taraf: Büyük Ödemeye Geç Butonu */}
          <Link
            href="/odeme"
            className="flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-[var(--radius-base,0.5rem)] bg-[var(--accent)] px-5 text-xs font-bold text-[var(--accent-fg,#ffffff)] shadow-md active:scale-95 transition-all"
          >
            <LockKey className="h-3.5 w-3.5" weight="bold" />
            <span>Ödemeye Geç</span>
            <ArrowRight className="h-3.5 w-3.5" weight="bold" />
          </Link>
        </div>
      </aside>
    </div>
  );
}
