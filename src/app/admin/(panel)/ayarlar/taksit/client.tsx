"use client";

import * as React from "react";
import { CreditCard, CheckCircle, Warning, FloppyDisk, Sparkle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { InstallmentSettings } from "@/lib/settings/schemas";
import { updateInstallmentSettingsAction } from "@/modules/settings/actions";

interface InstallmentSettingsClientProps {
  initialSettings: InstallmentSettings;
}

export function InstallmentSettingsClient({ initialSettings }: InstallmentSettingsClientProps) {
  const [settings, setSettings] = React.useState<InstallmentSettings>(initialSettings);
  const [saving, setSaving] = React.useState(false);
  const [status, setStatus] = React.useState<{ type: "success" | "error"; message: string } | null>(null);

  const handleRateChange = (cardId: string, count: number, rateValue: string) => {
    const numericRate = parseFloat(rateValue) || 0;
    setSettings((prev) => ({
      ...prev,
      cardFamilies: prev.cardFamilies.map((fam) => {
        if (fam.id !== cardId) return fam;
        return {
          ...fam,
          rates: {
            ...fam.rates,
            [count]: numericRate,
          },
        };
      }),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatus(null);

    try {
      const res = await updateInstallmentSettingsAction(settings);
      if (res.success && res.data) {
        setSettings(res.data);
        setStatus({ type: "success", message: "Taksit oranları ve metinleri başarıyla kaydedildi!" });
      } else {
        setStatus({ type: "error", message: res.error ?? "Kaydetme başarısız oldu." });
      }
    } catch (err) {
      setStatus({ type: "error", message: err instanceof Error ? err.message : "Beklenmeyen hata oluştu." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {status && (
        <div
          className={`flex items-center gap-2 rounded-md p-4 text-xs font-medium border ${
            status.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          {status.type === "success" ? (
            <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" weight="bold" />
          ) : (
            <Warning className="h-4 w-4 shrink-0 text-rose-600" weight="bold" />
          )}
          <span>{status.message}</span>
        </div>
      )}

      {/* Genel Taksit Durumu & Başlık Ayarları */}
      <div className="rounded-md border border-zinc-200 bg-white p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-zinc-900" />
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">
                Taksit Genel Görünüm ve Başlık Yönetimi
              </h2>
              <p className="text-xs text-zinc-500">
                Anasayfada, ürün detayında (PDP) ve ödeme ekranında müşterilere gösterilecek metinler
              </p>
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => setSettings((s) => ({ ...s, enabled: e.target.checked }))}
              className="h-4 w-4 rounded border-zinc-300 text-zinc-900"
            />
            <span className="text-xs font-semibold text-zinc-900">
              Taksit Sistemi Aktif
            </span>
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="bannerTitle">Taksit Banner Başlığı</Label>
            <Input
              id="bannerTitle"
              value={settings.bannerTitle}
              onChange={(e) => setSettings((s) => ({ ...s, bannerTitle: e.target.value }))}
              placeholder="Örn: Peşin Fiyatına 3 Taksit Fırsatı"
              className="mt-1 bg-white border-zinc-300 text-zinc-900"
            />
          </div>
          <div>
            <Label htmlFor="bannerSubtitle">Taksit Alt Açıklaması</Label>
            <Input
              id="bannerSubtitle"
              value={settings.bannerSubtitle}
              onChange={(e) => setSettings((s) => ({ ...s, bannerSubtitle: e.target.value }))}
              placeholder="Örn: Bonus, World, Axess, Maximum ve Paraf Kartlara Özel"
              className="mt-1 bg-white border-zinc-300 text-zinc-900"
            />
          </div>
        </div>
      </div>

      {/* 6 Kart Ailesi Taksit Oranları Matrisi */}
      <div className="rounded-md border border-zinc-200 bg-white p-6 space-y-6">
        <div className="border-b border-zinc-200 pb-3">
          <h2 className="text-sm font-semibold text-zinc-900">
            Kredi Kartı Aileleri ve Komisyon / Vade Farkı Oranları (%)
          </h2>
          <p className="text-xs text-zinc-500">
            Oranı 0 girilen taksitler vitrinde <strong>&quot;Peşin Fiyatına (%0)&quot;</strong> yeşil rozetiyle listelenir.
          </p>
        </div>

        <div className="space-y-6">
          {settings.cardFamilies.map((fam) => (
            <div
              key={fam.id}
              className="rounded-md border border-zinc-200 p-4 bg-zinc-50/50 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 pb-2.5">
                <div className="flex items-center gap-2.5">
                  <span
                    className="inline-block h-3.5 w-3.5 rounded-full"
                    style={{ backgroundColor: fam.accentColor }}
                  />
                  <strong className="text-sm text-zinc-900">{fam.name}</strong>
                  <span className="text-xs text-zinc-500">({fam.bankNames})</span>
                </div>
                <Badge variant="neutral" className="text-[11px] font-mono">
                  {fam.id}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {[1, 2, 3, 6, 9].map((count) => {
                  const currentRate = fam.rates[count] ?? 0;
                  return (
                    <div key={count} className="rounded-md bg-white p-2.5 border border-zinc-200">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-zinc-900">
                          {count === 1 ? "Tek Çekim" : `${count} Taksit`}
                        </span>
                        {currentRate <= 0 ? (
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                            Peşin
                          </span>
                        ) : (
                          <span className="text-[10px] text-zinc-500">
                            +%{currentRate}
                          </span>
                        )}
                      </div>
                      <div className="relative mt-1">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={currentRate}
                          onChange={(e) => handleRateChange(fam.id, count, e.target.value)}
                          className="h-8 text-xs font-mono text-right pr-6 bg-white border-zinc-300 text-zinc-900"
                        />
                        <span className="absolute right-2 top-2 text-xs text-zinc-400">%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={saving} className="gap-2 min-w-[140px]">
          <FloppyDisk className="h-4 w-4" />
          {saving ? "Kaydediliyor..." : "Taksit Ayarlarını Kaydet"}
        </Button>
      </div>
    </form>
  );
}
