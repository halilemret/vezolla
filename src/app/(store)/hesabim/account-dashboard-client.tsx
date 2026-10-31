"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Package,
  MapPin,
  Heart,
  UserCheck,
  SignOut as LogOut,
  Trash as Trash2,
  ShieldWarning as ShieldAlert,
  ArrowSquareOut as ExternalLink,
  SquaresFour,
  Tag,
  Copy,
  Check,
  ShoppingBag,
  ArrowRight,
  Clock,
  Truck,
  FolderSimplePlus,
  SealPercent,
  Crown,
  TrendDown,
  ArrowsLeftRight,
} from "@phosphor-icons/react";
import { formatMoney } from "@/lib/money";
import type { ClubSettings } from "@/lib/settings/schemas";
import { TR_CITIES } from "@/data/tr-cities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ProductCard, type ProductCardData } from "@/components/store/product-card";
import { useWishlist } from "@/components/store/wishlist-context";
import { logoutCustomerAction } from "@/modules/auth/actions";
import type {
  WishlistItemComputed,
  WishlistCollectionSummary,
} from "@/modules/wishlist/service";
import {
  updateMyProfileStoreAction,
  saveAddressStoreFormAction,
  deleteAddressStoreFormAction,
  removeWishlistItemStoreFormAction,
  submitReturnStoreFormAction,
  anonymizeMyAccountStoreFormAction,
  createCollectionStoreFormAction,
  deleteCollectionStoreFormAction,
  moveItemCollectionStoreFormAction,
  addWishlistItemToCartStoreAction,
  addMultipleWishlistItemsToCartStoreAction,
} from "./actions";

interface OrderItem {
  id: string;
  title: string;
  variantTitle: string | null;
  quantity: number;
  total: number;
}

interface OrderFulfillment {
  id: string;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
}

interface OrderReturnRecord {
  id: string;
  status: string;
  returnCode: string | null;
  carrierCode: string | null;
  refundAmount: number | null;
  hygieneAccepted: boolean;
  createdAt: Date;
}

interface OrderRecord {
  id: string;
  number: number;
  placedAt: Date;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  total: number;
  currency: string;
  items: OrderItem[];
  fulfillments: OrderFulfillment[];
  returns?: OrderReturnRecord[];
}

interface AddressRecord {
  id: string;
  title: string | null;
  firstName: string;
  lastName: string;
  phone: string;
  city: string;
  district: string;
  line1: string;
  isDefaultShipping: boolean;
}

interface PromotionRecord {
  id: string;
  name: string;
  description: string | null;
  code: string | null;
  type: string;
  value: number;
  endsAt: Date | null;
}

interface AccountDashboardClientProps {
  customer: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    totalSpent: number;
    orderCount: number;
    loyaltyPoints: number;
    createdAt: Date;
    acceptsMarketing: boolean;
  };
  customerGroupName: string | null;
  orders: OrderRecord[];
  addresses: AddressRecord[];
  wishlist: {
    items: WishlistItemComputed[];
    totalCount: number;
    priceDroppedCount: number;
    outOfStockCount: number;
  };
  collections: WishlistCollectionSummary[];
  activePromotions: PromotionRecord[];
  recommendedProducts: ProductCardData[];
  pendingLoyaltyPoints?: number;
  clubSettings?: ClubSettings | null;
}

const ORDER_STATUS_LABEL: Record<string, string> = {
  OPEN: "Açık",
  COMPLETED: "Tamamlandı",
  CANCELLED: "İptal Edildi",
};

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  PAID: "Ödendi",
  AWAITING_TRANSFER: "Havale Bekleniyor",
  AWAITING_COD: "Kapıda Ödeme",
  PENDING: "Beklemede",
  REFUNDED: "İade Edildi",
  PARTIALLY_REFUNDED: "Kısmi İade",
  FAILED: "Başarısız",
};

const FULFILLMENT_STATUS_LABEL: Record<string, string> = {
  UNFULFILLED: "Hazırlanıyor",
  PARTIALLY_FULFILLED: "Kısmi Kargolandı",
  FULFILLED: "Kargoya Verildi",
  DELIVERED: "Teslim Edildi",
  RETURNED: "İade Alındı",
};

