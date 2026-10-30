"use client";

import * as React from "react";
import Link from "next/link";
import {
  ShoppingBag,
  User,
  MagnifyingGlass,
  Sliders,
  Flame,
  Star,
  Sparkle,
  Truck,
  Heart,
  List,
  Tag,
  ShieldCheck,
  LockKey,
  CaretDown,
  ArrowRight,
} from "@phosphor-icons/react";
import type { StoreSettings, ThemeSettings } from "@/lib/settings/schemas";
import {
  MobileDrawer,
  type MobileCategoryItem,
  type MobileHeaderItem,
} from "@/components/store/mobile-drawer";
import { TopAnnouncementBar } from "@/components/store/top-announcement-bar";
import { useWishlist } from "@/components/store/wishlist-context";
import { InstantSearch } from "@/components/store/instant-search";
import { MobileSearchModal } from "@/components/store/mobile-search-modal";
import { DesktopMegaMenu } from "@/components/store/desktop-mega-menu";

interface StoreHeaderProps {
  store: StoreSettings;
  theme: ThemeSettings;
  categories: MobileCategoryItem[];
  headerItems: MobileHeaderItem[];
  cartCount: number;
  customer: { firstName: string; lastName: string } | null;
  previewSegmentName?: string | null;
}

export function StoreHeader({
  store,
  theme,
  categories,
  headerItems,
  cartCount,
  customer,
  previewSegmentName,
}: StoreHeaderProps) {
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = React.useState(false);
  const [megaMenuState, setMegaMenuState] = React.useState<{
    isOpen: boolean;
    activeRootId: string | null;
  }>({ isOpen: false, activeRootId: null });
  const { wishlistCount } = useWishlist();

  // Kategori slug ve ID haritası
  const categoryMap = React.useMemo(() => {
    const map = new Map<string, MobileCategoryItem>();
    for (const c of categories) {
      map.set(c.id, c);
      map.set(c.slug, c);
    }
    return map;
  }, [categories]);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-md shadow-xs transition-colors overflow-visible">
        {/* 1. Üst Duyuru ve Fırsat Çubuğu (Taşmada Otomatik Kayan Metin / Marquee Destekli) */}
        <TopAnnouncementBar
          announcementText={theme.announcementText}
          discreetShippingNotice={theme.discreetShippingNotice}
        />

        {/* R-37: Yönsüz taslak bildirimi */}
        {theme.isDraftDirection ? (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-1 text-center text-[11px] text-amber-900">
            <strong>Yönsüz Taslak:</strong> Vitrin teması ve marka renkleri{" "}
            <Link href="/admin/ayarlar" className="font-semibold underline">
              Yönetim Paneli &gt; Ayarlar
            </Link>{" "}
            üzerinden düzenlenebilir.
          </div>
        ) : null}

        {/* Segment Canlı Önizleme Çubuğu */}
        {previewSegmentName ? (
          <div className="flex items-center justify-between bg-zinc-900 px-4 py-1 text-xs text-white">
            <span>
              Kişiselleştirme Önizlemesi: <strong>{previewSegmentName}</strong> segmenti görünümü.
            </span>
            <Link href="/admin/kisisellestirme" className="text-amber-400 underline hover:text-amber-300">
              Ayarlara Dön
            </Link>
          </div>
        ) : null}

        {/* 2. Ana Header Satırı (Hamburger + Logo + Arama + Aksiyonlar) */}
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-3 sm:px-4 lg:px-8">
          {/* Sol Kısım: Hamburger Menü Butonu & Logo */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* BURGER MENÜ BUTONU (Mobil & Tablet) */}
            <button
              type="button"
              onClick={() => setIsDrawerOpen(true)}
              aria-label="Kategori ve gezinme menüsünü aç"
              className="md:hidden flex h-10 w-10 items-center justify-center rounded-[var(--radius-base,0.375rem)] border border-[var(--border)] bg-[var(--card)] text-[var(--ink)] hover:bg-[var(--surface)] active:scale-95 transition-all shadow-2xs"
            >
              <List className="h-5 w-5" weight="bold" />
            </button>

            {/* Logo */}
            <Link
              href="/"
              className="group flex items-center shrink-0 transition-opacity hover:opacity-90 max-w-[210px] sm:max-w-[280px]"
            >
              {theme.logoImageUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={theme.logoImageUrl}
                  alt={theme.logoText || store.storeName}
                  className="h-9 sm:h-11 md:h-12 w-auto max-w-[190px] sm:max-w-[240px] md:max-w-[260px] object-contain"
                />
              ) : (
                <div className="flex flex-col font-[family-name:var(--font-serif)] text-2xl sm:text-3xl font-bold tracking-tight text-[var(--ink)]">
                  <span className="truncate">{theme.logoText || store.storeName}</span>
                  <span className="text-[10px] font-sans font-medium uppercase tracking-widest text-[var(--muted)] group-hover:text-[var(--ink)] hidden sm:block">
                    {store.tagline || "Zarafet İçten Başlar"}
                  </span>
                </div>
              )}
            </Link>
          </div>

          {/* Orta: Geniş ve Kolay Kullanımlı Anlık Canlı Arama Çubuğu (Masaüstü) */}
          <div className="hidden md:flex flex-1 max-w-lg mx-4">
            <InstantSearch />
          </div>

          {/* Sağ: Kullanıcı ve Sepet Aksiyonları */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Mobil Arama Butonu */}
            <button
              type="button"
              onClick={() => setIsSearchModalOpen(true)}
              aria-label="Ürün Ara"
              className="flex md:hidden h-10 w-10 items-center justify-center rounded-[var(--radius-base,0.375rem)] border border-[var(--border)] bg-[var(--card)] text-[var(--ink)] hover:bg-[var(--surface)] active:scale-95 transition-all shadow-2xs"
            >
              <MagnifyingGlass className="h-4 w-4" />
            </button>

            {/* Favoriler Butonu (Masaüstü) */}
            <Link
              href="/hesabim?tab=favoriler"
              title="Favorilerim"
              className="hidden lg:inline-flex items-center gap-1.5 rounded-[var(--radius-base,0.375rem)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs font-medium text-[var(--ink)] hover:border-[var(--accent)] transition-colors relative"
            >
              <div className="relative flex items-center justify-center">
                <Heart className="h-4 w-4 text-[var(--muted)]" />
                {wishlistCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-rose-600 px-1 font-mono text-[9px] font-bold text-white shadow-xs">
                    {wishlistCount}
                  </span>
                )}
              </div>
              <span>Favoriler</span>
            </Link>

            {/* Kullanıcı Giriş / Hesabım */}
            <Link
              href={customer ? "/hesabim" : "/giris"}
              className="inline-flex items-center gap-2 rounded-[var(--radius-base,0.375rem)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs font-medium text-[var(--ink)] hover:border-[var(--accent)] transition-colors h-10"
            >
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--ink)]">
                <User className="h-3.5 w-3.5" />
              </div>
              <div className="hidden sm:flex flex-col text-left leading-none">
                <span className="text-[10px] text-[var(--muted)]">
                  {customer ? "Hoş Geldiniz" : "Hesabınız"}
                </span>
                <span className="font-semibold text-[var(--ink)] truncate max-w-[100px]">
                  {customer ? customer.firstName : "Giriş Yap"}
                </span>
              </div>
            </Link>

            {/* Canlı Sepet Butonu */}
            <Link
              href="/sepet"
              className="group relative inline-flex items-center gap-2 rounded-[var(--radius-base,0.375rem)] bg-[var(--accent)] px-3 sm:px-3.5 py-2 text-xs font-semibold text-[var(--accent-fg,#ffffff)] shadow-sm hover:opacity-95 transition-all active:scale-95 h-10"
            >
              <div className="relative">
                <ShoppingBag className="h-4 w-4" />
                {cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--ink)] px-1 font-mono text-[9px] font-bold text-[var(--surface)] shadow-xs animate-bounce">
                    {cartCount}
                  </span>
                )}
              </div>
              <span className="font-medium hidden sm:inline">Sepetim</span>
            </Link>
          </div>
        </div>

        {/* 3. Dinamik Kategori & Sekme Navigasyon Satırı (Masaüstü Açılır Dropdown Destekli) */}
        <div
          onMouseLeave={() => setMegaMenuState({ isOpen: false, activeRootId: null })}
          className="border-t border-[var(--border)] bg-[var(--card)]/50 relative overflow-visible"
        >
          <div className="mx-auto flex max-w-7xl items-center justify-between px-3 sm:px-4 lg:px-8 relative overflow-visible">
            <nav
              aria-label="Kategori Gezintisi"
              className="flex items-center gap-1 overflow-x-auto md:overflow-visible py-2 scrollbar-none relative"
            >
              {/* Burger Menü Hızlı Butonu (Kategorileri Aç - Hover Mega Menü + Tıklayınca Çekmece) */}
              <div
                className="relative shrink-0"
                onMouseEnter={() =>
                  setMegaMenuState({
                    isOpen: true,
                    activeRootId: categories[0]?.id ?? null,
                  })
                }
              >
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(true)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius-base,0.375rem)] px-3 py-1.5 text-xs font-bold text-[var(--ink)] bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--card)] transition-all whitespace-nowrap shadow-2xs cursor-pointer"
                >
                  <List className="h-3.5 w-3.5 text-[var(--accent)]" weight="bold" />
                  <span>Kategoriler</span>
                  <CaretDown
                    className={`h-3 w-3 text-[var(--muted)] transition-transform duration-200 ${
                      megaMenuState.isOpen ? "rotate-180 text-[var(--accent)]" : ""
                    }`}
                  />
                </button>
              </div>

              {/* Tüm Katalog */}
              <Link
                href="/katalog"
                onMouseEnter={() => setMegaMenuState({ isOpen: false, activeRootId: null })}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius-base,0.375rem)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--surface)] transition-all whitespace-nowrap"
              >
                <span>Tüm Katalog</span>
              </Link>

              {/* Dinamik Header Sekmeleri (Eğer tanımlıysa öncelikli göster, yoksa kök kategorileri göster) */}
              {headerItems.length > 0 ? (
                headerItems.map((item) => {
                  if (!item.url) return null;
                  const targetCat = item.targetId
                    ? categoryMap.get(item.targetId)
                    : categories.find((c) => `/kategori/${c.slug}` === item.url);

                  const hasChildren = Boolean(targetCat?.children && targetCat.children.length > 0);

                  return (
                    <div
                      key={item.id}
                      className="relative shrink-0"
                      onMouseEnter={() => {
                        if (targetCat) {
                          setMegaMenuState({
                            isOpen: true,
                            activeRootId: targetCat.id,
                          });
                        } else {
                          setMegaMenuState({
                            isOpen: false,
                            activeRootId: null,
                          });
                        }
                      }}
                    >
                      <Link
                        href={item.url}
                        className={`inline-flex shrink-0 items-center gap-1 rounded-[var(--radius-base,0.375rem)] px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap ${
                          megaMenuState.isOpen && targetCat && megaMenuState.activeRootId === targetCat.id
                            ? "bg-[var(--surface)] text-[var(--accent)] font-semibold"
                            : "text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--ink)]"
                        }`}
                      >
                        <span>{item.label}</span>
                        {hasChildren ? (
                          <CaretDown className="h-3 w-3 text-[var(--muted)]" />
                        ) : null}
                      </Link>
                    </div>
                  );
                })
              ) : (
                /* Varsayılan: Kök Kategoriler */
                categories.slice(0, 8).map((cat) => {
                  const hasChildren = Boolean(cat.children && cat.children.length > 0);

                  return (
                    <div
                      key={cat.id}
                      className="relative shrink-0"
                      onMouseEnter={() =>
                        setMegaMenuState({
                          isOpen: true,
                          activeRootId: cat.id,
                        })
                      }
                    >
                      <Link
                        href={`/kategori/${cat.slug}`}
                        className={`inline-flex shrink-0 items-center gap-1 rounded-[var(--radius-base,0.375rem)] px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap ${
                          megaMenuState.isOpen && megaMenuState.activeRootId === cat.id
                            ? "bg-[var(--surface)] text-[var(--accent)] font-semibold"
                            : "text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--ink)]"
                        }`}
                      >
                        <span>{cat.name}</span>
                        {hasChildren ? (
                          <CaretDown className="h-3 w-3 text-[var(--muted)]" />
                        ) : null}
                      </Link>
                    </div>
                  );
                })
              )}
            </nav>

            {/* Sağ Uç: Alışverişi Tetikleyen Fırsat Rozetleri */}
            <div
              onMouseEnter={() => setMegaMenuState({ isOpen: false, activeRootId: null })}
              className="hidden lg:flex items-center gap-3 shrink-0 pl-4 border-l border-[var(--border)]"
            >
              <Link
                href="/katalog?filter=discount"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)] hover:underline transition-colors whitespace-nowrap"
              >
                <Flame className="h-3.5 w-3.5 text-[var(--accent)]" />
                <span>Günün Fırsatları</span>
              </Link>
              <Link
                href="/katalog?sort=bestseller"
                className="inline-flex items-center gap-1 text-xs font-medium text-[var(--ink)] hover:text-[var(--accent)] transition-colors whitespace-nowrap"
              >
                <Star className="h-3.5 w-3.5 text-amber-500" />
                <span>Çok Satanlar</span>
              </Link>
              <Link
                href="/katalog?sort=newest"
                className="inline-flex items-center gap-1 text-xs font-medium text-[var(--muted)] hover:text-[var(--ink)] transition-colors whitespace-nowrap"
              >
                <Tag className="h-3.5 w-3.5 text-indigo-500" />
                <span>Yeni Gelenler</span>
              </Link>
            </div>
          </div>

          {/* Trendyol Tarzı Tam Kapsamlı Masaüstü Mega Menü */}
          <DesktopMegaMenu
            categories={categories}
            isOpen={megaMenuState.isOpen}
            activeRootId={megaMenuState.activeRootId}
            onActiveCategoryChange={(catId) =>
              setMegaMenuState((prev) => ({ ...prev, activeRootId: catId }))
            }
            onClose={() => setMegaMenuState({ isOpen: false, activeRootId: null })}
          />
        </div>
      </header>

      {/* 4. MOBİL BURGER ÇEKMECE MENÜSÜ */}
      <MobileDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        categories={categories}
        headerItems={headerItems}
        storeName={store.storeName}
        logoText={theme.logoText}
        logoImageUrl={theme.logoImageUrl}
        discreetShipping={theme.discreetShippingNotice}
        customer={customer}
        cartCount={cartCount}
      />

      {/* 5. MOBİL ANLIK ARAMA MODALI */}
      <MobileSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
      />
    </>
  );
}
