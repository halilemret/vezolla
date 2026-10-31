"use client";

import * as React from "react";
import {
  Star,
  CheckCircle as CheckCircle2,
  Camera,
  Funnel,
  X,
  CaretLeft,
  CaretRight,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { submitProductReviewStoreAction } from "@/app/(store)/urun/[slug]/actions";

export interface ReviewItem {
  id: string;
  authorName: string;
  rating: number;
  title: string | null;
  body: string;
  createdAt: Date | string;
  isVerifiedPurchase: boolean;
  heightCm?: number | null;
  weightKg?: number | null;
  sizePurchased?: string | null;
  fitRating?: string | null; // "KÜÇÜK" | "TAM_KALIP" | "BÜYÜK"
  images?: string[];
  reply?: string | null;
}

export interface ProductReviewsFilteredProps {
  productId: string;
  productSlug: string;
  reviews: ReviewItem[];
  defaultAuthorName?: string;
  availableSizes?: string[];
}

export function ProductReviewsFiltered({
  productId,
  productSlug,
  reviews,
  defaultAuthorName,
  availableSizes = [],
}: ProductReviewsFilteredProps) {
  const [onlyPhotos, setOnlyPhotos] = React.useState(false);
  const [sizeFilter, setSizeFilter] = React.useState<string>("ALL");
  const [fitFilter, setFitFilter] = React.useState<string>("ALL");
  const [heightFilter, setHeightFilter] = React.useState<string>("ALL");
  const [weightFilter, setWeightFilter] = React.useState<string>("ALL");
  const [activeGalleryImage, setActiveGalleryImage] = React.useState<string | null>(null);

  // Benzersiz beden listesi
  const sizesInReviews = React.useMemo(() => {
    const set = new Set<string>();
    reviews.forEach((r) => {
      if (r.sizePurchased) set.add(r.sizePurchased);
    });
    return Array.from(set);
  }, [reviews]);

  // Filtreleme
  const filteredReviews = React.useMemo(() => {
    return reviews.filter((r) => {
      if (onlyPhotos && (!r.images || r.images.length === 0)) {
        return false;
      }
      if (sizeFilter !== "ALL" && r.sizePurchased !== sizeFilter) {
        return false;
      }
      if (fitFilter !== "ALL" && r.fitRating !== fitFilter) {
        return false;
      }
      // Boy Ölçü Filtresi
      if (heightFilter !== "ALL") {
        if (!r.heightCm) return false;
        if (heightFilter === "PETITE" && r.heightCm >= 160) return false;
        if (heightFilter === "AVERAGE" && (r.heightCm < 160 || r.heightCm > 170)) return false;
        if (heightFilter === "TALL" && r.heightCm <= 170) return false;
      }
      // Kilo Ölçü Filtresi
      if (weightFilter !== "ALL") {
        if (!r.weightKg) return false;
        if (weightFilter === "LIGHT" && r.weightKg >= 55) return false;
        if (weightFilter === "AVERAGE" && (r.weightKg < 55 || r.weightKg > 68)) return false;
        if (weightFilter === "CURVY" && r.weightKg <= 68) return false;
      }
      return true;
    });
  }, [reviews, onlyPhotos, sizeFilter, fitFilter, heightFilter, weightFilter]);

  const photoCount = reviews.filter((r) => r.images && r.images.length > 0).length;

  return (
    <div className="space-y-8">
      {/* 1. FİLTRE ÇUBUĞU */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 text-xs">
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-1.5 font-bold text-[var(--ink)]">
            <Funnel className="h-4 w-4 text-[var(--accent)]" />
            <span>Yorumları Filtrele:</span>
          </div>

          {/* Sadece Fotoğraflı */}
          <button
            type="button"
            onClick={() => setOnlyPhotos(!onlyPhotos)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-semibold transition-all ${
              onlyPhotos
                ? "border-[var(--accent)] bg-[var(--accent)] text-white shadow-2xs"
                : "border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--accent)]"
            }`}
          >
            <Camera className="h-3.5 w-3.5" />
            <span>Fotoğraflı ({photoCount})</span>
          </button>

          {/* Beden Filtresi */}
          {sizesInReviews.length > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-[var(--muted)]">Beden:</span>
              <select
                value={sizeFilter}
                onChange={(e) => setSizeFilter(e.target.value)}
                className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs font-semibold text-[var(--ink)]"
              >
                <option value="ALL">Tüm Bedenler</option>
                {sizesInReviews.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Kalıp Filtresi */}
          <div className="flex items-center gap-1">
            <span className="text-[var(--muted)]">Kalıp:</span>
            <select
              value={fitFilter}
              onChange={(e) => setFitFilter(e.target.value)}
              className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs font-semibold text-[var(--ink)]"
            >
              <option value="ALL">Tüm Kalıplar</option>
              <option value="KÜÇÜK">Kalıp Küçük</option>
              <option value="TAM_KALIP">Tam Kalıp</option>
              <option value="BÜYÜK">Kalıp Büyük</option>
            </select>
          </div>

          {/* Boy Ölçüsü Filtresi */}
          <div className="flex items-center gap-1">
            <span className="text-[var(--muted)]">Boy:</span>
            <select
              value={heightFilter}
              onChange={(e) => setHeightFilter(e.target.value)}
              className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs font-semibold text-[var(--ink)]"
              aria-label="Boy ölçüsü filtresi"
            >
              <option value="ALL">Tüm Boylar</option>
              <option value="PETITE">&lt; 160 cm</option>
              <option value="AVERAGE">160 - 170 cm</option>
              <option value="TALL">&gt; 170 cm</option>
            </select>
          </div>

          {/* Kilo Ölçüsü Filtresi */}
          <div className="flex items-center gap-1">
            <span className="text-[var(--muted)]">Kilo:</span>
            <select
              value={weightFilter}
              onChange={(e) => setWeightFilter(e.target.value)}
              className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs font-semibold text-[var(--ink)]"
              aria-label="Kilo ölçüsü filtresi"
            >
              <option value="ALL">Tüm Kilolar</option>
              <option value="LIGHT">&lt; 55 kg</option>
              <option value="AVERAGE">55 - 68 kg</option>
              <option value="CURVY">&gt; 68 kg</option>
            </select>
          </div>
        </div>

        <span className="text-[var(--muted)] font-mono">
          {filteredReviews.length} / {reviews.length} değerlendirme
        </span>
      </div>

      {/* 2. YORUMLAR LİSTESİ VE FORM IZGARASI */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="lg:col-span-7 space-y-4">
          {filteredReviews.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center text-xs text-[var(--muted)] space-y-2">
              <p className="font-semibold text-[var(--ink)]">
                Filtreye uygun müşteri değerlendirmesi bulunamadı.
              </p>
              <p>Filtreleri temizleyerek tüm değerlendirmeleri inceleyebilirsiniz.</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setOnlyPhotos(false);
                  setSizeFilter("ALL");
                  setFitFilter("ALL");
                  setHeightFilter("ALL");
                  setWeightFilter("ALL");
                }}
              >
                Filtreleri Sıfırla
              </Button>
            </div>
          ) : (
            filteredReviews.map((rev) => (
              <div
                key={rev.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-3 shadow-2xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--ink)]">
                      {rev.authorName}
                    </span>
                    {rev.isVerifiedPurchase && (
                      <Badge variant="success" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Doğrulanmış Alıcı
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-[var(--muted)] font-mono">
                    {new Date(rev.createdAt).toLocaleDateString("tr-TR")}
                  </span>
                </div>

                {/* Yıldız ve Beden Bilgileri */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`h-3.5 w-3.5 ${
                          s <= rev.rating
                            ? "fill-warning text-warning"
                            : "text-[var(--muted)] opacity-40"
                        }`}
                      />
                    ))}
                  </div>

                  {/* Boy / Kilo / Beden / Kalıp Rozetleri */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-[var(--muted)]">
                    {rev.sizePurchased && (
                      <span className="rounded bg-[var(--surface)] px-2 py-0.5 border border-[var(--border)] text-[var(--ink)] font-bold">
                        Beden: {rev.sizePurchased}
                      </span>
                    )}
                    {rev.fitRating && (
                      <span
                        className={`rounded px-2 py-0.5 border font-semibold ${
                          rev.fitRating === "TAM_KALIP"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
                            : "border-amber-200 bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
                        }`}
                      >
                        {rev.fitRating === "TAM_KALIP"
                          ? "Tam Kalıp"
                          : rev.fitRating === "KÜÇÜK"
                          ? "Kalıbı Küçük"
                          : "Kalıbı Büyük"}
                      </span>
                    )}
                    {rev.heightCm && (
                      <span className="rounded bg-[var(--surface)] px-2 py-0.5 border border-[var(--border)]">
                        {rev.heightCm} cm
                      </span>
                    )}
                    {rev.weightKg && (
                      <span className="rounded bg-[var(--surface)] px-2 py-0.5 border border-[var(--border)]">
                        {rev.weightKg} kg
                      </span>
                    )}
                  </div>
                </div>

                {rev.title && (
                  <p className="text-sm font-semibold text-[var(--ink)]">
                    {rev.title}
                  </p>
                )}
                <p className="text-xs text-[var(--ink)]/80 leading-relaxed">{rev.body}</p>

                {/* Yorum Görselleri Galerisi */}
                {rev.images && rev.images.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {rev.images.map((imgUrl, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setActiveGalleryImage(imgUrl)}
                        className="group relative h-16 w-16 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)] transition-all cursor-zoom-in"
                        aria-label="Fotoğrafı büyüt"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={imgUrl}
                          alt="Müşteri fotoğrafı"
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                        />
                      </button>
                    ))}
                  </div>
                )}

                {/* Mağaza Yanıtı */}
                {rev.reply && (
                  <div className="rounded-lg bg-[var(--surface)] p-3 text-xs border border-[var(--border)] space-y-1">
                    <span className="font-bold text-[var(--accent)]">Vezolla Mağaza Yanıtı:</span>
                    <p className="text-[var(--muted)]">{rev.reply}</p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* 3. YENİ DEĞERLENDİRME FORMU */}
        <div className="lg:col-span-5">
          <EnhancedReviewForm
            productId={productId}
            productSlug={productSlug}
            defaultAuthorName={defaultAuthorName}
            availableSizes={availableSizes}
          />
        </div>
      </div>

      {/* 4. FOTOĞRAF GALERİSİ LIGHTBOX MODALI */}
      {activeGalleryImage && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in"
          onClick={() => setActiveGalleryImage(null)}
        >
          <div
            className="relative max-w-2xl max-h-[85vh] rounded-xl overflow-hidden border border-zinc-700 bg-zinc-900 p-2 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setActiveGalleryImage(null)}
              className="absolute top-4 right-4 z-10 rounded-full bg-black/60 p-2 text-white hover:bg-black transition-colors"
              aria-label="Kapat"
            >
              <X className="h-5 w-5" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeGalleryImage}
              alt="Müşteri fotoğrafı tam boy"
              className="max-h-[80vh] w-auto rounded-lg object-contain mx-auto"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function EnhancedReviewForm({
  productId,
  productSlug,
  defaultAuthorName,
  availableSizes,
}: {
  productId: string;
  productSlug: string;
  defaultAuthorName?: string;
  availableSizes: string[];
}) {
  const [submitting, setSubmitting] = React.useState(false);
  const [rating, setRating] = React.useState(5);
  const [result, setResult] = React.useState<{ ok: boolean; message: string } | null>(null);

  const [uploadedImages, setUploadedImages] = React.useState<string[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setUploadError(null);

    try {
      const urls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file) continue;
        if (!file.type.startsWith("image/")) {
          setUploadError("Yalnızca görsel dosyaları seçilebilir.");
          continue;
        }
        if (file.size > 10 * 1024 * 1024) {
          setUploadError("Görsel boyutu 10 MB'den küçük olmalıdır.");
          continue;
        }

        const fd = new FormData();
        fd.append("file", file);
        fd.append("folder", "reviews");

        const res = await fetch("/api/upload", {
          method: "POST",
          body: fd,
        });

        if (!res.ok) {
          const errData = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(errData.error ?? "Fotoğraf yüklenemedi.");
        }

        const data = (await res.json()) as { url?: string; asset?: { url: string } };
        const url = data.url ?? data.asset?.url;
        if (url) {
          urls.push(url);
        }
      }

      setUploadedImages((prev) => [...prev, ...urls].slice(0, 5));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Fotoğraf yüklenirken bir sorun oluştu.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function handleRemoveImage(indexToRemove: number) {
    setUploadedImages((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    const formData = new FormData(e.currentTarget);
    formData.set("rating", String(rating));
    formData.set("imageUrl", uploadedImages.join(","));

    try {
      const res = await submitProductReviewStoreAction(formData);
      setResult(res);
      if (res.ok) {
        (e.target as HTMLFormElement).reset();
        setUploadedImages([]);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-4 shadow-xs"
    >
      <div className="space-y-1">
        <h3 className="text-base font-bold text-[var(--ink)]">
          Değerlendirme Yazın
        </h3>
        <p className="text-xs text-[var(--muted)]">
          Beden ve boy/kilo bilgilerinizi paylaşarak diğer kadınlara yol gösterin, Vezolla Club Sadakat Puanı kazanın!
        </p>
      </div>

      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="productSlug" value={productSlug} />

      {/* Puan Seçici */}
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
                    : "text-[var(--muted)] opacity-40"
                }`}
              />
            </button>
          ))}
          <span className="ml-2 font-mono text-xs text-[var(--muted)]">
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
            placeholder="Örn: Elif Kaya"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="title">Başlık (İsteğe Bağlı)</Label>
          <Input
            id="title"
            name="title"
            placeholder="Örn: Kumaşı harika, tam oldu"
          />
        </div>
      </div>

      {/* Boy, Kilo, Satın Alınan Beden, Kalıp Değerlendirmesi */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-xs space-y-3">
        <span className="font-semibold text-[var(--ink)]">
          Beden & Kalıp Deneyimi (İsteğe Bağlı):
        </span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="space-y-1">
            <Label htmlFor="heightCm" className="text-[11px]">Boy (cm)</Label>
            <Input
              id="heightCm"
              name="heightCm"
              type="number"
              min="130"
              max="210"
              placeholder="168"
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="weightKg" className="text-[11px]">Kilo (kg)</Label>
            <Input
              id="weightKg"
              name="weightKg"
              type="number"
              min="35"
              max="150"
              placeholder="58"
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sizePurchased" className="text-[11px]">Aldığınız Beden</Label>
            <Input
              id="sizePurchased"
              name="sizePurchased"
              placeholder="Örn: 75B / M"
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="fitRating" className="text-[11px]">Kalıp Nasıl?</Label>
            <select
              id="fitRating"
              name="fitRating"
              className="h-8 w-full rounded border border-[var(--border)] bg-[var(--card)] px-2 text-[11px] font-medium"
            >
              <option value="TAM_KALIP">Tam Kalıp</option>
              <option value="KÜÇÜK">Kalıbı Küçük</option>
              <option value="BÜYÜK">Kalıbı Büyük</option>
            </select>
          </div>
        </div>
      </div>

      {/* Doğrudan Dosya Yükleme (Kamera veya Galeri) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="review-file-upload" className="text-xs font-semibold text-[var(--ink)]">
            Fotoğraf Ekle (+25 VezollaClub Puanı!)
          </Label>
          <span className="text-[11px] text-[var(--muted)]">
            {uploadedImages.length} / 5 fotoğraf
          </span>
        </div>

        <input
          ref={fileInputRef}
          id="review-file-upload"
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={uploading || uploadedImages.length >= 5}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-xs font-medium text-[var(--ink)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Camera className="h-4 w-4 text-[var(--accent)]" />
            <span>{uploading ? "Fotoğraf Yükleniyor..." : "Kamera veya Galeriden Seç"}</span>
          </button>
        </div>

        {uploadError && (
          <p className="text-[11px] text-danger">{uploadError}</p>
        )}

        {uploadedImages.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {uploadedImages.map((url, idx) => (
              <div
                key={url + idx}
                className="relative h-16 w-16 overflow-hidden rounded-lg border border-[var(--border)] group"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt="Yüklenen görsel önizleme"
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveImage(idx)}
                  className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/75 text-white hover:bg-black transition-colors"
                  aria-label="Fotoğrafı kaldır"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <input type="hidden" name="imageUrl" value={uploadedImages.join(",")} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="body">Değerlendirmeniz</Label>
        <textarea
          id="body"
          name="body"
          required
          rows={3}
          placeholder="Ürünün kumaşı, kalıbı ve duruşu hakkındaki dürüst görüşlerinizi paylaşın..."
          className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] p-2.5 text-xs text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
        />
      </div>

      {result && (
        <div
          className={`rounded-lg p-3 text-xs font-semibold ${
            result.ok
              ? "bg-emerald-50 text-emerald-900 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200"
              : "bg-rose-50 text-rose-900 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-200"
          }`}
        >
          {result.message}
        </div>
      )}

      <Button
        type="submit"
        variant="primary"
        size="md"
        disabled={submitting || uploading}
        className="w-full font-bold"
      >
        {submitting ? "Gönderiliyor..." : "Değerlendirmeyi Yayınla"}
      </Button>
    </form>
  );
}
