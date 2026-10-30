"use client";

import * as React from "react";
import Link from "next/link";
import { X, MagnifyingGlass, Sparkle, ArrowRight } from "@phosphor-icons/react";
import { InstantSearch } from "@/components/store/instant-search";

interface MobileSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const POPULAR_SEARCHES = [
  "Kadın Giyim",
  "Dış Giyim",
  "Trençkot",
  "Kaban",
  "Elbise",
  "Mont",
  "Triko",
];

export function MobileSearchModal({ isOpen, onClose }: MobileSearchModalProps) {
  // ESC tuşuyla kapat
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Arka plan kaydırmasını engelle
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] md:hidden">
      {/* Yarı Saydam Koyu Arka Plan */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Paneli */}
      <div className="fixed inset-x-0 top-0 flex max-h-[90vh] flex-col rounded-b-2xl border-b border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] shadow-2xl animate-in slide-in-from-top duration-200">
        {/* Üst Bar */}
        <div className="flex h-14 items-center justify-between border-b border-[var(--border)] px-4 bg-[var(--card)]">
          <div className="flex items-center gap-2">
            <MagnifyingGlass className="h-4 w-4 text-[var(--accent)]" />
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
              Anlık Ürün Arama
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Aramayı Kapat"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border)] text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface)] transition-all"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Arama Alanı */}
        <div className="p-4 space-y-4">
          <InstantSearch
            placeholder="Bir kelime yazmaya başlayın..."
            autoFocus
            variant="modal"
            onNavigate={onClose}
          />

          {/* Hızlı Arama Önerileri */}
          <div className="space-y-2 pt-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] flex items-center gap-1.5">
              <Sparkle className="h-3 w-3 text-[var(--accent)]" />
              Popüler Aramalar
            </span>
            <div className="flex flex-wrap gap-1.5">
              {POPULAR_SEARCHES.map((item) => (
                <Link
                  key={item}
                  href={`/katalog?q=${encodeURIComponent(item)}`}
                  onClick={onClose}
                  className="rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 text-xs font-medium text-[var(--ink)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors shadow-2xs"
                >
                  {item}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
