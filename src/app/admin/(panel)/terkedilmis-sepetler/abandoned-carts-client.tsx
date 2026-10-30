"use client";

import * as React from "react";
import Link from "next/link";
import {
  ShoppingCart,
  Funnel,
  ArrowRight,
  EnvelopeSimple,
  Clock,
  ArrowClockwise,
  CheckCircle,
  WarningCircle,
  User,
  MagnifyingGlass,
  Tag,
  Gear,
  X,
  PaperPlaneTilt,
  CaretDown,
  CaretUp,
  MapPin,
  DeviceMobile,
  Check,
} from "@phosphor-icons/react";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  sendCartRecoveryEmailAction,
  saveAbandonedCartSettingsAction,
  triggerManualRecoverySweepAction,
} from "@/modules/analytics/actions";
import type {
  AbandonedCartRecord,
  AbandonedCartStats,
  FunnelAnalyticsResult,
} from "@/modules/analytics/abandoned-cart";
import type { AbandonedCartSettings } from "@/lib/settings/schemas";

interface AbandonedCartsClientProps {
  initialCarts: AbandonedCartRecord[];
  initialTotal: number;
  initialStats: AbandonedCartStats;
  funnelAnalytics: FunnelAnalyticsResult;
  initialSettings: AbandonedCartSettings;
  activePromotions: Array<{ code: string | null; name: string }>;
}

