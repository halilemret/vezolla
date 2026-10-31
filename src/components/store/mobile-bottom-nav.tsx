"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  House,
  SquaresFour,
  ShoppingBag,
  Heart,
  User,
} from "@phosphor-icons/react";
import { useWishlist } from "@/components/store/wishlist-context";
import { useCart } from "@/components/store/cart-context";

interface MobileBottomNavProps {
  cartCount: number;
  customer: { firstName: string; lastName: string } | null;
}

export function MobileBottomNav({ cartCount, customer }: MobileBottomNavProps) {
  const pathname = usePathname();
  const { wishlistCount } = useWishlist();
  const { openCart, cartCount: liveCartCount } = useCart();
  const displayCartCount = liveCartCount || cartCount;

  // Sepet ve ödeme sayfalarında odaklanmış ödeme barına yer açmak için genel alt menüyü gizle
  if (pathname === "/sepet" || pathname === "/odeme") {
    return null;
  }

  const NAV_ITEMS = [
    {
      label: "Anasayfa",
      href: "/",
      icon: House,
      isActive: pathname === "/",
    },
    {
      label: "Keşfet",
      href: "/katalog",
      icon: SquaresFour,
      isActive: pathname.startsWith("/katalog") || pathname.startsWith("/kategori"),
    },
    {
      label: "Sepetim",
      href: "/sepet",
      icon: ShoppingBag,
      isActive: pathname === "/sepet" || pathname === "/odeme",
      badge: displayCartCount > 0 ? displayCartCount : null,
      onClick: (e: React.MouseEvent) => {
        e.preventDefault();
        openCart();
      },
    },
    {
      label: "Favoriler",
      href: "/hesabim?tab=favoriler",
      icon: Heart,
      isActive: pathname === "/hesabim",
      badge: wishlistCount > 0 ? wishlistCount : null,
    },
    {
      label: customer ? customer.firstName : "Giriş",
      href: customer ? "/hesabim" : "/giris",
      icon: User,
      isActive: pathname.startsWith("/hesabim") || pathname.startsWith("/giris"),
    },
  ];

  return (
    <nav
      aria-label="Mobil Hızlı Alt Gezinti"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-[var(--border)] bg-[var(--surface)] pb-[env(safe-area-inset-bottom)] shadow-lg transition-colors"
    >
      <div className="grid grid-cols-5 items-center h-14 px-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = item.isActive;
          return (
            <Link
              key={item.label}
              href={item.href}
              onClick={item.onClick}
              className={`relative flex flex-col items-center justify-center h-full py-1 gap-0.5 text-center transition-all active:scale-90 ${
                active
                  ? "text-[var(--accent)] font-bold"
                  : "text-[var(--muted)] hover:text-[var(--ink)] font-medium"
              }`}
            >
              <div className="relative">
                <Icon
                  className="h-5 w-5 transition-transform"
                  weight={active ? "fill" : "regular"}
                />
                {item.badge ? (
                  <span className="absolute -top-1.5 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 font-mono text-[9px] font-bold text-[var(--accent-fg,#ffffff)] shadow-xs animate-pulse">
                    {item.badge}
                  </span>
                ) : null}
              </div>
              <span className="text-[10px] tracking-tight leading-none truncate max-w-[56px]">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
