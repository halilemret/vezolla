"use client";

import * as React from "react";
import Link from "next/link";
import { Flame, Clock, Tag } from "@phosphor-icons/react";

export interface FlashDealsBannerProps {
  enabled?: boolean;
  badgeText?: string;
  title?: string;
  promoCode?: string;
  durationHours?: number;
  targetHref?: string;
}

export function FlashDealsBanner({
  enabled = true,
  badgeText = "GÜNÜN FLAŞ İNDİRİMİ",
  title = "Seçili Tasarım Ürünlerinde Sepette Ekstra %15 İndirim",
  promoCode = "FLAS15",
  durationHours = 12,
  targetHref = "/katalog?filter=discount",
}: FlashDealsBannerProps) {
  const [timeLeft, setTimeLeft] = React.useState({
    hours: Math.min(Math.max(1, durationHours), 23),
    minutes: 38,
    seconds: 45,
  });

  React.useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev.seconds > 0) {
          return { ...prev, seconds: prev.seconds - 1 };
        }
        if (prev.minutes > 0) {
          return { ...prev, minutes: prev.minutes - 1, seconds: 59 };
        }
        if (prev.hours > 0) {
          return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        }
        return { hours: durationHours, minutes: 0, seconds: 0 };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [durationHours]);

  if (!enabled) return null;

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6 text-[var(--ink)] shadow-xs">
      <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
        {/* Sol Alan: Başlık ve Fırsat Detayı */}
        <div className="space-y-1.5 max-w-xl">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 dark:text-amber-300">
              <Flame className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" weight="fill" />
              <span>{badgeText}</span>
            </span>
            <span className="text-xs text-muted-foreground font-medium hidden sm:inline">
              Sınırlı Stok & Süre
            </span>
          </div>

          <h3 className="text-lg sm:text-xl font-bold tracking-tight text-[var(--ink)]">
            {title}
          </h3>

          <p className="text-xs text-muted-foreground leading-relaxed">
            Kupon kodu: <code className="rounded bg-[var(--surface)] px-1.5 py-0.5 font-mono font-bold text-[var(--accent)] border border-[var(--border)]">{promoCode}</code> ile alışverişinizi avantajlı tamamlayın.
          </p>
        </div>

        {/* Sağ Alan: Geri Sayım Sayacı ve Aksiyon Butonu */}
        <div className="flex flex-wrap items-center gap-4 shrink-0">
          {/* Canlı Geri Sayım */}
          <div className="flex items-center gap-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3.5 py-2">
            <Clock className="h-4 w-4 text-[var(--accent)] shrink-0" />
            <div className="flex items-center gap-1 font-mono text-sm font-bold tabular-nums text-[var(--ink)]">
              <span className="rounded bg-[var(--card)] border border-[var(--border)] px-1.5 py-0.5">{pad(timeLeft.hours)}</span>
              <span className="text-[var(--accent)]">:</span>
              <span className="rounded bg-[var(--card)] border border-[var(--border)] px-1.5 py-0.5">{pad(timeLeft.minutes)}</span>
              <span className="text-[var(--accent)]">:</span>
              <span className="rounded bg-[var(--card)] border border-[var(--border)] px-1.5 py-0.5 text-[var(--accent)] font-bold">{pad(timeLeft.seconds)}</span>
            </div>
          </div>

          {/* İncele Butonu */}
          <Link
            href={targetHref}
            className="inline-flex items-center rounded-lg bg-[var(--accent)] px-4 py-2.5 text-xs font-semibold text-white hover:opacity-90 transition-all shadow-xs active:scale-95"
          >
            <span>Kampanyalı Ürünleri İncele</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
