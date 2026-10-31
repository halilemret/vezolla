"use client";

import * as React from "react";
import {
  Crown,
  Sparkle,
  ShoppingCart,
  CreditCard,
  User,
  Check,
  FloppyDisk,
  WarningCircle,
  Eye,
} from "@phosphor-icons/react";
import type { ClubSettings } from "@/lib/settings/schemas";
import { updateClubSettingsAction } from "@/lib/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ClubSettingsClientProps {
  initialSettings: ClubSettings;
}

type SettingsTab = "rules" | "pdp" | "cart" | "checkout" | "account";

export function ClubSettingsClient({ initialSettings }: ClubSettingsClientProps) {
  const [settings, setSettings] = React.useState<ClubSettings>(initialSettings);
  const [activeTab, setActiveTab] = React.useState<SettingsTab>("rules");
  const [saving, setSaving] = React.useState(false);
  const [savedSuccess, setSavedSuccess] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Anlık simülasyon hesaplamaları
  const sampleSpentTl = 1000;
  const samplePointsEarned = Math.floor(
    (sampleSpentTl * 100 * (settings.earningRatePercent / 100)) / 100
  );
  const sampleCashValueTl = (samplePointsEarned * settings.pointValueKurus) / 100;
  const sampleHundredPointsValueTl = (100 * settings.pointValueKurus) / 100;

  async function handleSave() {
    setSaving(true);
    setErrorMessage(null);
    setSavedSuccess(false);

    try {
      const res = await updateClubSettingsAction(settings);
      if (!res.success) {
        setErrorMessage(res.error ?? "Ayarlar kaydedilemedi.");
        return;
      }
      if (res.data) {
        setSettings(res.data);
      }
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Beklenmedik bir hata oluştu.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Üst Bilgi ve Kaydet Butonu */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-zinc-200 bg-white p-4 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
            <Crown className="h-6 w-6" weight="fill" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-zinc-900">
                VezollaClub Sadakat Programı
              </span>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  settings.enabled
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                    : "bg-zinc-100 text-zinc-600 border border-zinc-300"
                }`}
              >
                {settings.enabled ? "Aktif" : "Pasif"}
              </span>
            </div>
            <p className="text-xs text-zinc-500">
              Mevcut Puan Değeri: <strong className="text-zinc-800">1 Puan = {settings.pointValueKurus} Kuruş</strong> (100 Puan = {sampleHundredPointsValueTl.toFixed(2)} TL)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {savedSuccess && (
            <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
              <Check className="h-4 w-4" weight="bold" />
              Kaydedildi!
            </span>
          )}
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="gap-2 font-bold bg-zinc-900 text-white hover:bg-zinc-800"
          >
            <FloppyDisk className="h-4 w-4" weight="bold" />
            <span>{saving ? "Kaydediliyor..." : "Tüm Ayarları Kaydet"}</span>
          </Button>
        </div>
      </div>

      {errorMessage && (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-900">
          <WarningCircle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Sekmeler Tab Bar (Diğer ayarlar sayfalarıyla birebir uyumlu buton stili) */}
      <div className="flex flex-wrap gap-1.5 border-b border-zinc-200 pb-3">
        {[
          { id: "rules", label: "Puan & Oran Kuralları", icon: Crown },
          { id: "pdp", label: "Ürün Sayfası (PDP)", icon: Sparkle },
          { id: "cart", label: "Sepet & Drawer", icon: ShoppingCart },
          { id: "checkout", label: "Ödeme Adımı", icon: CreditCard },
          { id: "account", label: "Hesabım & Profil", icon: User },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as SettingsTab)}
              className={
                isActive
                  ? "flex items-center gap-2 rounded-md bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-white transition-all cursor-pointer"
                  : "flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3.5 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 transition-all cursor-pointer"
              }
            >
              <Icon className="h-4 w-4" weight={isActive ? "fill" : "regular"} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: Puan & Oran Kuralları */}
      {activeTab === "rules" && (
        <div className="space-y-6">
          <div className="rounded-md border border-zinc-200 bg-white p-6 space-y-5">
            <h2 className="text-sm font-bold text-zinc-900">
              Temel Puan ve Sadakat Motoru Parametreleri
            </h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Şalter */}
              <div className="rounded-md border border-zinc-200 bg-zinc-50/50 p-4 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.enabled}
                    onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
                    className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                  />
                  <span className="text-xs font-bold text-zinc-900">
                    VezollaClub Programı Aktif
                  </span>
                </label>
                <p className="text-[11px] text-zinc-500">
                  Pasife alınırsa sitedeki kulüp fiyatları, kazanım rozetleri ve puan harcama alanları gizlenir.
                </p>
              </div>

              {/* 1 Puan Değeri (Kuruş) */}
              <div className="rounded-md border border-zinc-200 bg-zinc-50/50 p-4 space-y-1.5">
                <Label htmlFor="pointValueKurus" className="text-xs font-bold text-zinc-900">
                  1 Puan Değeri (Kuruş)
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="pointValueKurus"
                    type="number"
                    min="1"
                    max="1000"
                    value={settings.pointValueKurus}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        pointValueKurus: Number.parseInt(e.target.value, 10) || 50,
                      })
                    }
                    className="h-8 text-xs tabular-nums bg-white border-zinc-300 text-zinc-900"
                  />
                  <span className="text-xs text-zinc-500 font-semibold shrink-0">
                    Kr ({settings.pointValueKurus / 100} TL)
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500">
                  50 kuruş ise 100 puan = 50 TL indirim sağlar.
                </p>
              </div>

              {/* Puan Kazanım Oranı (%) */}
              <div className="rounded-md border border-zinc-200 bg-zinc-50/50 p-4 space-y-1.5">
                <Label htmlFor="earningRatePercent" className="text-xs font-bold text-zinc-900">
                  Harcamadan Puan Kazanım Oranı (%)
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="earningRatePercent"
                    type="number"
                    min="0"
                    max="100"
                    value={settings.earningRatePercent}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        earningRatePercent: Number.parseFloat(e.target.value) || 10,
                      })
                    }
                    className="h-8 text-xs tabular-nums bg-white border-zinc-300 text-zinc-900"
                  />
                  <span className="text-xs text-zinc-500 font-semibold shrink-0">%</span>
                </div>
                <p className="text-[11px] text-zinc-500">
                  %10 ise 1.000 TL sipariş veren müşteri 100 puan kazanır.
                </p>
              </div>

              {/* Sepet Tavan İndirim Oranı (%) */}
              <div className="rounded-md border border-zinc-200 bg-zinc-50/50 p-4 space-y-1.5">
                <Label htmlFor="maxOrderDiscountPercent" className="text-xs font-bold text-zinc-900">
                  Siparişte Maksimum Puan İndirim Tavanı (%)
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="maxOrderDiscountPercent"
                    type="number"
                    min="1"
                    max="100"
                    value={settings.maxOrderDiscountPercent}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        maxOrderDiscountPercent: Number.parseFloat(e.target.value) || 20,
                      })
                    }
                    className="h-8 text-xs tabular-nums bg-white border-zinc-300 text-zinc-900"
                  />
                  <span className="text-xs text-zinc-500 font-semibold shrink-0">%</span>
                </div>
                <p className="text-[11px] text-zinc-500">
                  %20 ise sipariş tutarının en fazla %20&apos;si kadar puan düşülebilir.
                </p>
              </div>

              {/* Puan Olgunlaşma Süresi */}
              <div className="rounded-md border border-zinc-200 bg-zinc-50/50 p-4 space-y-1.5">
                <Label htmlFor="pointsMaturityDays" className="text-xs font-bold text-zinc-900">
                  Puan Aktarım Süresi (Teslimat Sonrası Gün)
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="pointsMaturityDays"
                    type="number"
                    min="0"
                    max="60"
                    value={settings.pointsMaturityDays}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        pointsMaturityDays: Number.parseInt(e.target.value, 10) || 0,
                      })
                    }
                    className="h-8 text-xs tabular-nums bg-white border-zinc-300 text-zinc-900"
                  />
                  <span className="text-xs text-zinc-500 font-semibold shrink-0">Gün</span>
                </div>
                <p className="text-[11px] text-zinc-500">
                  Kargo teslim edildi işaretlendikten kaç gün sonra bakiye kullanılabilir olur.
                </p>
              </div>

              {/* Fotoğraflı Yorum Puanı */}
              <div className="rounded-md border border-zinc-200 bg-zinc-50/50 p-4 space-y-1.5">
                <Label htmlFor="photoReviewPoints" className="text-xs font-bold text-zinc-900">
                  Fotoğraflı Yorum Ödül Puanı
                </Label>
                <Input
                  id="photoReviewPoints"
                  type="number"
                  min="0"
                  max="1000"
                  value={settings.photoReviewPoints}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      photoReviewPoints: Number.parseInt(e.target.value, 10) || 0,
                    })
                  }
                  className="h-8 text-xs tabular-nums bg-white border-zinc-300 text-zinc-900"
                />
                <p className="text-[11px] text-zinc-500">
                  Fotoğraflı onaylanan yorum başına müşteriye aktarılan puan.
                </p>
              </div>

              {/* Metinli Yorum Puanı */}
              <div className="rounded-md border border-zinc-200 bg-zinc-50/50 p-4 space-y-1.5">
                <Label htmlFor="textReviewPoints" className="text-xs font-bold text-zinc-900">
                  Standart Metin Yorum Ödül Puanı
                </Label>
                <Input
                  id="textReviewPoints"
                  type="number"
                  min="0"
                  max="1000"
                  value={settings.textReviewPoints}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      textReviewPoints: Number.parseInt(e.target.value, 10) || 0,
                    })
                  }
                  className="h-8 text-xs tabular-nums bg-white border-zinc-300 text-zinc-900"
                />
                <p className="text-[11px] text-zinc-500">
                  Fotoğrafsız onaylanan yorum başına müşteriye aktarılan puan.
                </p>
              </div>
            </div>

            {/* Canlı Simülasyon Kartı */}
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-900">
                <Eye className="h-4 w-4 text-amber-600" weight="fill" />
                <span>Canlı Kural ve Değer Simülasyonu:</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded bg-white border border-zinc-200">
                  <span className="text-[11px] text-zinc-500">Örnek Harcama:</span>
                  <div className="font-bold text-zinc-900 text-sm">1.000,00 TL</div>
                </div>
                <div className="p-3 rounded bg-white border border-zinc-200">
                  <span className="text-[11px] text-zinc-500">Kazanılan Puan:</span>
                  <div className="font-bold text-amber-600 text-sm">
                    {samplePointsEarned} VezollaClub Puanı
                  </div>
                </div>
                <div className="p-3 rounded bg-white border border-zinc-200">
                  <span className="text-[11px] text-zinc-500">Puanın İndirim Karşılığı:</span>
                  <div className="font-bold text-emerald-600 text-sm">
                    {sampleCashValueTl.toFixed(2)} TL İndirim
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Ürün Sayfası (PDP) */}
      {activeTab === "pdp" && (
        <div className="rounded-md border border-zinc-200 bg-white p-6 space-y-5">
          <h2 className="text-sm font-bold text-zinc-900">
            Ürün Detay Sayfası (PDP) VezollaClub Görünüm Ayarları
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-md border border-zinc-200 bg-zinc-50/50 p-4">
              <div>
                <span className="text-xs font-bold text-zinc-900">
                  Kulüp Üyelerine Özel Fiyat Bloğu
                </span>
                <p className="text-[11px] text-zinc-500">
                  Üründe özel kulüp fiyatı tanımlıysa fiyat kartının altında özel kutu gösterilir.
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.pdpShowMemberPrice}
                onChange={(e) =>
                  setSettings({ ...settings, pdpShowMemberPrice: e.target.checked })
                }
                className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="pdpMemberPriceTitle" className="text-xs font-bold text-zinc-900">
                  Kulüp Fiyat Başlığı
                </Label>
                <Input
                  id="pdpMemberPriceTitle"
                  value={settings.pdpMemberPriceTitle}
                  onChange={(e) =>
                    setSettings({ ...settings, pdpMemberPriceTitle: e.target.value })
                  }
                  className="h-8 text-xs bg-white border-zinc-300 text-zinc-900"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pdpMemberPriceCtaText" className="text-xs font-bold text-zinc-900">
                  Giriş Yapmamış Müşteriye Üyelik Buton Metni
                </Label>
                <Input
                  id="pdpMemberPriceCtaText"
                  value={settings.pdpMemberPriceCtaText}
                  onChange={(e) =>
                    setSettings({ ...settings, pdpMemberPriceCtaText: e.target.value })
                  }
                  className="h-8 text-xs bg-white border-zinc-300 text-zinc-900"
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border border-zinc-200 bg-zinc-50/50 p-4">
              <div>
                <span className="text-xs font-bold text-zinc-900">
                  Ürün Sayfasında Puan Kazanım Rozeti
                </span>
                <p className="text-[11px] text-zinc-500">
                  Seçili varyantın fiyatına göre kazanılacak tahmini sadakat puanını gösterir.
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.pdpShowEarningBadge}
                onChange={(e) =>
                  setSettings({ ...settings, pdpShowEarningBadge: e.target.checked })
                }
                className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pdpEarningBadgeTemplate" className="text-xs font-bold text-zinc-900">
                Puan Kazanım Rozeti Metin Şablonu
              </Label>
              <Input
                id="pdpEarningBadgeTemplate"
                value={settings.pdpEarningBadgeTemplate}
                onChange={(e) =>
                  setSettings({ ...settings, pdpEarningBadgeTemplate: e.target.value })
                }
                className="h-8 text-xs bg-white border-zinc-300 text-zinc-900"
              />
              <p className="text-[11px] text-zinc-500">
                Parametreler: <code className="font-mono text-zinc-800">{`{points}`}</code> = Puan miktarı,{" "}
                <code className="font-mono text-zinc-800">{`{value}`}</code> = TL karşılığı
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Sepet & Drawer */}
      {activeTab === "cart" && (
        <div className="rounded-md border border-zinc-200 bg-white p-6 space-y-5">
          <h2 className="text-sm font-bold text-zinc-900">
            Sepet Sayfası ve Yan Sepet Çekmecesi (Drawer) Ayarları
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-md border border-zinc-200 bg-zinc-50/50 p-4">
              <div>
                <span className="text-xs font-bold text-zinc-900">
                  Sepet Toplamları Altında Puan Kazanım Rozeti
                </span>
                <p className="text-[11px] text-zinc-500">
                  Sepetteki sipariş onaylandığında kazanılacak puanı gösterir.
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.cartShowEarningBadge}
                onChange={(e) =>
                  setSettings({ ...settings, cartShowEarningBadge: e.target.checked })
                }
                className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cartEarningBadgeTemplate" className="text-xs font-bold text-zinc-900">
                Sepet Puan Rozeti Şablon Metni
              </Label>
              <Input
                id="cartEarningBadgeTemplate"
                value={settings.cartEarningBadgeTemplate}
                onChange={(e) =>
                  setSettings({ ...settings, cartEarningBadgeTemplate: e.target.value })
                }
                className="h-8 text-xs bg-white border-zinc-300 text-zinc-900"
              />
              <p className="text-[11px] text-zinc-500">
                Parametreler: <code className="font-mono text-zinc-800">{`{points}`}</code>,{" "}
                <code className="font-mono text-zinc-800">{`{value}`}</code>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Ödeme Adımı (Checkout) */}
      {activeTab === "checkout" && (
        <div className="rounded-md border border-zinc-200 bg-white p-6 space-y-5">
          <h2 className="text-sm font-bold text-zinc-900">
            Ödeme Adımı (Checkout) Puan Kullanımı ve Özeti
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-md border border-zinc-200 bg-zinc-50/50 p-4">
              <div>
                <span className="text-xs font-bold text-zinc-900">
                  Ödeme Adımında Puan Harcama Alanı
                </span>
                <p className="text-[11px] text-zinc-500">
                  Giriş yapmış müşterinin sipariş özetinde sadakat puanlarını indirime dönüştürmesini sağlar.
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.checkoutShowRedemption}
                onChange={(e) =>
                  setSettings({ ...settings, checkoutShowRedemption: e.target.checked })
                }
                className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="checkoutRedemptionTitle" className="text-xs font-bold text-zinc-900">
                  Puan Harcama Kutusu Başlığı
                </Label>
                <Input
                  id="checkoutRedemptionTitle"
                  value={settings.checkoutRedemptionTitle}
                  onChange={(e) =>
                    setSettings({ ...settings, checkoutRedemptionTitle: e.target.value })
                  }
                  className="h-8 text-xs bg-white border-zinc-300 text-zinc-900"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="checkoutRedemptionNotice" className="text-xs font-bold text-zinc-900">
                  Puan Kullanım Bilgilendirme Notu
                </Label>
                <Input
                  id="checkoutRedemptionNotice"
                  value={settings.checkoutRedemptionNotice}
                  onChange={(e) =>
                    setSettings({ ...settings, checkoutRedemptionNotice: e.target.value })
                  }
                  className="h-8 text-xs bg-white border-zinc-300 text-zinc-900"
                />
                <p className="text-[11px] text-zinc-500">
                  Parametreler: <code className="font-mono text-zinc-800">{`{maxPoints}`}</code>,{" "}
                  <code className="font-mono text-zinc-800">{`{percent}`}</code>
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border border-zinc-200 bg-zinc-50/50 p-4">
              <div>
                <span className="text-xs font-bold text-zinc-900">
                  Sipariş Özeti Altında Puan Kazanım Rozeti
                </span>
                <p className="text-[11px] text-zinc-500">
                  Sipariş Onayla butonunun üzerinde bu siparişten kazanılacak puanı gösterir.
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.checkoutShowEarningBadge}
                onChange={(e) =>
                  setSettings({ ...settings, checkoutShowEarningBadge: e.target.checked })
                }
                className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="checkoutEarningBadgeTemplate" className="text-xs font-bold text-zinc-900">
                Ödeme Sayfası Rozet Metin Şablonu
              </Label>
              <Input
                id="checkoutEarningBadgeTemplate"
                value={settings.checkoutEarningBadgeTemplate}
                onChange={(e) =>
                  setSettings({ ...settings, checkoutEarningBadgeTemplate: e.target.value })
                }
                className="h-8 text-xs bg-white border-zinc-300 text-zinc-900"
              />
              <p className="text-[11px] text-zinc-500">
                Parametreler: <code className="font-mono text-zinc-800">{`{points}`}</code>,{" "}
                <code className="font-mono text-zinc-800">{`{value}`}</code>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: Hesabım & Profil */}
      {activeTab === "account" && (
        <div className="rounded-md border border-zinc-200 bg-white p-6 space-y-5">
          <h2 className="text-sm font-bold text-zinc-900">
            Müşteri Hesabı (/hesabim) ve Profil Ekranı Ayarları
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-md border border-zinc-200 bg-zinc-50/50 p-4">
              <div>
                <span className="text-xs font-bold text-zinc-900">
                  Hesabım Sayfasında Kulüp Kartı Gösterilsin
                </span>
                <p className="text-[11px] text-zinc-500">
                  Müşterinin kullanılabilir ve bekleyen puan durumunu gösteren büyük kart.
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.accountShowClubCard}
                onChange={(e) =>
                  setSettings({ ...settings, accountShowClubCard: e.target.checked })
                }
                className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="accountCardTitle" className="text-xs font-bold text-zinc-900">
                  Kart Başlığı
                </Label>
                <Input
                  id="accountCardTitle"
                  value={settings.accountCardTitle}
                  onChange={(e) =>
                    setSettings({ ...settings, accountCardTitle: e.target.value })
                  }
                  className="h-8 text-xs bg-white border-zinc-300 text-zinc-900"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="accountConversionBadge" className="text-xs font-bold text-zinc-900">
                  Dönüşüm Rozet Metni
                </Label>
                <Input
                  id="accountConversionBadge"
                  value={settings.accountConversionBadge}
                  onChange={(e) =>
                    setSettings({ ...settings, accountConversionBadge: e.target.value })
                  }
                  className="h-8 text-xs bg-white border-zinc-300 text-zinc-900"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="accountCardSubtitle" className="text-xs font-bold text-zinc-900">
                Kart Alt Açıklama Metni
              </Label>
              <Input
                id="accountCardSubtitle"
                value={settings.accountCardSubtitle}
                onChange={(e) =>
                  setSettings({ ...settings, accountCardSubtitle: e.target.value })
                }
                className="h-8 text-xs bg-white border-zinc-300 text-zinc-900"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="accountPendingNotice" className="text-xs font-bold text-zinc-900">
                Bekleyen Puanlar Bilgilendirme Metni
              </Label>
              <Input
                id="accountPendingNotice"
                value={settings.accountPendingNotice}
                onChange={(e) =>
                  setSettings({ ...settings, accountPendingNotice: e.target.value })
                }
                className="h-8 text-xs bg-white border-zinc-300 text-zinc-900"
              />
              <p className="text-[11px] text-zinc-500">
                Parametreler: <code className="font-mono text-zinc-800">{`{days}`}</code> = Bekleme gün sayısı
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
