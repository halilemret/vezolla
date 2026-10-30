import Link from "next/link";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import {
  BuildingOffice,
  CheckCircle,
  CreditCard,
  DeviceMobile,
  EnvelopeSimple,
  Globe,
  LockKey,
  Moon,
  Palette,
  Plus,
  ShieldCheck,
  Sparkle,
  Sun,
  Trash,
  Truck,
  UsersThree,
  Receipt,
} from "@phosphor-icons/react/dist/ssr";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { formatMoney, formatMoneyCompact } from "@/lib/money";
import { DEFAULT_EMAIL_TEMPLATES } from "@/lib/mail";
import { PERMISSIONS, hasPermission } from "@/lib/rbac/permissions";
import { THEME_PRESETS } from "@/lib/settings/theme-presets";
import {
  getConversionSettings,
  getInvoiceSettings,
  getPaymentSettings,
  getSeoSettings,
  getStoreSettings,
  getThemeSettings,
} from "@/lib/settings/service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  applyThemePresetAction,
  deleteRoleAction,
  deleteShippingMethodAction,
  deleteStaffUserAction,
  saveConversionSettingsAction,
  saveEmailTemplateAction,
  savePaymentSettingsAction,
  saveRoleAction,
  saveSeoSettingsAction,
  saveShippingMethodAction,
  saveStaffUserAction,
  saveStoreSettingsAction,
  saveThemeSettingsAction,
  sendTestEmailAction,
  toggleShippingMethodAction,
} from "@/modules/settings/actions";
import { saveInvoiceSettingsAction } from "@/modules/invoicing/actions";

export const dynamic = "force-dynamic";

type SettingsTabKey =
  | "magaza"
  | "tema"
  | "donusum"
  | "odeme"
  | "fatura"
  | "kargo"
  | "seo"
  | "eposta"
  | "personel";

