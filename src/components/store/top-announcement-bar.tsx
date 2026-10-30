"use client";

import * as React from "react";
import Link from "next/link";
import { Flame, LockKey, Truck, Sliders } from "@phosphor-icons/react";

export interface TopAnnouncementBarProps {
  announcementText?: string;
  discreetShippingNotice?: boolean;
}

export function TopAnnouncementBar({
  announcementText,
  discreetShippingNotice,
}: TopAnnouncementBarProps) {
  const text = announcementText || "1.500 TL üzeri tüm siparişlerde ÜCRETSİZ HIZLI KARGO";
  const containerRef = React.useRef<HTMLDivElement>(null);
  const textMeasureRef = React.useRef<HTMLSpanElement>(null);
  const [isOverflowing, setIsOverflowing] = React.useState(false);

  React.useEffect(() => {
    const checkOverflow = () => {
      if (containerRef.current && textMeasureRef.current) {
        const containerWidth = containerRef.current.clientWidth;
        const textWidth = textMeasureRef.current.scrollWidth;
        // Metin kapsayıcıdan en az 4px daha uzunsa kayan yazı moduna geç
        setIsOverflowing(textWidth > containerWidth + 4);
      }
    };

    checkOverflow();

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && containerRef.current) {
      observer = new ResizeObserver(() => {
        checkOverflow();
      });
      observer.observe(containerRef.current);
    }

    window.addEventListener("resize", checkOverflow);
    return () => {
      window.removeEventListener("resize", checkOverflow);
      if (observer) {
        observer.disconnect();
      }
    };
  }, [text]);

  // Metin uzunluğuna göre okuma hızını optimize et (karakter başına ~0.22sn, minimum 12sn)
  const duration = Math.max(12, Math.round(text.length * 0.22));

  return (
    <div className="border-b border-zinc-900 bg-zinc-950 px-3 sm:px-4 py-1.5 sm:py-2 text-white select-none">
      <div className="mx-auto flex max-w-7xl items-center justify-between text-xs">
        {/* Sol: Dinamik Kargo & Fırsat Bildirimi */}
        <div className="flex-1 min-w-0 flex items-center gap-2 overflow-hidden text-[11px] sm:text-xs">
          <span className="flex items-center gap-1 font-semibold text-amber-400 shrink-0">
            <Flame className="h-3.5 w-3.5 animate-pulse text-amber-400" />
            <span className="hidden sm:inline">GÜNÜN FIRSATI:</span>
          </span>

          {/* Duyuru Metni Alanı (Taşarsa Kayan Metin, Sığarsa Sabit) */}
          <div
            ref={containerRef}
            className="flex-1 min-w-0 overflow-hidden relative [mask-image:linear-gradient(to_right,transparent,black_8px,black_calc(100%-8px),transparent)]"
          >
            {/* Genişlik ölçümü için gizli element (orijinal metnin tek satırdaki gerçek genişliği) */}
            <span
              ref={textMeasureRef}
              aria-hidden="true"
              className="absolute left-0 top-0 invisible whitespace-nowrap pointer-events-none opacity-0 select-none"
            >
              {text}
            </span>

            {isOverflowing ? (
              <div
                className="animate-marquee flex items-center cursor-pointer"
                style={{ animationDuration: `${duration}s` }}
                title={`${text} (Duraklatmak için basılı tutun)`}
              >
                <span className="inline-block px-3 text-zinc-300 font-medium">
                  {text}
                </span>
                <span className="text-amber-400 font-bold px-2 text-[10px]">•</span>
                <span className="inline-block px-3 text-zinc-300 font-medium">
                  {text}
                </span>
                <span className="text-amber-400 font-bold px-2 text-[10px]">•</span>
              </div>
            ) : (
              <span className="truncate text-zinc-300 block font-medium">
                {text}
              </span>
            )}
          </div>

          {/* Gizli Paketleme veya Aynı Gün Kargo Rozeti */}
          {discreetShippingNotice ? (
            <span className="hidden sm:inline-flex items-center gap-1 text-rose-300 font-semibold pl-2 border-l border-zinc-800 shrink-0">
              <LockKey className="h-3 w-3" />
              <span>%100 Gizli Paketleme</span>
            </span>
          ) : (
            <span className="hidden md:inline-flex items-center gap-1 text-emerald-400 font-medium pl-2 border-l border-zinc-800 shrink-0">
              <Truck className="h-3 w-3" />
              <span>16:00'ya kadar aynı gün kargo</span>
            </span>
          )}
        </div>

        {/* Sağ: Yardımcı Bağlantılar */}
        <div className="hidden sm:flex items-center gap-4 text-[11px] text-zinc-400 shrink-0 pl-3">
          <Link
            href="/siparis-takip"
            className="hover:text-white transition-colors flex items-center gap-1"
          >
            <span>Sipariş Takibi</span>
          </Link>
          <span className="text-zinc-700">|</span>
          <Link
            href="/sayfa/iletisim"
            className="hover:text-white transition-colors"
          >
            Müşteri Desteği
          </Link>
          <span className="text-zinc-700">|</span>
          <Link
            href="/admin"
            className="flex items-center gap-1 text-zinc-300 hover:text-white transition-colors"
          >
            <Sliders className="h-3 w-3" />
            <span>Yönetim</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
