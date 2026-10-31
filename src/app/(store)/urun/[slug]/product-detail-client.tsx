"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShoppingBag,
  Heart,
  Bell,
  Check,
  WarningCircle as AlertCircle,
  Star,
  Package,
  Clock,
  ArrowRight,
  Ruler,
  CaretLeft,
  CaretRight,
  Sparkle,
  Crown,
} from "@phosphor-icons/react";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { addCartItemAction } from "@/modules/checkout/actions";
import { trackStoreEvent } from "@/components/store/visitor-tracker";
import { useWishlist } from "@/components/store/wishlist-context";
import { useCart } from "@/components/store/cart-context";
import { InstallmentModal } from "@/components/store/installment-modal";
import type { InstallmentSettings, ClubSettings } from "@/lib/settings/schemas";
import { SizeGuideModal, resolveSizeGuideKind } from "@/components/store/size-guide-modal";
import {
  requestBackInStockStoreAction,
  toggleWishlistStoreAction,
  submitProductReviewStoreAction,
} from "./actions";

export interface ClientProductOption {
  id: string;
  name: string;
  values: Array<{ id: string; value: string }>;
}

export interface ClientProductVariant {
  id: string;
  title: string;
  sku: string | null;
  barcode: string | null;
  effectivePrice: number;
  compareAtPrice: number | null;
  clubPrice?: number | null;
  availableStock: number;
  trackInventory: boolean;
  allowBackorder: boolean;
  optionMap: Record<string, string>;
  imageUrl: string | null;
}

export interface ClientProductImage {
  id: string;
  url: string;
  alt: string | null;
}

interface ProductDetailClientProps {
  productId: string;
  productSlug: string;
  productTitle: string;
  subtitle: string | null;
  brandName: string | null;
  images: ClientProductImage[];
  options: ClientProductOption[];
  variants: ClientProductVariant[];
  initialWishlisted: boolean;
  customerEmail: string | null;
  installmentSettings?: InstallmentSettings;
  sizeGuideType?: string | null;
  sizeGuideData?: string | null;
  categoryName?: string | null;
  productClubPrice?: number | null;
  isCustomerLoggedIn?: boolean;
  clubSettings?: ClubSettings | null;
}

