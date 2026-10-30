"use client";

import * as React from "react";
import Link from "next/link";
import {
  CaretRight,
  List,
  ArrowRight,
  Sparkle,
  Tag,
  ShoppingBag,
} from "@phosphor-icons/react";
import type { MobileCategoryItem } from "./mobile-drawer";

interface DesktopMegaMenuProps {
  categories: MobileCategoryItem[];
  isOpen: boolean;
  onClose: () => void;
  activeRootId?: string | null;
  onActiveCategoryChange?: (id: string) => void;
}

export function DesktopMegaMenu({
  categories,
  isOpen,
  onClose,
  activeRootId,
  onActiveCategoryChange,
}: DesktopMegaMenuProps) {
  // Kullanıcının mega menü sol listesinde mouse ile üzerinde gezindiği kategori
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);

  // Header'dan yeni bir kategoriye geçildiğinde veya menü kapandığında hoveredId'yi senkronize et
  React.useEffect(() => {
    setHoveredId(null);
  }, [activeRootId, isOpen]);

  if (!isOpen || categories.length === 0) return null;

  const effectiveId = hoveredId || activeRootId || categories[0]?.id || "";
  const currentCategory =
    categories.find((c) => c.id === effectiveId) ?? categories[0];

  const handleCategoryHover = (catId: string) => {
    setHoveredId(catId);
    onActiveCategoryChange?.(catId);
  };

  return (
    <div
      onMouseLeave={onClose}
      className="absolute top-full left-0 right-0 z-50 mx-auto w-full max-w-7xl px-3 sm:px-4 lg:px-8 pt-1"
    >
      <div className="flex rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl overflow-hidden animate-in fade-in-50 slide-in-from-top-1 duration-150">
        {/* Sol Kolon: Ana Departmanlar / Reyonlar (Trendyol Tarzı) */}
        <div className="w-56 shrink-0 border-r border-[var(--border)] bg-[var(--surface)]/70 py-3 flex flex-col justify-between">
          <div className="space-y-0.5 overflow-y-auto max-h-[460px] px-2 scrollbar-thin">
            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
              Kategoriler
            </div>
            {categories.map((cat) => {
              const isSelected = cat.id === currentCategory?.id;
              const hasChildren = Boolean(cat.children && cat.children.length > 0);

              return (
                <button
                  key={cat.id}
                  type="button"
                  onMouseEnter={() => handleCategoryHover(cat.id)}
                  onClick={() => handleCategoryHover(cat.id)}
                  className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold text-left transition-all ${
                    isSelected
                      ? "bg-[var(--card)] text-[var(--accent)] shadow-2xs border-l-2 border-[var(--accent)] pl-2.5"
                      : "text-[var(--ink)] hover:bg-[var(--card)]/60 hover:text-[var(--ink)]"
                  }`}
                >
                  <span className="truncate">{cat.name}</span>
                  {hasChildren && (
                    <CaretRight
                      className={`h-3 w-3 shrink-0 transition-transform ${
                        isSelected ? "text-[var(--accent)] translate-x-0.5" : "text-[var(--muted)] opacity-60"
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div className="p-3 border-t border-[var(--border)] mt-2">
            <Link
              href="/katalog"
              onClick={onClose}
              className="flex items-center justify-between text-xs font-bold text-[var(--accent)] hover:underline"
            >
              <span>Tüm Kataloğu İncele</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Sağ Panel: Seçili Ana Kategorinin Tüm Alt Kategorileri (Trendyol Çok Sütunlu Grid) */}
        <div className="flex-1 p-6 flex flex-col justify-between max-h-[500px] overflow-y-auto bg-[var(--card)]">
          {currentCategory && (
            <div className="space-y-5">
              {/* Üst Başlık ve Doğrudan Kategoriye Git Bağlantısı */}
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                <div className="flex items-baseline gap-2">
                  <h3 className="text-base font-bold text-[var(--ink)]">
                    {currentCategory.name}
                  </h3>
                  <span className="text-xs text-[var(--muted)]">
                    Seçkin Butik Reyonu
                  </span>
                </div>
                <Link
                  href={`/kategori/${currentCategory.slug}`}
                  onClick={onClose}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--accent)] hover:underline"
                >
                  <span>Tüm {currentCategory.name} Ürünlerini Gör</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              {/* Alt Kategori Hiyerarşisi Grid'i */}
              {currentCategory.children && currentCategory.children.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-5">
                  {currentCategory.children.map((sub) => {
                    const leafItems = sub.children ?? [];
                    const hasLeaves = leafItems.length > 0;

                    return (
                      <div key={sub.id} className="space-y-2">
                        {/* 2. Seviye Alt Kategori Başlığı (Örn: Elbise >, Dış Giyim >) */}
                        <Link
                          href={`/kategori/${sub.slug}`}
                          onClick={onClose}
                          className="group/sub flex items-center gap-1 text-xs font-bold text-[var(--ink)] hover:text-[var(--accent)] transition-colors"
                        >
                          <span className="truncate">{sub.name}</span>
                          <CaretRight className="h-3 w-3 text-[var(--accent)] transition-transform group-hover/sub:translate-x-0.5" />
                        </Link>

                        {/* 3. Seviye Yaprak Kategoriler (Örn: Midi Elbise, Triko Elbise, vb.) */}
                        {hasLeaves ? (
                          <ul className="space-y-1 pl-1">
                            {leafItems.map((leaf) => (
                              <li key={leaf.id}>
                                <Link
                                  href={`/kategori/${leaf.slug}`}
                                  onClick={onClose}
                                  className="text-[11px] text-[var(--muted)] hover:text-[var(--ink)] hover:underline block truncate py-0.5 transition-colors"
                                >
                                  {leaf.name}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center text-xs text-[var(--muted)]">
                  <p>Bu kategori için alt reyon ayrımı bulunmuyor.</p>
                  <Link
                    href={`/kategori/${currentCategory.slug}`}
                    onClick={onClose}
                    className="mt-2 text-xs font-bold text-[var(--accent)] hover:underline"
                  >
                    Ürünleri Doğrudan İncele &rarr;
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Alt Bilgi Şeridi */}
          <div className="mt-6 pt-3 border-t border-[var(--border)] flex items-center justify-between text-xs text-[var(--muted)]">
            <span className="text-[11px]">
              Tüm siparişlerde hızlı teslimat ve 14 gün kolay iade güvencesi.
            </span>
            <Link
              href="/katalog?filter=bestseller"
              onClick={onClose}
              className="font-semibold text-[var(--ink)] hover:text-[var(--accent)] transition-colors"
            >
              En Çok Satan Ürünler &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
