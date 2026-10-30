import * as React from "react";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import {
  CART_COOKIE,
  CONSENT_COOKIE,
  SEGMENT_PREVIEW_COOKIE,
  getCurrentCustomer,
} from "@/lib/auth/session";
import {
  getAbandonedCartSettings,
  getConversionSettings,
  getStoreSettings,
  getThemeSettings,
} from "@/lib/settings/service";
import { ensureDefaultMenus } from "@/modules/content/service";
import { getRecoveryOfferPreview } from "@/modules/analytics/abandoned-cart";
import { StoreHeader } from "@/components/store/store-header";
import { StoreFooter } from "@/components/store/store-footer";
import { VisitorConsentAndBeacon } from "@/components/store/visitor-tracker";
import { ExitIntentModal } from "@/components/store/exit-intent-modal";
import { LiveSalesToast } from "@/components/store/live-sales-toast";
import { MobileBottomNav } from "@/components/store/mobile-bottom-nav";
import { DiscreetShippingBanner } from "@/components/store/discreet-shipping-banner";
import { WishlistProvider } from "@/components/store/wishlist-context";
import { StoreStructuredData } from "@/components/store/store-structured-data";

export const dynamic = "force-dynamic";

export default async function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const cartId = cookieStore.get(CART_COOKIE)?.value;
  const rawConsent = cookieStore.get(CONSENT_COOKIE)?.value;
  const previewSegmentId = cookieStore.get(SEGMENT_PREVIEW_COOKIE)?.value;

  const initialConsent: "granted" | "denied" | "unset" =
    rawConsent === "granted" || rawConsent === "1" || rawConsent === "true"
      ? "granted"
      : rawConsent === "denied" || rawConsent === "0" || rawConsent === "false"
        ? "denied"
        : "unset";

  const [store, theme, conversionSettings, menus, categories, pages, customer, previewSegment] =
    await Promise.all([
      getStoreSettings(),
      getThemeSettings(),
      getConversionSettings(),
      ensureDefaultMenus(),
      db.category.findMany({
        where: { isActive: true, parentId: null },
        orderBy: { position: "asc" },
        include: {
          children: {
            where: { isActive: true },
            orderBy: { position: "asc" },
            include: {
              children: {
                where: { isActive: true },
                orderBy: { position: "asc" },
              },
            },
          },
        },
      }),
      db.page.findMany({
        where: { status: "PUBLISHED" },
        orderBy: { title: "asc" },
        select: { id: true, title: true, slug: true },
      }),
      getCurrentCustomer(),
      previewSegmentId
        ? db.segment.findUnique({
            where: { id: previewSegmentId },
            select: { name: true },
          })
        : Promise.resolve(null),
    ]);

  const cartItemsAgg = await db.cartItem.aggregate({
    where: cartId
      ? { cartId }
      : customer
        ? { cart: { customerId: customer.id, completedAt: null } }
        : { id: "__none__" },
    _sum: { quantity: true },
  });

  const cartCount = cartItemsAgg._sum.quantity ?? 0;

  const [initialWishlistItems, initialCollections] = customer
    ? await Promise.all([
        db.wishlistItem?.findMany
          ? db.wishlistItem.findMany({
              where: { customerId: customer.id },
              select: { productId: true },
            })
          : Promise.resolve([]),
        db.wishlistCollection?.findMany
          ? db.wishlistCollection.findMany({
              where: { customerId: customer.id },
              select: { id: true, name: true },
              orderBy: { createdAt: "asc" },
            })
          : Promise.resolve([]),
      ])
    : [[], []];

  const initialProductIds = initialWishlistItems.map((i) => i.productId);

  const abandonedSettings = await getAbandonedCartSettings();
  const exitOffer =
    abandonedSettings.exitIntentEnabled && cartCount > 0
      ? await getRecoveryOfferPreview(abandonedSettings)
      : null;

  const radiusValue =
    theme.radiusScale === "none"
      ? "0px"
      : theme.radiusScale === "md"
        ? "0.75rem"
        : theme.radiusScale === "full"
          ? "9999px"
          : "0.375rem";

  return (
    <div
      style={
        {
          "--surface": theme.surfaceColor || "#fafaf9",
          "--card": theme.cardColor || "#ffffff",
          "--ink": theme.primaryColor || "#18181b",
          "--muted": theme.mutedColor || "#52525b",
          "--border": theme.borderColor || "#e4e4e7",
          "--accent": theme.accentColor || "#9a3412",
          "--accent-fg": theme.accentFgColor || "#ffffff",
          "--radius-base": radiusValue,
        } as React.CSSProperties
      }
      data-theme-mode={theme.themeMode || "light"}
      className={`flex min-h-screen flex-col bg-[var(--surface)] text-[var(--ink)] transition-colors duration-200 ${
        theme.themeMode === "dark" ? "dark" : ""
      }`}
    >
      <WishlistProvider
        initialProductIds={initialProductIds}
        initialCollections={initialCollections}
        isAuthenticated={Boolean(customer)}
      >
        <StoreStructuredData />
        <StoreHeader
          store={store}
          theme={theme}
          categories={categories}
          headerItems={menus.header.items}
          cartCount={cartCount}
          customer={customer}
          previewSegmentName={previewSegment?.name ?? null}
        />

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:py-8 lg:px-8 pb-20 md:pb-8 space-y-6">
          {theme.discreetShippingNotice ? <DiscreetShippingBanner /> : null}
          {children}
        </main>

        <StoreFooter store={store} pages={pages} footerItems={menus.footer.items} theme={theme} />

        <MobileBottomNav cartCount={cartCount} customer={customer} />

        <LiveSalesToast
          enabled={conversionSettings.liveSalesToastEnabled}
          intervalSeconds={conversionSettings.liveSalesToastIntervalSeconds}
        />

        <React.Suspense fallback={null}>
          <VisitorConsentAndBeacon initialConsent={initialConsent} />
        </React.Suspense>

        {exitOffer ? (
          <ExitIntentModal
            cartCount={cartCount}
            enabled={abandonedSettings.exitIntentEnabled}
            discountPercent={exitOffer.percent}
            discountCode={exitOffer.code}
          />
        ) : null}
      </WishlistProvider>
    </div>
  );
}
