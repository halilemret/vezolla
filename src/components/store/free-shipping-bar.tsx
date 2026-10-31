"use client";

import * as React from "react";
import { Truck, Check } from "@phosphor-icons/react";
import { formatMoney } from "@/lib/money";

export interface FreeShippingBarProps {
  subtotalMinor: number;
  thresholdMinor?: number;
  freeShippingByPromo?: boolean;
  currency?: string;
  className?: string;
}

export function FreeShippingBar({
  subtotalMinor,
  thresholdMinor = 150000, // 1.500 TL (150.000 kuruş)
  freeShippingByPromo = false,
  currency = "TRY",
  className = "",
}: FreeShippingBarProps) {
  const currentNet = Math.max(0, subtotalMinor);
  const isFree = freeShippingByPromo || currentNet >= thresholdMinor;
  const remainingMinor = isFree ? 0 : Math.max(0, thresholdMinor - currentNet);

  const progressPercent = isFree
    ? 100
    : currentNet <= 0
      ? 0
      : Math.min(100, Math.max(4, Math.round((currentNet / thresholdMinor) * 100)));

  return (
    <div
      className={`rounded-[var(--radius-base,0.375rem)] border border-[var(--border)] bg-[var(--card)] p-3 shadow-2xs transition-all ${className}`}
    >
      <div className="flex items-center gap-2 mb-2 text-xs">
        <div
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--radius-base,0.25rem)] ${
            isFree
              ? "bg-emerald-600 text-white"
              : "bg-[var(--surface)] border border-[var(--border)] text-[var(--accent)]"
          }`}
        >
          {isFree ? (
            <Check className="h-3.5 w-3.5" weight="bold" />
          ) : (
            <Truck className="h-3.5 w-3.5" weight="bold" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          {isFree ? (
            <span className="font-bold text-emerald-700 dark:text-emerald-400">
              Tebrikler! Ücretsiz Hızlı Kargo Kazandınız 🚚
            </span>
          ) : (
            <span className="font-medium text-[var(--ink)]">
              Ücretsiz kargoya sadece{" "}
              <strong className="text-[var(--accent)] font-bold font-mono">
                {formatMoney(remainingMinor, currency)}
              </strong>{" "}
              kaldı!
            </span>
          )}
        </div>
      </div>

      {/* İlerleme Çubuğu */}
      <div className="relative h-2 w-full overflow-hidden rounded-[var(--radius-base,0.25rem)] bg-[var(--surface)] border border-[var(--border)]">
        <div
          className={`h-full transition-all duration-500 ease-out rounded-[var(--radius-base,0.25rem)] ${
            isFree ? "bg-emerald-600" : "bg-[var(--accent)]"
          }`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
}
