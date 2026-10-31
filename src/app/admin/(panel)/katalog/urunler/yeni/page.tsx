"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash, ArrowLeft, ArrowsClockwise } from "@phosphor-icons/react";
import { toast } from "sonner";
import { formatMoneyCompact, parseMoneyInput } from "@/lib/money";
import { slugify } from "@/lib/slug";
import {
  loadProductEditorDataAction,
  saveProductAction,
  softDeleteProductAction,
} from "@/modules/catalog/actions";
import type {
  ProductAttributeValueInput,
  ProductEditorData,
  ProductImageInput,
  ProductOptionInput,
  ProductStatusInput,
  ProductVariantInput,
  VariantOptionSelection,
} from "@/modules/catalog/schemas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImageUploadField } from "@/components/ui/media-picker";
import { RichEditor } from "@/components/ui/rich-editor";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface EditableVariantRow {
  id?: string;
  title: string;
  sku: string;
  barcode: string;
  supplierCode: string;
  priceText: string;
  compareAtPriceText: string;
  clubPriceText: string;
  costPriceText: string;
  stockText: string;
  isActive: boolean;
  trackInventory: boolean;
  allowBackorder: boolean;
  optionValues: VariantOptionSelection[];
}

function buildOptionKey(selections: VariantOptionSelection[]): string {
  return selections
    .map(
      (s) =>
        `${s.optionName.trim().toLowerCase()}:${s.value.trim().toLowerCase()}`
    )
    .join("|");
}

function generateClientCombinations(
  options: ProductOptionInput[]
): Array<{ title: string; key: string; optionValues: VariantOptionSelection[] }> {
  const validOptions = options
    .map((o) => ({
      name: o.name.trim(),
      values: o.values
        .map((v) => v.value.trim())
        .filter((v) => v.length > 0),
    }))
    .filter((o) => o.name.length > 0 && o.values.length > 0);

  if (validOptions.length === 0) return [];

  let acc: VariantOptionSelection[][] = [[]];
  for (const opt of validOptions) {
    const next: VariantOptionSelection[][] = [];
    for (const prefix of acc) {
      for (const val of opt.values) {
        next.push([...prefix, { optionName: opt.name, value: val }]);
      }
    }
    acc = next;
  }

  return acc.map((selections) => ({
    title: selections.map((s) => s.value).join(" / "),
    key: buildOptionKey(selections),
    optionValues: selections,
  }));
}

function toEditableVariant(v: ProductVariantInput): EditableVariantRow {
  return {
    id: v.id,
    title: v.title,
    sku: v.sku ?? "",
    barcode: v.barcode ?? "",
    supplierCode: v.supplierCode ?? "",
    priceText: formatMoneyCompact(v.price),
    compareAtPriceText:
      v.compareAtPrice !== null && v.compareAtPrice !== undefined
        ? formatMoneyCompact(v.compareAtPrice)
        : "",
    clubPriceText:
      v.clubPrice !== null && v.clubPrice !== undefined
        ? formatMoneyCompact(v.clubPrice)
        : "",
    costPriceText:
      v.costPrice !== null && v.costPrice !== undefined
        ? formatMoneyCompact(v.costPrice)
        : "",
    stockText: String(v.stock ?? 0),
    isActive: v.isActive,
    trackInventory: v.trackInventory,
    allowBackorder: v.allowBackorder,
    optionValues: v.optionValues ?? [],
  };
}

