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
  const [cartNotice, setCartNotice] = React.useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const { isWishlisted: checkWishlist, toggleWishlist: contextToggleWishlist } = useWishlist();
  const [wishlisted, setWishlisted] = React.useState(initialWishlisted);
  const isCurrentlyWishlisted = checkWishlist(productId) || wishlisted;
  const [wishlistMessage, setWishlistMessage] = React.useState<string | null>(null);

  const [stockEmail, setStockEmail] = React.useState(customerEmail ?? "");
  const [stockNotice, setStockNotice] = React.useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [submittingStock, setSubmittingStock] = React.useState(false);

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
      const res = await addCartItemAction(selectedVariant.id, quantity);
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
        router.refresh();
      }
    } finally {
      setAdding(false);
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
        <div className="relative aspect-[3/4] max-h-[440px] sm:max-h-[480px] w-full overflow-hidden rounded-xl border border-border bg-muted/20 shadow-xs flex items-center justify-center">
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
            <span className="absolute left-3 top-3 rounded-md bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white shadow-xs">
              %{discountPercent} İndirim
            </span>
          ) : null}
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
                <Badge variant="success">
                  {selectedVariant && selectedVariant.trackInventory
                    ? `Stokta (${selectedVariant.availableStock} adet)`
                    : "Stokta Var"}
                </Badge>
              ) : (
                <Badge variant="danger">Tükendi</Badge>
              )}
            </div>
          </div>

          {selectedVariant && (selectedVariant.sku || selectedVariant.barcode) && (
            <div className="pt-1 flex flex-wrap gap-4 text-xs text-muted-foreground font-mono">
              {selectedVariant.sku && <span>SKU: {selectedVariant.sku}</span>}
              {selectedVariant.barcode && (
                <span>Barkod: {selectedVariant.barcode}</span>
              )}
            </div>
          )}
        </div>

        {/* Seçenek Matrisi (Örn: Renk, Beden) */}
        {options.length > 0 ? (
          <div className="space-y-4">
            {options.map((opt) => {
              const currentVal = selectedOptions[opt.name] ?? "";
              return (
                <div key={opt.id} className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">{opt.name}</span>
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
                          className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                            active
                              ? "border-foreground bg-foreground text-background"
                              : "border-border bg-card text-foreground hover:bg-muted"
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
            <div className="flex items-center gap-3">
              <div className="flex items-center rounded-md border border-border bg-card">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="h-10 w-10 text-sm font-medium text-foreground hover:bg-muted"
                  aria-label="Miktarı azalt"
                >
                  -
                </button>
                <span className="w-10 text-center text-sm font-medium tabular-nums">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(maxOrderable, q + 1))}
                  className="h-10 w-10 text-sm font-medium text-foreground hover:bg-muted"
                  aria-label="Miktarı artır"
                >
                  +
                </button>
              </div>

              <Button
                type="submit"
                disabled={adding}
                className="h-10 flex-1 gap-2"
              >
                <ShoppingBag className="h-4 w-4" />
                {adding ? "Ekleniyor..." : "Sepete Ekle"}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={handleWishlistToggle}
                aria-label="Favorilere Ekle"
                className="h-10 px-3"
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

      {/* 70% Mobil Kullanıcı İçin Sabit Hızlı Sepete Ekle Çubuğu */}
      {inStock && (
        <aside
          aria-label="Mobil Hızlı Sepete Ekle"
          className="md:hidden fixed bottom-14 inset-x-0 z-30 border-t border-[var(--border)] bg-[var(--surface)] px-3 py-2 shadow-lg flex items-center justify-between gap-3"
        >
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] text-[var(--muted)] truncate max-w-[140px]">
              {selectedVariant ? selectedVariant.title : productTitle}
            </span>
            <div className="flex items-baseline gap-1.5 font-mono">
              <span className="text-sm font-bold text-[var(--ink)]">
                {formatMoney(selectedVariant?.effectivePrice ?? 0, "TRY")}
              </span>
              {selectedVariant?.compareAtPrice &&
                selectedVariant.effectivePrice &&
                selectedVariant.compareAtPrice > selectedVariant.effectivePrice && (
                  <span className="text-[10px] text-[var(--muted)] line-through">
                    {formatMoney(selectedVariant.compareAtPrice, "TRY")}
                  </span>
                )}
            </div>
          </div>

          <Button
            type="button"
            onClick={(e) => handleAddToCart(e as unknown as React.FormEvent)}
            disabled={adding}
            className="flex-1 max-w-[200px] h-10 gap-2 bg-[var(--accent)] text-[var(--accent-fg,#ffffff)] font-bold shadow-sm active:scale-95 transition-transform"
          >
            <ShoppingBag className="h-4 w-4" />
            <span>{adding ? "Ekleniyor..." : "Sepete Ekle"}</span>
          </Button>
        </aside>
      )}
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