export function AbandonedCartsClient({
  initialCarts,
  initialTotal,
  initialStats,
  funnelAnalytics,
  initialSettings,
  activePromotions,
}: AbandonedCartsClientProps) {
  const [carts, setCarts] = React.useState<AbandonedCartRecord[]>(initialCarts);
  const [stats, setStats] = React.useState<AbandonedCartStats>(initialStats);
  const [settings, setSettings] = React.useState<AbandonedCartSettings>(initialSettings);

  // Filtreler
  const [search, setSearch] = React.useState("");
  const [selectedStep, setSelectedStep] = React.useState<string>("all");
  const [selectedStatus, setSelectedStatus] = React.useState<string>("all");
  const [onlyWithEmail, setOnlyWithEmail] = React.useState(false);

  // Genişletilmiş satırlar
  const [expandedCartIds, setExpandedCartIds] = React.useState<Set<string>>(new Set());

  // Ayarlar paneli görünürlüğü
  const [showSettingsCard, setShowSettingsCard] = React.useState(false);
  const [savingSettings, setSavingSettings] = React.useState(false);
  const [runningSweep, setRunningSweep] = React.useState(false);

  // E-posta Gönderme Modal Durumu
  const [selectedCartForEmail, setSelectedCartForEmail] = React.useState<AbandonedCartRecord | null>(null);
  const [emailPromoCode, setEmailPromoCode] = React.useState("");
  const [sendingEmail, setSendingEmail] = React.useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = React.useState<string | null>(null);
  const [actionErrorMessage, setActionErrorMessage] = React.useState<string | null>(null);

  // Satır genişletme/daraltma
  function toggleExpandCart(id: string) {
    setExpandedCartIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  // Filtreleme (Client-side hızlı tepki)
  const filteredCarts = React.useMemo(() => {
    return carts.filter((c) => {
      if (onlyWithEmail && !c.email) return false;
      if (selectedStep !== "all" && c.lastStep !== selectedStep) return false;
      if (selectedStatus !== "all" && c.recoveryStatus !== selectedStatus) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchesName = c.customerName.toLowerCase().includes(q);
        const matchesEmail = (c.email ?? "").toLowerCase().includes(q);
        const matchesPhone = (c.phone ?? "").toLowerCase().includes(q);
        const matchesItems = c.items.some((it) => it.title.toLowerCase().includes(q));
        if (!matchesName && !matchesEmail && !matchesPhone && !matchesItems) {
          return false;
        }
      }
      return true;
    });
  }, [carts, onlyWithEmail, selectedStep, selectedStatus, search]);

  // Ayarları kaydet
  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingSettings(true);
    setActionSuccessMessage(null);
    setActionErrorMessage(null);

    const res = await saveAbandonedCartSettingsAction(settings);
    setSavingSettings(false);

    if (res.ok) {
      setActionSuccessMessage("Terk edilmiş sepet kurtarma ayarları kaydedildi.");
      setTimeout(() => setActionSuccessMessage(null), 4000);
    } else {
      setActionErrorMessage(res.error ?? "Ayarlar kaydedilirken hata oluştu.");
    }
  }

  // Manuel tarama tetikle
  async function handleTriggerSweep() {
    setRunningSweep(true);
    setActionSuccessMessage(null);
    setActionErrorMessage(null);

    const res = await triggerManualRecoverySweepAction();
    setRunningSweep(false);

    if (res.ok) {
      setActionSuccessMessage(
        `Kurtarma taraması tamamlandı: ${res.eligibleCount} uygun sepetten ${res.sentCount} tanesine hatırlatma e-postası gönderildi.`
      );
      setTimeout(() => setActionSuccessMessage(null), 6000);
    } else {
      setActionErrorMessage(res.error ?? "Tarama çalıştırılırken hata oluştu.");
    }
  }

  // E-posta gönder
  async function handleSendEmail() {
    if (!selectedCartForEmail) return;
    setSendingEmail(true);
    setActionSuccessMessage(null);
    setActionErrorMessage(null);

    const res = await sendCartRecoveryEmailAction(selectedCartForEmail.id, {
      discountCode: emailPromoCode || undefined,
    });

    setSendingEmail(false);

    if (res.ok) {
      // Yerel state'i güncelle
      setCarts((prev) =>
        prev.map((item) =>
          item.id === selectedCartForEmail.id
            ? {
                ...item,
                recoveryEmailAt: new Date(),
                recoveryEmailSentCount: item.recoveryEmailSentCount + 1,
                recoveryStatus: "SENT" as const,
                recoveryStatusLabel: "E-posta Gönderildi",
                recoveryDiscountCode: emailPromoCode || item.recoveryDiscountCode,
              }
            : item
        )
      );
      setStats((prev) => ({
        ...prev,
        recoveryEmailSentCount: prev.recoveryEmailSentCount + 1,
      }));

      setActionSuccessMessage(
        `${selectedCartForEmail.customerName} (${selectedCartForEmail.email}) için kurtarma e-postası başarıyla gönderildi.`
      );
      setSelectedCartForEmail(null);
      setEmailPromoCode("");
      setTimeout(() => setActionSuccessMessage(null), 5000);
    } else {
      setActionErrorMessage(res.error ?? "E-posta gönderimi başarısız.");
    }
  }

  function formatTimeAgo(date: Date): string {
    const diffSec = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (diffSec < 60) return "Az önce";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} dk önce`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours} saat önce`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} gün önce`;
  }

  return (
    <div className="space-y-8">
      {/* Bildirim Alanı */}
      {actionSuccessMessage && (
        <div className="flex items-center gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-xs font-medium text-emerald-800">
          <CheckCircle className="h-5 w-5 shrink-0 text-emerald-600" />
          <span>{actionSuccessMessage}</span>
        </div>
      )}

      {actionErrorMessage && (
        <div className="flex items-center gap-3 rounded-md border border-danger/30 bg-danger/10 p-4 text-xs font-medium text-danger">
          <WarningCircle className="h-5 w-5 shrink-0 text-danger" />
          <span>{actionErrorMessage}</span>
        </div>
      )}

      {/* KPI Kartları */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-5 space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Terk Edilen Sepetler</span>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
            {stats.totalAbandonedCount}
          </div>
          <p className="text-xs text-muted-foreground">
            Potansiyel Tutar:{" "}
            <span className="font-semibold text-foreground tabular-nums">
              {formatMoney(stats.totalAbandonedValueMinor)}
            </span>
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Sepet Terk Oranı</span>
            <Funnel className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
            %{stats.abandonmentRate}
          </div>
          <p className="text-xs text-muted-foreground">
            Ödeme adımı terk oranı:{" "}
            <span className="font-semibold text-foreground tabular-nums">
              %{funnelAnalytics.summary.checkoutAbandonmentRate}
            </span>
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Kurtarma E-postaları</span>
            <EnvelopeSimple className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
            {stats.recoveryEmailSentCount}
          </div>
          <p className="text-xs text-muted-foreground">
            Otomatik Gönderim:{" "}
            <span className="font-semibold text-foreground">
              {settings.autoRecoveryEnabled ? "Aktif" : "Kapalı"}
            </span>
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Kurtarılan Sepet & Ciro</span>
            <CheckCircle className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-emerald-600 tabular-nums">
            {stats.recoveredCount}{" "}
            <span className="text-xs font-normal text-muted-foreground">
              (%{stats.recoveryRate} başarı)
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Kurtarılan Gelir:{" "}
            <span className="font-semibold text-emerald-700 tabular-nums">
              {formatMoney(stats.recoveredRevenueMinor)}
            </span>
          </p>
        </div>
      </section>

      {/* Dönüşüm Hunisi (Checkout Funnel Görselleştirmesi) */}
      <section className="rounded-lg border border-border bg-card p-6 space-y-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Ziyaretçi ve Ödeme Adım Dönüşüm Hunisi
            </h2>
            <p className="text-xs text-muted-foreground">
              Son {funnelAnalytics.days} gündeki ziyaretçi hareketleri, sepet terk noktaları ve adım bazlı dökülme oranları
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowSettingsCard(!showSettingsCard)}
              className="text-xs gap-1.5"
            >
              <Gear className="h-3.5 w-3.5" />
              <span>Kurtarma Ayarları</span>
            </Button>
          </div>
        </div>

        {/* Adım Çubukları */}
        <div className="grid grid-cols-1 gap-2 md:grid-cols-6 pt-2">
          {funnelAnalytics.stages.map((stage, idx) => {
            const isLast = idx === funnelAnalytics.stages.length - 1;
            return (
              <div
                key={stage.step}
                className="relative flex flex-col justify-between rounded-md border border-border bg-background p-3.5 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    {idx + 1}. {stage.name}
                  </span>
                  {!isLast && (
                    <ArrowRight className="h-3 w-3 text-muted-foreground hidden md:block" />
                  )}
                </div>

                <div>
                  <div className="text-xl font-bold tracking-tight text-foreground tabular-nums">
                    {stage.count.toLocaleString("tr-TR")}
                  </div>
                  {idx > 0 && (
                    <div className="text-xs text-muted-foreground">
                      Dönüşüm:{" "}
                      <span className="font-medium text-foreground">
                        %{stage.conversionRate}
                      </span>
                    </div>
                  )}
                </div>

                {!isLast && stage.dropOffCount > 0 && (
                  <div className="rounded bg-rose-50 px-2 py-1 text-[11px] font-medium text-rose-700">
                    Terk: {stage.dropOffCount.toLocaleString("tr-TR")} (%{stage.dropOffRate})
                  </div>
                )}
                {isLast && (
                  <div className="rounded bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700">
                    Genel Başarı: %{funnelAnalytics.summary.overallConversionRate}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Otomatik Kurtarma Ayarları Kartı */}
      {showSettingsCard && (
        <form
          onSubmit={handleSaveSettings}
          className="rounded-lg border border-primary/20 bg-primary/5 p-6 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="space-y-0.5">
              <h3 className="text-sm font-semibold text-foreground">
                Terk Edilmiş Sepet Otomatik Kurtarma Yapılandırması
              </h3>
              <p className="text-xs text-muted-foreground">
                Zamanlanmış görev işçisi (cron) sepette kalan müşterilere otomatik teşvik e-postası göndersin.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowSettingsCard(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                Otomatik Hatırlatma Durumu
              </label>
              <div className="flex items-center gap-3 pt-1">
                <input
                  type="checkbox"
                  id="autoRecoveryEnabled"
                  checked={settings.autoRecoveryEnabled}
                  onChange={(e) =>
                    setSettings({ ...settings, autoRecoveryEnabled: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <label
                  htmlFor="autoRecoveryEnabled"
                  className="text-xs text-muted-foreground cursor-pointer"
                >
                  {settings.autoRecoveryEnabled ? "Aktif (Otomatik Gönder)" : "Devre Dışı"}
                </label>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                Sepet Terk Bekleme Süresi (Dakika)
              </label>
              <Input
                type="number"
                min={15}
                max={10080}
                value={settings.idleMinutesBeforeAbandoned}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    idleMinutesBeforeAbandoned: Number.parseInt(e.target.value, 10) || 60,
                  })
                }
                className="h-9 text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Kullanıcı bu süre işlem yapmazsa sepet terk kabul edilir (Örn: 60 dk).
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                Varsayılan İndirim / Teşvik Kodu (Opsiyonel)
              </label>
              <Input
                type="text"
                placeholder="Örn: GERIDON10"
                value={settings.autoDiscountCode}
                onChange={(e) =>
                  setSettings({ ...settings, autoDiscountCode: e.target.value.toUpperCase() })
                }
                className="h-9 text-xs font-mono uppercase"
              />
              <p className="text-[11px] text-muted-foreground">
                E-postadaki sepete dönüş linkine ve çıkış niyeti penceresine eklenir. Boş bırakılırsa
                çıkış niyeti için SEPET{settings.discountPercent} kodu otomatik oluşturulur.
              </p>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="discountPercent"
                className="text-xs font-medium text-foreground"
              >
                Varsayılan İndirim Oranı (%)
              </label>
              <Input
                id="discountPercent"
                type="number"
                min={1}
                max={90}
                value={settings.discountPercent}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    discountPercent: Math.min(
                      90,
                      Math.max(1, Number.parseInt(e.target.value, 10) || 10)
                    ),
                  })
                }
                className="h-9 text-xs tabular-nums"
              />
              <p className="text-[11px] text-muted-foreground">
                Kupon kaydı bu orana göre otomatik oluşturulur ve güncellenir. Mevcut bir kampanya
                koduysa o kampanyanın oranı korunur.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                Çıkış Niyeti Penceresi
              </label>
              <div className="flex items-center gap-3 pt-1">
                <input
                  type="checkbox"
                  id="exitIntentEnabled"
                  checked={settings.exitIntentEnabled}
                  onChange={(e) =>
                    setSettings({ ...settings, exitIntentEnabled: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <label
                  htmlFor="exitIntentEnabled"
                  className="text-xs text-muted-foreground cursor-pointer"
                >
                  {settings.exitIntentEnabled
                    ? `Aktif (%${settings.discountPercent} kupon sunulur)`
                    : "Devre Dışı"}
                </label>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Sepetinde ürün olan ziyaretçi sekmeyi kapatmaya yöneldiğinde oturum başına bir kez
                gösterilir.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={runningSweep}
              onClick={handleTriggerSweep}
              className="text-xs gap-1.5"
            >
              <ArrowClockwise
                className={`h-3.5 w-3.5 ${runningSweep ? "animate-spin" : ""}`}
              />
              <span>{runningSweep ? "Taranıyor..." : "Hemen Şimdi Taramayı Başlat"}</span>
            </Button>

            <Button
              type="submit"
              size="sm"
              disabled={savingSettings}
              className="text-xs gap-1.5"
            >
              {savingSettings ? "Kaydediliyor..." : "Ayarları Kaydet"}
            </Button>
          </div>
        </form>
      )}

      {/* Terk Edilmiş Sepetler Tablosu ve Filtreler */}
      <section className="rounded-lg border border-border bg-card space-y-0 overflow-hidden">
        {/* Arama ve Filtre Çubuğu */}
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-sm">
            <MagnifyingGlass className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Müşteri adı, e-posta, telefon veya ürün ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Adım Filtresi */}
            <select
              value={selectedStep}
              onChange={(e) => setSelectedStep(e.target.value)}
              aria-label="Funnel Adımı Filtresi"
              className="h-9 rounded-md border border-border bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">Tüm Adımlar</option>
              <option value="cart">Sepet Sayfası</option>
              <option value="address">Teslimat Adresi</option>
              <option value="shipping">Kargo Yöntemi</option>
              <option value="payment">Ödeme Tercihi</option>
              <option value="contracts">Sözleşmeler</option>
            </select>

            {/* Durum Filtresi */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              aria-label="Kurtarma Durumu Filtresi"
              className="h-9 rounded-md border border-border bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">Tüm Durumlar</option>
              <option value="NEVER_SENT">E-posta Gönderilmedi</option>
              <option value="SENT">E-posta Gönderildi</option>
              <option value="RECOVERED">Sepet Kurtarıldı</option>
            </select>

            {/* Sadece E-postası Olanlar */}
            <label className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={onlyWithEmail}
                onChange={(e) => setOnlyWithEmail(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-border text-primary"
              />
              <span>Sadece e-postası bilinenler</span>
            </label>
          </div>
        </div>

        {/* Tablo */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-muted/40 text-muted-foreground uppercase text-[10px] tracking-wider">
              <tr>
                <th className="px-4 py-3 font-semibold">Müşteri / Ziyaretçi</th>
                <th className="px-4 py-3 font-semibold">Terk Edilen Adım</th>
                <th className="px-4 py-3 font-semibold">Sepet İçeriği</th>
                <th className="px-4 py-3 font-semibold text-right">Tutar</th>
                <th className="px-4 py-3 font-semibold">Terk Zamanı</th>
                <th className="px-4 py-3 font-semibold">Kurtarma Durumu</th>
                <th className="px-4 py-3 font-semibold text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredCarts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    Kriterlere uygun terk edilmiş sepet bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredCarts.map((c) => {
                  const isExpanded = expandedCartIds.has(c.id);
                  const hasEmail = Boolean(c.email);
                  const isRecovered = c.recoveryStatus === "RECOVERED";

                  return (
                    <React.Fragment key={c.id}>
                      <tr className="hover:bg-muted/20 transition-colors">
                        {/* Müşteri / Ziyaretçi */}
                        <td className="px-4 py-3">
                          <div className="flex items-start gap-2">
                            <div className="mt-0.5 rounded p-1 bg-muted">
                              <User className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5 font-medium text-foreground">
                                <span>{c.customerName}</span>
                                {c.isRegisteredCustomer ? (
                                  <Badge variant="accent" className="text-[10px] py-0 px-1">
                                    Kayıtlı
                                  </Badge>
                                ) : (
                                  <Badge variant="neutral" className="text-[10px] py-0 px-1">
                                    Misafir
                                  </Badge>
                                )}
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                {c.email ?? "E-posta belirtilmemiş"}
                              </div>
                              {c.phone && (
                                <div className="text-[10px] text-muted-foreground">
                                  {c.phone}
                                </div>
                              )}
                              {c.shippingCity && (
                                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                  <MapPin className="h-2.5 w-2.5" />
                                  <span>{c.shippingCity}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Terk Edilen Adım */}
                        <td className="px-4 py-3">
                          <Badge
                            variant={
                              c.lastStep === "contracts" || c.lastStep === "payment"
                                ? "accent"
                                : "neutral"
                            }
                            className="text-[11px]"
                          >
                            {c.lastStepLabel}
                          </Badge>
                        </td>

                        {/* Sepet İçeriği */}
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => toggleExpandCart(c.id)}
                            className="flex items-center gap-1.5 text-left font-medium text-foreground hover:text-primary transition-colors"
                          >
                            <span>
                              {c.itemCount} adet ürün ({c.items.length} çeşit)
                            </span>
                            {isExpanded ? (
                              <CaretUp className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : (
                              <CaretDown className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </button>
                          <div className="text-[11px] text-muted-foreground truncate max-w-[220px]">
                            {c.items.map((it) => it.title).join(", ")}
                          </div>
                        </td>

                        {/* Tutar */}
                        <td className="px-4 py-3 text-right font-semibold text-foreground tabular-nums">
                          {formatMoney(c.totalMinor)}
                        </td>

                        {/* Zaman */}
                        <td className="px-4 py-3 text-muted-foreground">
                          <div className="font-medium text-foreground">
                            {formatTimeAgo(c.abandonedAt)}
                          </div>
                          <div className="text-[10px]">
                            {new Date(c.abandonedAt).toLocaleDateString("tr-TR", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </td>

                        {/* Kurtarma Durumu */}
                        <td className="px-4 py-3">
                          {c.recoveryStatus === "RECOVERED" ? (
                            <Badge variant="accent" className="bg-emerald-100 text-emerald-800 text-[10px]">
                              Kurtarıldı
                            </Badge>
                          ) : c.recoveryStatus === "SENT" ? (
                            <div className="space-y-0.5">
                              <Badge variant="neutral" className="bg-amber-100 text-amber-800 text-[10px]">
                                E-posta Gönderildi
                              </Badge>
                              {c.recoveryEmailAt && (
                                <div className="text-[10px] text-muted-foreground">
                                  {formatTimeAgo(c.recoveryEmailAt)}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">
                              Gönderilmedi
                            </span>
                          )}
                        </td>

                        {/* İşlem */}
                        <td className="px-4 py-3 text-right">
                          <Button
                            type="button"
                            size="sm"
                            variant={hasEmail && !isRecovered ? "primary" : "outline"}
                            disabled={!hasEmail || isRecovered}
                            onClick={() => {
                              setSelectedCartForEmail(c);
                              setEmailPromoCode(settings.autoDiscountCode || "");
                            }}
                            className="text-xs h-7 px-2.5 gap-1.5"
                          >
                            <PaperPlaneTilt className="h-3 w-3" />
                            <span>
                              {c.recoveryStatus === "SENT"
                                ? "Tekrar Gönder"
                                : "Kurtarma Maili"}
                            </span>
                          </Button>
                        </td>
                      </tr>

                      {/* Genişletilmiş Sepet Ürünleri Satırı */}
                      {isExpanded && (
                        <tr className="bg-muted/30">
                          <td colSpan={7} className="px-6 py-4">
                            <div className="space-y-3">
                              <div className="text-xs font-semibold text-foreground">
                                Sepetteki Ürünler ({c.items.length})
                              </div>
                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                {c.items.map((it) => (
                                  <div
                                    key={it.variantId}
                                    className="flex items-center gap-3 rounded-md border border-border bg-card p-2.5"
                                  >
                                    {it.imageUrl ? (
                                      <img
                                        src={it.imageUrl}
                                        alt={it.title}
                                        className="h-11 w-11 shrink-0 rounded object-cover"
                                      />
                                    ) : (
                                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
                                        <ShoppingCart className="h-4 w-4" />
                                      </div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <div className="text-xs font-medium text-foreground truncate">
                                        {it.title}
                                      </div>
                                      {it.variantTitle !== "Varsayılan" && (
                                        <div className="text-[11px] text-muted-foreground truncate">
                                          {it.variantTitle}
                                        </div>
                                      )}
                                      <div className="text-[11px] text-muted-foreground tabular-nums">
                                        {it.quantity} adet × {formatMoney(it.unitPriceMinor)} ={" "}
                                        <span className="font-semibold text-foreground">
                                          {formatMoney(it.totalPriceMinor)}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* Kurtarma Linki Bilgisi */}
                              {c.recoveryToken && (
                                <div className="flex items-center gap-2 pt-1 text-[11px] text-muted-foreground">
                                  <span>Özel Kurtarma Bağlantısı:</span>
                                  <code className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-foreground font-mono select-all">
                                    /sepet?recover={c.recoveryToken}
                                  </code>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Kurtarma E-postası Gönder Modal */}
      {selectedCartForEmail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="space-y-0.5">
                <h3 className="text-base font-semibold text-foreground">
                  Kurtarma E-postası Gönder
                </h3>
                <p className="text-xs text-muted-foreground">
                  Alışverişini tamamlamayan müşteriye özel hatırlatma ve teşvik linki iletilir.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCartForEmail(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="rounded-md border border-border bg-muted/40 p-3 space-y-1">
                <div>
                  <span className="text-muted-foreground">Alıcı: </span>
                  <span className="font-semibold text-foreground">
                    {selectedCartForEmail.customerName}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">E-posta: </span>
                  <span className="font-mono text-foreground font-medium">
                    {selectedCartForEmail.email}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Sepet Tutarı: </span>
                  <span className="font-semibold text-foreground tabular-nums">
                    {formatMoney(selectedCartForEmail.totalMinor)}
                  </span>{" "}
                  ({selectedCartForEmail.itemCount} adet ürün)
                </div>
                <div>
                  <span className="text-muted-foreground">Terk Edilen Aşama: </span>
                  <span className="font-medium text-foreground">
                    {selectedCartForEmail.lastStepLabel}
                  </span>
                </div>
              </div>

              {/* İndirim / Teşvik Kodu Seçimi */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  İndirim Kuponu Ekle (Opsiyonel)
                </label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="Örn: SEPET10"
                    value={emailPromoCode}
                    onChange={(e) => setEmailPromoCode(e.target.value.toUpperCase())}
                    className="h-9 text-xs font-mono uppercase"
                  />
                  {activePromotions.length > 0 && (
                    <select
                      onChange={(e) => setEmailPromoCode(e.target.value)}
                      value={emailPromoCode}
                      aria-label="Kupon Şablonu Seçimi"
                      className="h-9 rounded-md border border-border bg-background px-2 text-xs text-foreground focus:outline-none"
                    >
                      <option value="">Kupon Seç</option>
                      {activePromotions
                        .filter((p) => Boolean(p.code))
                        .map((p) => (
                          <option key={p.code} value={p.code ?? ""}>
                            {p.code} ({p.name})
                          </option>
                        ))}
                    </select>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Boş bırakırsanız müşteriye özel rastgele harf ve rakamlardan oluşan 48 saat geçerli tek kullanımlık kupon otomatik tanımlanır.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedCartForEmail(null)}
                className="text-xs"
              >
                Vazgeç
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={sendingEmail}
                onClick={handleSendEmail}
                className="text-xs gap-1.5"
              >
                <PaperPlaneTilt className="h-3.5 w-3.5" />
                <span>{sendingEmail ? "Gönderiliyor..." : "E-postayı Gönder"}</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