const SETTINGS_TABS: ReadonlyArray<{ key: SettingsTabKey; label: string }> = [
  { key: "magaza", label: "Mağaza ve Şirket Bilgileri" },
  { key: "tema", label: "Vitrin Tema Özelleştirici" },
  { key: "donusum", label: "Dönüşüm ve Psikolojik Satış" },
  { key: "odeme", label: "Ödeme Ayarları" },
  { key: "fatura", label: "e-Fatura / e-Arşiv Entegrasyonu" },
  { key: "kargo", label: "Kargo Yöntemleri" },
  { key: "seo", label: "SEO Varsayılanları" },
  { key: "eposta", label: "E-posta Şablonları ve Giden Kutusu" },
  { key: "personel", label: "Personel ve Rol / İzin Matrisi" },
];

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const staff = await requireStaff();
  const canManageSettings = hasPermission(staff, "settings.manage");
  const canManageStaff = hasPermission(staff, "staff.manage");

  const params = await searchParams;
  const rawTab = typeof params.tab === "string" ? params.tab : "magaza";
  const activeTab: SettingsTabKey = SETTINGS_TABS.some((t) => t.key === rawTab)
    ? (rawTab as SettingsTabKey)
    : "magaza";

  const [
    storeSettings,
    themeSettings,
    conversionSettings,
    paymentSettings,
    invoiceSettings,
    seoSettings,
    shippingMethods,
    existingTemplates,
    emailMessages,
    roles,
    staffUsers,
  ] = await Promise.all([
    getStoreSettings(),
    getThemeSettings(),
    getConversionSettings(),
    getPaymentSettings(),
    getInvoiceSettings(),
    getSeoSettings(),
    db.shippingMethod.findMany({
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    }),
    db.emailTemplate.findMany({ orderBy: { key: "asc" } }),
    db.emailMessage.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    db.role.findMany({
      include: { _count: { select: { users: true } } },
      orderBy: { createdAt: "asc" },
    }),
    db.staffUser.findMany({
      include: { role: { select: { id: true, name: true } } },
      orderBy: [{ isOwner: "desc" }, { createdAt: "asc" }],
    }),
  ]);

  // Varsayılan e-posta şablonlarını veritabanındaki kayıtlarla birleştir
  const templateByKey = new Map(existingTemplates.map((t) => [t.key, t]));
  const mergedTemplates = [
    ...DEFAULT_EMAIL_TEMPLATES.map((def) => {
      const dbTpl = templateByKey.get(def.key);
      return (
        dbTpl ?? {
          id: `default_${def.key}`,
          key: def.key,
          name: def.name,
          subject: def.subject,
          bodyHtml: def.bodyHtml,
          isActive: true,
          updatedAt: new Date(),
        }
      );
    }),
    ...existingTemplates.filter(
      (t) => !DEFAULT_EMAIL_TEMPLATES.some((def) => def.key === t.key)
    ),
  ];

  const permissionGroups = Array.from(new Set(PERMISSIONS.map((p) => p.group)));

  async function handleSaveInvoiceSettings(formData: FormData) {
    "use server";
    await saveInvoiceSettingsAction({
      enabled: formData.get("enabled") === "on",
      autoInvoiceOnPaid: formData.get("autoInvoiceOnPaid") === "on",
      autoSendEmailToCustomer: formData.get("autoSendEmailToCustomer") === "on",
      seriesPrefix: String(formData.get("seriesPrefix") ?? "VEZ").trim().toUpperCase(),
      provider: (String(formData.get("provider") ?? "vezolla_einvoice") as
        | "vezolla_einvoice"
        | "parasut"
        | "uyumsoft"
        | "edm"
        | "gib_portal"),
      isTestMode: formData.get("isTestMode") === "on",
      defaultNotes: String(formData.get("defaultNotes") ?? "").trim(),
      companySenderTitle: String(formData.get("companySenderTitle") ?? "").trim(),
      companyTaxOffice: String(formData.get("companyTaxOffice") ?? "").trim(),
      companyTaxNumber: String(formData.get("companyTaxNumber") ?? "").trim(),
      companyMersis: String(formData.get("companyMersis") ?? "").trim(),
      companyKepAddress: String(formData.get("companyKepAddress") ?? "").trim(),
      companyAddress: String(formData.get("companyAddress") ?? "").trim(),
      companyPhone: String(formData.get("companyPhone") ?? "").trim(),
      companyEmail: String(formData.get("companyEmail") ?? "").trim(),
      companyWeb: String(formData.get("companyWeb") ?? "").trim(),
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 border-b border-zinc-200 pb-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900">
            Sistem Ayarları, Vitrin Teması ve Yetki Yönetimi
          </h1>
          <p className="mt-1 text-xs text-zinc-600">
            Resmi şirket bilgilerini (MERSİS, Vergi, KEP), vitrin temasını, ödeme ve kargo
            kurallarını, e-posta şablonlarını ve personel rol izinlerini yönetin.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/ayarlar/denetim"
            className="inline-flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-100"
          >
            <ShieldCheck className="h-4 w-4 text-[#9a3412]" />
            Denetim Kaydı (AuditLog ve JSON Fark)
          </Link>
        </div>
      </div>

      <nav
        aria-label="Ayarlar sekmeleri"
        className="flex flex-wrap gap-1.5 border-b border-zinc-200 pb-3"
      >
        {SETTINGS_TABS.map((tab) => {
          const isCurrent = tab.key === activeTab;
          return (
            <Link
              key={tab.key}
              href={`/admin/ayarlar?tab=${tab.key}`}
              className={
                isCurrent
                  ? "rounded-md bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-white"
                  : "rounded-md border border-zinc-200 bg-white px-3.5 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
              }
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {/* 1. MAĞAZA VE ŞİRKET BİLGİLERİ */}
      {activeTab === "magaza" ? (
        <form
          action={saveStoreSettingsAction}
          className="space-y-6 rounded-md border border-zinc-200 bg-white p-6"
        >
          <div className="flex items-center gap-2 border-b border-zinc-200 pb-3">
            <BuildingOffice className="h-5 w-5 text-zinc-900" />
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">
                Mağaza Kimliği ve Resmi Şirket Bilgileri
              </h2>
              <p className="text-xs text-zinc-600">
                Bu bilgiler mesafeli satış sözleşmesinde, ön bilgilendirme formunda ve e-posta
                altbilgilerinde otomatik kullanılır.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label htmlFor="st-name">Mağaza Adı</Label>
              <Input
                id="st-name"
                name="storeName"
                defaultValue={storeSettings.storeName}
                required
                className="mt-1"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="st-tagline">Mağaza Sloganı / Alt Başlık</Label>
              <Input
                id="st-tagline"
                name="tagline"
                defaultValue={storeSettings.tagline}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="st-email">Müşteri Destek E-postası</Label>
              <Input
                id="st-email"
                name="supportEmail"
                type="email"
                defaultValue={storeSettings.supportEmail}
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="st-phone">Müşteri Destek Telefonu</Label>
              <Input
                id="st-phone"
                name="supportPhone"
                defaultValue={storeSettings.supportPhone}
                className="mt-1 font-mono"
              />
            </div>
            <div>
              <Label htmlFor="st-currency">Varsayılan Para Birimi</Label>
              <Input
                id="st-currency"
                name="currency"
                defaultValue={storeSettings.currency}
                className="mt-1 font-mono"
              />
            </div>
          </div>

          <div className="border-t border-zinc-200 pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-700">
              Resmi Ticari ve Vergi Bilgileri (ETBİS / Mesafeli Satış Uyumlu)
            </h3>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="sm:col-span-2">
                <Label htmlFor="st-legal">Resmi Ticaret Unvanı</Label>
                <Input
                  id="st-legal"
                  name="companyLegalName"
                  defaultValue={storeSettings.companyLegalName}
                  placeholder="Örn: Örnek Ticaret A.Ş."
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="st-mersis">MERSİS Numarası</Label>
                <Input
                  id="st-mersis"
                  name="mersisNumber"
                  defaultValue={storeSettings.mersisNumber}
                  placeholder="0123456789000001"
                  className="mt-1 font-mono tabular-nums"
                />
              </div>
              <div>
                <Label htmlFor="st-taxoffice">Vergi Dairesi</Label>
                <Input
                  id="st-taxoffice"
                  name="taxOffice"
                  defaultValue={storeSettings.taxOffice}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="st-taxno">Vergi Kimlik Numarası (VKN / TCKN)</Label>
                <Input
                  id="st-taxno"
                  name="taxNumber"
                  defaultValue={storeSettings.taxNumber}
                  className="mt-1 font-mono tabular-nums"
                />
              </div>
              <div>
                <Label htmlFor="st-kep">KEP (Kayıtlı Elektronik Posta) Adresi</Label>
                <Input
                  id="st-kep"
                  name="kepAddress"
                  defaultValue={storeSettings.kepAddress}
                  placeholder="ornek@hs01.kep.tr"
                  className="mt-1 font-mono"
                />
              </div>
              <div>
                <Label htmlFor="st-city">İl</Label>
                <Input
                  id="st-city"
                  name="city"
                  defaultValue={storeSettings.city}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="st-district">İlçe</Label>
                <Input
                  id="st-district"
                  name="district"
                  defaultValue={storeSettings.district}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="st-address">Açık Merkez Adresi</Label>
                <Input
                  id="st-address"
                  name="address"
                  defaultValue={storeSettings.address}
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-zinc-200 pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-700">
              Yorum ve KVKK Veri Saklama Kuralları
            </h3>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <label className="flex items-start gap-2.5 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs">
                <input
                  type="checkbox"
                  name="onlyBuyersCanReview"
                  defaultChecked={storeSettings.onlyBuyersCanReview}
                  className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-zinc-900"
                />
                <span>
                  <strong className="block text-zinc-900">
                    Yalnızca Satın Alanlar Yorum Yazabilsin
                  </strong>
                  <span className="text-zinc-600">
                    Sahte yorumları önlemek için sadece ödendi durumundaki sipariş sahiplerine izin
                    verir.
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-2.5 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs">
                <input
                  type="checkbox"
                  name="autoApproveReviews"
                  defaultChecked={storeSettings.autoApproveReviews}
                  className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-zinc-900"
                />
                <span>
                  <strong className="block text-zinc-900">Yorumları Otomatik Yayınla</strong>
                  <span className="text-zinc-600">
                    Kapalıysa yeni yorumlar moderasyon onayına düşer.
                  </span>
                </span>
              </label>

              <div>
                <Label htmlFor="st-retention">Ziyaretçi Profili Saklama Süresi (Gün)</Label>
                <Input
                  id="st-retention"
                  name="visitorRetentionDays"
                  type="number"
                  min={1}
                  max={730}
                  defaultValue={storeSettings.visitorRetentionDays}
                  className="mt-1 font-mono tabular-nums"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end border-t border-zinc-200 pt-4">
            <Button type="submit" variant="primary" disabled={!canManageSettings}>
              Mağaza ve Şirket Bilgilerini Kaydet
            </Button>
          </div>
        </form>
      ) : null}

      {/* 2. VİTRİN TEMA ÖZELLEŞTİRİCİ */}
      {activeTab === "tema" ? (
        <div className="space-y-8">
          {/* A. HAZIR TEMA ŞABLONLARI */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Palette className="h-5 w-5 text-zinc-900" />
                  <h2 className="text-base font-bold text-zinc-900">
                    Hazır Tema Şablonları (Tek Tıkla Uygula)
                  </h2>
                </div>
                <p className="mt-1 text-xs text-zinc-600 leading-relaxed">
                  İç giyim, fantazi giyim veya hazır giyim konseptinize en uygun profesyonel temayı tek tıkla seçin.
                  Tüm temalar renk paletini, tipografiyi, köşe yumuşatmasını, gizli paketleme bildirimini ve %70 mobil kitle için optimize edilmiş alt gezinme çubuğunu otomatik yapılandırır.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                  <DeviceMobile className="h-3.5 w-3.5 text-emerald-600" />
                  <span>%70 Mobil Öncelikli</span>
                </span>
                <Badge variant={themeSettings.isDraftDirection ? "warning" : "success"}>
                  {themeSettings.isDraftDirection
                    ? "Yönsüz Taslak Modu"
                    : "Marka Yönü Aktif"}
                </Badge>
              </div>
            </div>

            {/* Şablon Kartları Izgarası */}
            <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {THEME_PRESETS.map((preset) => {
                const isActive = themeSettings.activePresetId === preset.id;
                const isIntimate = preset.category === "intimate";

                return (
                  <div
                    key={preset.id}
                    className={`relative flex flex-col justify-between rounded-xl border p-5 transition-all duration-200 ${
                      isActive
                        ? "border-zinc-950 ring-2 ring-zinc-950/20 bg-zinc-50/50 shadow-md"
                        : "border-zinc-200 bg-white hover:border-zinc-400 hover:shadow-xs"
                    }`}
                  >
                    <div className="space-y-4">
                      {/* Kart Başlığı ve Kategori Rozeti */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              isIntimate
                                ? "bg-rose-50 text-rose-800 border border-rose-200/80"
                                : "bg-zinc-100 text-zinc-800 border border-zinc-200"
                            }`}
                          >
                            {isIntimate ? (
                              <>
                                <LockKey className="h-3 w-3 text-rose-600" />
                                <span>İç Giyim & Fantazi</span>
                              </>
                            ) : (
                              <span>Hazır Giyim & Moda</span>
                            )}
                          </span>
                          <h3 className="mt-1.5 text-sm font-bold text-zinc-950">
                            {preset.name}
                          </h3>
                        </div>

                        {isActive ? (
                          <span className="flex items-center gap-1 rounded-md bg-zinc-900 px-2 py-1 text-[11px] font-semibold text-white shrink-0">
                            <CheckCircle className="h-3.5 w-3.5 text-emerald-400" weight="fill" />
                            <span>Aktif</span>
                          </span>
                        ) : null}
                      </div>

                      {/* Görsel Renk Paleti Önizlemesi */}
                      <div className="rounded-lg border border-zinc-200 overflow-hidden shadow-2xs">
                        <div
                          className="p-3 text-xs transition-colors"
                          style={{
                            backgroundColor: preset.values.surfaceColor,
                            color: preset.values.primaryColor,
                          }}
                        >
                          <div className="flex items-center justify-between text-[11px] font-bold pb-2 border-b" style={{ borderColor: preset.values.borderColor }}>
                            <span style={{ color: preset.values.primaryColor }}>
                              {preset.values.logoText}
                            </span>
                            <span
                              className="rounded px-1.5 py-0.5 text-[9px] font-bold"
                              style={{
                                backgroundColor: preset.values.accentColor,
                                color: preset.values.accentFgColor,
                              }}
                            >
                              Fırsat
                            </span>
                          </div>
                          <div
                            className="mt-2 rounded p-2 text-[10px] space-y-1"
                            style={{
                              backgroundColor: preset.values.cardColor,
                              border: `1px solid ${preset.values.borderColor}`,
                            }}
                          >
                            <div className="font-semibold" style={{ color: preset.values.primaryColor }}>
                              Örnek Ürün Kartı
                            </div>
                            <div className="flex items-baseline justify-between">
                              <span className="font-mono font-bold" style={{ color: preset.values.primaryColor }}>
                                ₺1.250
                              </span>
                              <span
                                className="rounded px-1.5 py-0.5 text-[9px] font-bold"
                                style={{
                                  backgroundColor: preset.values.accentColor,
                                  color: preset.values.accentFgColor,
                                }}
                              >
                                Sepete Ekle
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Renk Skalası Şeridi */}
                        <div className="grid grid-cols-5 h-3">
                          <div title="Zemin (Surface)" style={{ backgroundColor: preset.values.surfaceColor }} />
                          <div title="Kart (Card)" style={{ backgroundColor: preset.values.cardColor }} />
                          <div title="Mürekkep (Primary)" style={{ backgroundColor: preset.values.primaryColor }} />
                          <div title="Vurgu (Accent)" style={{ backgroundColor: preset.values.accentColor }} />
                          <div title="Kenarlık (Border)" style={{ backgroundColor: preset.values.borderColor }} />
                        </div>
                      </div>

                      {/* Açıklama */}
                      <p className="text-xs text-zinc-600 leading-relaxed">
                        {preset.description}
                      </p>

                      {/* Özellik Etiketleri */}
                      <div className="flex flex-wrap gap-1.5 text-[11px]">
                        <span className="inline-flex items-center gap-1 rounded bg-zinc-100 px-2 py-0.5 text-zinc-700">
                          {preset.values.themeMode === "dark" ? (
                            <>
                              <Moon className="h-3 w-3 text-indigo-500" />
                              <span>Koyu Mod</span>
                            </>
                          ) : (
                            <>
                              <Sun className="h-3 w-3 text-amber-500" />
                              <span>Açık Mod</span>
                            </>
                          )}
                        </span>
                        <span className="rounded bg-zinc-100 px-2 py-0.5 text-zinc-700">
                          {preset.values.headingFont === "instrument-serif"
                            ? "Serif Başlık"
                            : "Modern Sans"}
                        </span>
                        {preset.values.discreetShippingNotice ? (
                          <span className="inline-flex items-center gap-1 rounded bg-rose-50 text-rose-700 font-medium px-2 py-0.5">
                            <LockKey className="h-3 w-3" />
                            <span>Gizli Paketleme</span>
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {/* Tek Tıkla Uygula Butonu */}
                    <div className="mt-5 pt-4 border-t border-zinc-100">
                      <form action={applyThemePresetAction}>
                        <input type="hidden" name="presetId" value={preset.id} />
                        <Button
                          type="submit"
                          variant={isActive ? "primary" : "outline"}
                          size="sm"
                          disabled={!canManageSettings}
                          className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold"
                        >
                          {isActive ? (
                            <>
                              <CheckCircle className="h-4 w-4 text-emerald-400" weight="fill" />
                              <span>Şu An Aktif Tema</span>
                            </>
                          ) : (
                            <>
                              <Sparkle className="h-4 w-4" />
                              <span>Bu Temayı Tek Tıkla Uygula</span>
                            </>
                          )}
                        </Button>
                      </form>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* B. İNCE AYAR VE ÖZELLEŞTİRME FORMU */}
          <form
            action={saveThemeSettingsAction}
            className="space-y-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-xs"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200 pb-4">
              <div>
                <h3 className="text-base font-bold text-zinc-900">
                  Temayı En İnce Ayrıntısına Kadar Özelleştirin
                </h3>
                <p className="mt-0.5 text-xs text-zinc-600">
                  Seçtiğiniz şablonun zemin, kart, mürekkep, vurgu renklerini, tipografisini ve güven rozetlerini manuel olarak düzenleyin.
                </p>
              </div>
              <input
                type="hidden"
                name="activePresetId"
                value={themeSettings.activePresetId ?? "custom"}
              />
            </div>

            {/* 1. Marka ve Logo Bilgileri */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-800 mb-3">
                1. Marka ve Logo
              </h4>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <Label htmlFor="th-logotext">Logo Metni</Label>
                  <Input
                    id="th-logotext"
                    name="logoText"
                    defaultValue={themeSettings.logoText}
                    required
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="th-logoimg">Logo Görsel URL (İsteğe Bağlı)</Label>
                  <Input
                    id="th-logoimg"
                    name="logoImageUrl"
                    defaultValue={themeSettings.logoImageUrl}
                    placeholder="/uploads/logo.svg veya boş bırakın"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="th-favicon">Favicon URL (İsteğe Bağlı)</Label>
                  <Input
                    id="th-favicon"
                    name="faviconUrl"
                    defaultValue={themeSettings.faviconUrl}
                    placeholder="/favicon.ico"
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            {/* 2. Mod ve Tipografi */}
            <div className="border-t border-zinc-200 pt-5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-800 mb-3">
                2. Tema Modu, Tipografi ve Köşe Yuvarlaklığı
              </h4>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                <div>
                  <Label htmlFor="th-mode">Görünüm Modu</Label>
                  <Select
                    id="th-mode"
                    name="themeMode"
                    defaultValue={themeSettings.themeMode ?? "light"}
                    className="mt-1"
                  >
                    <option value="light">Açık Mod (Light)</option>
                    <option value="dark">Koyu Mod (Dark)</option>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="th-hfont">Vitrin Başlık Fontu</Label>
                  <Select
                    id="th-hfont"
                    name="headingFont"
                    defaultValue={themeSettings.headingFont}
                    className="mt-1"
                  >
                    <option value="instrument-serif">Instrument Serif (Editoryal & Romantik)</option>
                    <option value="plus-jakarta">Plus Jakarta Sans (Modern & Temiz)</option>
                    <option value="ibm-plex-sans">IBM Plex Sans (Teknik & Brutalist)</option>
                    <option value="system">Sistem Sans Fontu</option>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="th-bfont">Gövde Metin Fontu</Label>
                  <Select
                    id="th-bfont"
                    name="bodyFont"
                    defaultValue={themeSettings.bodyFont}
                    className="mt-1"
                  >
                    <option value="plus-jakarta">Plus Jakarta Sans</option>
                    <option value="ibm-plex-sans">IBM Plex Sans</option>
                    <option value="system">Sistem Sans Fontu</option>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="th-radius">Köşe Yuvarlaklığı Ölçeği</Label>
                  <Select
                    id="th-radius"
                    name="radiusScale"
                    defaultValue={themeSettings.radiusScale}
                    className="mt-1"
                  >
                    <option value="none">Keskin Köşeler (0px)</option>
                    <option value="sm">Hafif Yuvarlak (6px)</option>
                    <option value="md">Belirgin Yuvarlak (12px)</option>
                    <option value="full">Tam Yuvarlak Pill (9999px)</option>
                  </Select>
                </div>
              </div>
            </div>

            {/* 3. Renk Paleti (7 Hassas Değer) */}
            <div className="border-t border-zinc-200 pt-5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-800 mb-1">
                3. Renk Paleti
              </h4>
              <p className="text-xs text-zinc-500 mb-4">
                Renk kodlarını hex biçiminde girin. Mağaza bileşenleri bu renkleri CSS değişkenleri olarak otomatik kullanır.
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                <div>
                  <Label htmlFor="th-surface">Sayfa Zemin Rengi (Surface)</Label>
                  <div className="mt-1 flex items-center gap-2">
                    <div
                      className="h-9 w-9 rounded-md border border-zinc-300 shadow-2xs shrink-0"
                      style={{ backgroundColor: themeSettings.surfaceColor }}
                    />
                    <Input
                      id="th-surface"
                      name="surfaceColor"
                      defaultValue={themeSettings.surfaceColor}
                      className="font-mono text-xs"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="th-card">Kart Zemin Rengi (Card)</Label>
                  <div className="mt-1 flex items-center gap-2">
                    <div
                      className="h-9 w-9 rounded-md border border-zinc-300 shadow-2xs shrink-0"
                      style={{ backgroundColor: themeSettings.cardColor }}
                    />
                    <Input
                      id="th-card"
                      name="cardColor"
                      defaultValue={themeSettings.cardColor}
                      className="font-mono text-xs"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="th-primary">Mürekkep / Metin (Primary)</Label>
                  <div className="mt-1 flex items-center gap-2">
                    <div
                      className="h-9 w-9 rounded-md border border-zinc-300 shadow-2xs shrink-0"
                      style={{ backgroundColor: themeSettings.primaryColor }}
                    />
                    <Input
                      id="th-primary"
                      name="primaryColor"
                      defaultValue={themeSettings.primaryColor}
                      className="font-mono text-xs"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="th-muted">Soluk / İkincil Metin (Muted)</Label>
                  <div className="mt-1 flex items-center gap-2">
                    <div
                      className="h-9 w-9 rounded-md border border-zinc-300 shadow-2xs shrink-0"
                      style={{ backgroundColor: themeSettings.mutedColor }}
                    />
                    <Input
                      id="th-muted"
                      name="mutedColor"
                      defaultValue={themeSettings.mutedColor}
                      className="font-mono text-xs"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="th-accent">Tek Vurgu Rengi (Accent)</Label>
                  <div className="mt-1 flex items-center gap-2">
                    <div
                      className="h-9 w-9 rounded-md border border-zinc-300 shadow-2xs shrink-0"
                      style={{ backgroundColor: themeSettings.accentColor }}
                    />
                    <Input
                      id="th-accent"
                      name="accentColor"
                      defaultValue={themeSettings.accentColor}
                      className="font-mono text-xs"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="th-accentfg">Vurgu Üzeri Metin (Accent FG)</Label>
                  <div className="mt-1 flex items-center gap-2">
                    <div
                      className="h-9 w-9 rounded-md border border-zinc-300 shadow-2xs shrink-0"
                      style={{ backgroundColor: themeSettings.accentFgColor }}
                    />
                    <Input
                      id="th-accentfg"
                      name="accentFgColor"
                      defaultValue={themeSettings.accentFgColor}
                      className="font-mono text-xs"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="th-border">Kenarlık Rengi (Border)</Label>
                  <div className="mt-1 flex items-center gap-2">
                    <div
                      className="h-9 w-9 rounded-md border border-zinc-300 shadow-2xs shrink-0"
                      style={{ backgroundColor: themeSettings.borderColor }}
                    />
                    <Input
                      id="th-border"
                      name="borderColor"
                      defaultValue={themeSettings.borderColor}
                      className="font-mono text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Duyuru Çubuğu */}
            <div className="border-t border-zinc-200 pt-5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-800 mb-3">
                4. Üst Duyuru Çubuğu
              </h4>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <Label htmlFor="th-ann-text">Duyuru Çubuğu Metni</Label>
                  <Input
                    id="th-ann-text"
                    name="announcementText"
                    defaultValue={themeSettings.announcementText}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="th-ann-href">Duyuru Çubuğu Bağlantısı</Label>
                  <Input
                    id="th-ann-href"
                    name="announcementHref"
                    defaultValue={themeSettings.announcementHref}
                    className="mt-1 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* 5. Bildirimler ve Özel Güvence Seçenekleri */}
            <div className="border-t border-zinc-200 pt-5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-800 mb-3">
                5. Güvenlik, Gizlilik ve Taslak Seçenekleri
              </h4>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <label className="flex items-start gap-2.5 rounded-lg border border-zinc-200 bg-zinc-50 p-3.5 text-xs hover:bg-zinc-100/60 transition-colors">
                  <input
                    type="checkbox"
                    name="announcementEnabled"
                    defaultChecked={themeSettings.announcementEnabled}
                    className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-zinc-900"
                  />
                  <span>
                    <strong className="block text-zinc-900">Duyuru Çubuğunu Göster</strong>
                    <span className="text-zinc-600">
                      Vitrinin en üstünde kargo ve kampanya bilgilendirme şeridini görüntüler.
                    </span>
                  </span>
                </label>

                <label className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50/50 p-3.5 text-xs hover:bg-rose-50 transition-colors">
                  <input
                    type="checkbox"
                    name="discreetShippingNotice"
                    defaultChecked={themeSettings.discreetShippingNotice}
                    className="mt-0.5 h-4 w-4 rounded border-rose-300 text-rose-900"
                  />
                  <span>
                    <strong className="flex items-center gap-1 text-rose-950 font-bold">
                      <LockKey className="h-3.5 w-3.5 text-rose-700" />
                      <span>Gizli Paketleme Güvencesi Rozeti</span>
                    </strong>
                    <span className="text-rose-800 leading-relaxed block mt-0.5">
                      İç giyim ve fantazi giyim gibi hassas kategorilerde alışveriş güvenini artıran %100 nötr koli ve isimsiz gönderi rozetini vitrinde gösterir.
                    </span>
                  </span>
                </label>

                <label className="flex items-start gap-2.5 rounded-lg border border-zinc-200 bg-zinc-50 p-3.5 text-xs hover:bg-zinc-100/60 transition-colors">
                  <input
                    type="checkbox"
                    name="isDraftDirection"
                    defaultChecked={themeSettings.isDraftDirection}
                    className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-zinc-900"
                  />
                  <span>
                    <strong className="block text-zinc-900">
                      Yönsüz Taslak (Draft without direction) Rozeti
                    </strong>
                    <span className="text-zinc-600">
                      Marka kimliği kesinleşene kadar vitrinin nötr taslak modunda olduğunu belirtir.
                    </span>
                  </span>
                </label>
              </div>
            </div>

            <div className="flex justify-end border-t border-zinc-200 pt-5">
              <Button type="submit" variant="primary" disabled={!canManageSettings}>
                Vitrin Tema Ayarlarını Kaydet
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      {/* DÖNÜŞÜM VE PSİKOLOJİK SATIŞ AYARLARI */}
      {activeTab === "donusum" ? (
        <form
          action={saveConversionSettingsAction}
          className="space-y-6 rounded-md border border-zinc-200 bg-white p-6"
        >
          <div className="flex items-center gap-2 border-b border-zinc-200 pb-3">
            <ShieldCheck className="h-5 w-5 text-zinc-900" />
            <div>
              <h2 className="font-[family-name:var(--font-serif)] text-lg text-zinc-900">
                Dönüşüm Optimizasyonu ve Satın Alma Psikolojisi Ayarları
              </h2>
              <p className="text-xs text-zinc-600">
                Flaş indirim sayacı, aciliyet kurguları, güven sütunları, canlı satın alma bildirimleri ve sepet teşviklerini tek ekrandan yönetin.
              </p>
            </div>
          </div>

          {/* 1. GÜNÜN FLAŞ İNDİRİM BANDI */}
          <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-zinc-900">1. Günün Flaş İndirim Bandı</h3>
                <p className="text-xs text-zinc-600">
                  Canlı geri sayım sayacı, aciliyet rozeti ve tek tıkla kopyalanan kupon alanı.
                </p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="flashDealsEnabled"
                  defaultChecked={conversionSettings.flashDealsEnabled}
                  className="h-4 w-4 rounded border-zinc-300 text-zinc-900"
                />
                <span className="text-xs font-semibold text-zinc-900">Aktif</span>
              </label>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 pt-2 border-t border-zinc-200/80">
              <div>
                <Label htmlFor="fd-badge">Rozet Metni</Label>
                <Input
                  id="fd-badge"
                  name="flashDealsBadgeText"
                  defaultValue={conversionSettings.flashDealsBadgeText}
                  className="mt-1"
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="fd-title">Flaş İndirim Başlığı</Label>
                <Input
                  id="fd-title"
                  name="flashDealsTitle"
                  defaultValue={conversionSettings.flashDealsTitle}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="fd-code">Promosyon / Kupon Kodu</Label>
                <Input
                  id="fd-code"
                  name="flashDealsPromoCode"
                  defaultValue={conversionSettings.flashDealsPromoCode}
                  className="mt-1 font-mono font-bold"
                />
              </div>
              <div>
                <Label htmlFor="fd-duration">Sayaç Süresi (Saat)</Label>
                <Input
                  id="fd-duration"
                  name="flashDealsDurationHours"
                  type="number"
                  min={1}
                  max={72}
                  defaultValue={conversionSettings.flashDealsDurationHours}
                  className="mt-1 tabular-nums"
                />
              </div>
              <div>
                <Label htmlFor="fd-href">Hedef Buton Linki</Label>
                <Input
                  id="fd-href"
                  name="flashDealsTargetHref"
                  defaultValue={conversionSettings.flashDealsTargetHref}
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          {/* 2. DEĞER VE GÜVEN SÜTUNLARI */}
          <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-zinc-900">2. Değer ve Güven Sütunları (4 Rozet)</h3>
                <p className="text-xs text-zinc-600">
                  Kullanıcının güven algısını artıran 4 temel mağaza vaadi ve kargo garantileri.
                </p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="trustBadgesEnabled"
                  defaultChecked={conversionSettings.trustBadgesEnabled}
                  className="h-4 w-4 rounded border-zinc-300 text-zinc-900"
                />
                <span className="text-xs font-semibold text-zinc-900">Aktif</span>
              </label>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2 border-t border-zinc-200/80">
              <div className="rounded-lg border border-zinc-200 bg-white p-3 space-y-2">
                <span className="text-[11px] font-bold text-zinc-500 uppercase">1. Sütun: Hızlı Kargo</span>
                <div>
                  <Label htmlFor="tb-1-title" className="text-xs">Başlık</Label>
                  <Input
                    id="tb-1-title"
                    name="trustBadge1Title"
                    defaultValue={conversionSettings.trustBadge1Title}
                    className="mt-1 text-xs"
                  />
                </div>
                <div>
                  <Label htmlFor="tb-1-desc" className="text-xs">Açıklama</Label>
                  <Input
                    id="tb-1-desc"
                    name="trustBadge1Desc"
                    defaultValue={conversionSettings.trustBadge1Desc}
                    className="mt-1 text-xs"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-zinc-200 bg-white p-3 space-y-2">
                <span className="text-[11px] font-bold text-zinc-500 uppercase">2. Sütun: Orijinallik</span>
                <div>
                  <Label htmlFor="tb-2-title" className="text-xs">Başlık</Label>
                  <Input
                    id="tb-2-title"
                    name="trustBadge2Title"
                    defaultValue={conversionSettings.trustBadge2Title}
                    className="mt-1 text-xs"
                  />
                </div>
                <div>
                  <Label htmlFor="tb-2-desc" className="text-xs">Açıklama</Label>
                  <Input
                    id="tb-2-desc"
                    name="trustBadge2Desc"
                    defaultValue={conversionSettings.trustBadge2Desc}
                    className="mt-1 text-xs"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-zinc-200 bg-white p-3 space-y-2">
                <span className="text-[11px] font-bold text-zinc-500 uppercase">3. Sütun: İade Güvencesi</span>
                <div>
                  <Label htmlFor="tb-3-title" className="text-xs">Başlık</Label>
                  <Input
                    id="tb-3-title"
                    name="trustBadge3Title"
                    defaultValue={conversionSettings.trustBadge3Title}
                    className="mt-1 text-xs"
                  />
                </div>
                <div>
                  <Label htmlFor="tb-3-desc" className="text-xs">Açıklama</Label>
                  <Input
                    id="tb-3-desc"
                    name="trustBadge3Desc"
                    defaultValue={conversionSettings.trustBadge3Desc}
                    className="mt-1 text-xs"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-zinc-200 bg-white p-3 space-y-2">
                <span className="text-[11px] font-bold text-zinc-500 uppercase">4. Sütun: Güvenli Ödeme</span>
                <div>
                  <Label htmlFor="tb-4-title" className="text-xs">Başlık</Label>
                  <Input
                    id="tb-4-title"
                    name="trustBadge4Title"
                    defaultValue={conversionSettings.trustBadge4Title}
                    className="mt-1 text-xs"
                  />
                </div>
                <div>
                  <Label htmlFor="tb-4-desc" className="text-xs">Açıklama</Label>
                  <Input
                    id="tb-4-desc"
                    name="trustBadge4Desc"
                    defaultValue={conversionSettings.trustBadge4Desc}
                    className="mt-1 text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 3. CANLI SATIN ALMA BİLDİRİMİ */}
          <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-zinc-900">3. Canlı Satın Alma Bildirimi (Social Proof Toast)</h3>
                <p className="text-xs text-zinc-600">
                  Sol alt köşede gerçek zamanlı müşteri alımlarını göstererek sürü psikolojisi oluşturur.
                </p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="liveSalesToastEnabled"
                  defaultChecked={conversionSettings.liveSalesToastEnabled}
                  className="h-4 w-4 rounded border-zinc-300 text-zinc-900"
                />
                <span className="text-xs font-semibold text-zinc-900">Aktif</span>
              </label>
            </div>

            <div className="max-w-xs pt-2 border-t border-zinc-200/80">
              <Label htmlFor="lst-interval">Gösterim Periyodu (Saniye)</Label>
              <Input
                id="lst-interval"
                name="liveSalesToastIntervalSeconds"
                type="number"
                min={5}
                max={120}
                defaultValue={conversionSettings.liveSalesToastIntervalSeconds}
                className="mt-1 tabular-nums"
              />
              <p className="mt-1 text-[11px] text-zinc-500">Önerilen aralık: 15 ile 30 saniye arası.</p>
            </div>
          </div>

          {/* 4. SATIN ALMA PSİKOLOJİSİ VE ÜRÜN KARTI TETİKLEYİCİLERİ */}
          <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-5 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-zinc-900">4. Ürün Kartı Psikolojik Satış Tetikleyicileri</h3>
              <p className="text-xs text-zinc-600">
                Kıtlık uyarısı, hızlı aksiyon butonu ve kazanç pekiştirme rozetleri.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 pt-2 border-t border-zinc-200/80 sm:grid-cols-2">
              <label className="flex items-start gap-2.5 rounded-lg border border-zinc-200 bg-white p-3 text-xs">
                <input
                  type="checkbox"
                  name="scarcityWarningEnabled"
                  defaultChecked={conversionSettings.scarcityWarningEnabled}
                  className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-zinc-900"
                />
                <span>
                  <strong className="block text-zinc-900">Kıtlık Uyarısını Göster (⚡ Son X Adet!)</strong>
                  <span className="text-zinc-600">
                    Stok seviyesi kritik eşiğin altına indiğinde müşteriyi hızlı karar vermeye yönlendirir.
                  </span>
                </span>
              </label>

              <div className="rounded-lg border border-zinc-200 bg-white p-3">
                <Label htmlFor="sc-thresh" className="text-xs font-bold text-zinc-900">
                  Kritik Stok Uyarısı Eşiği (Adet)
                </Label>
                <Input
                  id="sc-thresh"
                  name="scarcityStockThreshold"
                  type="number"
                  min={1}
                  max={50}
                  defaultValue={conversionSettings.scarcityStockThreshold}
                  className="mt-1 text-xs tabular-nums"
                />
                <p className="mt-1 text-[11px] text-zinc-500">
                  Stok bu sayının altında olduğunda kartta uyarı görünür (Varsayılan: 5).
                </p>
              </div>

              <label className="flex items-start gap-2.5 rounded-lg border border-zinc-200 bg-white p-3 text-xs">
                <input
                  type="checkbox"
                  name="quickAddToCartEnabled"
                  defaultChecked={conversionSettings.quickAddToCartEnabled}
                  className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-zinc-900"
                />
                <span>
                  <strong className="block text-zinc-900">Hızlı Sepete Ekle Butonu</strong>
                  <span className="text-zinc-600">
                    Kartın üzerinde gezinildiğinde yukarı kayan anlık sepete ekleme butonu.
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-2.5 rounded-lg border border-zinc-200 bg-white p-3 text-xs">
                <input
                  type="checkbox"
                  name="showSavingsBadge"
                  defaultChecked={conversionSettings.showSavingsBadge}
                  className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-zinc-900"
                />
                <span>
                  <strong className="block text-zinc-900">Kazanç Rozetini Göster (Kazancınız: XX TL)</strong>
                  <span className="text-zinc-600">
                    İndirimli ürünlerde müşteriye elde ettiği tasarrufu açıkça vurgular.
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-2.5 rounded-lg border border-zinc-200 bg-white p-3 text-xs sm:col-span-2">
                <input
                  type="checkbox"
                  name="showReviewStars"
                  defaultChecked={conversionSettings.showReviewStars}
                  className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-zinc-900"
                />
                <span>
                  <strong className="block text-zinc-900">Sosyal Kanıt Puanı ve Yıldızları</strong>
                  <span className="text-zinc-600">
                    Kartın üst alanında müşteri değerlendirme puanını ve yıldızları görüntüler.
                  </span>
                </span>
              </label>
            </div>
          </div>

          <div className="flex justify-end border-t border-zinc-200 pt-4">
            <Button type="submit" variant="primary" disabled={!canManageSettings}>
              Dönüşüm ve Psikolojik Satış Ayarlarını Kaydet
            </Button>
          </div>
        </form>
      ) : null}

      {/* 3. ÖDEME AYARLARI */}
      {activeTab === "odeme" ? (
        <form
          action={savePaymentSettingsAction}
          className="space-y-6 rounded-md border border-zinc-200 bg-white p-6"
        >
          <div className="flex items-center gap-2 border-b border-zinc-200 pb-3">
            <CreditCard className="h-5 w-5 text-zinc-900" />
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">
                Ödeme Yöntemleri (iyzico, Havale / EFT ve Kapıda Ödeme)
              </h2>
              <p className="text-xs text-zinc-600">
                Ödeme sağlayıcı anahtarlarını, banka IBAN hesaplarını ve kapıda ödeme hizmet
                bedelini yapılandırın.
              </p>
            </div>
          </div>

          {/* IYZICO */}
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-xs font-semibold text-zinc-900">
              <input
                type="checkbox"
                name="iyzicoEnabled"
                defaultChecked={paymentSettings.iyzicoEnabled}
                className="h-4 w-4 rounded border-zinc-300 text-zinc-900"
              />
              Kredi / Banka Kartı ile Ödeme (iyzico) Aktif
            </label>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="pay-iyz-key">iyzico API Anahtarı (API Key)</Label>
                <Input
                  id="pay-iyz-key"
                  name="iyzicoApiKey"
                  defaultValue={paymentSettings.iyzicoApiKey}
                  placeholder="sandbox-..."
                  className="mt-1 font-mono"
                />
              </div>
              <div>
                <Label htmlFor="pay-iyz-sec">iyzico Gizli Anahtar (Secret Key)</Label>
                <Input
                  id="pay-iyz-sec"
                  name="iyzicoSecretKey"
                  type="password"
                  defaultValue={paymentSettings.iyzicoSecretKey}
                  placeholder="sandbox-..."
                  className="mt-1 font-mono"
                />
              </div>
              <div>
                <Label htmlFor="pay-iyz-url">iyzico Servis Adresi (Base URL)</Label>
                <Input
                  id="pay-iyz-url"
                  name="iyzicoBaseUrl"
                  defaultValue={paymentSettings.iyzicoBaseUrl}
                  className="mt-1 font-mono"
                />
              </div>
            </div>
          </div>

          {/* HAVALE / EFT */}
          <div className="space-y-4 border-t border-zinc-200 pt-5">
            <label className="flex items-center gap-2 text-xs font-semibold text-zinc-900">
              <input
                type="checkbox"
                name="bankTransferEnabled"
                defaultChecked={paymentSettings.bankTransferEnabled}
                className="h-4 w-4 rounded border-zinc-300 text-zinc-900"
              />
              Banka Havalesi / EFT ile Ödeme Aktif
            </label>

            <div className="space-y-3">
              <Label>Banka ve IBAN Hesapları (Boş bırakılan satırlar kaydedilmez)</Label>
              {[0, 1, 2].map((idx) => {
                const acc = paymentSettings.bankAccounts[idx];
                return (
                  <div
                    key={`bank-acc-${idx}`}
                    className="grid grid-cols-1 gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-3 sm:grid-cols-12"
                  >
                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-medium text-zinc-600">
                        Banka Adı #{idx + 1}
                      </label>
                      <Input
                        name="bankName"
                        defaultValue={acc?.bankName ?? ""}
                        placeholder="Örn: Ziraat Bankası"
                        className="mt-1 min-h-9 py-1 text-xs"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-medium text-zinc-600">
                        Alıcı Unvanı
                      </label>
                      <Input
                        name="accountHolder"
                        defaultValue={acc?.accountHolder ?? ""}
                        placeholder="Örn: Örnek Ticaret A.Ş."
                        className="mt-1 min-h-9 py-1 text-xs"
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <label className="block text-[11px] font-medium text-zinc-600">
                        IBAN Numarası
                      </label>
                      <Input
                        name="iban"
                        defaultValue={acc?.iban ?? ""}
                        placeholder="TR00 0000 0000 0000 0000 0000 00"
                        className="mt-1 min-h-9 py-1 font-mono text-xs"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-medium text-zinc-600">
                        Şube
                      </label>
                      <Input
                        name="branch"
                        defaultValue={acc?.branch ?? ""}
                        placeholder="Beyoğlu"
                        className="mt-1 min-h-9 py-1 text-xs"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div>
              <Label htmlFor="pay-bank-inst">Havale / EFT Açıklama Notu</Label>
              <Textarea
                id="pay-bank-inst"
                name="bankTransferInstructions"
                defaultValue={paymentSettings.bankTransferInstructions}
                className="mt-1 min-h-20"
              />
            </div>
          </div>

          {/* KAPIDA ÖDEME */}
          <div className="space-y-4 border-t border-zinc-200 pt-5">
            <label className="flex items-center gap-2 text-xs font-semibold text-zinc-900">
              <input
                type="checkbox"
                name="codEnabled"
                defaultChecked={paymentSettings.codEnabled}
                className="h-4 w-4 rounded border-zinc-300 text-zinc-900"
              />
              Kapıda Ödeme Seçeneği Aktif
            </label>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="pay-cod-fee">Kapıda Ödeme Hizmet Bedeli (TL)</Label>
                <Input
                  id="pay-cod-fee"
                  name="codFeeTl"
                  defaultValue={formatMoneyCompact(paymentSettings.codFeeMinor)}
                  className="mt-1 font-mono tabular-nums"
                />
                <p className="mt-1 text-[11px] text-zinc-600">
                  Mevcut: {formatMoney(paymentSettings.codFeeMinor)}
                </p>
              </div>
              <div>
                <Label htmlFor="pay-cod-max">Kapıda Ödeme Maksimum Sipariş Tutarı (TL)</Label>
                <Input
                  id="pay-cod-max"
                  name="codMaxOrderTl"
                  defaultValue={formatMoneyCompact(paymentSettings.codMaxOrderMinor)}
                  className="mt-1 font-mono tabular-nums"
                />
                <p className="mt-1 text-[11px] text-zinc-600">
                  Mevcut üst limit: {formatMoney(paymentSettings.codMaxOrderMinor)}
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end border-t border-zinc-200 pt-4">
            <Button type="submit" variant="primary" disabled={!canManageSettings}>
              Ödeme Ayarlarını Kaydet
            </Button>
          </div>
        </form>
      ) : null}

      {/* 3.1. E-FATURA VE E-ARŞİV ENTEGRASYONU */}
      {activeTab === "fatura" ? (
        <form
          action={handleSaveInvoiceSettings}
          className="space-y-6 rounded-md border border-zinc-200 bg-white p-6"
        >
          <div className="flex items-center gap-2 border-b border-zinc-200 pb-3">
            <Receipt className="h-5 w-5 text-zinc-900" />
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">
                e-Fatura ve e-Arşiv Entegrasyon Ayarları (GİB UBL-TR 1.2)
              </h2>
              <p className="text-xs text-zinc-600">
                Ödeme tamamlandığında otomatik fatura kesilmesini, seri numaralandırma kurallarını ve entegratör sağlayıcılarını yapılandırın.
              </p>
            </div>
          </div>

          {/* Otomatik Faturalandırma Kuralları */}
          <div className="space-y-3 rounded-md border border-zinc-200 bg-zinc-50/50 p-4">
            <div className="text-xs font-semibold text-zinc-900">Otomatik Fatura Tetikleyicileri</div>

            <label className="flex items-center gap-2 text-xs font-medium text-zinc-800">
              <input
                type="checkbox"
                name="enabled"
                defaultChecked={invoiceSettings.enabled}
                className="h-4 w-4 rounded border-zinc-300 text-zinc-900"
              />
              <span>e-Fatura ve e-Arşiv Motoru Aktif</span>
            </label>

            <label className="flex items-center gap-2 text-xs font-medium text-zinc-800">
              <input
                type="checkbox"
                name="autoInvoiceOnPaid"
                defaultChecked={invoiceSettings.autoInvoiceOnPaid}
                className="h-4 w-4 rounded border-zinc-300 text-zinc-900"
              />
              <span>Sipariş ödendiğinde (kredi kartı veya havale onayı) faturayı otomatik kes</span>
            </label>

            <label className="flex items-center gap-2 text-xs font-medium text-zinc-800">
              <input
                type="checkbox"
                name="autoSendEmailToCustomer"
                defaultChecked={invoiceSettings.autoSendEmailToCustomer}
                className="h-4 w-4 rounded border-zinc-300 text-zinc-900"
              />
              <span>Fatura kesildiğinde müşteriye otomatik bilgilendirme e-postası ilet</span>
            </label>
          </div>

          {/* Fatura Seri ve Numaralandırma */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="seriesPrefix">Fatura Seri Kodu (3 Harf)</Label>
              <Input
                id="seriesPrefix"
                name="seriesPrefix"
                maxLength={3}
                defaultValue={invoiceSettings.seriesPrefix}
                className="mt-1 font-mono uppercase text-xs"
                placeholder="Örn: VEZ"
              />
              <p className="mt-1 text-[11px] text-zinc-500">
                GİB 16 haneli seri formatı (Örn: {invoiceSettings.seriesPrefix}2026000000001).
              </p>
            </div>

            <div>
              <Label htmlFor="provider">Entegrasyon Sağlayıcısı</Label>
              <Select
                id="provider"
                name="provider"
                defaultValue={invoiceSettings.provider}
                className="mt-1 text-xs"
              >
                <option value="vezolla_einvoice">Vezolla Yerel e-Arşiv Motoru (Önerilen)</option>
                <option value="gib_portal">GİB 5000/30000 e-Arşiv Portal</option>
                <option value="parasut">Paraşüt API</option>
                <option value="uyumsoft">Uyumsoft e-Fatura</option>
                <option value="edm">EDM Bilişim</option>
              </Select>
            </div>

            <div className="flex flex-col justify-center">
              <label className="flex items-center gap-2 text-xs font-medium text-zinc-800 mt-5">
                <input
                  type="checkbox"
                  name="isTestMode"
                  defaultChecked={invoiceSettings.isTestMode}
                  className="h-4 w-4 rounded border-zinc-300 text-zinc-900"
                />
                <span>Test / Sandbox Modu (GİB Deneme Ortamı)</span>
              </label>
            </div>
          </div>

          {/* Şirket Vergi ve Fatura Bilgileri */}
          <div className="border-t border-zinc-200 pt-4 space-y-4">
            <div className="text-xs font-semibold text-zinc-900">Faturada Gözükecek Resmi Satıcı Bilgileri</div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="companySenderTitle">Firma Resmi Unvanı</Label>
                <Input
                  id="companySenderTitle"
                  name="companySenderTitle"
                  defaultValue={invoiceSettings.companySenderTitle}
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <Label htmlFor="companyTaxNumber">Vergi Kimlik Numarası (VKN)</Label>
                <Input
                  id="companyTaxNumber"
                  name="companyTaxNumber"
                  defaultValue={invoiceSettings.companyTaxNumber}
                  className="mt-1 font-mono text-xs"
                />
              </div>

              <div>
                <Label htmlFor="companyTaxOffice">Vergi Dairesi</Label>
                <Input
                  id="companyTaxOffice"
                  name="companyTaxOffice"
                  defaultValue={invoiceSettings.companyTaxOffice}
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <Label htmlFor="companyMersis">MERSİS Numarası</Label>
                <Input
                  id="companyMersis"
                  name="companyMersis"
                  defaultValue={invoiceSettings.companyMersis}
                  className="mt-1 font-mono text-xs"
                />
              </div>

              <div>
                <Label htmlFor="companyKepAddress">KEP Adresi</Label>
                <Input
                  id="companyKepAddress"
                  name="companyKepAddress"
                  defaultValue={invoiceSettings.companyKepAddress}
                  className="mt-1 font-mono text-xs"
                />
              </div>

              <div>
                <Label htmlFor="companyEmail">Muhasebe E-posta</Label>
                <Input
                  id="companyEmail"
                  name="companyEmail"
                  defaultValue={invoiceSettings.companyEmail}
                  className="mt-1 text-xs"
                />
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="companyAddress">Resmi Tebligat ve Fatura Adresi</Label>
                <Input
                  id="companyAddress"
                  name="companyAddress"
                  defaultValue={invoiceSettings.companyAddress}
                  className="mt-1 text-xs"
                />
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="defaultNotes">Fatura Varsayılan Alt Notu</Label>
                <Textarea
                  id="defaultNotes"
                  name="defaultNotes"
                  rows={2}
                  defaultValue={invoiceSettings.defaultNotes}
                  className="mt-1 text-xs"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end border-t border-zinc-200 pt-4">
            <Button type="submit" variant="primary" disabled={!canManageSettings}>
              e-Fatura Ayarlarını Kaydet
            </Button>
          </div>
        </form>
      ) : null}

      {/* 4. KARGO YÖNTEMLERİ YÖNETİMİ */}
      {activeTab === "kargo" ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-7">
            <h2 className="text-sm font-semibold text-zinc-900">
              Tanımlı Kargo Yöntemleri ({shippingMethods.length})
            </h2>

            {shippingMethods.length === 0 ? (
              <EmptyState
                title="Henüz kargo yöntemi eklenmemiş"
                description="Sağdaki formu kullanarak standart kargo, hızlı teslimat veya ücretsiz kargo barajlı gönderim yöntemi ekleyin."
              />
            ) : (
              <div className="overflow-x-auto rounded-md border border-zinc-200 bg-white">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50 text-[11px] font-semibold uppercase text-zinc-600">
                      <th className="px-3.5 py-2.5">Kargo Yöntemi ve Taşıyıcı</th>
                      <th className="px-3.5 py-2.5 text-right">Ücret</th>
                      <th className="px-3.5 py-2.5 text-right">Ücretsiz Barajı</th>
                      <th className="px-3.5 py-2.5">Teslimat / İller</th>
                      <th className="px-3.5 py-2.5 text-right">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {shippingMethods.map((sm) => (
                      <tr key={sm.id} className="align-top hover:bg-zinc-50">
                        <td className="px-3.5 py-3">
                          <div className="font-semibold text-zinc-900">{sm.name}</div>
                          {sm.description ? (
                            <div className="text-[11px] text-zinc-600">{sm.description}</div>
                          ) : null}
                          {sm.carrier ? (
                            <div className="mt-1 font-mono text-[11px] text-zinc-600">
                              Firma: {sm.carrier}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-3.5 py-3 text-right font-mono font-semibold tabular-nums text-zinc-900">
                          {sm.price === 0 ? "Ücretsiz" : formatMoney(sm.price)}
                        </td>
                        <td className="px-3.5 py-3 text-right font-mono tabular-nums text-zinc-700">
                          {sm.freeOverAmount ? formatMoney(sm.freeOverAmount) : "Yok"}
                        </td>
                        <td className="px-3.5 py-3 text-[11px] text-zinc-700">
                          <div>{sm.estimatedDays ?? "1-3 iş günü"}</div>
                          <div className="text-zinc-500">
                            {sm.cities.length > 0 ? sm.cities.join(", ") : "Tüm Türkiye"}
                          </div>
                        </td>
                        <td className="px-3.5 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <form action={toggleShippingMethodAction}>
                              <input type="hidden" name="id" value={sm.id} />
                              <input
                                type="hidden"
                                name="isActive"
                                value={sm.isActive ? "false" : "true"}
                              />
                              <button
                                type="submit"
                                className="rounded border border-zinc-300 bg-white px-2 py-1 text-[11px] font-medium text-zinc-800 hover:bg-zinc-100"
                              >
                                {sm.isActive ? "Aktif" : "Pasif"}
                              </button>
                            </form>
                            <form action={deleteShippingMethodAction}>
                              <input type="hidden" name="id" value={sm.id} />
                              <button
                                type="submit"
                                aria-label={`${sm.name} kargo yöntemini sil`}
                                className="inline-flex h-7 w-7 items-center justify-center rounded border border-red-200 bg-red-50 text-red-800 hover:bg-red-100"
                              >
                                <Trash className="h-3.5 w-3.5" />
                              </button>
                            </form>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="lg:col-span-5">
            <form
              action={saveShippingMethodAction}
              className="space-y-4 rounded-md border border-zinc-200 bg-white p-5"
            >
              <div className="flex items-center gap-2 border-b border-zinc-200 pb-3">
                <Truck className="h-4 w-4 text-zinc-900" />
                <h3 className="text-sm font-semibold text-zinc-900">
                  Kargo Yöntemi Ekle / Güncelle
                </h3>
              </div>

              <div>
                <Label htmlFor="ship-name">Kargo Yöntemi Adı</Label>
                <Input
                  id="ship-name"
                  name="name"
                  required
                  placeholder="Örn: Standart Yurtiçi Kargo"
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="ship-carrier">Kargo Firması Kodu</Label>
                  <Select id="ship-carrier" name="carrier" defaultValue="yurtici" className="mt-1">
                    <option value="yurtici">Yurtiçi Kargo (yurtici)</option>
                    <option value="aras">Aras Kargo (aras)</option>
                    <option value="mng">MNG / DHL eCommerce (mng)</option>
                    <option value="surat">Sürat Kargo (surat)</option>
                    <option value="ptt">PTT Kargo (ptt)</option>
                    <option value="hepsijet">hepsiJET (hepsijet)</option>
                    <option value="kolaygelsin">Kolay Gelsin (kolaygelsin)</option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="ship-est">Tahmini Teslimat Süresi</Label>
                  <Input
                    id="ship-est"
                    name="estimatedDays"
                    defaultValue="1-3 iş günü"
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="ship-price">Kargo Ücreti (TL)</Label>
                  <Input
                    id="ship-price"
                    name="priceTl"
                    defaultValue="79,90"
                    className="mt-1 font-mono tabular-nums"
                  />
                </div>
                <div>
                  <Label htmlFor="ship-free">Ücretsiz Kargo Sepet Barajı (TL)</Label>
                  <Input
                    id="ship-free"
                    name="freeOverTl"
                    defaultValue="1500,00"
                    placeholder="Boşsa ücretsiz barajı yok"
                    className="mt-1 font-mono tabular-nums"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="ship-cities">Geçerli İller (Boşsa Tüm İller)</Label>
                <Input
                  id="ship-cities"
                  name="cities"
                  placeholder="Örn: İstanbul, Ankara, İzmir"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="ship-desc">Açıklama</Label>
                <Input
                  id="ship-desc"
                  name="description"
                  placeholder="Saat 15:00'e kadar verilen siparişler aynı gün kargoda"
                  className="mt-1"
                />
              </div>

              <Button type="submit" variant="primary" disabled={!canManageSettings} className="w-full">
                <Plus className="h-4 w-4" />
                Kargo Yöntemini Kaydet
              </Button>
            </form>
          </div>
        </div>
      ) : null}

      {/* 5. SEO VARSAYILANLARI */}
      {activeTab === "seo" ? (
        <form
          action={saveSeoSettingsAction}
          className="space-y-5 rounded-md border border-zinc-200 bg-white p-6"
        >
          <div className="flex items-center gap-2 border-b border-zinc-200 pb-3">
            <Globe className="h-5 w-5 text-zinc-900" />
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">SEO Varsayılanları</h2>
              <p className="text-xs text-zinc-600">
                Arama motoru başlık şablonunu, meta açıklamasını, OpenGraph görselini ve robots.txt
                kurallarını yönetin.
              </p>
            </div>
          </div>

          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-zinc-900">Kapsamlı SEO, GEO ve İstatistik Merkezi</div>
              <p className="text-xs text-zinc-600">
                Canlı SERP simülatörü, Generative Engine (AI arama ve llms.txt) optimizasyonu, anahtar kelime sıralama takibi, arama istatistikleri ve bot tarama günlüklerini tek merkezden yönetin.
              </p>
            </div>
            <Link
              href="/admin/seo-geo"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-900 bg-white border border-zinc-200 rounded-md hover:bg-zinc-100 transition shrink-0"
            >
              SEO &amp; GEO Merkezine Git &rarr;
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="seo-title">Varsayılan Site Başlığı</Label>
              <Input
                id="seo-title"
                name="defaultTitle"
                defaultValue={seoSettings.defaultTitle}
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="seo-tpl">Başlık Şablonu (%s sayfa başlığıyla değişir)</Label>
              <Input
                id="seo-tpl"
                name="titleTemplate"
                defaultValue={seoSettings.titleTemplate}
                required
                className="mt-1 font-mono"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="seo-desc">Varsayılan Meta Açıklaması (Description)</Label>
            <Textarea
              id="seo-desc"
              name="defaultDescription"
              defaultValue={seoSettings.defaultDescription}
              className="mt-1 min-h-20"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="seo-og">Varsayılan OpenGraph Görsel URL</Label>
              <Input
                id="seo-og"
                name="ogImageUrl"
                defaultValue={seoSettings.ogImageUrl}
                placeholder="/uploads/og-default.jpg"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="seo-robots">
                robots.txt Engellenen Dizinler (Virgül veya satırla ayırın)
              </Label>
              <Input
                id="seo-robots"
                name="robotsDisallowPaths"
                defaultValue={seoSettings.robotsDisallowPaths.join(", ")}
                className="mt-1 font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end border-t border-zinc-200 pt-4">
            <Button type="submit" variant="primary" disabled={!canManageSettings}>
              SEO Ayarlarını Kaydet
            </Button>
          </div>
        </form>
      ) : null}

      {/* 6. E-POSTA ŞABLONLARI VE GİDEN KUTUSU */}
      {activeTab === "eposta" ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="space-y-4 lg:col-span-7">
              <h2 className="text-sm font-semibold text-zinc-900">
                İşlemsel E-posta Şablonları ({mergedTemplates.length})
              </h2>

              <div className="space-y-4">
                {mergedTemplates.map((tpl) => (
                  <form
                    key={tpl.key}
                    action={saveEmailTemplateAction}
                    className="space-y-3 rounded-md border border-zinc-200 bg-white p-4"
                  >
                    <input type="hidden" name="key" value={tpl.key} />
                    <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
                      <div>
                        <span className="text-xs font-semibold text-zinc-900">{tpl.name}</span>
                        <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] text-zinc-700">
                          {tpl.key}
                        </span>
                      </div>
                      <label className="flex items-center gap-1.5 text-xs text-zinc-700">
                        <input
                          type="checkbox"
                          name="isActive"
                          value="true"
                          defaultChecked={tpl.isActive}
                          className="h-4 w-4 rounded border-zinc-300"
                        />
                        Aktif
                      </label>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <Label>Şablon Adı</Label>
                        <Input name="name" defaultValue={tpl.name} className="mt-1 text-xs" />
                      </div>
                      <div>
                        <Label>E-posta Konusu (Değişkenler: {"{{orderNumber}}"})</Label>
                        <Input name="subject" defaultValue={tpl.subject} className="mt-1 text-xs" />
                      </div>
                    </div>

                    <div>
                      <Label>HTML Gövde</Label>
                      <Textarea
                        name="bodyHtml"
                        defaultValue={tpl.bodyHtml}
                        className="mt-1 min-h-28 font-mono text-xs"
                      />
                    </div>

                    <div className="flex justify-end">
                      <Button type="submit" variant="primary" size="sm">
                        Şablonu Kaydet
                      </Button>
                    </div>
                  </form>
                ))}
              </div>
            </div>

            <div className="space-y-4 lg:col-span-5">
              <form
                action={sendTestEmailAction}
                className="space-y-3 rounded-md border border-zinc-200 bg-white p-4"
              >
                <div className="flex items-center gap-2 border-b border-zinc-200 pb-2">
                  <EnvelopeSimple className="h-4 w-4 text-zinc-900" />
                  <h3 className="text-sm font-semibold text-zinc-900">
                    Örnek Değişkenlerle Test E-postası Gönder
                  </h3>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="test-tpl">Şablon</Label>
                    <Select id="test-tpl" name="templateKey" defaultValue="order_placed" className="mt-1">
                      {mergedTemplates.map((t) => (
                        <option key={t.key} value={t.key}>
                          {t.name} ({t.key})
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="test-to">Alıcı E-posta</Label>
                    <Input
                      id="test-to"
                      name="to"
                      type="email"
                      defaultValue={staff.email}
                      className="mt-1"
                    />
                  </div>
                </div>
                <Button type="submit" variant="outline" size="sm" className="w-full">
                  Test E-postası Oluştur / Gönder
                </Button>
              </form>

              <div className="rounded-md border border-zinc-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-zinc-900">
                  E-posta Giden Kutusu (EmailMessage: Son {emailMessages.length})
                </h3>
                {emailMessages.length === 0 ? (
                  <p className="mt-2 text-xs text-zinc-600">
                    Henüz gönderilmiş veya kaydedilmiş bir e-posta iletisi yok.
                  </p>
                ) : (
                  <div className="mt-3 max-h-96 divide-y divide-zinc-200 overflow-y-auto text-xs">
                    {emailMessages.map((msg) => (
                      <div key={msg.id} className="py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-zinc-900">{msg.subject}</span>
                          <Badge
                            variant={
                              msg.status === "SENT"
                                ? "success"
                                : msg.status === "FAILED"
                                  ? "danger"
                                  : "neutral"
                            }
                          >
                            {msg.status}
                          </Badge>
                        </div>
                        <div className="mt-1 flex items-center justify-between text-[11px] text-zinc-600 tabular-nums">
                          <span>Alıcı: {msg.to}</span>
                          <span>{format(msg.createdAt, "dd MMM yyyy HH:mm", { locale: tr })}</span>
                        </div>
                        {msg.error ? (
                          <p className="mt-1 text-[11px] text-red-700">{msg.error}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* 7. PERSONEL HESAPLARI VE ROL / İZİN MATRİSİ */}
      {activeTab === "personel" ? (
        <div className="space-y-8">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="space-y-4 lg:col-span-7">
              <h2 className="text-sm font-semibold text-zinc-900">
                Personel Hesapları ({staffUsers.length})
              </h2>

              <div className="overflow-x-auto rounded-md border border-zinc-200 bg-white">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50 text-[11px] font-semibold uppercase text-zinc-600">
                      <th className="px-3.5 py-2.5">Ad Soyad ve E-posta</th>
                      <th className="px-3.5 py-2.5">Rol</th>
                      <th className="px-3.5 py-2.5">Son Giriş</th>
                      <th className="px-3.5 py-2.5">Durum</th>
                      <th className="px-3.5 py-2.5 text-right">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {staffUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-zinc-50">
                        <td className="px-3.5 py-3">
                          <div className="font-semibold text-zinc-900">{u.name}</div>
                          <div className="font-mono text-[11px] text-zinc-600">{u.email}</div>
                        </td>
                        <td className="px-3.5 py-3">
                          <Badge variant={u.isOwner ? "accent" : "neutral"}>
                            {u.isOwner ? "Mağaza Sahibi (Tüm Yetkiler)" : u.role.name}
                          </Badge>
                        </td>
                        <td className="px-3.5 py-3 font-mono text-[11px] tabular-nums text-zinc-600">
                          {u.lastLoginAt
                            ? format(u.lastLoginAt, "dd MMM yyyy HH:mm", { locale: tr })
                            : "Henüz giriş yok"}
                        </td>
                        <td className="px-3.5 py-3">
                          <Badge variant={u.isActive ? "success" : "danger"}>
                            {u.isActive ? "Aktif" : "Pasif"}
                          </Badge>
                        </td>
                        <td className="px-3.5 py-3 text-right">
                          {!u.isOwner && u.id !== staff.id && canManageStaff ? (
                            <form action={deleteStaffUserAction} className="inline">
                              <input type="hidden" name="id" value={u.id} />
                              <button
                                type="submit"
                                aria-label={`${u.email} personelini sil`}
                                className="inline-flex h-7 w-7 items-center justify-center rounded border border-red-200 bg-red-50 text-red-800 hover:bg-red-100"
                              >
                                <Trash className="h-3.5 w-3.5" />
                              </button>
                            </form>
                          ) : (
                            <span className="text-[11px] text-zinc-500">Korunuyor</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="lg:col-span-5">
              <form
                action={saveStaffUserAction}
                className="space-y-4 rounded-md border border-zinc-200 bg-white p-5"
              >
                <div className="flex items-center gap-2 border-b border-zinc-200 pb-3">
                  <UsersThree className="h-4 w-4 text-zinc-900" />
                  <h3 className="text-sm font-semibold text-zinc-900">
                    Yeni Personel Hesabı Oluştur
                  </h3>
                </div>

                <div>
                  <Label htmlFor="stf-name">Ad Soyad</Label>
                  <Input
                    id="stf-name"
                    name="name"
                    required
                    placeholder="Örn: Deniz Kaya"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="stf-email">E-posta Adresi</Label>
                  <Input
                    id="stf-email"
                    name="email"
                    type="email"
                    required
                    placeholder="deniz@magaza.local"
                    className="mt-1"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="stf-role">Atanacak Rol</Label>
                    <Select id="stf-role" name="roleId" required className="mt-1">
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="stf-pass">Geçici Şifre (En az 6 karakter)</Label>
                    <Input
                      id="stf-pass"
                      name="password"
                      type="password"
                      required
                      minLength={6}
                      className="mt-1"
                    />
                  </div>
                </div>

                <Button type="submit" variant="primary" disabled={!canManageStaff} className="w-full">
                  <Plus className="h-4 w-4" />
                  Personel Hesabını Ekle
                </Button>
              </form>
            </div>
          </div>

          {/* ROL VE İZİN MATRİSİ */}
          <div className="space-y-4 border-t border-zinc-200 pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900">
                  Rol ve İzin Matrisi (RBAC)
                </h2>
                <p className="text-xs text-zinc-600">
                  Her rolün sahip olduğu modül yetkilerini düzenleyin veya yeni bir operasyon rolü
                  tanımlayın.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {roles.map((role) => {
                const hasWildcard = role.permissions.includes("*");
                return (
                  <form
                    key={role.id}
                    action={saveRoleAction}
                    className="space-y-4 rounded-md border border-zinc-200 bg-white p-5"
                  >
                    <input type="hidden" name="id" value={role.id} />
                    <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-zinc-900">{role.name}</span>
                          {role.isSystem ? <Badge variant="neutral">Sistem Rolü</Badge> : null}
                        </div>
                        <p className="text-xs text-zinc-600">
                          Atanmış personel: {role._count.users}
                        </p>
                      </div>
                      {!role.isSystem && role._count.users === 0 && canManageStaff ? (
                        <button
                          type="submit"
                          formAction={deleteRoleAction}
                          className="rounded border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-800 hover:bg-red-100"
                        >
                          Rolü Sil
                        </button>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <Label>Rol Adı</Label>
                        <Input
                          name="name"
                          defaultValue={role.name}
                          readOnly={role.isSystem}
                          className="mt-1 text-xs"
                        />
                      </div>
                      <div>
                        <Label>Açıklama</Label>
                        <Input
                          name="description"
                          defaultValue={role.description ?? ""}
                          className="mt-1 text-xs"
                        />
                      </div>
                    </div>

                    <div className="max-h-60 space-y-3 overflow-y-auto rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs">
                      {permissionGroups.map((grp) => (
                        <div key={`${role.id}-${grp}`}>
                          <div className="font-semibold text-zinc-900">{grp}</div>
                          <div className="mt-1 space-y-1">
                            {PERMISSIONS.filter((p) => p.group === grp).map((perm) => (
                              <label
                                key={`${role.id}-${perm.key}`}
                                className="flex cursor-pointer items-center gap-2 text-zinc-700"
                              >
                                <input
                                  type="checkbox"
                                  name="permissions"
                                  value={perm.key}
                                  defaultChecked={
                                    hasWildcard || role.permissions.includes(perm.key)
                                  }
                                  className="h-3.5 w-3.5 rounded border-zinc-300 text-zinc-900"
                                />
                                <span className="font-mono text-[11px] text-zinc-900">
                                  {perm.key}
                                </span>
                                <span className="text-[11px] text-zinc-600">({perm.label})</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-end">
                      <Button type="submit" variant="primary" size="sm" disabled={!canManageStaff}>
                        Rol Yetkilerini Güncelle
                      </Button>
                    </div>
                  </form>
                );
              })}

              {/* YENİ ROL EKLE */}
              <form
                action={saveRoleAction}
                className="space-y-4 rounded-md border border-dashed border-zinc-300 bg-white p-5"
              >
                <div className="border-b border-zinc-200 pb-3">
                  <h3 className="text-sm font-semibold text-zinc-900">Yeni Rol Tanımla</h3>
                  <p className="text-xs text-zinc-600">
                    Depo sorumlusu, katalog editörü veya pazarlama uzmanı gibi özel yetki grupları
                    oluşturun.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="new-role-name">Rol Adı</Label>
                    <Input
                      id="new-role-name"
                      name="name"
                      required
                      placeholder="Örn: Pazarlama ve Vitrin Uzmanı"
                      className="mt-1 text-xs"
                    />
                  </div>
                  <div>
                    <Label htmlFor="new-role-desc">Açıklama</Label>
                    <Input
                      id="new-role-desc"
                      name="description"
                      placeholder="Kampanya, kişiselleştirme ve içerik yönetimi"
                      className="mt-1 text-xs"
                    />
                  </div>
                </div>

                <div className="max-h-60 space-y-3 overflow-y-auto rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs">
                  {permissionGroups.map((grp) => (
                    <div key={`new-${grp}`}>
                      <div className="font-semibold text-zinc-900">{grp}</div>
                      <div className="mt-1 space-y-1">
                        {PERMISSIONS.filter((p) => p.group === grp).map((perm) => (
                          <label
                            key={`new-${perm.key}`}
                            className="flex cursor-pointer items-center gap-2 text-zinc-700"
                          >
                            <input
                              type="checkbox"
                              name="permissions"
                              value={perm.key}
                              className="h-3.5 w-3.5 rounded border-zinc-300 text-zinc-900"
                            />
                            <span className="font-mono text-[11px] text-zinc-900">{perm.key}</span>
                            <span className="text-[11px] text-zinc-600">({perm.label})</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <Button type="submit" variant="primary" size="sm" disabled={!canManageStaff} className="w-full">
                  <Plus className="h-4 w-4" />
                  Yeni Rolü Oluştur
                </Button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