export function ProductDetailClient({
  productId,
  productTitle,
  subtitle,
  brandName,
  images,
  options,
  variants,
  initialWishlisted,
  customerEmail,
  installmentSettings,
  sizeGuideType,
  sizeGuideData,
  categoryName,
  productClubPrice,
  isCustomerLoggedIn,
  clubSettings,
}: ProductDetailClientProps) {
  const router = useRouter();
  const defaultVariant =
    variants.find((v) => v.availableStock > 0 || v.allowBackorder) ?? variants[0];

  const [selectedOptions, setSelectedOptions] = React.useState<Record<string, string>>(
    () => defaultVariant?.optionMap ?? {}
  );
  const [selectedVariantId, setSelectedVariantId] = React.useState<string>(
    () => defaultVariant?.id ?? ""
  );
  const [activeImageUrl, setActiveImageUrl] = React.useState<string | null>(
    () => defaultVariant?.imageUrl ?? images[0]?.url ?? null
  );
  const [quantity, setQuantity] = React.useState<number>(1);
  const [adding, setAdding] = React.useState(false);
  const [buyingNow, setBuyingNow] = React.useState(false);
  const [cartNotice, setCartNotice] = React.useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const { isWishlisted: checkWishlist, toggleWishlist: contextToggleWishlist } = useWishlist();
  const { addItem } = useCart();
  const [wishlisted, setWishlisted] = React.useState(initialWishlisted);
  const isCurrentlyWishlisted = checkWishlist(productId) || wishlisted;
  const [wishlistMessage, setWishlistMessage] = React.useState<string | null>(null);

  const [stockEmail, setStockEmail] = React.useState(customerEmail ?? "");
  const [stockNotice, setStockNotice] = React.useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [submittingStock, setSubmittingStock] = React.useState(false);
  const [fitFinderOpen, setFitFinderOpen] = React.useState(false);

  const currentImageIndex = React.useMemo(() => {
    const idx = images.findIndex((img) => img.url === activeImageUrl);
    return idx >= 0 ? idx : 0;
  }, [images, activeImageUrl]);

  const handlePrevImage = React.useCallback(() => {
    if (images.length <= 1) return;
    const prevIndex = (currentImageIndex - 1 + images.length) % images.length;
    const prevImg = images[prevIndex];
    if (prevImg) setActiveImageUrl(prevImg.url);
  }, [currentImageIndex, images]);

  const handleNextImage = React.useCallback(() => {
    if (images.length <= 1) return;
    const nextIndex = (currentImageIndex + 1) % images.length;
    const nextImg = images[nextIndex];
    if (nextImg) setActiveImageUrl(nextImg.url);
  }, [currentImageIndex, images]);

  const touchStartX = React.useRef<number | null>(null);
  const touchEndX = React.useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    const firstTouch = e.targetTouches[0];
    if (firstTouch) {
      touchStartX.current = firstTouch.clientX;
    }
    touchEndX.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const firstTouch = e.targetTouches[0];
    if (firstTouch) {
      touchEndX.current = firstTouch.clientX;
    }
  };

  const handleTouchEnd = () => {
    if (touchStartX.current !== null && touchEndX.current !== null) {
      const diff = touchStartX.current - touchEndX.current;
      if (diff > 40) {
        handleNextImage();
      } else if (diff < -40) {
        handlePrevImage();
      }
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  const sizeGuideKind = resolveSizeGuideKind(
    sizeGuideType,
    categoryName,
    productTitle,
    sizeGuideData
  );

  function handleFitFinderSelect(calculatedSize: string) {
    const sizeOpt = options.find(
      (o) =>
        o.name.toLowerCase().includes("beden") ||
        o.name.toLowerCase().includes("size")
    );
    if (sizeOpt) {
      const matched = sizeOpt.values.find(
        (v) =>
          v.value.toLowerCase() === calculatedSize.toLowerCase() ||
          calculatedSize.toLowerCase().includes(v.value.toLowerCase()) ||
          v.value.toLowerCase().includes(calculatedSize.toLowerCase())
      );
      if (matched) {
        handleOptionSelect(sizeOpt.name, matched.value);
        return;
      }
    }

    const matchedVariant = variants.find(
      (v) =>
        v.title.toLowerCase().includes(calculatedSize.toLowerCase()) ||
        calculatedSize.toLowerCase().includes(v.title.toLowerCase())
    );
    if (matchedVariant) {
      setSelectedVariantId(matchedVariant.id);
    }
  }

  const selectedVariant = React.useMemo(() => {
    if (options.length > 0) {
      const matched = variants.find((v) =>
        options.every((opt) => v.optionMap[opt.name] === selectedOptions[opt.name])
      );
      if (matched) return matched;
    }
    return variants.find((v) => v.id === selectedVariantId) ?? variants[0];
  }, [options, selectedOptions, selectedVariantId, variants]);

  React.useEffect(() => {
    if (selectedVariant) {
      setSelectedVariantId(selectedVariant.id);
      if (selectedVariant.imageUrl) {
        setActiveImageUrl(selectedVariant.imageUrl);
      }
    }
  }, [selectedVariant]);

  const inStock = selectedVariant
    ? !selectedVariant.trackInventory ||
      selectedVariant.allowBackorder ||
      selectedVariant.availableStock > 0
    : false;

  const maxOrderable = selectedVariant
    ? !selectedVariant.trackInventory || selectedVariant.allowBackorder
      ? 50
      : Math.max(1, selectedVariant.availableStock)
    : 1;

  const discountPercent =
    selectedVariant &&
    selectedVariant.compareAtPrice &&
    selectedVariant.compareAtPrice > selectedVariant.effectivePrice
      ? Math.round(
          ((selectedVariant.compareAtPrice - selectedVariant.effectivePrice) /
            selectedVariant.compareAtPrice) *
            100
        )
      : null;

  function handleOptionSelect(optionName: string, value: string) {
    setSelectedOptions((prev) => ({
      ...prev,
      [optionName]: value,
    }));
    setCartNotice(null);
  }

  async function handleAddToCart(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedVariant) return;
    setAdding(true);
    setCartNotice(null);

    try {
      const res = await addItem(selectedVariant.id, quantity);
      if (!res.ok) {
        setCartNotice({
          ok: false,
          message: res.error ?? "Ürün sepete eklenemedi.",
        });
      } else {
        trackStoreEvent({
          type: "add_to_cart",
          productId,
          variantId: selectedVariant.id,
          meta: { quantity },
        });
        setCartNotice({
          ok: true,
          message: `${quantity} adet "${productTitle}" sepetinize eklendi.`,
        });
      }
    } finally {
      setAdding(false);
    }
  }

  async function handleBuyNow() {
    if (!selectedVariant) return;
    setBuyingNow(true);
    setCartNotice(null);

    try {
      const res = await addItem(selectedVariant.id, quantity, { openDrawer: false });
      if (!res.ok) {
        setCartNotice({
          ok: false,
          message: res.error ?? "Hızlı satın alma başlatılamadı.",
        });
      } else {
        trackStoreEvent({
          type: "add_to_cart",
          productId,
          variantId: selectedVariant.id,
          meta: { quantity, source: "buy_now_express" },
        });
        router.push("/odeme");
      }
    } finally {
      setBuyingNow(false);
    }
  }

  async function handleWishlistToggle() {
    const nextState = await contextToggleWishlist(productId, {
      title: productTitle,
      price: selectedVariant?.effectivePrice,
    });
    setWishlisted(nextState);
    if (nextState) {
      setWishlistMessage("Ürün favorilerinize eklendi! ❤️");
      trackStoreEvent({
        type: "wishlist",
        productId,
        variantId: selectedVariant?.id,
      });
    } else {
      setWishlistMessage("Ürün favorilerinizden çıkarıldı.");
    }
  }

  async function handleBackInStockSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedVariant) return;
    setSubmittingStock(true);
    setStockNotice(null);
    try {
      const res = await requestBackInStockStoreAction(selectedVariant.id, stockEmail);
      setStockNotice(res);
    } finally {
      setSubmittingStock(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
      {/* Sol Kolon: Görsel Galerisi */}
      <div className="lg:col-span-5 space-y-2.5">
        <div
          className="relative aspect-[3/4] max-h-[440px] sm:max-h-[480px] w-full overflow-hidden rounded-xl border border-border bg-muted/20 shadow-xs flex items-center justify-center select-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {activeImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={activeImageUrl}
              alt={productTitle}
              className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
              <Package className="h-10 w-10 stroke-[1.5]" />
              <span className="text-xs">Ürün görseli bulunmuyor</span>
            </div>
          )}
          {discountPercent && discountPercent > 0 ? (
            <span className="absolute left-3 top-3 z-10 rounded-md bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white shadow-xs">
              %{discountPercent} İndirim
            </span>
          ) : null}

          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={handlePrevImage}
                aria-label="Önceki fotoğraf"
                className="absolute left-2.5 top-1/2 -translate-y-1/2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-zinc-900 shadow-md hover:bg-white active:scale-95 transition-all dark:bg-zinc-900/90 dark:text-zinc-100 dark:hover:bg-zinc-900 border border-border/40 cursor-pointer"
              >
                <CaretLeft className="h-5 w-5" weight="bold" />
              </button>
              <button
                type="button"
                onClick={handleNextImage}
                aria-label="Sonraki fotoğraf"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-zinc-900 shadow-md hover:bg-white active:scale-95 transition-all dark:bg-zinc-900/90 dark:text-zinc-100 dark:hover:bg-zinc-900 border border-border/40 cursor-pointer"
              >
                <CaretRight className="h-5 w-5" weight="bold" />
              </button>
              <span className="absolute bottom-2.5 right-2.5 z-10 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-mono font-medium text-white backdrop-blur-xs">
                {currentImageIndex + 1} / {images.length}
              </span>
            </>
          )}
        </div>

        {images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {images.map((img) => {
              const isSelected = activeImageUrl === img.url;
              return (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setActiveImageUrl(img.url)}
                  className={`relative h-16 w-14 shrink-0 overflow-hidden rounded-lg border transition-all ${
                    isSelected
                      ? "border-foreground ring-2 ring-foreground/20 shadow-xs"
                      : "border-border opacity-70 hover:opacity-100"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={img.alt ?? productTitle}
                    className="h-full w-full object-cover"
                  />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Sağ Kolon: Ürün Başlığı, Varyant Seçimi ve Sepet Aksiyonları */}
      <div className="lg:col-span-7 flex flex-col gap-4">
        <div className="space-y-1.5 border-b border-border pb-3">
          {brandName && (
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {brandName}
            </p>
          )}
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {productTitle}
          </h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}

          {/* Fiyat ve Stok Durumu */}
          <div className="pt-2 flex flex-wrap items-baseline justify-between gap-3">
            <div className="flex items-baseline gap-2.5">
              <span className="text-2xl font-semibold tabular-nums text-foreground">
                {formatMoney(selectedVariant?.effectivePrice ?? 0, "TRY")}
              </span>
              {selectedVariant?.compareAtPrice &&
              selectedVariant.compareAtPrice > selectedVariant.effectivePrice ? (
                <span className="text-sm text-muted-foreground line-through tabular-nums">
                  {formatMoney(selectedVariant.compareAtPrice, "TRY")}
                </span>
              ) : null}
            </div>

            <div>
              {inStock ? (
                selectedVariant &&
                selectedVariant.trackInventory &&
                !selectedVariant.allowBackorder &&
                selectedVariant.availableStock <= 5 &&
                selectedVariant.availableStock > 0 ? (
                  <Badge variant="warning" className="gap-1.5 font-bold">
                    <Clock className="h-3.5 w-3.5" weight="bold" />
                    <span>Tükenmek Üzere</span>
                  </Badge>
                ) : (
                  <Badge variant="success">Stokta Var</Badge>
                )
              ) : (
                <Badge variant="danger">Tükendi</Badge>
              )}
            </div>
          </div>

          {/* iyzico Taksit Seçenekleri Tablosu Tetikleyicisi */}
          {installmentSettings?.enabled !== false && (
            <div className="pt-1.5 flex items-center justify-between border-t border-[var(--border)]/60">
              <InstallmentModal
                priceMinor={selectedVariant?.effectivePrice ?? 0}
                customFamilies={installmentSettings?.cardFamilies}
                bannerTitle={installmentSettings?.bannerTitle}
                bannerSubtitle={installmentSettings?.bannerSubtitle}
              />
              <span className="text-[11px] text-muted-foreground">
                {installmentSettings?.bannerTitle ?? "iyzico Güvencesiyle 9 Taksit"}
              </span>
            </div>
          )}

          {/* VezollaClub Üyelerine Özel Fiyat */}
          {(() => {
            if (clubSettings && !clubSettings.pdpShowMemberPrice) return null;
            const currentClubPrice = selectedVariant?.clubPrice ?? productClubPrice;
            if (!currentClubPrice) return null;
            return (
              <div className="mt-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-[var(--radius-base,0.5rem)] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-base,0.375rem)] bg-[var(--accent)] text-[var(--accent-fg)] shrink-0">
                    <Crown className="h-4 w-4" weight="fill" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
                      {clubSettings?.pdpMemberPriceTitle ?? "VezollaClub Üyelerine Özel Fiyat:"}
                    </span>
                    <div className="text-xl font-extrabold text-[var(--ink)] tabular-nums">
                      {formatMoney(currentClubPrice, "TRY")}
                    </div>
                  </div>
                </div>
                {!isCustomerLoggedIn && (
                  <Link
                    href="/kayit"
                    className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-base,0.375rem)] bg-[var(--accent)] hover:opacity-90 text-[var(--accent-fg)] px-3 py-1.5 text-xs font-bold shadow-xs transition-colors shrink-0"
                  >
                    <span>{clubSettings?.pdpMemberPriceCtaText ?? "Üye Ol & Bu Fiyatla Al"}</span>
                    <ArrowRight className="h-3 w-3" weight="bold" />
                  </Link>
                )}
              </div>
            );
          })()}

          {/* VezollaClub Sadakat Puanı Rozeti */}
          {(() => {
            if (clubSettings && !clubSettings.pdpShowEarningBadge) return null;
            const effective = selectedVariant?.effectivePrice ?? 0;
            const priceInTl = Math.round(effective / 100);
            const earnRate = (clubSettings?.earningRatePercent ?? 10) / 100;
            const clubPoints = Math.max(1, Math.round(priceInTl * earnRate));
            const pointValueKurus = clubSettings?.pointValueKurus ?? 50;
            const cashValueTl = Math.round((clubPoints * pointValueKurus) / 100);

            const template =
              clubSettings?.pdpEarningBadgeTemplate ??
              "Bu alışverişinizden {points} VezollaClub Puanı ({value} TL Değerinde) Kazanacaksınız.";

            const renderedText = template
              .replace("{points}", `${clubPoints} VezollaClub Puanı`)
              .replace("{value}", String(cashValueTl));

            return (
              <div className="pt-2">
                <div className="flex items-center gap-2 rounded-[var(--radius-base,0.375rem)] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-xs text-[var(--ink)]">
                  <Sparkle className="h-4 w-4 shrink-0 text-[var(--accent)]" weight="fill" />
                  <span>{renderedText}</span>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Seçenek Matrisi (Örn: Renk, Beden) */}
        {options.length > 0 ? (
          <div className="space-y-4">
            {options.map((opt) => {
              const currentVal = selectedOptions[opt.name] ?? "";
              return (
                <div key={opt.id} className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{opt.name}</span>
                      {(opt.name.toLowerCase().includes("beden") ||
                        opt.name.toLowerCase().includes("size")) &&
                        sizeGuideKind !== "NONE" && (
                        <button
                          type="button"
                          onClick={() => setFitFinderOpen(true)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--accent)] hover:underline cursor-pointer"
                        >
                          <Ruler className="h-3 w-3" />
                          <span>
                            {sizeGuideKind === "BRA"
                              ? "Sütyen Beden Bulucu"
                              : "Beden Tablosu & Ölçü Rehberi"}
                          </span>
                        </button>
                      )}
                    </div>
                    <span className="text-muted-foreground">{currentVal}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {opt.values.map((val) => {
                      const active = currentVal === val.value;
                      return (
                        <button
                          key={val.id}
                          type="button"
                          onClick={() => handleOptionSelect(opt.name, val.value)}
                          className={`rounded-md border px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                            active
                              ? "bg-[var(--ink)] text-[var(--card)] ring-2 ring-[var(--ink)] ring-offset-2 ring-offset-[var(--card)] border-transparent shadow-xs font-bold"
                              : "border-[var(--border)] bg-[var(--card)] text-[var(--ink)] hover:border-[var(--ink)]/50"
                          }`}
                        >
                          {val.value}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : variants.length > 1 ? (
          <div className="space-y-2">
            <Label htmlFor="variant-select">Varyant Seçimi</Label>
            <select
              id="variant-select"
              value={selectedVariant?.id ?? ""}
              onChange={(e) => setSelectedVariantId(e.target.value)}
              className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
            >
              {variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.title} ({formatMoney(v.effectivePrice, "TRY")})
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {/* Sepete Ekle veya Gelince Haber Ver */}
        {inStock ? (
          <form onSubmit={handleAddToCart} className="space-y-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center rounded-md border border-border bg-card">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="h-10 w-9 text-sm font-medium text-foreground hover:bg-muted"
                  aria-label="Miktarı azalt"
                >
                  -
                </button>
                <span className="w-8 text-center text-sm font-medium tabular-nums">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(maxOrderable, q + 1))}
                  className="h-10 w-9 text-sm font-medium text-foreground hover:bg-muted"
                  aria-label="Miktarı artır"
                >
                  +
                </button>
              </div>

              {/* Sepete Ekle Butonu */}
              <Button
                type="submit"
                disabled={adding || buyingNow}
                className="h-10 flex-1 min-w-[130px] gap-2 cursor-pointer"
              >
                <ShoppingBag className="h-4 w-4" />
                {adding ? "Ekleniyor..." : "Sepete Ekle"}
              </Button>

              {/* 1-Click Hemen Al (Express Checkout) Butonu */}
              <Button
                type="button"
                disabled={adding || buyingNow}
                onClick={handleBuyNow}
                className="h-10 flex-1 min-w-[130px] gap-2 bg-[var(--accent)] hover:opacity-95 text-[var(--accent-fg,#ffffff)] font-bold shadow-xs cursor-pointer active:scale-98 transition-all"
              >
                <ArrowRight className="h-4 w-4" weight="bold" />
                {buyingNow ? "Yönlendiriliyor..." : "Hemen Al"}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={handleWishlistToggle}
                aria-label="Favorilere Ekle"
                className="h-10 px-3 cursor-pointer"
              >
                <Heart
                  className={`h-4 w-4 ${
                    isCurrentlyWishlisted ? "fill-rose-600 text-rose-600" : ""
                  }`}
                  weight={isCurrentlyWishlisted ? "fill" : "regular"}
                />
              </Button>
            </div>
          </form>
        ) : (
          <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Bell className="h-4 w-4 text-primary" />
                <span>Stok Gelince Haber Ver</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleWishlistToggle}
                className="gap-1.5"
              >
                <Heart
                  className={`h-3.5 w-3.5 ${
                    isCurrentlyWishlisted ? "fill-rose-600 text-rose-600" : ""
                  }`}
                  weight={isCurrentlyWishlisted ? "fill" : "regular"}
                />
                Favori
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Bu varyant şu anda stokta yok. E-posta adresinizi bırakın, tekrar
              stoğa girdiğinde size haber verelim.
            </p>
            <form onSubmit={handleBackInStockSubmit} className="flex gap-2">
              <Input
                type="email"
                required
                placeholder="ornek@eposta.com"
                value={stockEmail}
                onChange={(e) => setStockEmail(e.target.value)}
                className="h-9 flex-1"
              />
              <Button type="submit" size="sm" disabled={submittingStock}>
                {submittingStock ? "Kaydediliyor..." : "Beni Bilgilendir"}
              </Button>
            </form>
            {stockNotice && (
              <p
                className={`text-xs ${
                  stockNotice.ok ? "text-success" : "text-danger"
                }`}
              >
                {stockNotice.message}
              </p>
            )}
          </div>
        )}

        {/* Sepet Geri Bildirim Kutusu */}
        {cartNotice && (
          <div
            className={`rounded-md border p-3 text-xs ${
              cartNotice.ok
                ? "border-success/30 bg-success/10 text-foreground"
                : "border-danger/30 bg-danger/10 text-danger"
            }`}
          >
            <div className="flex items-center gap-2 font-medium">
              {cartNotice.ok ? (
                <Check className="h-4 w-4 text-success shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 text-danger shrink-0" />
              )}
              <span>{cartNotice.message}</span>
            </div>
            {cartNotice.ok && (
              <div className="mt-2.5 flex gap-2">
                <Link
                  href="/sepet"
                  className="inline-flex h-8 items-center rounded-md bg-foreground px-3 text-xs font-medium text-background hover:opacity-90"
                >
                  Sepete Git
                </Link>
                <Link
                  href="/odeme"
                  className="inline-flex h-8 items-center rounded-md border border-border bg-card px-3 text-xs font-medium text-foreground hover:bg-muted"
                >
                  Hemen Öde
                </Link>
              </div>
            )}
          </div>
        )}

        {wishlistMessage && (
          <p className="text-xs text-muted-foreground">{wishlistMessage}</p>
        )}

        {/* Teslimat ve Güvence Özeti */}
        <div className="rounded-lg border border-border bg-card p-3.5 text-xs text-muted-foreground space-y-1.5">
          <p className="font-medium text-foreground">Fiyat ve Teslimat Bilgisi</p>
          <p>• Tüm fiyatlara KDV dahildir.</p>
          <p>• Siparişiniz kargoya verildiğinde takip numarası e-posta ile iletilir.</p>
          <p>• Teslim tarihinden itibaren 14 gün içinde kolay iade hakkı mevcuttur.</p>
        </div>
      </div>

      {/* 70% Mobil Kullanıcı İçin Sabit Hızlı Sepete Ekle & Hemen Al Çubuğu */}
      {inStock && (
        <aside
          aria-label="Mobil Hızlı Satın Alma"
          className="md:hidden fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom))] inset-x-0 z-30 border-t border-[var(--border)] bg-[var(--surface)] px-3 py-2 shadow-lg flex items-center justify-between gap-2"
        >
          <div className="flex flex-col min-w-0 pr-1">
            <span className="text-[10px] text-[var(--muted)] truncate max-w-[120px]">
              {selectedVariant ? selectedVariant.title : productTitle}
            </span>
            <div className="flex items-baseline gap-1 font-mono">
              <span className="text-sm font-bold text-[var(--ink)]">
                {formatMoney(selectedVariant?.effectivePrice ?? 0, "TRY")}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-1 justify-end">
            <Button
              type="button"
              onClick={(e) => handleAddToCart(e as unknown as React.FormEvent)}
              disabled={adding || buyingNow}
              variant="outline"
              className="h-10 px-2.5 text-xs font-semibold cursor-pointer"
            >
              <ShoppingBag className="h-4 w-4" />
              <span>{adding ? "..." : "Sepet"}</span>
            </Button>

            <Button
              type="button"
              onClick={handleBuyNow}
              disabled={adding || buyingNow}
              className="h-10 px-3.5 gap-1.5 bg-[var(--accent)] text-[var(--accent-fg,#ffffff)] font-bold shadow-sm active:scale-95 transition-transform text-xs cursor-pointer"
            >
              <span>{buyingNow ? "..." : "Hemen Al"}</span>
              <ArrowRight className="h-3.5 w-3.5" weight="bold" />
            </Button>
          </div>
        </aside>
      )}

      <SizeGuideModal
        isOpen={fitFinderOpen}
        onClose={() => setFitFinderOpen(false)}
        onSelectSize={handleFitFinderSelect}
        sizeGuideType={sizeGuideType}
        sizeGuideData={sizeGuideData}
        categoryName={categoryName}
        productTitle={productTitle}
      />
    </div>
  );
}

export function ProductReviewForm({
  productId,
  productSlug,
  defaultAuthorName,
}: {
  productId: string;
  productSlug: string;
  defaultAuthorName?: string;
}) {
  const [submitting, setSubmitting] = React.useState(false);
  const [rating, setRating] = React.useState(5);
  const [result, setResult] = React.useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    const formData = new FormData(e.currentTarget);
    formData.set("rating", String(rating));
    try {
      const res = await submitProductReviewStoreAction(formData);
      setResult(res);
      if (res.ok) {
        (e.target as HTMLFormElement).reset();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-border bg-card p-5 space-y-4"
    >
      <h3 className="text-base font-semibold text-foreground">
        Değerlendirme Yazın
      </h3>
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="productSlug" value={productSlug} />

      <div className="space-y-1.5">
        <Label>Puanınız</Label>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              className="p-1 text-warning hover:scale-110 transition-transform"
              aria-label={`${star} yıldız`}
            >
              <Star
                className={`h-5 w-5 ${
                  star <= rating
                    ? "fill-warning text-warning"
                    : "text-muted-foreground"
                }`}
              />
            </button>
          ))}
          <span className="ml-2 text-xs text-muted-foreground">
            {rating} / 5
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="authorName">Adınız Soyadınız</Label>
          <Input
            id="authorName"
            name="authorName"
            required
            defaultValue={defaultAuthorName ?? ""}
            placeholder="Örn: Ayşe Yılmaz"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reviewTitle">Başlık (İsteğe Bağlı)</Label>
          <Input
            id="reviewTitle"
            name="title"
            placeholder="Kısa özet"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="reviewBody">Yorumunuz</Label>
        <Textarea
          id="reviewBody"
          name="body"
          required
          rows={3}
          placeholder="Ürün hakkındaki deneyiminizi paylaşın..."
        />
      </div>

      {result && (
        <p
          className={`text-xs ${
            result.ok ? "text-success" : "text-danger"
          }`}
        >
          {result.message}
        </p>
      )}

      <Button type="submit" size="sm" disabled={submitting}>
        {submitting ? "Gönderiliyor..." : "Yorumu Gönder"}
      </Button>
    </form>
  );
}
