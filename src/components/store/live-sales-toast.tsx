"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle, X, ShoppingBag } from "@phosphor-icons/react";

interface RecentPurchase {
  id: string;
  customerName: string;
  city: string;
  productTitle: string;
  slug: string;
  timeAgo: string;
  imageUrl?: string;
}

const SAMPLE_ACTIVITY: RecentPurchase[] = [
  {
    id: "1",
    customerName: "Deniz K.",
    city: "İstanbul",
    productTitle: "Dimmerli Mimari LED Masa Lambası",
    slug: "dimmerli-mimari-led-masa-lambasi",
    timeAgo: "2 dakika önce",
    imageUrl: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=200&q=80",
  },
  {
    id: "2",
    customerName: "Burak A.",
    city: "İzmir",
    productTitle: "El Yapımı Seramik Demleme ve Fincan Seti",
    slug: "el-yapimi-seramik-demleme-ve-fincan-seti",
    timeAgo: "5 dakika önce",
    imageUrl: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=200&q=80",
  },
  {
    id: "3",
    customerName: "Selin Y.",
    city: "Ankara",
    productTitle: "Su Geçirmez Kanvas Günlük Sırt Çantası",
    slug: "su-gecirmez-kanvas-gunluk-sirt-cantasi",
    timeAgo: "8 dakika önce",
    imageUrl: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=200&q=80",
  },
  {
    id: "4",
    customerName: "Caner T.",
    city: "Bursa",
    productTitle: "Masif Meşe Masaüstü Düzenleyici Set",
    slug: "masif-mese-masaustu-duzenleyici-set",
    timeAgo: "12 dakika önce",
    imageUrl: "https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=200&q=80",
  },
];

export interface LiveSalesToastProps {
  enabled?: boolean;
  intervalSeconds?: number;
}

export function LiveSalesToast({
  enabled = true,
  intervalSeconds = 22,
}: LiveSalesToastProps) {
  const [current, setCurrent] = React.useState<RecentPurchase | null>(null);
  const [visible, setVisible] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);

  React.useEffect(() => {
    if (dismissed || !enabled) return;

    // İlk gösterim 4 saniye sonra
    const initialTimer = setTimeout(() => {
      const item = SAMPLE_ACTIVITY[0];
      if (item) {
        setCurrent(item);
        setVisible(true);
      }
    }, 4000);

    // Ayarlanan aralıkta bir rastgele göster
    const intervalMs = Math.max(5, intervalSeconds) * 1000;
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        const next = SAMPLE_ACTIVITY[Math.floor(Math.random() * SAMPLE_ACTIVITY.length)];
        if (next) {
          setCurrent(next);
          setVisible(true);
        }
      }, 1000);
    }, intervalMs);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [dismissed, enabled, intervalSeconds]);

  if (!enabled) return null;

  // 6 saniye açık kaldıktan sonra gizle
  React.useEffect(() => {
    if (!visible) return;
    const hideTimer = setTimeout(() => {
      setVisible(false);
    }, 6000);
    return () => clearTimeout(hideTimer);
  }, [visible]);

  if (!current || !visible || dismissed) return null;

  return (
    <aside
      aria-label="Canlı Satın Alma Bildirimi"
      className="fixed bottom-4 left-4 z-40 max-w-sm rounded-xl border border-zinc-200/90 bg-white p-3 shadow-xl shadow-zinc-950/10 transition-all duration-500 ease-out animate-in fade-in slide-in-from-bottom-4"
    >
      <div className="flex items-center gap-3">
        {current.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={current.imageUrl}
            alt={current.productTitle}
            className="h-12 w-12 shrink-0 rounded-lg object-cover border border-zinc-100"
          />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700">
            <ShoppingBag className="h-5 w-5" />
          </div>
        )}

        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-500">
            <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
            <span className="font-semibold text-zinc-900">{current.customerName}</span>
            <span>({current.city})</span>
            <span className="text-zinc-600">· {current.timeAgo}</span>
          </div>

          <Link
            href={`/urun/${current.slug}`}
            className="block text-xs font-semibold text-zinc-900 hover:text-[#9a3412] truncate transition-colors"
          >
            {current.productTitle}
          </Link>
          <p className="text-[10px] text-emerald-700 font-medium">Sipariş Onaylandı</p>
        </div>

        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-zinc-600 hover:text-zinc-900 p-1"
          aria-label="Kapat"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </aside>
  );
}
