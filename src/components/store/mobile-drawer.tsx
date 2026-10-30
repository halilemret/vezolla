"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  X,
  CaretRight,
  Flame,
  Star,
  Tag,
  ShoppingBag,
  Heart,
  User,
  ShieldCheck,
  LockKey,
  Truck,
  ArrowRight,
  SignOut,
  List,
} from "@phosphor-icons/react";
import { logoutCustomerAction } from "@/modules/auth/actions";
import { InstantSearch } from "@/components/store/instant-search";

export interface MobileCategoryChild {
  id: string;
  name: string;
  slug: string;
  children?: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
}

export interface MobileCategoryItem {
  id: string;
  name: string;
  slug: string;
  children?: MobileCategoryChild[];
}

export interface MobileHeaderItem {
  id: string;
  label: string;
  url: string | null;
  type?: string;
  targetId?: string | null;
}

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  categories: MobileCategoryItem[];
  headerItems: MobileHeaderItem[];
  storeName: string;
  logoText?: string;
  logoImageUrl?: string;
  discreetShipping?: boolean;
  customer: { firstName: string; lastName: string } | null;
  cartCount: number;
}

export function MobileDrawer({
  isOpen,
  onClose,
  categories,
  headerItems,
  storeName,
  logoText,
  logoImageUrl,
  discreetShipping = false,
  customer,
  cartCount,
}: MobileDrawerProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = React.useState<"categories" | "menu">("categories");
  const [selectedRootId, setSelectedRootId] = React.useState<string>(() => {
    return categories[0]?.id || "";
  });

  // Kilit: Çekmece açıkken arka plan kaydırmasını engelle
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      if (!selectedRootId && categories[0]) {
        setSelectedRootId(categories[0].id);
      }
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen, categories, selectedRootId]);

  // ESC tuşu ile kapat
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentCategory =
    categories.find((c) => c.id === selectedRootId) ?? categories[0];

  return (
    <div className="fixed inset-0 z-[70]">
      {/* 1. Yarı Saydam Koyu Arka Plan (Backdrop) */}
      <div
        className="fixed inset-0 bg-black/60 transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* 2. Sol Çekmece Paneli (Drawer Container - Trendyol Tarzı) */}
      <aside
        aria-label="Kategori ve Menü Gezintisi"
        className="fixed inset-y-0 left-0 flex w-[92vw] sm:w-[440px] max-w-md flex-col bg-[var(--surface)] text-[var(--ink)] shadow-2xl border-r border-[var(--border)] transition-transform animate-in slide-in-from-left duration-200 ease-out"
      >
        {/* Çekmece Üst Başlık Satırı */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--border)] px-4 bg-[var(--card)]">
          <Link
            href="/"
            onClick={onClose}
            className="flex items-center gap-2 truncate max-w-[260px]"
          >
            {logoImageUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={logoImageUrl}
                alt={logoText || storeName}
                className="h-9 sm:h-10 max-h-11 w-auto max-w-[220px] object-contain"
              />
            ) : (
              <span className="font-[family-name:var(--font-serif)] text-xl font-bold tracking-tight text-[var(--ink)]">
                {logoText || storeName}
              </span>
            )}
          </Link>

          <button
            type="button"
            onClick={onClose}
            aria-label="Menüyü Kapat"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface)] active:scale-95 transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Hızlı Arama Kutusu */}
        <div className="p-2.5 border-b border-[var(--border)] bg-[var(--card)]">
          <InstantSearch
            variant="drawer"
            onNavigate={onClose}
            placeholder="Ürün, kategori veya özellik ara..."
          />
        </div>

        {/* Sekme Değiştirici: [Kategoriler] | [Menü & Destek] */}
        <div className="grid grid-cols-2 border-b border-[var(--border)] bg-[var(--surface)] text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab("categories")}
            className={`py-2.5 text-center transition-colors flex items-center justify-center gap-1.5 border-b-2 ${
              activeTab === "categories"
                ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--card)] font-bold"
                : "border-transparent text-[var(--muted)] hover:text-[var(--ink)]"
            }`}
          >
            <List className="h-3.5 w-3.5" weight="bold" />
            <span>Kategoriler ({categories.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("menu")}
            className={`py-2.5 text-center transition-colors flex items-center justify-center gap-1.5 border-b-2 ${
              activeTab === "menu"
                ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--card)] font-bold"
                : "border-transparent text-[var(--muted)] hover:text-[var(--ink)]"
            }`}
          >
            <Tag className="h-3.5 w-3.5" />
            <span>Fırsatlar & Yardım</span>
          </button>
        </div>

        {/* Ana İçerik: Trendyol Tarzı Split View (Sol: Kök Kategoriler, Sağ: Alt Hiyerarşi) */}
        {activeTab === "categories" ? (
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Sol Sütun: Ana Kategori Listesi */}
            <div className="w-[115px] sm:w-[130px] shrink-0 border-r border-[var(--border)] bg-[var(--surface)] overflow-y-auto scrollbar-thin divide-y divide-[var(--border)]/40">
              {/* Tüm Katalog */}
              <Link
                href="/katalog"
                onClick={onClose}
                className="block p-3 text-center text-xs font-bold text-[var(--accent)] hover:bg-[var(--card)] transition-colors"
              >
                Tüm Ürünler
              </Link>

              {categories.map((cat) => {
                const isSelected = cat.id === currentCategory?.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedRootId(cat.id)}
                    className={`w-full p-3 text-left text-xs font-medium transition-all relative block ${
                      isSelected
                        ? "bg-[var(--card)] text-[var(--accent)] font-bold border-l-4 border-[var(--accent)] shadow-2xs"
                        : "text-[var(--ink)] hover:bg-[var(--card)]/60"
                    }`}
                  >
                    <span className="line-clamp-2 leading-tight">{cat.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Sağ Sütun: Seçili Kategori Alt Hiyerarşisi (Tüm Alt Kategoriler ve Çocukları Açık Görünür) */}
            <div className="flex-1 bg-[var(--card)] overflow-y-auto p-3.5 space-y-4 scrollbar-thin">
              {currentCategory ? (
                <>
                  {/* Tüm Kategoriye Git Çubuğu */}
                  <Link
                    href={`/kategori/${currentCategory.slug}`}
                    onClick={onClose}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-xs font-bold text-[var(--accent)] hover:bg-[var(--surface)]/80 transition-colors"
                  >
                    <span>Tüm {currentCategory.name} Ürünleri</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>

                  {/* Alt Kategori Grupları */}
                  {currentCategory.children && currentCategory.children.length > 0 ? (
                    <div className="space-y-4">
                      {currentCategory.children.map((sub) => {
                        const leafItems = sub.children ?? [];
                        const hasLeaves = leafItems.length > 0;

                        return (
                          <div key={sub.id} className="space-y-1.5">
                            {/* 2. Düzey Başlık (Örn: Elbise >, Dış Giyim >) */}
                            <Link
                              href={`/kategori/${sub.slug}`}
                              onClick={onClose}
                              className="group/sub flex items-center justify-between text-xs font-bold text-[var(--ink)] hover:text-[var(--accent)] pb-1 border-b border-[var(--border)]"
                            >
                              <span>{sub.name}</span>
                              <CaretRight className="h-3 w-3 text-[var(--accent)]" />
                            </Link>

                            {/* 3. Düzey Alt Öğeler (Doğrudan Tıklanabilir Liste) */}
                            {hasLeaves ? (
                              <div className="grid grid-cols-2 gap-1 pt-1">
                                {leafItems.map((leaf) => (
                                  <Link
                                    key={leaf.id}
                                    href={`/kategori/${leaf.slug}`}
                                    onClick={onClose}
                                    className="text-[11px] text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface)] p-1.5 rounded truncate block transition-colors"
                                  >
                                    {leaf.name}
                                  </Link>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-xs text-[var(--muted)]">
                      <p>Bu kategori için detaylı alt grup bulunmuyor.</p>
                      <Link
                        href={`/kategori/${currentCategory.slug}`}
                        onClick={onClose}
                        className="mt-2 inline-block font-semibold text-[var(--accent)] hover:underline"
                      >
                        Ürünleri Listele &rarr;
                      </Link>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>
        ) : (
          /* Menü & Destek Sekmesi */
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
            {/* Özel Vitrin Sekmeleri */}
            {headerItems.length > 0 && (
              <div className="space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] px-1">
                  Özel Vitrin Sekmeleri
                </div>
                {headerItems.map((item) =>
                  item.url ? (
                    <Link
                      key={item.id}
                      href={item.url}
                      onClick={onClose}
                      className="flex items-center justify-between p-2.5 rounded-lg text-xs font-medium text-[var(--ink)] hover:bg-[var(--surface)] transition-colors"
                    >
                      <span>{item.label}</span>
                      <ArrowRight className="h-3 w-3 text-[var(--muted)]" />
                    </Link>
                  ) : null
                )}
              </div>
            )}

            {/* Fırsatlar */}
            <div className="space-y-1 pt-2 border-t border-[var(--border)]">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] px-1">
                Alışveriş Fırsatları
              </div>
              <Link
                href="/katalog?filter=discount"
                onClick={onClose}
                className="flex items-center gap-2.5 p-2.5 rounded-lg text-xs font-semibold text-[var(--accent)] hover:bg-[var(--surface)] transition-colors"
              >
                <Flame className="h-4 w-4" weight="fill" />
                <span>Günün Fırsatları</span>
              </Link>
              <Link
                href="/katalog?sort=bestseller"
                onClick={onClose}
                className="flex items-center gap-2.5 p-2.5 rounded-lg text-xs font-medium text-[var(--ink)] hover:bg-[var(--surface)] transition-colors"
              >
                <Star className="h-4 w-4 text-amber-500" weight="fill" />
                <span>En Çok Satanlar</span>
              </Link>
              <Link
                href="/katalog?sort=newest"
                onClick={onClose}
                className="flex items-center gap-2.5 p-2.5 rounded-lg text-xs font-medium text-[var(--ink)] hover:bg-[var(--surface)] transition-colors"
              >
                <Tag className="h-4 w-4 text-indigo-500" />
                <span>Yeni Gelen Ürünler</span>
              </Link>
            </div>

            {/* Gizli Paketleme */}
            {discreetShipping && (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--ink)]">
                  <LockKey className="h-3.5 w-3.5 text-[var(--accent)]" />
                  <span>%100 Gizli Paketleme</span>
                </div>
                <p className="text-[10px] text-[var(--muted)] leading-tight">
                  Tüm siparişler dışarıdan içeriği belli olmayan nötr ambalajlarda gönderilir.
                </p>
              </div>
            )}

            {/* Yardım ve Takip */}
            <div className="space-y-1 pt-2 border-t border-[var(--border)]">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] px-1">
                Müşteri Hizmetleri
              </div>
              <Link
                href="/siparis-takip"
                onClick={onClose}
                className="flex items-center gap-2.5 p-2.5 rounded-lg text-xs font-medium text-[var(--ink)] hover:bg-[var(--surface)] transition-colors"
              >
                <Truck className="h-4 w-4 text-[var(--muted)]" />
                <span>Sipariş Takibi</span>
              </Link>
              <Link
                href="/sayfa/iletisim"
                onClick={onClose}
                className="flex items-center gap-2.5 p-2.5 rounded-lg text-xs font-medium text-[var(--ink)] hover:bg-[var(--surface)] transition-colors"
              >
                <ShieldCheck className="h-4 w-4 text-[var(--muted)]" />
                <span>Müşteri Hizmetleri ve İade</span>
              </Link>
            </div>
          </div>
        )}

        {/* Çekmece Alt Müşteri Hesabı Çubuğu */}
        <div className="shrink-0 border-t border-[var(--border)] p-3 bg-[var(--card)]">
          {customer ? (
            <div className="flex items-center justify-between gap-2">
              <Link
                href="/hesabim"
                onClick={onClose}
                className="flex items-center gap-2 min-w-0"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface)] border border-[var(--border)] text-[var(--ink)]">
                  <User className="h-4 w-4" />
                </div>
                <div className="truncate text-left leading-tight">
                  <div className="text-[10px] text-[var(--muted)]">Hesabım</div>
                  <div className="text-xs font-bold text-[var(--ink)] truncate max-w-[140px]">
                    {customer.firstName} {customer.lastName}
                  </div>
                </div>
              </Link>

              <form action={logoutCustomerAction}>
                <button
                  type="submit"
                  title="Çıkış Yap"
                  className="flex h-8 w-8 items-center justify-center rounded border border-[var(--border)] text-[var(--muted)] hover:text-red-600 hover:bg-[var(--surface)] transition-colors"
                >
                  <SignOut className="h-4 w-4" />
                </button>
              </form>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/giris"
                onClick={onClose}
                className="flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] py-2 text-center text-xs font-semibold text-[var(--ink)] hover:bg-[var(--card)] active:scale-95 transition-all"
              >
                Giriş Yap
              </Link>
              <Link
                href="/kayit"
                onClick={onClose}
                className="flex items-center justify-center rounded-lg bg-[var(--accent)] py-2 text-center text-xs font-semibold text-[var(--accent-fg,#ffffff)] hover:opacity-95 active:scale-95 transition-all shadow-xs"
              >
                Üye Ol
              </Link>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