export default function ProductEditorPage({
  initialData,
}: {
  params?: Promise<Record<string, string>>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
  initialData?: ProductEditorData;
}) {
  const router = useRouter();
  const [data, setData] = React.useState<ProductEditorData | null>(
    initialData ?? null
  );
  const [loading, setLoading] = React.useState(!initialData);
  const [saving, setSaving] = React.useState(false);

  const existing = data?.product ?? null;

  const [title, setTitle] = React.useState(existing?.title ?? "");
  const [slug, setSlug] = React.useState(existing?.slug ?? "");
  const [subtitle, setSubtitle] = React.useState(existing?.subtitle ?? "");
  const [description, setDescription] = React.useState(
    existing?.description ?? ""
  );
  const [status, setStatus] = React.useState<ProductStatusInput>(
    existing?.status ?? "ACTIVE"
  );
  const [publishedAt, setPublishedAt] = React.useState(
    existing?.publishedAt ?? ""
  );
  const [brandId, setBrandId] = React.useState(existing?.brandId ?? "");
  const [productTypeId, setProductTypeId] = React.useState(
    existing?.productTypeId ?? ""
  );
  const [taxClassId, setTaxClassId] = React.useState(
    existing?.taxClassId ?? ""
  );
  const [weightGramsText, setWeightGramsText] = React.useState(
    existing?.weightGrams !== null && existing?.weightGrams !== undefined
      ? String(existing.weightGrams)
      : ""
  );
  const [seoTitle, setSeoTitle] = React.useState(existing?.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = React.useState(
    existing?.seoDescription ?? ""
  );

  const [categoryIds, setCategoryIds] = React.useState<string[]>(
    existing?.categoryIds ?? []
  );
  const [primaryCategoryId, setPrimaryCategoryId] = React.useState<string>(
    existing?.primaryCategoryId ?? ""
  );
  const [collectionIds, setCollectionIds] = React.useState<string[]>(
    existing?.collectionIds ?? []
  );
  const [tagInput, setTagInput] = React.useState(
    existing ? existing.tagNames.join(", ") : ""
  );

  const [options, setOptions] = React.useState<ProductOptionInput[]>(
    existing?.options ?? []
  );
  const [newOptionValueInputs, setNewOptionValueInputs] = React.useState<
    Record<number, string>
  >({});
  const [matrixDefaultPriceText, setMatrixDefaultPriceText] =
    React.useState("499,90");
  const [matrixSkuPrefix, setMatrixSkuPrefix] = React.useState("URUN");

  const [variants, setVariants] = React.useState<EditableVariantRow[]>(
    existing && existing.variants.length > 0
      ? existing.variants.map(toEditableVariant)
      : [
          {
            title: "Varsayılan",
            sku: "",
            barcode: "",
            supplierCode: "",
            priceText: "499,90",
            compareAtPriceText: "",
            clubPriceText: "",
            costPriceText: "",
            stockText: "10",
            isActive: true,
            trackInventory: true,
            allowBackorder: false,
            optionValues: [],
          },
        ]
  );

  const [images, setImages] = React.useState<ProductImageInput[]>(
    existing?.images ?? []
  );

  const [attributeValues, setAttributeValues] = React.useState<
    Record<string, ProductAttributeValueInput>
  >(() => {
    const map: Record<string, ProductAttributeValueInput> = {};
    for (const attr of existing?.attributes ?? []) {
      map[attr.attributeId] = attr;
    }
    return map;
  });

  React.useEffect(() => {
    if (initialData) return;
    let active = true;
    loadProductEditorDataAction()
      .then((res) => {
        if (!active) return;
        setData(res);
        const defaultTax = res.taxClasses.find((t) => t.isDefault);
        if (defaultTax) {
          setTaxClassId(defaultTax.id);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        toast.error(
          err instanceof Error ? err.message : "Düzenleyici verileri yüklenemedi"
        );
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [initialData]);

  const handleGenerateVariantMatrix = () => {
    const combs = generateClientCombinations(options);
    if (combs.length === 0) {
      toast.error("Lütfen önce en az bir seçenek ve değer tanımlayın.");
      return;
    }

    const byKey = new Map<string, EditableVariantRow>();
    const byTitle = new Map<string, EditableVariantRow>();

    for (const v of variants) {
      if (v.optionValues.length > 0) {
        byKey.set(buildOptionKey(v.optionValues), v);
      }
      byTitle.set(v.title.trim().toLowerCase(), v);
    }

    const prefix = matrixSkuPrefix.trim().toUpperCase();
    const fallbackPrice =
      matrixDefaultPriceText.trim() || variants[0]?.priceText || "0,00";

    const nextVariants: EditableVariantRow[] = combs.map((comb) => {
      const matched =
        byKey.get(comb.key) ?? byTitle.get(comb.title.trim().toLowerCase());
      if (matched) {
        return {
          ...matched,
          title: comb.title,
          optionValues: comb.optionValues,
        };
      }

      const autoSku = prefix
        ? `${prefix}-${slugify(comb.title).toUpperCase()}`
        : "";

      return {
        title: comb.title,
        sku: autoSku,
        barcode: "",
        supplierCode: "",
        priceText: fallbackPrice,
        compareAtPriceText: "",
        clubPriceText: "",
        costPriceText: "",
        stockText: "0",
        isActive: true,
        trackInventory: true,
        allowBackorder: false,
        optionValues: comb.optionValues,
      };
    });

    setVariants(nextVariants);
    toast.success(
      `${nextVariants.length} varyant kombinasyonu mevcut SKU ve fiyatlar korunarak senkronlandı.`
    );
  };

  const toggleCategory = (catId: string) => {
    setCategoryIds((prev) => {
      const exists = prev.includes(catId);
      const next = exists ? prev.filter((id) => id !== catId) : [...prev, catId];
      if (!exists && !primaryCategoryId) {
        setPrimaryCategoryId(catId);
      } else if (exists && primaryCategoryId === catId) {
        setPrimaryCategoryId(next[0] ?? "");
      }
      return next;
    });
  };

  const toggleCollection = (colId: string) => {
    setCollectionIds((prev) =>
      prev.includes(colId) ? prev.filter((id) => id !== colId) : [...prev, colId]
    );
  };

  const selectedProductType = React.useMemo(
    () => data?.productTypes.find((pt) => pt.id === productTypeId) ?? null,
    [data?.productTypes, productTypeId]
  );

  const visibleAttributes = React.useMemo(() => {
    if (!data) return [];
    if (selectedProductType && selectedProductType.attributes.length > 0) {
      return selectedProductType.attributes.map((pta) => ({
        ...pta.attribute,
        isRequired: pta.isRequired,
      }));
    }
    return data.attributes.map((a) => ({
      ...a,
      isRequired: false,
    }));
  }, [data, selectedProductType]);

  const updateAttributeVal = (
    attributeId: string,
    patch: Partial<ProductAttributeValueInput>
  ) => {
    setAttributeValues((prev) => {
      const current = prev[attributeId] ?? {
        attributeId,
        valueText: null,
        valueNumber: null,
        valueBool: null,
        valueList: [],
      };
      return {
        ...prev,
        [attributeId]: {
          ...current,
          ...patch,
        },
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Ürün başlığı zorunludur.");
      return;
    }
    if (variants.length === 0) {
      toast.error("En az bir varyant bulunmalıdır.");
      return;
    }

    setSaving(true);
    try {
      const tagNames = tagInput
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const parsedVariants: ProductVariantInput[] = variants.map((v, idx) => ({
        id: v.id,
        title: v.title.trim() || `Varyant ${idx + 1}`,
        sku: v.sku.trim() || null,
        barcode: v.barcode.trim() || null,
        supplierCode: v.supplierCode.trim() || null,
        price: parseMoneyInput(v.priceText),
        compareAtPrice: v.compareAtPriceText.trim()
          ? parseMoneyInput(v.compareAtPriceText)
          : null,
        clubPrice: v.clubPriceText.trim()
          ? parseMoneyInput(v.clubPriceText)
          : null,
        costPrice: v.costPriceText.trim()
          ? parseMoneyInput(v.costPriceText)
          : null,
        weightGrams: null,
        position: idx,
        isActive: v.isActive,
        trackInventory: v.trackInventory,
        allowBackorder: v.allowBackorder,
        stock: Math.max(0, Number.parseInt(v.stockText, 10) || 0),
        optionValues: v.optionValues,
      }));

      const validOptions: ProductOptionInput[] = options
        .map((o, oIdx) => ({
          id: o.id,
          name: o.name.trim(),
          position: oIdx,
          values: o.values
            .map((val, vIdx) => ({
              id: val.id,
              value: val.value.trim(),
              swatch: val.swatch ?? null,
              position: vIdx,
            }))
            .filter((val) => val.value.length > 0),
        }))
        .filter((o) => o.name.length > 0 && o.values.length > 0);

      const validImages: ProductImageInput[] = images
        .filter((img) => img.url.trim().length > 0)
        .map((img, idx) => ({
          id: img.id,
          url: img.url.trim(),
          alt: img.alt?.trim() || title.trim(),
          width: img.width ?? null,
          height: img.height ?? null,
          position: idx,
        }));

      const res = await saveProductAction({
        id: existing?.id,
        title: title.trim(),
        slug: slug.trim() || undefined,
        subtitle: subtitle.trim() || null,
        description,
        status,
        publishedAt: publishedAt.trim() || null,
        brandId: brandId || null,
        productTypeId: productTypeId || null,
        taxClassId: taxClassId || null,
        seoTitle: seoTitle.trim() || null,
        seoDescription: seoDescription.trim() || null,
        weightGrams: weightGramsText.trim()
          ? Math.max(0, Number.parseInt(weightGramsText, 10) || 0)
          : null,
        categoryIds,
        primaryCategoryId: primaryCategoryId || null,
        collectionIds,
        tagNames,
        options: validOptions,
        variants: parsedVariants,
        images: validImages,
        attributes: Object.values(attributeValues),
      });

      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      toast.success(
        existing ? "Ürün değişiklikleri kaydedildi." : "Yeni ürün oluşturuldu."
      );
      if (!existing) {
        router.push(`/admin/katalog/urunler/${res.productId}`);
      } else {
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!existing) return;
    setSaving(true);
    try {
      const res = await softDeleteProductAction(existing.id);
      if (!res.ok) {
        toast.error(res.error ?? "Ürün silinemedi.");
        return;
      }
      toast.success("Ürün arşivlenerek silindi.");
      router.push("/admin/katalog/urunler");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-md border border-zinc-200 bg-white p-8 text-sm text-zinc-600">
        Ürün düzenleyici yükleniyor...
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex flex-col gap-3 border-b border-zinc-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/katalog/urunler"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50"
            title="Ürün listesine dön"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-zinc-900">
                {existing ? existing.title : "Yeni Ürün Oluştur"}
              </h1>
              {existing ? (
                <Badge
                  variant={
                    status === "ACTIVE"
                      ? "success"
                      : status === "DRAFT"
                        ? "warning"
                        : "neutral"
                  }
                >
                  {status === "ACTIVE"
                    ? "Yayında"
                    : status === "DRAFT"
                      ? "Taslak"
                      : "Arşiv"}
                </Badge>
              ) : null}
            </div>
            <p className="text-xs text-zinc-600">
              Temel ürün bilgilerini, seçenek matrisini, varyant fiyat/stoklarını ve özel alanları yönetin.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {existing ? (
            <Button
              type="button"
              variant="danger"
              size="sm"
              disabled={saving}
              onClick={handleDelete}
            >
              Ürünü Sil
            </Button>
          ) : null}
          <Button type="submit" variant="primary" size="md" disabled={saving}>
            {saving
              ? "Kaydediliyor..."
              : existing
                ? "Değişiklikleri Kaydet"
                : "Ürünü Oluştur"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* SOL SÜTUN: ANA İÇERİK (2/3) */}
        <div className="space-y-6 lg:col-span-2">
          {/* 1. Genel Bilgiler ve Zengin Metin Açıklama */}
          <section className="space-y-4 rounded-md border border-zinc-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-zinc-900">
              Temel Bilgiler ve Açıklama
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="title">Ürün Başlığı *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (!existing && !slug) {
                      setMatrixSkuPrefix(
                        slugify(e.target.value).slice(0, 8).toUpperCase() || "URUN"
                      );
                    }
                  }}
                  required
                  placeholder="Örn: Organik Pamuklu Oversize Tişört"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="slug">URL Kısa Adı (Slug)</Label>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder={slugify(title || "urun-kisa-adi")}
                  className="mt-1 font-mono"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <Label htmlFor="subtitle">Alt Başlık / Kısa Özet</Label>
                <Input
                  id="subtitle"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="Örn: %100 Ege pamuğu, 240 gsm ağır gramajlı dokuma"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="weightGrams">Ağırlık (Gram)</Label>
                <Input
                  id="weightGrams"
                  type="number"
                  min="0"
                  value={weightGramsText}
                  onChange={(e) => setWeightGramsText(e.target.value)}
                  placeholder="250"
                  className="mt-1 font-mono tabular-nums"
                />
              </div>
            </div>

            <div>
              <Label className="mb-1">Detaylı Ürün Açıklaması</Label>
              <RichEditor value={description} onChange={setDescription} />
            </div>
          </section>

          {/* 2. Ürün Görselleri */}
          <section className="space-y-4 rounded-md border border-zinc-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900">
                  Ürün Görselleri
                </h2>
                <p className="text-xs text-zinc-600">
                  İlk sıradaki görsel vitrin kapak fotoğrafı olarak kullanılır.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setImages((prev) => [
                    ...prev,
                    {
                      url: "",
                      alt: title || "Ürün görseli",
                      width: null,
                      height: null,
                      position: prev.length,
                    },
                  ])
                }
              >
                <Plus className="h-4 w-4" />
                Görsel Satırı Ekle
              </Button>
            </div>

            {images.length === 0 ? (
              <div className="rounded border border-dashed border-zinc-300 bg-zinc-50 p-4">
                <Label className="mb-1.5">Hızlı Görsel Yükle veya URL Gir</Label>
                <ImageUploadField
                  value=""
                  folder="urunler"
                  onChange={(url, meta) => {
                    if (!url.trim()) return;
                    setImages([
                      {
                        url,
                        alt: title || "Ürün görseli",
                        width: meta?.width ?? null,
                        height: meta?.height ?? null,
                        position: 0,
                      },
                    ]);
                  }}
                />
              </div>
            ) : (
              <div className="space-y-3">
                {images.map((img, idx) => (
                  <div
                    key={idx}
                    className="grid gap-3 rounded border border-zinc-200 bg-zinc-50 p-3 sm:grid-cols-12 sm:items-center"
                  >
                    <div className="sm:col-span-1">
                      {img.url ? (
                        <img
                          src={img.url}
                          alt={img.alt ?? ""}
                          className="h-12 w-12 rounded border border-zinc-200 object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded border border-zinc-200 bg-white text-[10px] text-zinc-500">
                          #{idx + 1}
                        </div>
                      )}
                    </div>
                    <div className="sm:col-span-6">
                      <Label className="mb-1">Görsel Adresi / Yükle</Label>
                      <ImageUploadField
                        value={img.url}
                        folder="urunler"
                        onChange={(url, meta) =>
                          setImages((prev) =>
                            prev.map((item, i) =>
                              i === idx
                                ? {
                                    ...item,
                                    url,
                                    width: meta?.width ?? item.width,
                                    height: meta?.height ?? item.height,
                                  }
                                : item
                            )
                          )
                        }
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <Label className="mb-1">Alternatif Metin (Alt)</Label>
                      <Input
                        value={img.alt ?? ""}
                        onChange={(e) =>
                          setImages((prev) =>
                            prev.map((item, i) =>
                              i === idx ? { ...item, alt: e.target.value } : item
                            )
                          )
                        }
                        placeholder="Görsel açıklaması"
                      />
                    </div>
                    <div className="flex justify-end sm:col-span-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setImages((prev) => prev.filter((_, i) => i !== idx))
                        }
                        title="Görseli kaldır"
                      >
                        <Trash className="h-4 w-4 text-red-700" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 3. Seçenek Tanımlama ve Tek Tıkla Varyant Matrisi Üretici */}
          <section className="space-y-4 rounded-md border border-zinc-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900">
                  Seçenekler ve Otomatik Varyant Matrisi
                </h2>
                <p className="text-xs text-zinc-600">
                  Renk, Beden gibi seçenekleri tanımlayıp tek tıkla tüm kombinasyonları oluşturun.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setOptions((prev) => [
                    ...prev,
                    {
                      name: prev.length === 0 ? "Renk" : "Beden",
                      position: prev.length,
                      values: [
                        {
                          value: prev.length === 0 ? "Siyah" : "S",
                          position: 0,
                          swatch: null,
                        },
                      ],
                    },
                  ])
                }
              >
                <Plus className="h-4 w-4" />
                Seçenek Grubu Ekle
              </Button>
            </div>

            {options.length > 0 ? (
              <div className="space-y-3">
                {options.map((opt, optIdx) => (
                  <div
                    key={optIdx}
                    className="space-y-3 rounded border border-zinc-200 bg-zinc-50 p-3.5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="w-full max-w-xs">
                        <Label>Seçenek Adı (Örn: Renk, Beden, Materyal)</Label>
                        <Input
                          value={opt.name}
                          onChange={(e) =>
                            setOptions((prev) =>
                              prev.map((item, idx) =>
                                idx === optIdx
                                  ? { ...item, name: e.target.value }
                                  : item
                              )
                            )
                          }
                          placeholder="Örn: Renk"
                          className="mt-1"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setOptions((prev) =>
                            prev.filter((_, idx) => idx !== optIdx)
                          )
                        }
                      >
                        <Trash className="h-4 w-4 text-red-700" />
                        Grubu Sil
                      </Button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {opt.values.map((val, valIdx) => (
                        <div
                          key={valIdx}
                          className="inline-flex items-center gap-1.5 rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs"
                        >
                          <span className="font-medium text-zinc-900">
                            {val.value}
                          </span>
                          <input
                            type="text"
                            value={val.swatch ?? ""}
                            onChange={(e) =>
                              setOptions((prev) =>
                                prev.map((item, idx) =>
                                  idx === optIdx
                                    ? {
                                        ...item,
                                        values: item.values.map((v, vI) =>
                                          vI === valIdx
                                            ? { ...v, swatch: e.target.value }
                                            : v
                                        ),
                                      }
                                    : item
                                )
                              )
                            }
                            placeholder="#000"
                            title="Renk kodu (#RRGGBB) isteğe bağlı"
                            className="w-16 rounded border border-zinc-200 px-1 py-0.5 font-mono text-[11px] text-zinc-600"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setOptions((prev) =>
                                prev.map((item, idx) =>
                                  idx === optIdx
                                    ? {
                                        ...item,
                                        values: item.values.filter(
                                          (_, vI) => vI !== valIdx
                                        ),
                                      }
                                    : item
                                )
                              )
                            }
                            className="text-zinc-500 hover:text-red-700"
                            aria-label={`${val.value} değerini kaldır`}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <Input
                        value={newOptionValueInputs[optIdx] ?? ""}
                        onChange={(e) =>
                          setNewOptionValueInputs((prev) => ({
                            ...prev,
                            [optIdx]: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const raw = (newOptionValueInputs[optIdx] ?? "").trim();
                            if (!raw) return;
                            const parts = raw
                              .split(",")
                              .map((p) => p.trim())
                              .filter(Boolean);
                            setOptions((prev) =>
                              prev.map((item, idx) =>
                                idx === optIdx
                                  ? {
                                      ...item,
                                      values: [
                                        ...item.values,
                                        ...parts.map((p, pIdx) => ({
                                          value: p,
                                          position: item.values.length + pIdx,
                                          swatch: null,
                                        })),
                                      ],
                                    }
                                  : item
                              )
                            );
                            setNewOptionValueInputs((prev) => ({
                              ...prev,
                              [optIdx]: "",
                            }));
                          }
                        }}
                        placeholder="Yeni değer yazın (virgülle çoklu ekleyebilirsiniz: S, M, L)"
                        className="max-w-md"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          const raw = (newOptionValueInputs[optIdx] ?? "").trim();
                          if (!raw) return;
                          const parts = raw
                            .split(",")
                            .map((p) => p.trim())
                            .filter(Boolean);
                          setOptions((prev) =>
                            prev.map((item, idx) =>
                              idx === optIdx
                                ? {
                                    ...item,
                                    values: [
                                      ...item.values,
                                      ...parts.map((p, pIdx) => ({
                                        value: p,
                                        position: item.values.length + pIdx,
                                        swatch: null,
                                      })),
                                    ],
                                  }
                                : item
                            )
                          );
                          setNewOptionValueInputs((prev) => ({
                            ...prev,
                            [optIdx]: "",
                          }));
                        }}
                      >
                        Değer Ekle
                      </Button>
                    </div>
                  </div>
                ))}

                <div className="flex flex-wrap items-end justify-between gap-3 rounded border border-zinc-200 bg-zinc-100/80 p-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <div>
                      <Label>Yeni Kombinasyon Varsayılan Fiyatı (TL)</Label>
                      <Input
                        value={matrixDefaultPriceText}
                        onChange={(e) => setMatrixDefaultPriceText(e.target.value)}
                        className="mt-1 w-32 font-mono tabular-nums"
                      />
                    </div>
                    <div>
                      <Label>SKU Ön Eki</Label>
                      <Input
                        value={matrixSkuPrefix}
                        onChange={(e) => setMatrixSkuPrefix(e.target.value)}
                        className="mt-1 w-32 font-mono uppercase"
                      />
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="accent"
                    size="sm"
                    onClick={handleGenerateVariantMatrix}
                  >
                    <ArrowsClockwise className="h-4 w-4" />
                    Varyant Matrisini Üret / Senkronla
                  </Button>
                </div>
              </div>
            ) : null}
          </section>

          {/* 4. Varyant Tablosu */}
          <section className="space-y-4 rounded-md border border-zinc-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900">
                  Varyantlar, Fiyatlandırma ve Stok ({variants.length})
                </h2>
                <p className="text-xs text-zinc-600">
                  Her varyant için SKU, barkod, KDV dahil satış fiyatı, üstü çizili fiyat, maliyet ve stok miktarı.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setVariants((prev) => [
                    ...prev,
                    {
                      title: `Varyant ${prev.length + 1}`,
                      sku: "",
                      barcode: "",
                      supplierCode: "",
                      priceText: prev[0]?.priceText ?? "499,90",
                      compareAtPriceText: "",
                      clubPriceText: "",
                      costPriceText: "",
                      stockText: "0",
                      isActive: true,
                      trackInventory: true,
                      allowBackorder: false,
                      optionValues: [],
                    },
                  ])
                }
              >
                <Plus className="h-4 w-4" />
                Manuel Varyant Ekle
              </Button>
            </div>

            <div className="overflow-x-auto rounded border border-zinc-200">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                    <th className="px-2.5 py-2">Varyant</th>
                    <th className="px-2.5 py-2">SKU</th>
                    <th className="px-2.5 py-2">Barkod</th>
                    <th className="px-2.5 py-2">Satış Fiyatı (TL)</th>
                    <th className="px-2.5 py-2">Üstü Çizili (TL)</th>
                    <th className="px-2.5 py-2">VezollaClub (TL)</th>
                    <th className="px-2.5 py-2">Maliyet (TL)</th>
                    <th className="px-2.5 py-2">Stok</th>
                    <th className="px-2.5 py-2 text-center">Aktif</th>
                    <th className="px-2.5 py-2 text-right">Sil</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {variants.map((v, vIdx) => (
                    <tr key={v.id ?? vIdx} className="hover:bg-zinc-50/70">
                      <td className="px-2.5 py-2">
                        <Input
                          value={v.title}
                          onChange={(e) =>
                            setVariants((prev) =>
                              prev.map((row, idx) =>
                                idx === vIdx
                                  ? { ...row, title: e.target.value }
                                  : row
                              )
                            )
                          }
                          className="min-w-28 font-medium"
                        />
                      </td>
                      <td className="px-2.5 py-2">
                        <Input
                          value={v.sku}
                          onChange={(e) =>
                            setVariants((prev) =>
                              prev.map((row, idx) =>
                                idx === vIdx
                                  ? { ...row, sku: e.target.value }
                                  : row
                              )
                            )
                          }
                          placeholder="SKU-001"
                          className="min-w-28 font-mono tabular-nums"
                        />
                      </td>
                      <td className="px-2.5 py-2">
                        <Input
                          value={v.barcode}
                          onChange={(e) =>
                            setVariants((prev) =>
                              prev.map((row, idx) =>
                                idx === vIdx
                                  ? { ...row, barcode: e.target.value }
                                  : row
                              )
                            )
                          }
                          placeholder="869..."
                          className="min-w-28 font-mono tabular-nums"
                        />
                      </td>
                      <td className="px-2.5 py-2">
                        <Input
                          value={v.priceText}
                          onChange={(e) =>
                            setVariants((prev) =>
                              prev.map((row, idx) =>
                                idx === vIdx
                                  ? { ...row, priceText: e.target.value }
                                  : row
                              )
                            )
                          }
                          className="w-24 font-mono tabular-nums"
                        />
                      </td>
                      <td className="px-2.5 py-2">
                        <Input
                          value={v.compareAtPriceText}
                          onChange={(e) =>
                            setVariants((prev) =>
                              prev.map((row, idx) =>
                                idx === vIdx
                                  ? {
                                      ...row,
                                      compareAtPriceText: e.target.value,
                                    }
                                  : row
                              )
                            )
                          }
                          placeholder="İsteğe bağlı"
                          className="w-24 font-mono tabular-nums"
                        />
                      </td>
                      <td className="px-2.5 py-2">
                        <Input
                          value={v.clubPriceText}
                          onChange={(e) =>
                            setVariants((prev) =>
                              prev.map((row, idx) =>
                                idx === vIdx
                                  ? {
                                      ...row,
                                      clubPriceText: e.target.value,
                                    }
                                  : row
                              )
                            )
                          }
                          placeholder="Kulüp (TL)"
                          className="w-24 font-mono tabular-nums text-amber-700 font-semibold"
                        />
                      </td>
                      <td className="px-2.5 py-2">
                        <Input
                          value={v.costPriceText}
                          onChange={(e) =>
                            setVariants((prev) =>
                              prev.map((row, idx) =>
                                idx === vIdx
                                  ? { ...row, costPriceText: e.target.value }
                                  : row
                              )
                            )
                          }
                          placeholder="Maliyet"
                          className="w-24 font-mono tabular-nums"
                        />
                      </td>
                      <td className="px-2.5 py-2">
                        <Input
                          type="number"
                          min="0"
                          value={v.stockText}
                          onChange={(e) =>
                            setVariants((prev) =>
                              prev.map((row, idx) =>
                                idx === vIdx
                                  ? { ...row, stockText: e.target.value }
                                  : row
                              )
                            )
                          }
                          className="w-20 font-mono tabular-nums"
                        />
                      </td>
                      <td className="px-2.5 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={v.isActive}
                          onChange={(e) =>
                            setVariants((prev) =>
                              prev.map((row, idx) =>
                                idx === vIdx
                                  ? { ...row, isActive: e.target.checked }
                                  : row
                              )
                            )
                          }
                          className="h-4 w-4 rounded border-zinc-300"
                        />
                      </td>
                      <td className="px-2.5 py-2 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={variants.length <= 1}
                          onClick={() =>
                            setVariants((prev) =>
                              prev.filter((_, idx) => idx !== vIdx)
                            )
                          }
                        >
                          <Trash className="h-4 w-4 text-red-700" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 5. Ürün Tipine Bağlı Özel Alanlar (Attributes) */}
          <section className="space-y-4 rounded-md border border-zinc-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900">
                  Ürün Özellikleri ve Özel Alanlar
                </h2>
                <p className="text-xs text-zinc-600">
                  {selectedProductType
                    ? `"${selectedProductType.name}" ürün tipine ait teknik ve filtreleme alanları.`
                    : "Mağaza genelinde tanımlanan özel alan değerleri."}
                </p>
              </div>
              <Link
                href="/admin/katalog/ozel-alanlar"
                className="text-xs font-medium text-[#9a3412] hover:underline"
              >
                Özel Alanları Yönet
              </Link>
            </div>

            {visibleAttributes.length === 0 ? (
              <p className="text-xs text-zinc-600">
                Henüz özel alan tanımlanmamış. Ürün Tipleri ve Özel Alanlar sayfasından ekleyebilirsiniz.
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {visibleAttributes.map((attr) => {
                  const val = attributeValues[attr.id];
                  const labelSuffix = attr.unit ? ` (${attr.unit})` : "";

                  return (
                    <div key={attr.id}>
                      <Label>
                        {attr.label}
                        {labelSuffix}
                        {attr.isRequired ? " *" : ""}
                      </Label>

                      {attr.kind === "TEXT" || attr.kind === "COLOR" ? (
                        <Input
                          value={val?.valueText ?? ""}
                          onChange={(e) =>
                            updateAttributeVal(attr.id, {
                              valueText: e.target.value,
                            })
                          }
                          placeholder={
                            attr.kind === "COLOR" ? "#18181b veya Siyah" : ""
                          }
                          className="mt-1"
                        />
                      ) : null}

                      {attr.kind === "NUMBER" ? (
                        <Input
                          type="number"
                          step="any"
                          value={
                            val?.valueNumber !== null &&
                            val?.valueNumber !== undefined
                              ? String(val.valueNumber)
                              : ""
                          }
                          onChange={(e) =>
                            updateAttributeVal(attr.id, {
                              valueNumber:
                                e.target.value.trim() === ""
                                  ? null
                                  : Number(e.target.value),
                            })
                          }
                          className="mt-1 font-mono tabular-nums"
                        />
                      ) : null}

                      {attr.kind === "BOOLEAN" ? (
                        <Select
                          value={
                            val?.valueBool === true
                              ? "true"
                              : val?.valueBool === false
                                ? "false"
                                : ""
                          }
                          onChange={(e) =>
                            updateAttributeVal(attr.id, {
                              valueBool:
                                e.target.value === "true"
                                  ? true
                                  : e.target.value === "false"
                                    ? false
                                    : null,
                            })
                          }
                          className="mt-1"
                        >
                          <option value="">Seçiniz</option>
                          <option value="true">Evet</option>
                          <option value="false">Hayır</option>
                        </Select>
                      ) : null}

                      {attr.kind === "SELECT" ? (
                        <Select
                          value={val?.valueText ?? ""}
                          onChange={(e) =>
                            updateAttributeVal(attr.id, {
                              valueText: e.target.value || null,
                            })
                          }
                          className="mt-1"
                        >
                          <option value="">Seçiniz</option>
                          {attr.options.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </Select>
                      ) : null}

                      {attr.kind === "MULTISELECT" ? (
                        <div className="mt-1.5 flex flex-wrap gap-2 rounded border border-zinc-200 bg-zinc-50 p-2.5">
                          {attr.options.map((opt) => {
                            const selectedList = val?.valueList ?? [];
                            const checked = selectedList.includes(opt);
                            return (
                              <label
                                key={opt}
                                className="inline-flex items-center gap-1.5 text-xs text-zinc-800"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => {
                                    const nextList = checked
                                      ? selectedList.filter((i) => i !== opt)
                                      : [...selectedList, opt];
                                    updateAttributeVal(attr.id, {
                                      valueList: nextList,
                                    });
                                  }}
                                  className="h-3.5 w-3.5 rounded border-zinc-300"
                                />
                                <span>{opt}</span>
                              </label>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* 6. SEO Alanları */}
          <section className="space-y-4 rounded-md border border-zinc-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-zinc-900">
              Arama Motoru Optimizasyonu (SEO)
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="seoTitle">SEO Başlığı</Label>
                <Input
                  id="seoTitle"
                  value={seoTitle}
                  onChange={(e) => setSeoTitle(e.target.value)}
                  placeholder={title || "Sayfa başlığı"}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="seoDescription">SEO Meta Açıklaması</Label>
                <Textarea
                  id="seoDescription"
                  value={seoDescription}
                  onChange={(e) => setSeoDescription(e.target.value)}
                  placeholder={subtitle || "Arama sonuçlarında görünecek özet metin"}
                  className="mt-1 min-h-20"
                />
              </div>
            </div>
          </section>
        </div>

        {/* SAĞ SÜTUN: YAYIN, KATEGORİ, KOLEKSİYON, VERGİ (1/3) */}
        <div className="space-y-6">
          <section className="space-y-4 rounded-md border border-zinc-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-zinc-900">
              Yayın ve Sınıflandırma
            </h2>

            <div>
              <Label htmlFor="status">Ürün Durumu</Label>
              <Select
                id="status"
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as ProductStatusInput)
                }
                className="mt-1"
              >
                <option value="ACTIVE">Yayında (Satışa Açık)</option>
                <option value="DRAFT">Taslak (Vitrinde Gizli)</option>
                <option value="ARCHIVED">Arşivlendi</option>
              </Select>
            </div>

            <div>
              <Label htmlFor="publishedAt">Zamanlı Yayın Tarihi (İsteğe Bağlı)</Label>
              <Input
                id="publishedAt"
                type="datetime-local"
                value={publishedAt}
                onChange={(e) => setPublishedAt(e.target.value)}
                className="mt-1 font-mono"
              />
              <p className="mt-1 text-[11px] text-zinc-500">
                İleri bir tarih seçilirse o tarihe kadar vitrinde listelenmez.
              </p>
            </div>

            <div>
              <Label htmlFor="brandId">Marka</Label>
              <Select
                id="brandId"
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
                className="mt-1"
              >
                <option value="">Marka Seçilmedi</option>
                {data?.brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="productTypeId">Ürün Tipi</Label>
              <Select
                id="productTypeId"
                value={productTypeId}
                onChange={(e) => setProductTypeId(e.target.value)}
                className="mt-1"
              >
                <option value="">Standart Ürün</option>
                {data?.productTypes.map((pt) => (
                  <option key={pt.id} value={pt.id}>
                    {pt.name}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="taxClassId">KDV Sınıfı</Label>
              <Select
                id="taxClassId"
                value={taxClassId}
                onChange={(e) => setTaxClassId(e.target.value)}
                className="mt-1"
              >
                <option value="">Varsayılan Mağaza KDV Oranı</option>
                {data?.taxClasses.map((tc) => (
                  <option key={tc.id} value={tc.id}>
                    {tc.name} (%{Math.round(tc.rateBps / 100)})
                  </option>
                ))}
              </Select>
            </div>
          </section>

          {/* Kategoriler */}
          <section className="space-y-3 rounded-md border border-zinc-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-900">
                Kategoriler
              </h2>
              <Link
                href="/admin/katalog/kategoriler"
                className="text-xs font-medium text-[#9a3412] hover:underline"
              >
                Yönet
              </Link>
            </div>

            {data?.categoriesFlat.length === 0 ? (
              <p className="text-xs text-zinc-600">Henüz kategori eklenmemiş.</p>
            ) : (
              <div className="max-h-56 space-y-1.5 overflow-y-auto rounded border border-zinc-200 bg-zinc-50 p-2.5">
                {data?.categoriesFlat.map((cat) => {
                  const checked = categoryIds.includes(cat.id);
                  return (
                    <div
                      key={cat.id}
                      className="flex items-center justify-between gap-2 text-xs"
                      style={{ paddingLeft: `${cat.depth * 14}px` }}
                    >
                      <label className="flex cursor-pointer items-center gap-2 text-zinc-800">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCategory(cat.id)}
                          className="h-3.5 w-3.5 rounded border-zinc-300"
                        />
                        <span>{cat.name}</span>
                      </label>
                      {checked ? (
                        <button
                          type="button"
                          onClick={() => setPrimaryCategoryId(cat.id)}
                          className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            primaryCategoryId === cat.id
                              ? "bg-zinc-900 text-white"
                              : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300"
                          }`}
                        >
                          {primaryCategoryId === cat.id ? "Ana Kategori" : "Ana Yap"}
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Koleksiyonlar ve Etiketler */}
          <section className="space-y-4 rounded-md border border-zinc-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-zinc-900">
              Manuel Koleksiyonlar ve Etiketler
            </h2>

            {data?.collections.length === 0 ? (
              <p className="text-xs text-zinc-600">
                Henüz manuel koleksiyon oluşturulmamış.
              </p>
            ) : (
              <div className="max-h-40 space-y-1.5 overflow-y-auto rounded border border-zinc-200 bg-zinc-50 p-2.5">
                {data?.collections.map((col) => (
                  <label
                    key={col.id}
                    className="flex cursor-pointer items-center gap-2 text-xs text-zinc-800"
                  >
                    <input
                      type="checkbox"
                      checked={collectionIds.includes(col.id)}
                      onChange={() => toggleCollection(col.id)}
                      className="h-3.5 w-3.5 rounded border-zinc-300"
                    />
                    <span>{col.title}</span>
                  </label>
                ))}
              </div>
            )}

            <div>
              <Label htmlFor="tagInput">Etiketler (Virgülle Ayırın)</Label>
              <Input
                id="tagInput"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="Örn: Yeni Sezon, Organik, İndirim"
                className="mt-1"
              />
              {data && data.tags.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {data.tags.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        const list = tagInput
                          .split(",")
                          .map((item) => item.trim())
                          .filter(Boolean);
                        if (!list.includes(t.name)) {
                          setTagInput([...list, t.name].join(", "));
                        }
                      }}
                      className="rounded border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-700 hover:bg-zinc-200"
                    >
                      + {t.name}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </form>
  );
}
