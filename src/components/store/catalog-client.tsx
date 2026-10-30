"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Faders,
  X,
  CaretRight,
  CaretDown,
  CaretLeft,
  SquaresFour,
  Check,
  Tag,
  ArrowRight,
  ArrowClockwise,
} from "@phosphor-icons/react";

export interface CatalogCategoryItem {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  productCount: number;
}

export interface CatalogBrandItem {
  id: string;
  name: string;
  slug: string;
  productCount?: number;
}

export interface CatalogAttributeItem {
  id: string;
  key: string;
  label: string;
  unit: string | null;
  options: string[];
}

export interface CatalogClientProps {
  totalCount: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  activeCategory: { id: string; name: string; slug: string } | null;
  categoryAncestors: Array<{ id: string; name: string; slug: string }>;
  categories: CatalogCategoryItem[];
  brands: CatalogBrandItem[];
  filterableAttributes: CatalogAttributeItem[];
  currentQuery: string;
  currentSort: string;
  currentCategorySlug: string;
  currentBrandSlug: string;
  currentInStockOnly: boolean;
  currentMinLira: number | null;
  currentMaxLira: number | null;
  currentAttrFilters: Record<string, string>;
  children: React.ReactNode;
}

const PRICE_PRESETS = [
  { label: "Tümü", min: null, max: null },
  { label: "500 ₺ altı", min: null, max: 500 },
  { label: "500 - 1.500 ₺", min: 500, max: 1500 },
  { label: "1.500 - 3.000 ₺", min: 1500, max: 3000 },
  { label: "3.000 ₺ üzeri", min: 3000, max: null },
];