export function AccountDashboardClient({
  customer,
  customerGroupName,
  orders,
  addresses,
  wishlist,
  collections,
  activePromotions,
  recommendedProducts,
  pendingLoyaltyPoints = 0,
  clubSettings,
}: AccountDashboardClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTab = searchParams.get("tab") ?? "genel-bakis";
  const { refreshWishlist } = useWishlist();

  const pointVal = clubSettings?.pointValueKurus ?? 50;
  const maturityDays = clubSettings?.pointsMaturityDays ?? 2;

  const [activeTab, setActiveTab] = React.useState<string>(rawTab);
  const [selectedCollectionId, setSelectedCollectionId] = React.useState<
    string | null
  >(null);
  const [wishlistFilter, setWishlistFilter] = React.useState<
    "all" | "price_dropped" | "in_stock" | "out_of_stock"
  >("all");

  const [copiedCoupon, setCopiedCoupon] = React.useState<string | null>(null);
  const [isAddingBatch, setIsAddingBatch] = React.useState(false);
  const [batchSuccessMessage, setBatchSuccessMessage] = React.useState<
    string | null
  >(null);
  const [addingItemId, setAddingItemId] = React.useState<string | null>(null);
  const [activeReturnOrderId, setActiveReturnOrderId] = React.useState<string | null>(null);
  const [returnSuccessMessage, setReturnSuccessMessage] = React.useState<string | null>(null);

  // URL tab senkronizasyonu
  React.useEffect(() => {
    if (rawTab && rawTab !== activeTab) {
      setActiveTab(rawTab);
    }
  }, [rawTab, activeTab]);

  function handleTabChange(tab: string) {
    setActiveTab(tab);
    router.replace(`/hesabim?tab=${tab}`, { scroll: false });
  }

  // Müşteri Sadakat Seviyesi (Gamification / Loyalty Tier)
  const tier = React.useMemo(() => {
    if (customer.totalSpent >= 100000) {
      return {
        label: "Altın VIP Üye",
        badge: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300",
        icon: Crown,
      };
    }
    if (customer.totalSpent >= 50000) {
      return {
        label: "Gümüş Üye",
        badge: "bg-zinc-100 text-zinc-800 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-200",
        icon: SealPercent,
      };
    }
    return {
      label: "Sadakat Kulübü Üyesi",
      badge: "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300",
      icon: Heart,
    };
  }, [customer.totalSpent]);

  // Kupon Kopyalama Fonksiyonu
  function handleCopyCoupon(code: string) {
    navigator.clipboard.writeText(code);
    setCopiedCoupon(code);
    setTimeout(() => setCopiedCoupon(null), 2500);
  }

  // Filtrelenmiş Favori Listesi
  const filteredWishlistItems = React.useMemo(() => {
    let list = wishlist.items;

    // Koleksiyona göre filtreleme
    if (selectedCollectionId) {
      list = list.filter((i) => i.collectionId === selectedCollectionId);
    }

    // Fiyat ve stok durumuna göre filtreleme
    if (wishlistFilter === "price_dropped") {
      list = list.filter((i) => i.hasPriceDropped);
    } else if (wishlistFilter === "in_stock") {
      list = list.filter((i) => !i.isOutOfStock);
    } else if (wishlistFilter === "out_of_stock") {
      list = list.filter((i) => i.isOutOfStock);
    }

    return list;
  }, [wishlist.items, selectedCollectionId, wishlistFilter]);

  // Tekil Ürünü Sepete Ekleme
  async function handleAddToCart(item: WishlistItemComputed) {
    if (!item.product.defaultVariantId || addingItemId) return;

    setAddingItemId(item.id);
    try {
      const res = await addWishlistItemToCartStoreAction(
        item.product.defaultVariantId
      );
      if (res.ok) {
        setBatchSuccessMessage(`"${item.product.title}" sepete eklendi! 🎉`);
        setTimeout(() => setBatchSuccessMessage(null), 3000);
      }
    } finally {
      setAddingItemId(null);
    }
  }

  // Toplu Sepete Ekleme (Fiyatı Düşenler veya Tüm Favoriler)
  async function handleBatchAddToCart(itemIds: string[]) {
    if (itemIds.length === 0 || isAddingBatch) return;

    setIsAddingBatch(true);
    try {
      const res = await addMultipleWishlistItemsToCartStoreAction(itemIds);
      if (res.ok) {
        setBatchSuccessMessage(res.message);
        setTimeout(() => setBatchSuccessMessage(null), 4000);
      }
    } finally {
      setIsAddingBatch(false);
    }
  }

  // Son aktif sipariş
  const latestOrder = orders[0] ?? null;

  return (
    <div className="space-y-8">
      {/* 1. VIP MÜŞTERİ KULÜBÜ VE PROFİL ÖZET ÇUBUĞU */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-lg font-bold text-[var(--accent-fg,#ffffff)] shadow-xs">
              {customer.firstName.charAt(0).toUpperCase()}
              {customer.lastName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-[var(--ink)]">
                  Merhaba, {customer.firstName} {customer.lastName}
                </h1>
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tier.badge}`}
                >
                  <tier.icon className="h-3.5 w-3.5" weight="fill" />
                  {customerGroupName || tier.label}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-0.5 text-xs font-semibold text-[var(--ink)]">
                  <Crown className="h-3.5 w-3.5 text-[var(--accent)]" weight="fill" />
                  VezollaClub: {customer.loyaltyPoints} Puan ({formatMoney(customer.loyaltyPoints * pointVal, "TRY")})
                  {pendingLoyaltyPoints > 0 && (
                    <span className="text-[10px] text-[var(--muted)] font-normal">
                      (+{pendingLoyaltyPoints} Bekleyen)
                    </span>
                  )}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                {customer.email} • {customer.phone || "Telefon belirtilmemiş"}
              </p>
            </div>
          </div>

          {/* Hızlı İstatistik Kartları */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            <button
              type="button"
              onClick={() => handleTabChange("siparisler")}
              className="flex flex-col items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2.5 text-center transition-all hover:border-[var(--accent)] active:scale-95"
            >
              <Package className="h-4 w-4 text-[var(--accent)]" />
              <span className="mt-1 text-sm font-bold text-[var(--ink)]">
                {orders.length}
              </span>
              <span className="text-[10px] text-[var(--muted)]">Sipariş</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange("favoriler")}
              className="relative flex flex-col items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2.5 text-center transition-all hover:border-[var(--accent)] active:scale-95"
            >
              {wishlist.priceDroppedCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-emerald-600 px-1 text-[9px] font-bold text-white shadow-xs">
                  🔥 {wishlist.priceDroppedCount}
                </span>
              )}
              <Heart className="h-4 w-4 text-rose-600" weight="fill" />
              <span className="mt-1 text-sm font-bold text-[var(--ink)]">
                {wishlist.totalCount}
              </span>
              <span className="text-[10px] text-[var(--muted)]">Favori</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange("kuponlar")}
              className="flex flex-col items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2.5 text-center transition-all hover:border-[var(--accent)] active:scale-95"
            >
              <SealPercent className="h-4 w-4 text-amber-600" />
              <span className="mt-1 text-sm font-bold text-[var(--ink)]">
                {activePromotions.length}
              </span>
              <span className="text-[10px] text-[var(--muted)]">Kupon</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange("adresler")}
              className="flex flex-col items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2.5 text-center transition-all hover:border-[var(--accent)] active:scale-95"
            >
              <MapPin className="h-4 w-4 text-sky-600" />
              <span className="mt-1 text-sm font-bold text-[var(--ink)]">
                {addresses.length}
              </span>
              <span className="text-[10px] text-[var(--muted)]">Adres</span>
            </button>
          </div>
        </div>
      </section>

      {/* 2. TAB NAVİGASYON ŞERİDİ */}
      <nav aria-label="Hesap Sekmeleri" className="border-b border-[var(--border)]">
        <div className="flex gap-2 overflow-x-auto pb-px scrollbar-none">
          {[
            { id: "genel-bakis", label: "Genel Bakış", icon: SquaresFour },
            {
              id: "favoriler",
              label: `Koleksiyonlarım & Favorilerim (${wishlist.totalCount})`,
              icon: Heart,
              badge:
                wishlist.priceDroppedCount > 0
                  ? `🔥 ${wishlist.priceDroppedCount} İndirim!`
                  : null,
            },
            {
              id: "siparisler",
              label: `Siparişlerim (${orders.length})`,
              icon: Package,
            },
            {
              id: "kuponlar",
              label: `Kuponlarım & Ayrıcalıklarım (${activePromotions.length})`,
              icon: SealPercent,
            },
            { id: "adresler", label: "Adreslerim", icon: MapPin },
            { id: "ayarlar", label: "Profil & Güvenlik", icon: UserCheck },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition-all whitespace-nowrap ${
                  isActive
                    ? "border-[var(--accent)] text-[var(--accent)]"
                    : "border-transparent text-[var(--muted)] hover:border-[var(--border)] hover:text-[var(--ink)]"
                }`}
              >
                <Icon
                  className="h-4 w-4"
                  weight={isActive && tab.id === "favoriler" ? "fill" : "regular"}
                />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-2xs">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* GENEL BİLDİRİM TOAST/BANNER */}
      {batchSuccessMessage && (
        <div className="flex items-center justify-between rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-4 text-xs font-semibold text-emerald-900 dark:text-emerald-200 animate-in fade-in">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 shrink-0" weight="bold" />
            <span>{batchSuccessMessage}</span>
          </div>
          <Link
            href="/sepet"
            className="rounded bg-emerald-600 px-3 py-1 text-[11px] font-bold text-white hover:bg-emerald-700"
          >
            Sepete Git &rarr;
          </Link>
        </div>
      )}

      {/* 3. TAB İÇERİKLERİ */}

      {/* TAB: GENEL BAKIŞ */}
      {activeTab === "genel-bakis" && (
        <div className="space-y-8">
          {/* Fiyatı Düşenler Acil Teşvik Bildirimi (Conversion Hero) */}
          {wishlist.priceDroppedCount > 0 && (
            <div className="relative overflow-hidden rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-5 shadow-xs">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                    <TrendDown className="h-4 w-4 text-emerald-600" weight="bold" />
                    <span>Özel Fırsat Yakalandı!</span>
                  </div>
                  <h3 className="text-base font-bold text-emerald-950 dark:text-emerald-100">
                    Favorilerinizdeki {wishlist.priceDroppedCount} ürünün fiyatı düştü! 🎉
                  </h3>
                  <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80">
                    Koleksiyonunuza eklediğiniz fiyatlardan daha uyguna satın alma şansını kaçırmayın.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setWishlistFilter("price_dropped");
                      handleTabChange("favoriler");
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition-colors"
                  >
                    <span>Fırsatları İncele</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* VezollaClub Sadakat ve Puan Durum Kartı */}
          {(!clubSettings || clubSettings.accountShowClubCard) && (
            <section className="rounded-[var(--radius-base,0.75rem)] border border-[var(--border)] bg-[var(--card)] p-5 space-y-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-base,0.375rem)] bg-[var(--accent)] text-[var(--accent-fg)]">
                    <Crown className="h-5 w-5" weight="fill" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[var(--ink)]">
                      {clubSettings?.accountCardTitle ?? "VezollaClub Puan Hesabınız"}
                    </h3>
                    <p className="text-xs text-[var(--muted)]">
                      {clubSettings?.accountCardSubtitle ?? "Her 1.000 TL harcamanıza 100 Puan (50 TL indirim) kazanırsınız."}
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-[var(--surface)] border border-[var(--border)] px-3 py-1 text-xs font-semibold text-[var(--ink)]">
                  {clubSettings?.accountConversionBadge ?? "10 Puan = 5 TL"}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-[var(--radius-base,0.5rem)] border border-[var(--border)] bg-[var(--surface)] p-4">
                  <span className="text-xs font-medium text-[var(--muted)]">
                    Kullanılabilir Bakiye
                  </span>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-2xl font-extrabold text-[var(--ink)]">
                      {customer.loyaltyPoints}
                    </span>
                    <span className="text-xs text-[var(--muted)]">Puan</span>
                    <span className="text-sm font-bold text-emerald-600">
                      ({formatMoney(customer.loyaltyPoints * pointVal, "TRY")})
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-[var(--muted)]">
                    Sepetteki sipariş tutarınızın %{clubSettings?.maxOrderDiscountPercent ?? 20}&apos;sine kadar hemen düşebilirsiniz.
                  </p>
                </div>

                <div className="rounded-[var(--radius-base,0.5rem)] border border-[var(--border)] bg-[var(--surface)] p-4">
                  <span className="text-xs font-medium text-[var(--muted)]">
                    Bekleyen Puanlar
                  </span>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-2xl font-extrabold text-[var(--accent)]">
                      {pendingLoyaltyPoints}
                    </span>
                    <span className="text-xs text-[var(--muted)]">Puan</span>
                    <span className="text-sm font-bold text-[var(--ink)]">
                      ({formatMoney(pendingLoyaltyPoints * pointVal, "TRY")})
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-[var(--muted)]">
                    {(clubSettings?.accountPendingNotice ?? "Siparişiniz teslim edildikten {days} gün sonra otomatik olarak bakiyenize aktarılır.").replace("{days}", String(maturityDays))}
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* Son Siparişin Canlı Kargo İlerleme Takibi */}
          {latestOrder && (
            <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-3">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-[var(--accent)]" />
                  <h3 className="text-sm font-bold text-[var(--ink)]">
                    Son Siparişiniz (#{latestOrder.number})
                  </h3>
                  <span className="text-xs text-[var(--muted)]">
                    {new Date(latestOrder.placedAt).toLocaleDateString("tr-TR")}
                  </span>
                </div>
                <Link
                  href={`/siparis-sonuc/${latestOrder.id}`}
                  className="text-xs font-semibold text-[var(--accent)] hover:underline inline-flex items-center gap-1"
                >
                  Detayları Gör
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>

              {/* 4 Aşamalı Görsel Kargo İlerleme Çubuğu */}
              <div className="py-2">
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  {[
                    { label: "Sipariş Alındı", done: true },
                    {
                      label: "Hazırlanıyor",
                      done:
                        latestOrder.fulfillmentStatus !== "CANCELLED",
                    },
                    {
                      label: "Kargoya Verildi",
                      done:
                        latestOrder.fulfillmentStatus === "FULFILLED" ||
                        latestOrder.fulfillmentStatus === "DELIVERED",
                    },
                    {
                      label: "Teslim Edildi",
                      done: latestOrder.fulfillmentStatus === "DELIVERED",
                    },
                  ].map((step, idx) => (
                    <div key={step.label} className="flex flex-col items-center gap-1.5">
                      <div
                        className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                          step.done
                            ? "bg-[var(--accent)] text-white shadow-2xs"
                            : "bg-[var(--surface)] border border-[var(--border)] text-[var(--muted)]"
                        }`}
                      >
                        {step.done ? <Check className="h-3.5 w-3.5" weight="bold" /> : idx + 1}
                      </div>
                      <span
                        className={`text-[11px] font-medium leading-tight ${
                          step.done ? "text-[var(--ink)] font-semibold" : "text-[var(--muted)]"
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {latestOrder.fulfillments[0]?.trackingNumber && (
                <div className="flex items-center justify-between rounded-md bg-[var(--surface)] p-3 text-xs">
                  <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4 text-[var(--accent)]" />
                    <span>
                      <strong>{latestOrder.fulfillments[0].carrier?.toUpperCase() ?? "KARGO"}:</strong> Takip No:{" "}
                      {latestOrder.fulfillments[0].trackingNumber}
                    </span>
                  </div>
                  {latestOrder.fulfillments[0].trackingUrl && (
                    <a
                      href={latestOrder.fulfillments[0].trackingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-bold text-[var(--accent)] hover:underline"
                    >
                      Kargoyu Canlı İzle &rarr;
                    </a>
                  )}
                </div>
              )}
            </section>
          )}

          {/* Hızlı Kupon Kartları */}
          {activePromotions.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <SealPercent className="h-5 w-5 text-amber-600" />
                  <h3 className="text-sm font-bold text-[var(--ink)]">
                    Kullanabileceğiniz Aktif Kuponlar
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => handleTabChange("kuponlar")}
                  className="text-xs font-semibold text-[var(--accent)] hover:underline"
                >
                  Tümünü Gör
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {activePromotions.slice(0, 3).map((promo) => (
                  <div
                    key={promo.id}
                    className="flex flex-col justify-between rounded-[var(--radius-base,0.5rem)] border border-dashed border-[var(--border)] bg-[var(--surface)] p-4 space-y-2"
                  >
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                        {promo.type === "PERCENTAGE"
                          ? `%${promo.value / 100} İndirim`
                          : promo.type === "FIXED_AMOUNT"
                          ? `${formatMoney(promo.value)} İndirim`
                          : "Özel Fırsat"}
                      </span>
                      <h4 className="text-sm font-bold text-[var(--ink)]">{promo.name}</h4>
                      {promo.description && (
                        <p className="text-xs text-[var(--muted)] line-clamp-2">
                          {promo.description}
                        </p>
                      )}
                    </div>
                    {promo.code && (
                      <div className="flex items-center justify-between pt-2 border-t border-amber-200 dark:border-amber-800">
                        <span className="font-mono text-xs font-bold text-[var(--ink)] bg-white dark:bg-zinc-800 px-2 py-0.5 rounded border border-amber-200">
                          {promo.code}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyCoupon(promo.code!)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 hover:text-amber-800"
                        >
                          {copiedCoupon === promo.code ? (
                            <>
                              <Check className="h-3 w-3" /> Kopyalandı!
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" /> Kodu Kopyala
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Sizin İçin Seçtiklerimiz / Önerilen Ürünler */}
          {recommendedProducts.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-[var(--accent)]" />
                <h3 className="text-sm font-bold text-[var(--ink)]">
                  İlginizi Çekebilecek Ürünler
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {recommendedProducts.slice(0, 4).map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* TAB: KOLEKSİYONLARIM & FAVORİLERİM */}
      {activeTab === "favoriler" && (
        <div className="space-y-6">
          {/* Koleksiyon Çipleri & Yeni Liste Butonu */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedCollectionId(null)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                  selectedCollectionId === null
                    ? "bg-[var(--accent)] text-white shadow-2xs"
                    : "border border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--card)]"
                }`}
              >
                Tümü ({wishlist.totalCount})
              </button>

              {collections.map((col) => (
                <div key={col.id} className="relative inline-flex items-center group">
                  <button
                    type="button"
                    onClick={() => setSelectedCollectionId(col.id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                      selectedCollectionId === col.id
                        ? "bg-[var(--accent)] text-white shadow-2xs"
                        : "border border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--card)]"
                    }`}
                  >
                    📁 {col.name} ({col.itemCount})
                  </button>
                  {/* Koleksiyon Silme Butonu */}
                  <form
                    action={deleteCollectionStoreFormAction}
                    className="opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                    onSubmit={(e) => {
                      if (!confirm(`"${col.name}" listesini silmek istediğinize emin misiniz?`)) {
                        e.preventDefault();
                      }
                    }}
                  >
                    <input type="hidden" name="collectionId" value={col.id} />
                    <button
                      type="submit"
                      title="Koleksiyonu Sil"
                      className="text-[var(--muted)] hover:text-rose-600 p-0.5"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </form>
                </div>
              ))}
            </div>

            {/* Yeni Koleksiyon Oluşturma Formu */}
            <form
              action={createCollectionStoreFormAction}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                name="name"
                required
                placeholder="Yeni Liste Adı..."
                className="h-8 rounded-md border border-[var(--border)] bg-[var(--card)] px-2.5 text-xs text-[var(--ink)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
              />
              <button
                type="submit"
                className="inline-flex h-8 items-center gap-1 rounded-md bg-[var(--surface)] border border-[var(--border)] px-2.5 text-xs font-semibold text-[var(--ink)] hover:border-[var(--accent)] transition-colors"
              >
                <FolderSimplePlus className="h-3.5 w-3.5 text-[var(--accent)]" />
                Liste Aç
              </button>
            </form>
          </div>

          {/* Filtre ve Toplu Sepete Ekleme Eylemleri */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--muted)]">Filtrele:</span>
              <button
                type="button"
                onClick={() => setWishlistFilter("all")}
                className={`rounded px-2.5 py-1 text-xs font-medium ${
                  wishlistFilter === "all"
                    ? "bg-[var(--ink)] text-[var(--surface)] font-bold"
                    : "text-[var(--muted)] hover:text-[var(--ink)]"
                }`}
              >
                Tümü
              </button>
              <button
                type="button"
                onClick={() => setWishlistFilter("price_dropped")}
                className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium ${
                  wishlistFilter === "price_dropped"
                    ? "bg-emerald-600 text-white font-bold"
                    : "text-emerald-700 hover:underline"
                }`}
              >
                🔥 Fiyatı Düşenler ({wishlist.priceDroppedCount})
              </button>
              <button
                type="button"
                onClick={() => setWishlistFilter("in_stock")}
                className={`rounded px-2.5 py-1 text-xs font-medium ${
                  wishlistFilter === "in_stock"
                    ? "bg-[var(--ink)] text-[var(--surface)] font-bold"
                    : "text-[var(--muted)] hover:text-[var(--ink)]"
                }`}
              >
                Stokta Var
              </button>
            </div>

            {/* Toplu Sepete Ekleme Aksiyonları */}
            <div className="flex items-center gap-2">
              {wishlist.priceDroppedCount > 0 && (
                <button
                  type="button"
                  disabled={isAddingBatch}
                  onClick={() =>
                    handleBatchAddToCart(
                      wishlist.items.filter((i) => i.hasPriceDropped).map((i) => i.id)
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50 transition-all"
                >
                  <TrendDown className="h-3.5 w-3.5" />
                  <span>Fiyatı Düşenleri Sepete Ekle ({wishlist.priceDroppedCount})</span>
                </button>
              )}

              {filteredWishlistItems.length > 0 && (
                <button
                  type="button"
                  disabled={isAddingBatch}
                  onClick={() =>
                    handleBatchAddToCart(
                      filteredWishlistItems.filter((i) => !i.isOutOfStock).map((i) => i.id)
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] hover:border-[var(--accent)] disabled:opacity-50 transition-all"
                >
                  <ShoppingBag className="h-3.5 w-3.5 text-[var(--accent)]" />
                  <span>Mevcut Listeyi Sepete Ekle</span>
                </button>
              )}
            </div>
          </div>

          {/* Favori Ürün Listesi */}
          {filteredWishlistItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] p-10 text-center space-y-3">
              <Heart className="mx-auto h-10 w-10 text-[var(--muted)]" />
              <p className="text-sm font-semibold text-[var(--ink)]">
                Bu görünümde favori ürününüz bulunmuyor.
              </p>
              <p className="text-xs text-[var(--muted)] max-w-sm mx-auto">
                Beğendiğiniz ürünlerin üzerindeki kalp simgesine tıklayarak favorilerinize ve özel koleksiyonlarınıza ekleyebilirsiniz.
              </p>
              <Link
                href="/katalog"
                className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent)] px-4 py-2 text-xs font-bold text-[var(--accent-fg,#ffffff)] hover:opacity-90"
              >
                Kataloğu İncele &rarr;
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredWishlistItems.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col justify-between rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-xs transition-all hover:border-[var(--accent)]/40 hover:shadow-md space-y-3"
                >
                  <div className="flex gap-3">
                    {/* Ürün Görseli */}
                    <Link
                      href={`/urun/${item.product.slug}`}
                      className="relative h-24 w-20 shrink-0 overflow-hidden rounded-lg bg-[var(--surface)]"
                    >
                      {item.product.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.product.imageUrl}
                          alt={item.product.title}
                          className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center p-2 text-center text-[10px] text-[var(--muted)]">
                          {item.product.title}
                        </div>
                      )}
                    </Link>

                    {/* Bilgiler ve Fiyat Karşılaştırması */}
                    <div className="flex-1 min-w-0 space-y-1">
                      {item.product.brandName && (
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                          {item.product.brandName}
                        </p>
                      )}
                      <Link
                        href={`/urun/${item.product.slug}`}
                        className="block text-xs font-bold text-[var(--ink)] line-clamp-2 hover:underline"
                      >
                        {item.product.title}
                      </Link>

                      {/* Koleksiyon Adı */}
                      {item.collectionName && (
                        <span className="inline-block rounded bg-[var(--surface)] px-1.5 py-0.5 text-[9px] font-semibold text-[var(--muted)]">
                          📁 {item.collectionName}
                        </span>
                      )}

                      {/* Stok Durumu */}
                      <div>
                        {item.isOutOfStock ? (
                          <span className="inline-block text-[10px] font-bold text-zinc-500">
                            Stokta Yok
                          </span>
                        ) : item.isLowStock ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600">
                            <Clock className="h-3 w-3" />
                            Son {item.product.totalStock} Adet Kaldı!
                          </span>
                        ) : null}
                      </div>

                      {/* Fiyat Gösterimi ve Fiyat Düşüşü Hesaplaması */}
                      <div className="pt-1">
                        {item.hasPriceDropped ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-[var(--muted)] line-through">
                                {formatMoney(item.priceWhenAdded ?? item.currentPrice)}
                              </span>
                              <span className="text-sm font-extrabold text-emerald-600 tabular-nums">
                                {formatMoney(item.currentPrice)}
                              </span>
                            </div>
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                              <TrendDown className="h-3 w-3" weight="bold" />
                              %{item.priceDropPercentage} Fiyatı Düştü! ({formatMoney(item.priceDropMinor)} indirim)
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-[var(--ink)] tabular-nums">
                              {formatMoney(item.currentPrice)}
                            </span>
                            {item.compareAtPrice && item.compareAtPrice > item.currentPrice && (
                              <span className="text-xs text-[var(--muted)] line-through">
                                {formatMoney(item.compareAtPrice)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Alt Aksiyon Butonları */}
                  <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] pt-2.5">
                    {/* Koleksiyon Değiştir Dropdown */}
                    <form
                      action={moveItemCollectionStoreFormAction}
                      className="flex items-center gap-1"
                    >
                      <input type="hidden" name="wishlistItemId" value={item.id} />
                      <select
                        name="collectionId"
                        defaultValue={item.collectionId ?? "none"}
                        onChange={(e) => e.target.form?.requestSubmit()}
                        aria-label="Koleksiyon Seç"
                        className="h-7 rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 text-[10px] font-medium text-[var(--ink)] focus:outline-none"
                      >
                        <option value="none">Genel Favoriler</option>
                        {collections.map((col) => (
                          <option key={col.id} value={col.id}>
                            {col.name}
                          </option>
                        ))}
                      </select>
                    </form>

                    <div className="flex items-center gap-1.5">
                      {/* Sepete Ekle Butonu */}
                      {!item.isOutOfStock && item.product.defaultVariantId && (
                        <button
                          type="button"
                          disabled={addingItemId === item.id}
                          onClick={() => handleAddToCart(item)}
                          className="inline-flex h-7 items-center gap-1 rounded bg-[var(--accent)] px-2.5 text-[11px] font-bold text-[var(--accent-fg,#ffffff)] hover:opacity-90 disabled:opacity-50 transition-opacity"
                        >
                          <ShoppingBag className="h-3 w-3" />
                          <span>{addingItemId === item.id ? "Ekleniyor..." : "Sepete Ekle"}</span>
                        </button>
                      )}

                      {/* Kaldır Butonu */}
                      <form action={removeWishlistItemStoreFormAction}>
                        <input type="hidden" name="wishlistItemId" value={item.id} />
                        <button
                          type="submit"
                          title="Favorilerden Kaldır"
                          className="flex h-7 w-7 items-center justify-center rounded border border-[var(--border)] text-[var(--muted)] hover:border-rose-300 hover:text-rose-600 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: SİPARİŞLERİM */}
      {activeTab === "siparisler" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[var(--ink)]">
              Geçmiş ve Aktif Siparişleriniz ({orders.length})
            </h2>
          </div>

          {orders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] p-10 text-center space-y-3">
              <Package className="mx-auto h-10 w-10 text-[var(--muted)]" />
              <p className="text-sm font-semibold text-[var(--ink)]">
                Henüz verilmiş bir siparişiniz bulunmuyor.
              </p>
              <Link
                href="/katalog"
                className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent)] px-4 py-2 text-xs font-bold text-[var(--accent-fg,#ffffff)] hover:opacity-90"
              >
                Alışverişe Başla &rarr;
              </Link>
            </div>
          ) : (
            orders.map((order) => (
              <div
                key={order.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/siparis-sonuc/${order.id}`}
                      className="text-sm font-bold text-[var(--ink)] hover:underline"
                    >
                      Sipariş #{order.number}
                    </Link>
                    <span className="text-xs text-[var(--muted)]">
                      {new Date(order.placedAt).toLocaleDateString("tr-TR", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                    <Badge variant="neutral">
                      {ORDER_STATUS_LABEL[order.status] ?? order.status}
                    </Badge>
                    <Badge
                      variant={order.paymentStatus === "PAID" ? "success" : "warning"}
                    >
                      {PAYMENT_STATUS_LABEL[order.paymentStatus] ?? order.paymentStatus}
                    </Badge>
                    <Badge variant="accent">
                      {FULFILLMENT_STATUS_LABEL[order.fulfillmentStatus] ??
                        order.fulfillmentStatus}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold tabular-nums text-[var(--ink)]">
                      {formatMoney(order.total, order.currency)}
                    </span>
                    <Link
                      href={`/siparis-sonuc/${order.id}`}
                      className="inline-flex items-center gap-1 rounded border border-[var(--border)] px-2.5 py-1 text-xs font-semibold text-[var(--ink)] hover:border-[var(--accent)] transition-colors"
                    >
                      Detay
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                </div>

                {/* Ürün Kalemleri */}
                <div className="divide-y divide-[var(--border)] text-xs">
                  {order.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between py-2"
                    >
                      <div>
                        <span className="font-semibold text-[var(--ink)]">
                          {item.quantity}x {item.title}
                        </span>
                        {item.variantTitle && (
                          <span className="text-[var(--muted)]">
                            {" "}
                            ({item.variantTitle})
                          </span>
                        )}
                      </div>
                      <span className="font-semibold tabular-nums text-[var(--ink)]">
                        {formatMoney(item.total, order.currency)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Kargo Bilgisi */}
                {order.fulfillments.length > 0 && (
                  <div className="rounded-md bg-[var(--surface)] p-3 text-xs space-y-1">
                    {order.fulfillments.map((f) => (
                      <div
                        key={f.id}
                        className="flex flex-wrap items-center justify-between gap-2"
                      >
                        <span>
                          <strong>Kargo:</strong> {(f.carrier ?? "Kargo").toUpperCase()}{" "}
                          {f.trackingNumber ? `• Takip No: ${f.trackingNumber}` : ""}
                        </span>
                        {f.trackingUrl && (
                          <a
                            href={f.trackingUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="font-bold text-[var(--accent)] hover:underline"
                          >
                            Kargoyu Takip Et &rarr;
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Mevcut İade Talepleri (RMA) ve Kargo Kodları */}
                {order.returns && order.returns.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3.5 text-xs space-y-2">
                    <div className="flex items-center gap-2 font-bold text-amber-950">
                      <Package className="h-4 w-4 text-amber-700" />
                      <span>İade Talepleriniz (RMA)</span>
                    </div>
                    {order.returns.map((ret) => (
                      <div
                        key={ret.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-amber-200/70 pt-2"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant={
                              ret.status === "APPROVED"
                                ? "success"
                                : ret.status === "RECEIVED"
                                ? "accent"
                                : ret.status === "REFUNDED"
                                ? "success"
                                : "warning"
                            }
                          >
                            {ret.status === "REQUESTED"
                              ? "Onay Bekliyor"
                              : ret.status === "APPROVED"
                              ? "Onaylandı"
                              : ret.status === "RECEIVED"
                              ? "Depoya Ulaştı"
                              : ret.status === "REFUNDED"
                              ? "Ücret İade Edildi"
                              : ret.status}
                          </Badge>
                          {ret.returnCode && (
                            <span className="font-mono font-bold text-zinc-900 bg-white px-2 py-0.5 rounded border border-amber-300 shadow-2xs">
                              Kargo İade Kodu: {ret.returnCode} ({ret.carrierCode || "Yurtiçi Kargo"})
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-amber-900">
                          {ret.carrierCode || "Yurtiçi Kargo"} şubesine iade kodunuzu bildirerek ücretsiz teslim edebilirsiniz.
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* İade Talebi Oluşturma Butonu ve Akordeon Formu */}
                {order.paymentStatus === "PAID" && order.status !== "CANCELLED" && (
                  <div className="pt-2">
                    {activeReturnOrderId === order.id ? (
                      <form
                        action={async (formData) => {
                          await submitReturnStoreFormAction(formData);
                          setActiveReturnOrderId(null);
                          setReturnSuccessMessage("İade talebiniz ve kargo kodunuz başarıyla oluşturuldu.");
                          setTimeout(() => setReturnSuccessMessage(null), 5000);
                        }}
                        className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-xs space-y-4"
                      >
                        <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                          <h4 className="font-bold text-[var(--ink)]">
                            Sipariş #{order.number} İçin İade Talebi Oluştur
                          </h4>
                          <button
                            type="button"
                            onClick={() => setActiveReturnOrderId(null)}
                            className="text-xs text-[var(--muted)] hover:text-[var(--ink)]"
                          >
                            Vazgeç
                          </button>
                        </div>

                        <input type="hidden" name="orderId" value={order.id} />

                        <div className="space-y-2">
                          <Label className="font-semibold text-[var(--ink)]">
                            İade Edilecek Ürünler ve Adetleri:
                          </Label>
                          <div className="space-y-1.5">
                            {order.items.map((item) => (
                              <div
                                key={item.id}
                                className="flex items-center justify-between gap-3 rounded border border-[var(--border)] bg-[var(--card)] p-2.5"
                              >
                                <span className="font-medium text-[var(--ink)]">
                                  {item.title} {item.variantTitle ? `(${item.variantTitle})` : ""}
                                </span>
                                <div className="flex items-center gap-2">
                                  <label className="text-[11px] text-[var(--muted)]">Adet:</label>
                                  <select
                                    name={`return_qty_${item.id}`}
                                    defaultValue="1"
                                    className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs"
                                  >
                                    {Array.from({ length: item.quantity }, (_, i) => i + 1).map((q) => (
                                      <option key={q} value={q}>
                                        {q}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label htmlFor="reason">İade Nedeni</Label>
                            <select
                              id="reason"
                              name="reason"
                              className="w-full rounded border border-[var(--border)] bg-[var(--surface)] p-2 text-xs"
                            >
                              <option value="Beden Uymadı (Kalıp Dar)">Beden Uymadı (Kalıp Dar)</option>
                              <option value="Beden Uymadı (Kalıp Geniş)">Beden Uymadı (Kalıp Geniş)</option>
                              <option value="Model / Kumaş Beklentimi Karşılamadı">Model / Kumaş Beklentimi Karşılamadı</option>
                              <option value="Kusurlu / Hatalı Ürün">Kusurlu / Hatalı Ürün</option>
                              <option value="Fikrimi Değiştirdim">Fikrimi Değiştirdim</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <Label htmlFor="carrierCode">Tercih Edilen Kargo Firması</Label>
                            <select
                              id="carrierCode"
                              name="carrierCode"
                              className="w-full rounded border border-[var(--border)] bg-[var(--surface)] p-2 text-xs"
                            >
                              <option value="YURTICI">Yurtiçi Kargo (Ücretsiz İade)</option>
                              <option value="ARAS">Aras Kargo</option>
                              <option value="MNG">MNG Kargo</option>
                              <option value="SURAT">Sürat Kargo</option>
                            </select>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <Label htmlFor="customerNote">Açıklama / Notunuz (İsteğe Bağlı)</Label>
                          <Input
                            id="customerNote"
                            name="customerNote"
                            placeholder="Ürün hakkındaki iade notunuzu buraya yazabilirsiniz..."
                          />
                        </div>

                        {/* Mesafeli Sözleşmeler Yönetmeliği m. 15/ç Hijyen İstisnası Yasal Onay Kutusu */}
                        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-950">
                          <label className="flex items-start gap-2.5 cursor-pointer">
                            <input
                              type="checkbox"
                              name="hygieneAccepted"
                              required
                              className="mt-0.5 h-4 w-4 shrink-0 rounded border-amber-400 text-[var(--accent)] focus:ring-[var(--accent)]"
                            />
                            <span>
                              <strong>Yasal Bilgilendirme ve Hijyen Onayı:</strong> 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği m. 15/ç uyarınca; ambalajı, hijyen koruma bandı veya mührü açılmış alt iç giyim ve mayo ürünlerinde hijyen/sağlık gerekçesiyle cayma hakkının bulunmadığını, koruyucu hijyen bandı sökülmüş ürünlerin iadesinin kabul edilmeyeceğini okudum ve kabul ediyorum.
                            </span>
                          </label>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setActiveReturnOrderId(null)}
                          >
                            Vazgeç
                          </Button>
                          <Button type="submit" variant="primary" size="sm">
                            İade Kodu Oluştur &rarr;
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setActiveReturnOrderId(order.id)}
                        className="text-xs font-semibold text-[var(--muted)] hover:text-[var(--accent)] underline transition-colors"
                      >
                        + Bu Sipariş İçin İade Talebi Aç (RMA)
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB: KUPONLARIM & AYRICALIKLARIM */}
      {activeTab === "kuponlar" && (
        <div className="space-y-6">
          <div className="rounded-[var(--radius-base,0.75rem)] border border-[var(--border)] bg-[var(--surface)] p-5 space-y-2">
            <h3 className="text-sm font-bold text-[var(--ink)] flex items-center gap-2">
              <Crown className="h-4 w-4 text-[var(--accent)]" weight="fill" />
              Size Özel İndirim ve Sadakat Avantajları
            </h3>
            <p className="text-xs text-[var(--muted)]">
              Bu kodları sepetinizde veya ödeme adımında &quot;Kupon Kodu&quot; alanına girerek anında indirim kazanabilirsiniz.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activePromotions.map((promo) => (
              <div
                key={promo.id}
                className="flex flex-col justify-between rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-xs space-y-3"
              >
                <div>
                  <span className="inline-block rounded-[var(--radius-base,0.25rem)] bg-[var(--surface)] border border-[var(--border)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--ink)]">
                    {promo.type === "PERCENTAGE"
                      ? `%${promo.value / 100} İndirim`
                      : promo.type === "FIXED_AMOUNT"
                      ? `${formatMoney(promo.value)} İndirim`
                      : promo.type === "FREE_SHIPPING"
                      ? "Ücretsiz Kargo"
                      : "Özel Fırsat"}
                  </span>
                  <h4 className="mt-2 text-sm font-bold text-[var(--ink)]">
                    {promo.name}
                  </h4>
                  {promo.description && (
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {promo.description}
                    </p>
                  )}
                </div>

                <div className="space-y-2 border-t border-[var(--border)] pt-3">
                  {promo.endsAt && (
                    <p className="text-[10px] text-[var(--muted)] flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Son Geçerlilik: {new Date(promo.endsAt).toLocaleDateString("tr-TR")}
                    </p>
                  )}

                  {promo.code && (
                    <div className="flex items-center justify-between rounded-lg bg-[var(--surface)] p-2">
                      <span className="font-mono text-xs font-bold text-[var(--ink)]">
                        {promo.code}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyCoupon(promo.code!)}
                        className="inline-flex items-center gap-1 rounded bg-[var(--card)] border border-[var(--border)] px-2 py-1 text-xs font-bold text-[var(--ink)] hover:border-[var(--accent)] transition-colors"
                      >
                        {copiedCoupon === promo.code ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                            Kopyalandı
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            Kopyala
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB: ADRESLERİM */}
      {activeTab === "adresler" && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Kayıtlı Adresler */}
          <div className="lg:col-span-7 space-y-4">
            <h3 className="text-base font-bold text-[var(--ink)] flex items-center gap-2">
              <MapPin className="h-5 w-5 text-[var(--accent)]" />
              Kayıtlı Teslimat Adreslerim ({addresses.length})
            </h3>

            {addresses.length === 0 ? (
              <p className="text-xs text-[var(--muted)]">
                Henüz kayıtlı bir adresiniz bulunmuyor. Yan taraftaki formdan hemen ekleyebilirsiniz.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {addresses.map((addr) => (
                  <div
                    key={addr.id}
                    className="flex flex-col justify-between rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 text-xs space-y-3 shadow-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between font-bold text-[var(--ink)]">
                        <span>{addr.title ?? "Adres"}</span>
                        {addr.isDefaultShipping && (
                          <Badge variant="success">Varsayılan</Badge>
                        )}
                      </div>
                      <p className="font-medium text-[var(--ink)]">
                        {addr.firstName} {addr.lastName} • {addr.phone}
                      </p>
                      <p className="text-[var(--muted)]">{addr.line1}</p>
                      <p className="text-[var(--muted)]">
                        {addr.district} / {addr.city}
                      </p>
                    </div>

                    <form action={deleteAddressStoreFormAction}>
                      <input type="hidden" name="addressId" value={addr.id} />
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1 text-rose-600 hover:underline font-semibold"
                      >
                        <Trash2 className="h-3 w-3" />
                        Adresi Sil
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Yeni Adres Ekle Formu */}
          <div className="lg:col-span-5">
            <form
              action={saveAddressStoreFormAction}
              className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-3 shadow-xs"
            >
              <h4 className="text-sm font-bold text-[var(--ink)]">Yeni Adres Ekle</h4>
              <div className="space-y-1">
                <Label htmlFor="titleInput">Adres Başlığı</Label>
                <Input id="titleInput" name="title" required placeholder="Evim, İşyeri vb." />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="firstInput">Ad</Label>
                  <Input id="firstInput" name="firstName" required defaultValue={customer.firstName} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="lastInput">Soyad</Label>
                  <Input id="lastInput" name="lastName" required defaultValue={customer.lastName} />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="phoneInput">Telefon</Label>
                <Input
                  id="phoneInput"
                  name="phone"
                  required
                  defaultValue={customer.phone ?? ""}
                  placeholder="05XX XXX XX XX"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="citySelect">İl</Label>
                  <select
                    id="citySelect"
                    name="city"
                    defaultValue="İstanbul"
                    className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs text-[var(--ink)]"
                  >
                    {TR_CITIES.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="districtInput">İlçe</Label>
                  <Input id="districtInput" name="district" required defaultValue="Kadıköy" />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="line1Input">Açık Adres</Label>
                <Input
                  id="line1Input"
                  name="line1"
                  required
                  placeholder="Mahalle, sokak, bina, daire"
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-[var(--ink)]">
                <input type="checkbox" name="isDefaultShipping" defaultChecked />
                Varsayılan teslimat adresi olarak ayarla
              </label>
              <Button type="submit" size="sm" className="w-full">
                Adresi Kaydet
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* TAB: PROFİL & GÜVENLİK */}
      {activeTab === "ayarlar" && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Kişisel Bilgiler */}
          <div className="lg:col-span-7 space-y-4">
            <h3 className="text-base font-bold text-[var(--ink)] flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-[var(--accent)]" />
              Kişisel Bilgiler ve İletişim Tercihleri
            </h3>

            <form
              action={updateMyProfileStoreAction}
              className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-3 shadow-xs"
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="pFirst">Adınız</Label>
                  <Input id="pFirst" name="firstName" required defaultValue={customer.firstName} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="pLast">Soyadınız</Label>
                  <Input id="pLast" name="lastName" required defaultValue={customer.lastName} />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="pPhone">Telefon Numarası</Label>
                <Input id="pPhone" name="phone" defaultValue={customer.phone ?? ""} />
              </div>

              <label className="flex items-center gap-2 text-xs text-[var(--ink)]">
                <input
                  type="checkbox"
                  name="acceptsMarketing"
                  defaultChecked={customer.acceptsMarketing}
                />
                Kampanya, özel indirim ve yeni koleksiyon bildirimlerini almak istiyorum (İYS Onayı)
              </label>

              <Button type="submit" size="sm">
                Bilgilerimi Güncelle
              </Button>
            </form>
          </div>

          {/* Oturum & KVKK Silme */}
          <div className="lg:col-span-5 space-y-6">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-3 shadow-xs">
              <h4 className="text-sm font-bold text-[var(--ink)]">Oturum Yönetimi</h4>
              <p className="text-xs text-[var(--muted)]">
                Cihazınızdaki müşteri oturumunu sonlandırabilirsiniz.
              </p>
              <form action={logoutCustomerAction}>
                <Button type="submit" variant="outline" size="sm" className="gap-1.5 w-full">
                  <LogOut className="h-3.5 w-3.5" />
                  Oturumu Kapat
                </Button>
              </form>
            </div>

            {/* KVKK Hesap Silme */}
            <div className="rounded-xl border border-rose-300 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20 p-5 space-y-3 shadow-xs">
              <div className="flex items-center gap-2 text-sm font-bold text-rose-700 dark:text-rose-400">
                <ShieldAlert className="h-4 w-4" />
                <span>KVKK Hesap Silme ve Anonimleştirme</span>
              </div>
              <p className="text-xs text-[var(--muted)]">
                6698 sayılı KVKK kapsamında hesabınızı kalıcı olarak kapatabilirsiniz. Bu işlem geri alınamaz.
              </p>
              <form action={anonymizeMyAccountStoreFormAction} className="space-y-2">
                <Input
                  name="confirmText"
                  required
                  placeholder="Onaylamak için ONAYLIYORUM yazın"
                  className="h-8 text-xs"
                />
                <Button type="submit" variant="danger" size="sm" className="w-full">
                  Hesabımı Kalıcı Olarak Kapat
                </Button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
