"use client";

import * as React from "react";
import Link from "next/link";
import { X, ShoppingBag, CheckCircle } from "@phosphor-icons/react";
import type { RecentSaleItem } from "@/app/api/store/social-proof/recent-sales/helpers";

export interface LiveSalesToastProps {
  enabled?: boolean;
  intervalSeconds?: number;
}

export function LiveSalesToast({
  enabled = true,
  intervalSeconds = 22,
}: LiveSalesToastProps) {
  const [purchases, setPurchases] = React.useState<RecentSaleItem[]>([]);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [visible, setVisible] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);

  // Gerçek son siparişleri API'den çek (KVKK maskeli)
  React.useEffect(() => {
    if (!enabled || dismissed) return;

    let isMounted = true;

    async function loadRecentPurchases() {
      try {
        const res = await fetch("/api/store/social-proof/recent-sales", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { purchases?: RecentSaleItem[] };
        if (isMounted && data.purchases && Array.isArray(data.purchases)) {
          setPurchases(data.purchases);
        }
      } catch {
        // Ağ hatasında sessizce geç
      }
    }

    void loadRecentPurchases();

    return () => {
      isMounted = false;
    };
  }, [enabled, dismissed]);

  // Döngüsel bildirim gösterimi
  React.useEffect(() => {
    if (dismissed || !enabled || purchases.length === 0) return;

    let switchTimer: NodeJS.Timeout | null = null;

    // İlk gösterim 4 saniye sonra
    const initialTimer = setTimeout(() => {
      setCurrentIndex(0);
      setVisible(true);
    }, 4000);

    const intervalMs = Math.max(8, intervalSeconds) * 1000;
    const interval = setInterval(() => {
      setVisible(false);
      switchTimer = setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % purchases.length);
        setVisible(true);
      }, 800);
    }, intervalMs);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
      if (switchTimer) clearTimeout(switchTimer);
    };
  }, [dismissed, enabled, purchases, intervalSeconds]);

  // 5.5 saniye açık kaldıktan sonra gizle
  React.useEffect(() => {
    if (!visible) return;
    const hideTimer = setTimeout(() => {
      setVisible(false);
    }, 5500);
    return () => clearTimeout(hideTimer);
  }, [visible]);

  if (!enabled || purchases.length === 0 || dismissed) {
    return null;
  }

  const current = purchases[currentIndex];
  if (!current || !visible) return null;

  return (
    <aside
      aria-label="Canlı Satın Alma Bildirimi"
      className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-4 left-4 z-40 max-w-sm rounded-[var(--radius-base,0.375rem)] border border-[var(--border)] bg-[var(--card)] p-3 shadow-lg shadow-black/5 transition-all duration-300 ease-out animate-in fade-in slide-in-from-bottom-4"
    >
      <div className="flex items-center gap-3">
        {current.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={current.imageUrl}
            alt={current.productTitle}
            className="h-12 w-12 shrink-0 rounded-[var(--radius-base,0.375rem)] object-cover border border-[var(--border)]"
          />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-base,0.375rem)] bg-[var(--surface)] text-[var(--muted)] border border-[var(--border)]">
            <ShoppingBag className="h-5 w-5" />
          </div>
        )}

        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--muted)]">
            <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
            <span className="font-semibold text-[var(--ink)] truncate max-w-[150px]">
              {current.customerName}
            </span>
            <span className="text-[var(--muted)] shrink-0">· {current.timeAgo}</span>
          </div>

          {current.slug ? (
            <Link
              href={`/urun/${current.slug}`}
              className="block text-xs font-semibold text-[var(--ink)] hover:text-[var(--accent)] truncate transition-colors"
            >
              {current.productTitle}
            </Link>
          ) : (
            <p className="text-xs font-semibold text-[var(--ink)] truncate">
              {current.productTitle}
            </p>
          )}

          <div className="flex items-center gap-1 text-[10px] text-emerald-700 font-medium">
            <CheckCircle className="h-3 w-3 text-emerald-600" weight="fill" />
            <span>Gerçek Sipariş Doğrulandı</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-[var(--muted)] hover:text-[var(--ink)] p-1 transition-colors"
          aria-label="Bildirimi Kapat"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </aside>
  );
}