export function CatalogClient({
  totalCount,
  currentPage,
  totalPages,
  pageSize,
  activeCategory,
  categoryAncestors,
  categories,
  brands,
  filterableAttributes,
  currentQuery,
  currentSort,
  currentCategorySlug,
  currentBrandSlug,
  currentInStockOnly,
  currentMinLira,
  currentMaxLira,
  currentAttrFilters,
  children,
}: CatalogClientProps) {
  const router = useRouter();
  const [isMobileFilterOpen, setIsMobileFilterOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  // Fiyat girişleri için lokal state
  const [customMin, setCustomMin] = React.useState(
    currentMinLira !== null ? String(currentMinLira) : ""
  );
  const [customMax, setCustomMax] = React.useState(
    currentMaxLira !== null ? String(currentMaxLira) : ""
  );

  // Kategori ağacı için genişletilmiş ebeveynler
  const [expandedParents, setExpandedParents] = React.useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    if (activeCategory) {
      initial[activeCategory.id] = true;
      for (const anc of categoryAncestors) {
        initial[anc.id] = true;
      }
    }
    return initial;
  });

  // URL Güncelleme Yardımcısı
  const updateParams = React.useCallback(
    (updates: Record<string, string | null>) => {
      startTransition(() => {
        const search = new URLSearchParams(window.location.search);
        for (const [k, v] of Object.entries(updates)) {
          if (v === null || v === "") {
            search.delete(k);
          } else {
            search.set(k, v);
          }
        }
        if (!("sayfa" in updates)) {
          search.delete("sayfa");
        }
        const qs = search.toString();
        router.push(qs ? `/katalog?${qs}` : "/katalog", { scroll: false });
      });
    },
    [router]
  );

  // Filtreyi Kaldır
  const removeParam = React.useCallback(
    (key: string) => {
      startTransition(() => {
        const search = new URLSearchParams(window.location.search);
        search.delete(key);
        search.delete("sayfa");
        const qs = search.toString();
        router.push(qs ? `/katalog?${qs}` : "/katalog", { scroll: false });
      });
    },
    [router]
  );

  // Tüm Filtreleri Temizle
  const clearAllFilters = React.useCallback(() => {
    startTransition(() => {
      router.push("/katalog");
    });
  }, [router]);

  // Sayfa Değiştir
  const handlePageChange = React.useCallback(
    (page: number) => {
      startTransition(() => {
        const search = new URLSearchParams(window.location.search);
        search.set("sayfa", String(page));
        router.push(`/katalog?${search.toString()}`);
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    },
    [router]
  );

  // Özel Fiyat Formu Gönderme
  const handleApplyPrice = (e: React.FormEvent) => {
    e.preventDefault();
    const minVal = customMin.trim() ? Number(customMin.trim()) : null;
    const maxVal = customMax.trim() ? Number(customMax.trim()) : null;
    updateParams({
      min: minVal !== null && minVal > 0 ? String(minVal) : null,
      max: maxVal !== null && maxVal > 0 ? String(maxVal) : null,
    });
  };

  // Aktif Filtre Sayısı
  const activeFiltersCount =
    (currentQuery ? 1 : 0) +
    (currentCategorySlug ? 1 : 0) +
    (currentBrandSlug ? 1 : 0) +
    (currentInStockOnly ? 1 : 0) +
    (currentMinLira !== null || currentMaxLira !== null ? 1 : 0) +
    Object.keys(currentAttrFilters).length;

  // Kategori Hiyerarşisi Hazırla
  const { rootCategories, childrenByParent } = React.useMemo(() => {
    const roots: CatalogCategoryItem[] = [];
    const childrenMap = new Map<string, CatalogCategoryItem[]>();

    for (const cat of categories) {
      if (!cat.parentId) {
        roots.push(cat);
      } else {
        const list = childrenMap.get(cat.parentId) ?? [];
        list.push(cat);
        childrenMap.set(cat.parentId, list);
      }
    }
    return { rootCategories: roots, childrenByParent: childrenMap };
  }, [categories]);

  // Aktif Fiyat Ön Tanımı Eşleşmesi
  const isMatchingPreset = (min: number | null, max: number | null) => {
    return currentMinLira === min && currentMaxLira === max;
  };

  // Filtre Bileşeni İçeriği (Sidebar ve Mobil Çekmece için Ortak)
  const renderFilterSections = (
    <div className="space-y-6">
      {/* 1. KATEGORİLER */}
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-1.5 border-b border-zinc-200">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-900">
            Kategoriler
          </span>
          {currentCategorySlug ? (
            <button
              type="button"
              onClick={() => updateParams({ kategori: null })}
              className="text-[11px] font-semibold text-[#9a3412] hover:underline cursor-pointer"
            >
              Tümü
            </button>
          ) : null}
        </div>

        <div className="space-y-1 max-h-[320px] overflow-y-auto pr-1 scrollbar-thin">
          <button
            type="button"
            onClick={() => updateParams({ kategori: null })}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors cursor-pointer text-left ${
              !currentCategorySlug
                ? "bg-zinc-900 text-white font-semibold"
                : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
            }`}
          >
            <span>Tüm Kategoriler</span>
            <span
              className={`text-[10px] tabular-nums ${
                !currentCategorySlug ? "text-zinc-300" : "text-zinc-400"
              }`}
            >
              ({totalCount})
            </span>
          </button>

          {rootCategories.map((root) => {
            const hasChildren = (childrenByParent.get(root.id) ?? []).length > 0;
            const isRootActive = currentCategorySlug === root.slug;
            const isExpanded = !!expandedParents[root.id];
            const childList = childrenByParent.get(root.id) ?? [];

            return (
              <div key={root.id} className="space-y-0.5">
                <div className="flex items-center gap-1 group">
                  <button
                    type="button"
                    onClick={() => updateParams({ kategori: root.slug })}
                    className={`flex-1 flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors cursor-pointer text-left ${
                      isRootActive
                        ? "bg-[#9a3412] text-white font-semibold"
                        : "text-zinc-800 hover:bg-zinc-100 hover:text-zinc-900"
                    }`}
                  >
                    <span className="truncate">{root.name}</span>
                    <span
                      className={`text-[10px] tabular-nums ml-1 shrink-0 ${
                        isRootActive ? "text-white/80" : "text-zinc-400"
                      }`}
                    >
                      ({root.productCount})
                    </span>
                  </button>

                  {hasChildren && (
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedParents((prev) => ({
                          ...prev,
                          [root.id]: !prev[root.id],
                        }))
                      }
                      aria-label="Alt kategorileri aç/kapat"
                      className="p-1 text-zinc-400 hover:text-zinc-800 transition-colors"
                    >
                      <CaretDown
                        className={`h-3.5 w-3.5 transition-transform ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                  )}
                </div>

                {/* Alt Kategoriler Listesi */}
                {hasChildren && isExpanded && (
                  <div className="pl-3 space-y-0.5 border-l-2 border-zinc-200 ml-2 py-0.5">
                    {childList.map((child) => {
                      const isChildActive = currentCategorySlug === child.slug;
                      const subChildren = childrenByParent.get(child.id) ?? [];
                      const hasSubChildren = subChildren.length > 0;
                      const isSubExpanded = !!expandedParents[child.id];

                      return (
                        <div key={child.id} className="space-y-0.5">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => updateParams({ kategori: child.slug })}
                              className={`flex-1 flex items-center justify-between px-2 py-1 rounded text-[11px] transition-colors cursor-pointer text-left ${
                                isChildActive
                                  ? "bg-zinc-900 text-white font-semibold"
                                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                              }`}
                            >
                              <span className="truncate">{child.name}</span>
                              <span
                                className={`text-[10px] tabular-nums ml-1 shrink-0 ${
                                  isChildActive ? "text-zinc-300" : "text-zinc-400"
                                }`}
                              >
                                ({child.productCount})
                              </span>
                            </button>
                            {hasSubChildren && (
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedParents((prev) => ({
                                    ...prev,
                                    [child.id]: !prev[child.id],
                                  }))
                                }
                                aria-label="Torun kategorileri aç/kapat"
                                className="p-0.5 text-zinc-400 hover:text-zinc-800"
                              >
                                <CaretDown
                                  className={`h-3 w-3 transition-transform ${
                                    isSubExpanded ? "rotate-180" : ""
                                  }`}
                                />
                              </button>
                            )}
                          </div>

                          {/* 3. Seviye (Torunlar: Trençkot, Kaban vb.) */}
                          {hasSubChildren && isSubExpanded && (
                            <div className="pl-2 space-y-0.5 border-l border-zinc-200 ml-1.5 py-0.5">
                              {subChildren.map((sub) => {
                                const isSubActive = currentCategorySlug === sub.slug;
                                return (
                                  <button
                                    key={sub.id}
                                    type="button"
                                    onClick={() => updateParams({ kategori: sub.slug })}
                                    className={`w-full flex items-center justify-between px-1.5 py-0.5 rounded text-[10px] transition-colors cursor-pointer text-left ${
                                      isSubActive
                                        ? "bg-zinc-900 text-white font-semibold"
                                        : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                                    }`}
                                  >
                                    <span className="truncate">{sub.name}</span>
                                    <span
                                      className={`tabular-nums ml-1 shrink-0 ${
                                        isSubActive ? "text-zinc-300" : "text-zinc-400"
                                      }`}
                                    >
                                      ({sub.productCount})
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. FİYAT ARALIĞI */}
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-1.5 border-b border-zinc-200">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-900">
            Fiyat Aralığı
          </span>
          {currentMinLira !== null || currentMaxLira !== null ? (
            <button
              type="button"
              onClick={() => {
                setCustomMin("");
                setCustomMax("");
                updateParams({ min: null, max: null });
              }}
              className="text-[11px] font-semibold text-[#9a3412] hover:underline cursor-pointer"
            >
              Sıfırla
            </button>
          ) : null}
        </div>

        {/* Hızlı Fiyat Butonları */}
        <div className="flex flex-wrap gap-1.5">
          {PRICE_PRESETS.map((preset) => {
            const active = isMatchingPreset(preset.min, preset.max);
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  setCustomMin(preset.min !== null ? String(preset.min) : "");
                  setCustomMax(preset.max !== null ? String(preset.max) : "");
                  updateParams({
                    min: preset.min !== null ? String(preset.min) : null,
                    max: preset.max !== null ? String(preset.max) : null,
                  });
                }}
                className={`rounded px-2.5 py-1 text-[11px] font-medium border transition-colors cursor-pointer ${
                  active
                    ? "border-zinc-900 bg-zinc-900 text-white font-semibold shadow-2xs"
                    : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400"
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        {/* Özel Min - Maks Girişi */}
        <form onSubmit={handleApplyPrice} className="space-y-2 pt-1">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-zinc-500 mb-0.5">En Az (TL)</label>
              <input
                type="number"
                min={0}
                placeholder="0"
                value={customMin}
                onChange={(e) => setCustomMin(e.target.value)}
                className="h-8 w-full rounded border border-zinc-200 bg-white px-2 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] text-zinc-500 mb-0.5">En Çok (TL)</label>
              <input
                type="number"
                min={0}
                placeholder="50000"
                value={customMax}
                onChange={(e) => setCustomMax(e.target.value)}
                className="h-8 w-full rounded border border-zinc-200 bg-white px-2 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-none"
              />
            </div>
          </div>
          <button
            type="submit"
            className="w-full rounded bg-zinc-100 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-200 transition-colors cursor-pointer"
          >
            Fiyatı Uygula
          </button>
        </form>
      </div>

      {/* 3. STOK DURUMU */}
      <div className="space-y-2 pt-1">
        <label className="flex items-center gap-2.5 p-2 rounded-md border border-zinc-200 bg-white cursor-pointer hover:border-zinc-300 transition-colors select-none">
          <input
            type="checkbox"
            checked={currentInStockOnly}
            onChange={(e) => updateParams({ stokta: e.target.checked ? "1" : null })}
            className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-0 cursor-pointer"
          />
          <span className="text-xs font-medium text-zinc-800">
            Sadece Stokta Olanları Göster
          </span>
        </label>
      </div>

      {/* 4. MARKALAR */}
      {brands.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-1.5 border-b border-zinc-200">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-900">
              Markalar
            </span>
            {currentBrandSlug ? (
              <button
                type="button"
                onClick={() => updateParams({ marka: null })}
                className="text-[11px] font-semibold text-[#9a3412] hover:underline cursor-pointer"
              >
                Temizle
              </button>
            ) : null}
          </div>

          <div className="space-y-1 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
            {brands.map((brand) => {
              const isSelected = currentBrandSlug === brand.slug;
              return (
                <button
                  key={brand.id}
                  type="button"
                  onClick={() =>
                    updateParams({ marka: isSelected ? null : brand.slug })
                  }
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-colors cursor-pointer text-left ${
                    isSelected
                      ? "bg-zinc-900 text-white font-semibold"
                      : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
                  }`}
                >
                  <span className="truncate">{brand.name}</span>
                  {isSelected ? (
                    <Check className="h-3.5 w-3.5 text-white" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. ÖZEL NİTELİKLER (BEDEN, RENK VB.) */}
      {filterableAttributes.map((attr) => {
        const paramKey = `attr_${attr.key}`;
        const activeVal = currentAttrFilters[attr.key];

        return (
          <div key={attr.id} className="space-y-2">
            <div className="flex items-center justify-between pb-1.5 border-b border-zinc-200">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-900">
                {attr.label} {attr.unit ? `(${attr.unit})` : ""}
              </span>
              {activeVal ? (
                <button
                  type="button"
                  onClick={() => removeParam(paramKey)}
                  className="text-[11px] font-semibold text-[#9a3412] hover:underline cursor-pointer"
                >
                  Temizle
                </button>
              ) : null}
            </div>

            {attr.options.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {attr.options.map((opt) => {
                  const isSelected = activeVal === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() =>
                        updateParams({
                          [paramKey]: isSelected ? null : opt,
                        })
                      }
                      className={`rounded px-2.5 py-1 text-[11px] border transition-colors cursor-pointer ${
                        isSelected
                          ? "border-zinc-900 bg-zinc-900 text-white font-semibold"
                          : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400"
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* 1. ÜST BAŞLIK VE BREADCRUMB */}
      <div className="border-b border-zinc-200 pb-4">
        {/* Hiyerarşik Breadcrumb */}
        <nav
          aria-label="Katalog Gezintisi"
          className="flex items-center gap-1.5 text-xs text-zinc-500 flex-wrap"
        >
          <Link href="/" className="hover:text-zinc-900 transition-colors">
            Anasayfa
          </Link>
          <span>/</span>
          <Link
            href="/katalog"
            className={`${
              !activeCategory ? "font-semibold text-zinc-900" : "hover:text-zinc-900"
            } transition-colors`}
          >
            Katalog
          </Link>

          {categoryAncestors.map((anc) => (
            <span key={anc.id} className="flex items-center gap-1.5">
              <span>/</span>
              <button
                type="button"
                onClick={() => updateParams({ kategori: anc.slug })}
                className="hover:text-zinc-900 transition-colors cursor-pointer"
              >
                {anc.name}
              </button>
            </span>
          ))}

          {activeCategory && (
            <span className="flex items-center gap-1.5">
              <span>/</span>
              <span className="font-semibold text-zinc-900">
                {activeCategory.name}
              </span>
            </span>
          )}
        </nav>

        {/* Başlık ve Sonuç Sayısı */}
        <div className="mt-2 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <h1 className="font-[family-name:var(--font-serif)] text-2xl sm:text-3xl text-zinc-900">
              {currentQuery
                ? `"${currentQuery}" Arama Sonuçları`
                : activeCategory
                  ? activeCategory.name
                  : "Ürün Kataloğu"}
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-zinc-600">
              {currentQuery
                ? `Aramanızla eşleşen ürünler listeleniyor.`
                : activeCategory
                  ? `${activeCategory.name} kategorisi ve alt reyonlarındaki tüm ürünler.`
                  : "Özenle seçilmiş tüm koleksiyon ve kategorilerimiz."}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isPending && (
              <span className="inline-flex items-center gap-1.5 text-xs text-[#9a3412] animate-pulse font-medium">
                <ArrowClockwise className="h-3.5 w-3.5 animate-spin" />
                <span>Güncelleniyor...</span>
              </span>
            )}
            <span className="text-xs text-zinc-500 tabular-nums">
              Toplam <strong>{totalCount}</strong> ürün
            </span>
          </div>
        </div>
      </div>

      {/* 2. AKTİF FİLTRELER ÇİP BARI (CHIPS BAR) */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg border border-zinc-200 bg-zinc-50/70">
          <span className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
            Aktif Filtreler:
          </span>

          {currentQuery && (
            <span className="inline-flex items-center gap-1 rounded-full border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-800 shadow-2xs">
              <span>Arama: &ldquo;{currentQuery}&rdquo;</span>
              <button
                type="button"
                onClick={() => removeParam("q")}
                className="hover:text-rose-600 transition-colors"
                aria-label="Aramayı kaldır"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}

          {activeCategory && (
            <span className="inline-flex items-center gap-1 rounded-full border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-800 shadow-2xs">
              <span>Kategori: {activeCategory.name}</span>
              <button
                type="button"
                onClick={() => removeParam("kategori")}
                className="hover:text-rose-600 transition-colors"
                aria-label="Kategoriyi kaldır"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}

          {currentBrandSlug && (
            <span className="inline-flex items-center gap-1 rounded-full border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-800 shadow-2xs">
              <span>
                Marka:{" "}
                {brands.find((b) => b.slug === currentBrandSlug)?.name ||
                  currentBrandSlug}
              </span>
              <button
                type="button"
                onClick={() => removeParam("marka")}
                className="hover:text-rose-600 transition-colors"
                aria-label="Markayı kaldır"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}

          {(currentMinLira !== null || currentMaxLira !== null) && (
            <span className="inline-flex items-center gap-1 rounded-full border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-800 shadow-2xs">
              <span>
                Fiyat:{" "}
                {currentMinLira !== null ? `${currentMinLira} ₺` : "0 ₺"} -{" "}
                {currentMaxLira !== null ? `${currentMaxLira} ₺` : "Sınırsız"}
              </span>
              <button
                type="button"
                onClick={() => {
                  setCustomMin("");
                  setCustomMax("");
                  updateParams({ min: null, max: null });
                }}
                className="hover:text-rose-600 transition-colors"
                aria-label="Fiyat filtresini kaldır"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}

          {currentInStockOnly && (
            <span className="inline-flex items-center gap-1 rounded-full border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-800 shadow-2xs">
              <span>Sadece Stoktakiler</span>
              <button
                type="button"
                onClick={() => removeParam("stokta")}
                className="hover:text-rose-600 transition-colors"
                aria-label="Stok filtresini kaldır"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}

          {Object.entries(currentAttrFilters).map(([k, v]) => (
            <span
              key={k}
              className="inline-flex items-center gap-1 rounded-full border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-800 shadow-2xs"
            >
              <span>
                {k}: {v}
              </span>
              <button
                type="button"
                onClick={() => removeParam(`attr_${k}`)}
                className="hover:text-rose-600 transition-colors"
                aria-label="Filtreyi kaldır"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}

          <button
            type="button"
            onClick={clearAllFilters}
            className="text-xs font-semibold text-[#9a3412] hover:underline ml-auto cursor-pointer"
          >
            Tümünü Temizle
          </button>
        </div>
      )}

      {/* 3. KONTROL ÇUBUĞU (SIRALAMA VE MOBİL FİLTRE BUTONU) */}
      <div className="flex items-center justify-between gap-3 border-b border-zinc-200 pb-3">
        {/* Mobil Filtre Butonu */}
        <button
          type="button"
          onClick={() => setIsMobileFilterOpen(true)}
          className="lg:hidden flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50 shadow-2xs cursor-pointer"
        >
          <Faders className="h-4 w-4 text-[#9a3412]" />
          <span>Filtreler</span>
          {activeFiltersCount > 0 ? (
            <span className="rounded-full bg-[#9a3412] px-1.5 py-0.2 text-[10px] font-bold text-white">
              {activeFiltersCount}
            </span>
          ) : null}
        </button>

        {/* Gösterilen Aralık Bilgisi */}
        <div className="hidden sm:block text-xs text-zinc-500 tabular-nums">
          {totalCount > 0 ? (
            <>
              <strong>{(currentPage - 1) * pageSize + 1}</strong> -{" "}
              <strong>{Math.min(currentPage * pageSize, totalCount)}</strong> arası
              gösteriliyor (Toplam {totalCount})
            </>
          ) : (
            "0 ürün"
          )}
        </div>

        {/* Sıralama Seçimi (Modern Dropdown) */}
        <div className="flex items-center gap-2 ml-auto">
          <label htmlFor="sort-select" className="text-xs text-zinc-600 hidden sm:inline">
            Sıralama:
          </label>
          <select
            id="sort-select"
            value={currentSort}
            onChange={(e) => updateParams({ sirala: e.target.value })}
            className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-900 focus:border-zinc-900 focus:outline-none cursor-pointer shadow-2xs"
          >
            <option value="onerilen">Önerilen Sıralama</option>
            <option value="cok-satan">En Çok Satanlar</option>
            <option value="yeni">En Yeni Eklenenler</option>
            <option value="fiyat-artan">Fiyat: Düşükten Yükseğe</option>
            <option value="fiyat-azalan">Fiyat: Yüksekten Düşüğe</option>
          </select>
        </div>
      </div>

      {/* 4. ANA DÜZEN: SOL SİDEBAR + SAĞ ÜRÜN IZGARASI */}
      <div className="grid gap-8 lg:grid-cols-12 items-start">
        {/* Masaüstü Filtre Kolonu (Sol 3 Sütun) */}
        <aside className="hidden lg:block lg:col-span-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-2xs sticky top-24">
          {renderFilterSections}
        </aside>

        {/* Ürün Listesi (Sağ 9 Sütun) */}
        <div className="lg:col-span-9 space-y-8">
          {children}

          {/* Sayfalama (Pagination) */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-zinc-200 pt-6">
              <button
                type="button"
                disabled={currentPage <= 1 || isPending}
                onClick={() => handlePageChange(currentPage - 1)}
                className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs cursor-pointer"
              >
                <CaretLeft className="h-4 w-4" />
                <span>Önceki</span>
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => {
                    // Sayfa numaralarını akıllıca kısalt
                    return (
                      p === 1 ||
                      p === totalPages ||
                      Math.abs(p - currentPage) <= 2
                    );
                  })
                  .map((pageNum, index, arr) => {
                    const prevNum = arr[index - 1];
                    const showEllipsis = prevNum && pageNum - prevNum > 1;

                    return (
                      <React.Fragment key={pageNum}>
                        {showEllipsis && (
                          <span className="px-1 text-xs text-zinc-400">...</span>
                        )}
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handlePageChange(pageNum)}
                          className={`h-8 min-w-8 rounded-md px-2 text-xs font-semibold tabular-nums transition-colors cursor-pointer ${
                            pageNum === currentPage
                              ? "bg-zinc-900 text-white"
                              : "border border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50"
                          }`}
                        >
                          {pageNum}
                        </button>
                      </React.Fragment>
                    );
                  })}
              </div>

              <button
                type="button"
                disabled={currentPage >= totalPages || isPending}
                onClick={() => handlePageChange(currentPage + 1)}
                className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs cursor-pointer"
              >
                <span>Sonraki</span>
                <CaretRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 5. MOBİL FİLTRE ÇEKMECESİ (SLIDE-OVER DRAWER) */}
      {isMobileFilterOpen && (
        <div className="fixed inset-0 z-[75] lg:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
            onClick={() => setIsMobileFilterOpen(false)}
            aria-hidden="true"
          />

          <aside className="fixed inset-y-0 right-0 flex w-[86vw] sm:w-[380px] max-w-sm flex-col bg-white shadow-2xl border-l border-zinc-200 animate-in slide-in-from-right duration-200">
            {/* Çekmece Başlığı */}
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 px-4">
              <div className="flex items-center gap-2">
                <Faders className="h-4 w-4 text-[#9a3412]" />
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-900">
                  Filtreler
                </span>
                {activeFiltersCount > 0 && (
                  <span className="rounded-full bg-[#9a3412] px-2 py-0.5 text-[10px] font-bold text-white">
                    {activeFiltersCount} Aktif
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsMobileFilterOpen(false)}
                aria-label="Filtreleri kapat"
                className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 text-zinc-500 hover:text-zinc-900 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Kaydırılabilir Filtreler */}
            <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
              {renderFilterSections}
            </div>

            {/* Alt Sabit Buton Barı */}
            <div className="border-t border-zinc-200 p-3 bg-zinc-50 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  clearAllFilters();
                  setIsMobileFilterOpen(false);
                }}
                className="flex-1 rounded-md border border-zinc-300 bg-white py-2.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-100 transition-colors cursor-pointer"
              >
                Temizle
              </button>
              <button
                type="button"
                onClick={() => setIsMobileFilterOpen(false)}
                className="flex-1 rounded-md bg-zinc-900 py-2.5 text-xs font-semibold text-white hover:bg-black transition-colors cursor-pointer"
              >
                Sonuçları Gör ({totalCount})
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
