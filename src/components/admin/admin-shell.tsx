"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  House,
  Package,
  TreeStructure,
  Tag,
  SlidersHorizontal,
  Warehouse,
  FileCode,
  ShoppingCart,
  ArrowCounterClockwise,
  Users,
  Percent,
  Layout,
  Sparkle,
  ChartBar,
  Gear,
  List,
  X,
  ArrowSquareOut,
  ChatText,
  Receipt,
  Funnel,
  Globe,
} from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { CommandPalette } from "@/components/admin/command-palette";
import { logoutStaffAction } from "@/modules/auth/actions";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Operasyon",
    items: [
      { label: "Aksiyon Merkezi", href: "/admin", icon: House },
      { label: "Siparişler", href: "/admin/siparisler", icon: ShoppingCart },
      { label: "e-Faturalar", href: "/admin/faturalar", icon: Receipt },
      { label: "Terk Edilmiş Sepetler", href: "/admin/terkedilmis-sepetler", icon: Funnel },
      { label: "İade Talepleri (RMA)", href: "/admin/iadeler", icon: ArrowCounterClockwise },
      { label: "Müşteriler ve Gruplar", href: "/admin/musteriler", icon: Users },
    ],
  },
  {
    title: "Katalog ve Stok",
    items: [
      { label: "Ürünler", href: "/admin/katalog/urunler", icon: Package },
      { label: "Kategoriler", href: "/admin/katalog/kategoriler", icon: TreeStructure },
      { label: "Koleksiyonlar ve Markalar", href: "/admin/katalog/koleksiyonlar", icon: Tag },
      { label: "Ürün Tipleri ve Özel Alanlar", href: "/admin/katalog/ozel-alanlar", icon: SlidersHorizontal },
      { label: "Fiyat Listeleri ve KDV", href: "/admin/katalog/fiyat-vergi", icon: Receipt },
      { label: "Depolar ve Stok Hareketleri", href: "/admin/stok", icon: Warehouse },
      { label: "XML Entegrasyonu", href: "/admin/xml/kaynaklar", icon: FileCode },
    ],
  },
  {
    title: "Pazarlama ve Vitrin",
    items: [
      { label: "Promosyon ve Kuponlar", href: "/admin/promosyonlar", icon: Percent },
      { label: "Kişiselleştirme ve Reklam", href: "/admin/kisisellestirme", icon: Sparkle },
      { label: "Ana Sayfa Blokları", href: "/admin/icerik/bloklar", icon: Layout },
      { label: "Sayfalar, Menüler, Yönlendirme", href: "/admin/icerik/sayfalar", icon: Layout },
      { label: "SEO & GEO Optimizasyonu", href: "/admin/seo-geo", icon: Globe },
      { label: "Ürün Yorumları", href: "/admin/yorumlar", icon: ChatText },
    ],
  },
  {
    title: "Analiz ve Sistem",
    items: [
      { label: "Raporlar", href: "/admin/raporlar", icon: ChartBar },
      { label: "Ayarlar ve Yetkiler", href: "/admin/ayarlar", icon: Gear },
    ],
  },
];

export function AdminShell({
  staff,
  storeName,
  pendingCounts,
  children,
}: {
  staff: { name: string; email: string; roleName: string };
  storeName: string;
  pendingCounts: { orders: number; returns: number; reviews: number };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const renderSidebarContent = () => (
    <div className="flex h-full flex-col justify-between">
      <div className="space-y-5 overflow-y-auto px-3 py-4">
        <div className="flex items-center justify-between px-2">
          <div>
            <Link href="/admin" className="text-sm font-bold tracking-tight text-zinc-900">
              {storeName}
            </Link>
            <p className="text-[11px] text-zinc-600">Yönetim Paneli</p>
          </div>
          <Link
            href="/"
            target="_blank"
            title="Mağaza vitrinini yeni sekmede aç"
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100"
          >
            <ArrowSquareOut className="h-4 w-4" />
          </Link>
        </div>

        {NAV_GROUPS.map((group) => (
          <div key={group.title}>
            <div className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              {group.title}
            </div>
            <nav className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                let count = 0;
                if (item.href === "/admin/siparisler") count = pendingCounts.orders;
                if (item.href === "/admin/iadeler") count = pendingCounts.returns;
                if (item.href === "/admin/yorumlar") count = pendingCounts.reviews;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center justify-between rounded-md px-2.5 py-2 text-xs font-medium transition-colors",
                      active
                        ? "bg-zinc-900 text-white"
                        : "text-zinc-700 hover:bg-zinc-200/70 hover:text-zinc-900"
                    )}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{item.label}</span>
                    </span>
                    {count > 0 ? (
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 font-mono text-[11px] tabular-nums",
                          active
                            ? "bg-white/20 text-white"
                            : "bg-[#ffedd5] text-[#9a3412] font-semibold"
                        )}
                      >
                        {count}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </nav>
          </div>
        ))}
      </div>

      <div className="border-t border-zinc-200 bg-zinc-50 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-zinc-900">{staff.name}</p>
            <p className="truncate text-[11px] text-zinc-600">{staff.roleName}</p>
          </div>
          <form action={logoutStaffAction}>
            <button
              type="submit"
              className="rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-800 hover:bg-zinc-100"
            >
              Çıkış
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#fafaf9] text-zinc-900">
      <aside className="hidden w-64 shrink-0 border-r border-zinc-200 bg-zinc-100/70 lg:block print:hidden">
        <div className="sticky top-0 h-screen">{renderSidebarContent()}</div>
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden print:hidden">
          <div className="fixed inset-0 bg-black/45" onClick={() => setMobileOpen(false)} />
          <div className="relative z-10 h-full w-72 bg-zinc-100">
            <div className="flex justify-end p-2">
              <button
                type="button"
                aria-label="Menüyü kapat"
                onClick={() => setMobileOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded text-zinc-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {renderSidebarContent()}
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4 lg:px-8 print:hidden">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Menüyü aç"
              onClick={() => setMobileOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded border border-zinc-200 text-zinc-800 lg:hidden"
            >
              <List className="h-5 w-5" />
            </button>
            <CommandPalette />
          </div>

          <div className="flex items-center gap-3 text-xs text-zinc-700">
            <Link
              href="/admin/katalog/urunler/yeni"
              className="hidden rounded-md bg-zinc-900 px-3 py-1.5 font-medium text-white hover:bg-zinc-800 sm:inline-flex"
            >
              + Yeni Ürün
            </Link>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 lg:px-8 print:max-w-none print:p-0">{children}</main>
      </div>
    </div>
  );
}
