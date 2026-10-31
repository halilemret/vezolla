"use client";

import * as React from "react";
import { CreditCard, X, CheckCircle, ShieldCheck } from "@phosphor-icons/react";
import { formatMoney } from "@/lib/money";
import {
  calculateInstallmentPlans,
  type CardFamilyInstallment,
  type InstallmentFamilyConfig,
} from "@/modules/payments/installments";

export interface InstallmentModalProps {
  priceMinor: number;
  currency?: string;
  triggerClassName?: string;
  customFamilies?: InstallmentFamilyConfig[];
  bannerTitle?: string;
  bannerSubtitle?: string;
}

export function InstallmentModal({
  priceMinor,
  currency = "TRY",
  triggerClassName,
  customFamilies,
  bannerTitle,
  bannerSubtitle,
}: InstallmentModalProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [activeFamilyId, setActiveFamilyId] = React.useState("bonus");

  const plans = React.useMemo(() => {
    return calculateInstallmentPlans(priceMinor, customFamilies);
  }, [priceMinor, customFamilies]);

  const activePlan: CardFamilyInstallment =
    plans.find((p) => p.id === activeFamilyId) ?? plans[0]!;

  // Escape tuşu dinleyicisi
  React.useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Arka plan kaydırmasını kilitle
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

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={
          triggerClassName ??
          "inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--accent)] hover:underline cursor-pointer"
        }
      >
        <CreditCard className="h-4 w-4 shrink-0" weight="bold" />
        <span>Taksit Seçenekleri</span>
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="installment-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
        >
          {/* Karartma Arka Planı */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Modal Gövdesi */}
          <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-[var(--radius-base,0.375rem)] border border-[var(--border)] bg-[var(--card)] shadow-2xl flex flex-col max-h-[90vh]">
            {/* Modal Başlığı */}
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3 bg-[var(--surface)]">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-[var(--accent)]" weight="bold" />
                <div>
                  <h2
                    id="installment-modal-title"
                    className="text-sm font-bold text-[var(--ink)]"
                  >
                    Taksit Seçenekleri
                  </h2>
                  <p className="text-[11px] text-[var(--muted)]">
                    Ürün Tutarı:{" "}
                    <strong className="text-[var(--ink)] font-semibold">
                      {formatMoney(priceMinor, currency)}
                    </strong>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-[var(--radius-base,0.25rem)] p-1.5 text-[var(--muted)] hover:bg-[var(--card)] hover:text-[var(--ink)] transition-colors"
                aria-label="Kapat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Taksit Kampanya Bandı */}
            {(bannerTitle || bannerSubtitle) && (
              <div className="border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 flex items-start gap-2.5">
                <CreditCard className="h-4 w-4 text-[var(--accent)] shrink-0 mt-0.5" weight="bold" />
                <div className="text-xs">
                  {bannerTitle && (
                    <div className="font-bold text-[var(--ink)] leading-snug">{bannerTitle}</div>
                  )}
                  {bannerSubtitle && (
                    <div className="text-[11px] text-[var(--muted)] leading-snug">{bannerSubtitle}</div>
                  )}
                </div>
              </div>
            )}

            {/* Kart Ailesi Sekmeleri */}
            <div className="border-b border-[var(--border)] bg-[var(--surface)]/50 px-2 sm:px-4 py-2 overflow-x-auto scrollbar-none flex gap-1.5 shrink-0">
              {plans.map((p) => {
                const isActive = p.id === activeFamilyId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setActiveFamilyId(p.id)}
                    className={`shrink-0 rounded-[var(--radius-base,0.375rem)] px-3 py-1.5 text-xs font-semibold transition-all ${
                      isActive
                        ? "bg-[var(--card)] text-[var(--ink)] border border-[var(--border)] shadow-xs"
                        : "text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface)]"
                    }`}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>

            {/* Kart Ailesi Bilgi Notu */}
            <div className="px-4 py-2 bg-[var(--surface)]/30 border-b border-[var(--border)] text-[11px] text-[var(--muted)]">
              Geçerli Bankalar:{" "}
              <span className="font-medium text-[var(--ink)]">
                {activePlan.bankNames}
              </span>
            </div>

            {/* Taksit Tablosu */}
            <div className="overflow-y-auto p-4 flex-1">
              <div className="overflow-hidden rounded-[var(--radius-base,0.375rem)] border border-[var(--border)]">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[var(--border)] bg-[var(--surface)] text-[11px] font-semibold text-[var(--muted)]">
                    <tr>
                      <th className="py-2.5 px-3">Taksit Sayısı</th>
                      <th className="py-2.5 px-3 text-right">Aylık Tutar</th>
                      <th className="py-2.5 px-3 text-right">Toplam Tutar</th>
                      <th className="py-2.5 px-3 text-right">Vade Farkı</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)] bg-[var(--card)]">
                    {activePlan.installments.map((row) => (
                      <tr
                        key={row.count}
                        className={
                          row.isFreeInterest
                            ? "bg-emerald-50/40 dark:bg-emerald-950/20"
                            : "hover:bg-[var(--surface)]/50"
                        }
                      >
                        <td className="py-2.5 px-3 font-semibold text-[var(--ink)]">
                          {row.count === 1 ? (
                            "Tek Çekim"
                          ) : (
                            <span className="font-mono">{row.count} Taksit</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-[var(--ink)] tabular-nums">
                          {formatMoney(row.monthlyMinor, currency)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-[var(--ink)] tabular-nums">
                          {formatMoney(row.totalMinor, currency)}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {row.isFreeInterest ? (
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.5 text-[10px] font-bold">
                              <CheckCircle className="h-3 w-3" weight="fill" />
                              Peşin Fiyatına
                            </span>
                          ) : (
                            <span className="font-mono text-[11px] font-semibold text-[var(--muted)]">
                              {row.label}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Bilgilendirme Notları */}
              <div className="mt-3.5 space-y-1 text-[11px] text-[var(--muted)]">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" weight="fill" />
                  <span>
                    Taksitli alışverişlerde iyzico güvenli altyapısı ve 3D Secure doğrulaması kullanılır.
                  </span>
                </div>
                <p>
                  * Vade farkı oranları bankalar ve iyzico anlaşmasına göre değişkenlik gösterebilir.
                </p>
              </div>
            </div>

            {/* Alt Buton */}
            <div className="border-t border-[var(--border)] p-3 bg-[var(--surface)] flex justify-end">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-[var(--radius-base,0.375rem)] border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--surface)] transition-colors cursor-pointer"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
