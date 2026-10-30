"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MagnifyingGlass,
  X,
  CircleNotch,
  ArrowRight,
  SquaresFour,
  Package,
} from "@phosphor-icons/react";
import { formatMoney } from "@/lib/money";

export interface SearchProductResult {
  id: string;
  title: string;
  slug: string;
  minPrice: number | null;
  maxPrice: number | null;
  totalStock: number;
  brandName: string | null;
  categoryName: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  price: number;
  compareAtPrice: number | null;
}

export interface SearchCategoryResult {
  id: string;
  name: string;
  slug: string;
  parentName: string | null;
  productCount: number;
}

interface InstantSearchProps {
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  onNavigate?: () => void;
  variant?: "header" | "modal" | "drawer";
}

export function InstantSearch({
  placeholder = "Ürün, marka, kategori veya özellik ara...",
  className = "",
  autoFocus = false,
  onNavigate,
  variant = "header",
}: InstantSearchProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);
  const [products, setProducts] = React.useState<SearchProductResult[]>([]);
  const [categories, setCategories] = React.useState<SearchCategoryResult[]>([]);
  const [totalCount, setTotalCount] = React.useState(0);
  const [selectedIndex, setSelectedIndex] = React.useState<number>(-1);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const abortControllerRef = React.useRef<AbortController | null>(null);

  // Dışarı tıklamayı dinle
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Anlık Arama API Çağrısı (Debounce 150ms)
  React.useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setProducts([]);
      setCategories([]);
      setTotalCount(0);
      setIsLoading(false);
      setIsOpen(false);
      setSelectedIndex(-1);
      return;
    }

    setIsLoading(true);
    setIsOpen(true);
    setSelectedIndex(-1);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/catalog/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Arama hatası");
        const data = await res.json();
        setProducts(data.products || []);
        setCategories(data.categories || []);
        setTotalCount(data.total || 0);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        setProducts([]);
        setCategories([]);
        setTotalCount(0);
      } finally {
        setIsLoading(false);
      }
    }, 150);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // Arama gönderme (Enter veya Buton)
  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    // Eğer klavye ile bir ürün seçilmişse ona git
    if (selectedIndex >= 0 && selectedIndex < products.length) {
      const selected = products[selectedIndex];
      if (selected) {
        setIsOpen(false);
        onNavigate?.();
        router.push(`/urun/${selected.slug}`);
        return;
      }
    }

    setIsOpen(false);
    onNavigate?.();
    router.push(`/katalog?q=${encodeURIComponent(trimmed)}`);
  };

  // Klavye Gezintisi (Yukarı/Aşağı/ESC/Enter)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
      return;
    }

    if (!isOpen || products.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < products.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : products.length - 1));
    }
  };

  const handleClear = () => {
    setQuery("");
    setProducts([]);
    setCategories([]);
    setTotalCount(0);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleSelectProduct = (slug: string) => {
    setIsOpen(false);
    onNavigate?.();
    router.push(`/urun/${slug}`);
  };

  const handleSelectCategory = (slug: string) => {
    setIsOpen(false);
    onNavigate?.();
    router.push(`/kategori/${slug}`);
  };

  const isModalOrDrawer = variant === "modal" || variant === "drawer";

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Arama Input Alanı */}
      <form onSubmit={handleSubmit} className="relative w-full">
        <div className="relative flex items-center">
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              if (query.trim().length > 0) {
                setIsOpen(true);
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            autoFocus={autoFocus}
            autoComplete="off"
            spellCheck={false}
            className={`w-full rounded-[var(--radius-base,0.375rem)] border border-[var(--border)] bg-[var(--card)] text-xs text-[var(--ink)] placeholder:text-[var(--muted)] transition-colors focus:border-[var(--accent)] focus:outline-none ${
              isModalOrDrawer
                ? "h-11 pl-10 pr-10 text-sm"
                : "h-10 pl-3.5 pr-14"
            }`}
          />

          {/* Sol İkon (Modal/Drawer ise) veya Sağ İkon Grubu */}
          {isModalOrDrawer ? (
            <div className="absolute left-3.5 pointer-events-none text-[var(--muted)]">
              {isLoading ? (
                <CircleNotch className="h-4 w-4 animate-spin text-[var(--accent)]" />
              ) : (
                <MagnifyingGlass className="h-4 w-4" />
              )}
            </div>
          ) : null}

          {/* Sağ Aksiyon Butonları (Temizle + Ara) */}
          <div className="absolute right-2 flex items-center gap-1">
            {query.length > 0 && (
              <button
                type="button"
                onClick={handleClear}
                aria-label="Aramayı temizle"
                className="p-1 rounded text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface)] transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}

            {!isModalOrDrawer && (
              <button
                type="submit"
                aria-label="Ara"
                className="p-1 rounded text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
              >
                {isLoading ? (
                  <CircleNotch className="h-4 w-4 animate-spin text-[var(--accent)]" />
                ) : (
                  <MagnifyingGlass className="h-4 w-4" />
                )}
              </button>
            )}
          </div>
        </div>
      </form>

      {/* ANLIK ARAMA SONUÇLARI AÇILIR PANELİ (DROPDOWN / POPUP) */}
      {isOpen && query.trim().length > 0 && (
        <div
          className={`absolute left-0 right-0 z-50 rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-2xl overflow-hidden animate-in fade-in-50 duration-150 ${
            isModalOrDrawer
              ? "top-full mt-2 max-h-[65vh] overflow-y-auto"
              : "top-full mt-1.5 w-full max-h-[480px] overflow-y-auto"
          }`}
        >
          {/* Yükleniyor Durumu */}
          {isLoading && products.length === 0 && (
            <div className="flex items-center justify-center gap-2 p-6 text-xs text-[var(--muted)]">
              <CircleNotch className="h-4 w-4 animate-spin text-[var(--accent)]" />
              <span>Sonuçlar taranıyor...</span>
            </div>
          )}

          {/* Eşleşen Kategoriler Bölümü */}
          {categories.length > 0 && (
            <div className="border-b border-[var(--border)] p-3 bg-[var(--card)]/50">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] mb-2">
                İlgili Kategoriler
              </span>
              <div className="flex flex-wrap gap-1.5">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleSelectCategory(cat.slug)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--card)] px-2.5 py-1 text-xs font-medium text-[var(--ink)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors group text-left cursor-pointer"
                  >
                    <SquaresFour className="h-3 w-3 text-[var(--muted)] group-hover:text-[var(--accent)]" />
                    <span>{cat.name}</span>
                    {cat.productCount > 0 ? (
                      <span className="text-[10px] text-[var(--muted)] tabular-nums">
                        ({cat.productCount})
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Eşleşen Ürünler Listesi */}
          {products.length > 0 ? (
            <div className="p-2 space-y-1">
              <div className="flex items-center justify-between px-2 pt-1 pb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                  Ürünler
                </span>
                <span className="text-[11px] text-[var(--muted)] tabular-nums">
                  Toplam {totalCount} sonuç
                </span>
              </div>

              {products.map((product, idx) => {
                const isSelected = selectedIndex === idx;
                const hasDiscount =
                  product.compareAtPrice && product.compareAtPrice > product.price;

                return (
                  <div
                    key={product.id}
                    onClick={() => handleSelectProduct(product.slug)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`flex items-center gap-3 rounded-md p-2 cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-[var(--card)] text-[var(--ink)] shadow-2xs"
                        : "hover:bg-[var(--card)]/60 text-[var(--ink)]"
                    }`}
                  >
                    {/* Ürün Görseli */}
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border border-[var(--border)] bg-zinc-100">
                      {product.imageUrl ? (
                        <Image
                          src={product.imageUrl}
                          alt={product.imageAlt || product.title}
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-zinc-400">
                          <Package className="h-5 w-5" />
                        </div>
                      )}
                    </div>

                    {/* Ürün Bilgisi */}
                    <div className="flex-1 min-w-0">
                      {product.brandName ? (
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] truncate">
                          {product.brandName}
                        </span>
                      ) : null}
                      <h4 className="text-xs font-medium text-[var(--ink)] truncate">
                        {product.title}
                      </h4>
                      <div className="mt-0.5 flex items-center gap-2">
                        <span className="text-xs font-bold text-[var(--ink)] tabular-nums">
                          {formatMoney(product.price)}
                        </span>
                        {hasDiscount ? (
                          <span className="text-[11px] text-zinc-400 line-through tabular-nums">
                            {formatMoney(product.compareAtPrice!)}
                          </span>
                        ) : null}
                        {product.totalStock <= 0 ? (
                          <span className="rounded bg-rose-50 px-1.5 py-0.2 text-[10px] font-semibold text-rose-700">
                            Tükendi
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {/* Ok İkonu */}
                    <ArrowRight
                      className={`h-4 w-4 shrink-0 transition-transform ${
                        isSelected
                          ? "text-[var(--accent)] translate-x-0.5"
                          : "text-zinc-300 opacity-0 group-hover:opacity-100"
                      }`}
                    />
                  </div>
                );
              })}
            </div>
          ) : null}

          {/* Sonuç Bulunamadı Durumu */}
          {!isLoading && products.length === 0 && categories.length === 0 && (
            <div className="p-6 text-center">
              <p className="text-xs font-semibold text-[var(--ink)]">
                &ldquo;{query}&rdquo; için ürün bulunamadı
              </p>
              <p className="mt-1 text-[11px] text-[var(--muted)]">
                Farklı bir kelime deneyebilir veya tüm kataloğumuzu inceleyebilirsiniz.
              </p>
              <Link
                href="/katalog"
                onClick={() => {
                  setIsOpen(false);
                  onNavigate?.();
                }}
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--accent)] hover:underline"
              >
                <span>Tüm Kataloğu İncele</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          )}

          {/* Alt Bar: Tüm Sonuçları Gör */}
          {products.length > 0 && (
            <div className="border-t border-[var(--border)] p-2.5 bg-[var(--card)]">
              <button
                type="button"
                onClick={() => handleSubmit()}
                className="w-full flex items-center justify-between rounded-md bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--card)] hover:text-[var(--accent)] border border-[var(--border)] transition-colors cursor-pointer"
              >
                <span>Tüm &ldquo;{query}&rdquo; sonuçlarını gör</span>
                <span className="flex items-center gap-1 text-[var(--accent)]">
                  <span className="tabular-nums font-bold">({totalCount})</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
