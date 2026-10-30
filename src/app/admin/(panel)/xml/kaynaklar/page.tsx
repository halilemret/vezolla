"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileCode,
  Plus,
  Copy,
  Check,
  DownloadSimple,
  ArrowSquareOut,
  Play,
  Eye,
  Trash,
  SlidersHorizontal,
  ArrowsClockwise,
  CloudArrowUp,
  LinkSimple,
  Rss,
} from "@phosphor-icons/react";
import {
  createExportFeedAction,
  createFeedSourceAction,
  deleteExportFeedAction,
  deleteFeedSourceAction,
  loadXmlSourcesDashboardAction,
  toggleExportFeedActiveAction,
  triggerFeedRunAction,
  type XmlDashboardDataDto,
} from "@/modules/xml/actions";
import {
  DEFAULT_CUSTOM_EXPORT_TEMPLATE,
  type CustomExportTemplate,
} from "@/modules/xml/schemas";

export default function AdminXmlSourcesPage() {
  const router = useRouter();
  const [data, setData] = React.useState<XmlDashboardDataDto | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [feedback, setFeedback] = React.useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);

  // Yeni Tedarikçi XML Kaynağı Form Durumu
  const [showNewSourceForm, setShowNewSourceForm] = React.useState(false);
  const [sourceName, setSourceName] = React.useState("");
  const [sourceKind, setSourceKind] = React.useState<"URL" | "FILE">("URL");
  const [sourceUrl, setSourceUrl] = React.useState("");
  const [authType, setAuthType] = React.useState<"none" | "basic" | "header">(
    "none"
  );
  const [authUser, setAuthUser] = React.useState("");
  const [authPassword, setAuthPassword] = React.useState("");
  const [headersText, setHeadersText] = React.useState("");
  const [warehouseId, setWarehouseId] = React.useState("");
  const [createAsStatus, setCreateAsStatus] = React.useState<
    "DRAFT" | "ACTIVE"
  >("DRAFT");
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [submittingSource, setSubmittingSource] = React.useState(false);

  // Hızlı çalıştırma durumu
  const [runningSourceId, setRunningSourceId] = React.useState<string | null>(
    null
  );

  // Yeni Dışa Aktarma Feed Form Durumu
  const [showNewExportForm, setShowNewExportForm] = React.useState(false);
  const [exportName, setExportName] = React.useState("");
  const [exportFormat, setExportFormat] = React.useState<
    "GOOGLE" | "META" | "CUSTOM"
  >("GOOGLE");
  const [inStockOnly, setInStockOnly] = React.useState(true);
  const [selectedCategoryIds, setSelectedCategoryIds] = React.useState<
    string[]
  >([]);
  const [selectedBrandIds, setSelectedBrandIds] = React.useState<string[]>([]);
  const [selectedCollectionIds, setSelectedCollectionIds] = React.useState<
    string[]
  >([]);
  const [customTemplate, setCustomTemplate] =
    React.useState<CustomExportTemplate>(DEFAULT_CUSTOM_EXPORT_TEMPLATE);
  const [submittingExport, setSubmittingExport] = React.useState(false);

  const refreshData = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await loadXmlSourcesDashboardAction();
      setData(res);
      if (!warehouseId && res.warehouses[0]) {
        setWarehouseId(res.warehouses[0].id);
      }
    } catch (err) {
      setFeedback({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "XML entegrasyon verileri yüklenemedi.",
      });
    } finally {
      setLoading(false);
    }
  }, [warehouseId]);

  React.useEffect(() => {
    void refreshData();
  }, [refreshData]);

  const copyText = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => {
        setCopiedKey((prev) => (prev === key ? null : prev));
      }, 2000);
    } catch {
      setFeedback({
        type: "error",
        text: "Panoya kopyalama başarısız oldu.",
      });
    }
  };

  const sampleXmlUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/admin/xml/sample`
      : "http://localhost:3000/api/admin/xml/sample";

  const handlePrefillSampleSource = () => {
    setShowNewSourceForm(true);
    setSourceKind("URL");
    setSourceName("Anadolu Tekstil Örnek Tedarikçi XML");
    setSourceUrl(sampleXmlUrl);
    setAuthType("none");
    setFeedback({
      type: "success",
      text: "Örnek tedarikçi XML adresi forma dolduruldu. Kaydedip eşleştirme sihirbazına geçebilirsiniz.",
    });
  };

  const handleCreateSource = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmittingSource(true);
    setFeedback(null);

    try {
      const fd = new FormData();
      fd.set("name", sourceName);
      fd.set("kind", sourceKind);
      fd.set("url", sourceUrl);
      fd.set("authType", authType);
      fd.set("authUser", authUser);
      fd.set("authPassword", authPassword);
      fd.set("headersText", headersText);
      fd.set("warehouseId", warehouseId);
      fd.set("createAsStatus", createAsStatus);
      if (sourceKind === "FILE" && selectedFile) {
        fd.set("xmlFile", selectedFile);
      }

      const res = await createFeedSourceAction(fd);
      if (!res.ok || !res.id) {
        setFeedback({
          type: "error",
          text: res.error ?? "XML kaynağı oluşturulamadı.",
        });
        return;
      }

      router.push(`/admin/xml/kaynaklar/${res.id}`);
    } finally {
      setSubmittingSource(false);
    }
  };

  const handleQuickRun = async (
    sourceId: string,
    mode: "PREVIEW" | "APPLY"
  ) => {
    setRunningSourceId(sourceId);
    setFeedback(null);
    try {
      const res = await triggerFeedRunAction(sourceId, mode);
      if (!res.ok || !res.result) {
        setFeedback({
          type: "error",
          text: res.error ?? "Senkronizasyon çalıştırılamadı.",
        });
      } else {
        const s = res.result.stats;
        setFeedback({
          type: "success",
          text:
            mode === "PREVIEW"
              ? `Önizleme tamamlandı: ${s.total} ürün okundu (${s.created} yeni, ${s.updated} güncellenecek, ${s.unchanged} aynı, ${s.skipped} atlandı).`
              : `Aktarım tamamlandı: ${s.created} yeni ürün oluşturuldu, ${s.updated} ürün güncellendi.`,
        });
        await refreshData();
      }
    } finally {
      setRunningSourceId(null);
    }
  };

  const handleDeleteSource = async (sourceId: string, name: string) => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `"${name}" XML kaynağını silmek istediğinize emin misiniz? İçeri aktarılmış ürünler silinmez, yalnızca kaynak bağlantısı kaldırılır.`
      )
    ) {
      return;
    }
    const res = await deleteFeedSourceAction(sourceId);
    if (!res.ok) {
      setFeedback({
        type: "error",
        text: res.error ?? "Kaynak silinemedi.",
      });
      return;
    }
    setFeedback({
      type: "success",
      text: `"${name}" kaynağı silindi.`,
    });
    await refreshData();
  };

  const handleCreateExportFeed = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    setSubmittingExport(true);
    setFeedback(null);

    try {
      const res = await createExportFeedAction({
        name: exportName,
        format: exportFormat,
        filters: {
          categoryIds: selectedCategoryIds,
          brandIds: selectedBrandIds,
          collectionIds: selectedCollectionIds,
          inStockOnly,
        },
        template: exportFormat === "CUSTOM" ? customTemplate : undefined,
      });

      if (!res.ok) {
        setFeedback({
          type: "error",
          text: res.error ?? "Dışa aktarma beslemesi oluşturulamadı.",
        });
        return;
      }

      setExportName("");
      setShowNewExportForm(false);
      setFeedback({
        type: "success",
        text: "Dışa aktarma XML beslemesi oluşturuldu.",
      });
      await refreshData();
    } finally {
      setSubmittingExport(false);
    }
  };

  const handleToggleExportFeed = async (feedId: string, nextState: boolean) => {
    const res = await toggleExportFeedActiveAction(feedId, nextState);
    if (!res.ok) {
      setFeedback({
        type: "error",
        text: res.error ?? "Durum güncellenemedi.",
      });
      return;
    }
    await refreshData();
  };

  const handleDeleteExportFeed = async (feedId: string, name: string) => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(`"${name}" dışa aktarma beslemesini silmek istiyor musunuz?`)
    ) {
      return;
    }
    const res = await deleteExportFeedAction(feedId);
    if (!res.ok) {
      setFeedback({
        type: "error",
        text: res.error ?? "Dışa aktarma beslemesi silinemedi.",
      });
      return;
    }
    setFeedback({
      type: "success",
      text: `"${name}" dışa aktarma beslemesi silindi.`,
    });
    await refreshData();
  };

  const toggleIdInList = (
    list: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>,
    id: string
  ) => {
    if (list.includes(id)) {
      setList(list.filter((item) => item !== id));
    } else {
      setList([...list, id]);
    }
  };

  return (
    <div className="space-y-8">
      {/* Üst Başlık */}
      <div className="flex flex-col justify-between gap-4 border-b border-zinc-200 pb-5 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <FileCode className="h-5 w-5 text-[#9a3412]" />
            <h1 className="text-xl font-bold tracking-tight text-zinc-900">
              XML Entegrasyon Merkezi
            </h1>
          </div>
          <p className="mt-1 text-xs text-zinc-600">
            Tedarikçi XML kaynaklarından ürün, varyant, fiyat ve stok senkronizasyonu yapın; Google, Meta ve pazaryerleri için canlı XML beslemeleri üretin.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowNewSourceForm((prev) => !prev)}
            className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
          >
            <Plus className="h-4 w-4" />
            <span>Yeni Tedarikçi XML Ekle</span>
          </button>
          <button
            type="button"
            onClick={() => setShowNewExportForm((prev) => !prev)}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-100"
          >
            <Rss className="h-4 w-4 text-[#9a3412]" />
            <span>Yeni Dışa Aktarma Feed</span>
          </button>
        </div>
      </div>

      {/* Örnek Tedarikçi XML Hızlı Deneme Çubuğu */}
      <div className="rounded-md border border-zinc-200 bg-white p-4">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="rounded bg-[#ffedd5] px-2 py-0.5 text-[11px] font-semibold text-[#9a3412]">
                Hazır Test Kaynağı
              </span>
              <h2 className="text-sm font-semibold text-zinc-900">
                Örnek Tedarikçi XML Beslemesi (Çok Varyantlı, CDATA Açıklamalı, Özel Alanlı)
              </h2>
            </div>
            <p className="text-xs text-zinc-600">
              İçe aktarma sihirbazını hemen denemek için aşağıdaki canlı örnek XML adresini kopyalayabilir, tek tıkla forma doldurabilir veya bilgisayarınıza indirip dosya olarak yükleyebilirsiniz.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded border border-zinc-200 bg-[#fafaf9] px-2.5 py-1.5 font-mono text-xs text-zinc-800">
              /api/admin/xml/sample
            </code>
            <button
              type="button"
              onClick={() => void copyText("sample-url", sampleXmlUrl)}
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-100"
            >
              {copiedKey === "sample-url" ? (
                <>
                  <Check className="h-3.5 w-3.5 text-[#166534]" />
                  <span>Kopyalandı</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>URL Kopyala</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handlePrefillSampleSource}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#9a3412] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#7c2d12]"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Örnek XML ile Kaynak Oluştur</span>
            </button>
            <a
              href="/api/admin/xml/sample?indir=1"
              download="ornek-tedarikci-urunler.xml"
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-100"
            >
              <DownloadSimple className="h-3.5 w-3.5" />
              <span>Örnek XML İndir</span>
            </a>
          </div>
        </div>
      </div>

      {/* Bildirim */}
      {feedback ? (
        <div
          className={`rounded-md border px-4 py-3 text-xs font-medium ${
            feedback.type === "success"
              ? "border-[#bbf7d0] bg-[#dcfce7] text-[#166534]"
              : "border-[#fecaca] bg-[#fee2e2] text-[#991b1b]"
          }`}
        >
          {feedback.text}
        </div>
      ) : null}

      {/* Yeni Tedarikçi XML Kaynağı Ekleme Formu */}
      {showNewSourceForm ? (
        <form
          onSubmit={(e) => void handleCreateSource(e)}
          className="space-y-4 rounded-md border border-zinc-300 bg-white p-5"
        >
          <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
            <div>
              <h2 className="text-sm font-bold text-zinc-900">
                Yeni Tedarikçi XML Kaynağı Tanımla
              </h2>
              <p className="text-xs text-zinc-600">
                Kaynağı kaydettiğinizde XML yapısı otomatik analiz edilir ve adım adım alan eşleştirme sihirbazı açılır.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowNewSourceForm(false)}
              className="text-xs font-medium text-zinc-600 hover:text-zinc-900"
            >
              Kapat
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-800">
                Tedarikçi / Kaynak Adı
              </label>
              <input
                type="text"
                required
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
                placeholder="Örn: Anadolu Tekstil Bayi XML"
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-800">
                Okuma Yöntemi
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSourceKind("URL")}
                  className={`flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium ${
                    sourceKind === "URL"
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50"
                  }`}
                >
                  <LinkSimple className="h-3.5 w-3.5" />
                  <span>Canlı URL</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSourceKind("FILE")}
                  className={`flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium ${
                    sourceKind === "FILE"
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50"
                  }`}
                >
                  <CloudArrowUp className="h-3.5 w-3.5" />
                  <span>Dosya Yükle</span>
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-800">
                Hedef Depo ve İlk Ürün Durumu
              </label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                  className="rounded-md border border-zinc-300 bg-white px-2.5 py-2 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-none"
                >
                  <option value="">Varsayılan Depo</option>
                  {data?.warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </option>
                  ))}
                </select>
                <select
                  value={createAsStatus}
                  onChange={(e) =>
                    setCreateAsStatus(
                      e.target.value === "ACTIVE" ? "ACTIVE" : "DRAFT"
                    )
                  }
                  className="rounded-md border border-zinc-300 bg-white px-2.5 py-2 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-none"
                >
                  <option value="DRAFT">Yeni Ürünler: Taslak</option>
                  <option value="ACTIVE">Yeni Ürünler: Yayında</option>
                </select>
              </div>
            </div>
          </div>

          {sourceKind === "URL" ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-zinc-800">
                  XML Bağlantı Adresi (.xml, .xml.gz veya .zip)
                </label>
                <input
                  type="text"
                  required
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  placeholder="https://tedarikci.com/feed/urunler.xml veya /api/admin/xml/sample"
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-xs text-zinc-900 focus:border-zinc-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-800">
                  HTTP Kimlik Doğrulama
                </label>
                <select
                  value={authType}
                  onChange={(e) =>
                    setAuthType(
                      e.target.value as "none" | "basic" | "header"
                    )
                  }
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-none"
                >
                  <option value="none">Doğrulama Yok (Açık URL)</option>
                  <option value="basic">HTTP Basic Auth (Kullanıcı / Şifre)</option>
                  <option value="header">Özel HTTP Başlığı (API Anahtarı)</option>
                </select>
              </div>

              {authType === "basic" ? (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-zinc-800">
                      Basic Auth Kullanıcı Adı
                    </label>
                    <input
                      type="text"
                      value={authUser}
                      onChange={(e) => setAuthUser(e.target.value)}
                      className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-zinc-800">
                      Basic Auth Şifre
                    </label>
                    <input
                      type="password"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900"
                    />
                  </div>
                </>
              ) : null}

              {authType === "header" ? (
                <div className="md:col-span-3">
                  <label className="mb-1 block text-xs font-semibold text-zinc-800">
                    Özel HTTP Başlıkları (Her satıra Başlık: Değer)
                  </label>
                  <textarea
                    rows={2}
                    value={headersText}
                    onChange={(e) => setHeadersText(e.target.value)}
                    placeholder={"X-Api-Key: gizli-anahtar\nX-Bayi-Kodu: 1042"}
                    className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-xs text-zinc-900"
                  />
                </div>
              ) : null}
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-800">
                XML Dosyası Seçin (.xml, .xml.gz veya .zip desteklenir)
              </label>
              <input
                type="file"
                accept=".xml,.gz,.zip,application/xml,text/xml,application/gzip,application/zip"
                required
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                className="w-full rounded-md border border-zinc-300 bg-[#fafaf9] px-3 py-2 text-xs text-zinc-800"
              />
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-zinc-200 pt-3">
            <button
              type="button"
              onClick={() => setShowNewSourceForm(false)}
              className="rounded-md border border-zinc-300 bg-white px-3.5 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              disabled={submittingSource}
              className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span>
                {submittingSource
                  ? "Analiz Ediliyor..."
                  : "Kaydet ve Eşleştirme Sihirbazını Aç"}
              </span>
            </button>
          </div>
        </form>
      ) : null}

      {/* Tedarikçi XML Kaynakları Tablosu */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-zinc-900">
              Tedarikçi XML Kaynakları (İçe Aktarma)
            </h2>
            <p className="text-xs text-zinc-600">
              Kayıtlı tedarikçi XML bağlantıları, eşleştirilen ürün sayıları ve son senkronizasyon durumları.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refreshData()}
            className="inline-flex items-center gap-1 rounded border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
          >
            <ArrowsClockwise className="h-3.5 w-3.5" />
            <span>Yenile</span>
          </button>
        </div>

        <div className="overflow-x-auto rounded-md border border-zinc-200 bg-white">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-200 bg-[#fafaf9] text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
                <th className="px-4 py-3">Kaynak Adı ve Bağlantı</th>
                <th className="px-3 py-3">Ürün Düğümü / Anahtar</th>
                <th className="px-3 py-3 text-right">Bağlı Ürün</th>
                <th className="px-3 py-3">Otomatik Zamanlama</th>
                <th className="px-3 py-3">Son Çalışma</th>
                <th className="px-4 py-3 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-xs text-zinc-600"
                  >
                    XML kaynakları yükleniyor...
                  </td>
                </tr>
              ) : !data || data.sources.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-xs text-zinc-600"
                  >
                    Henüz tanımlı bir tedarikçi XML kaynağı bulunmuyor. Yukarıdaki &quot;Örnek XML ile Kaynak Oluştur&quot; butonuna tıklayarak hemen deneyebilirsiniz.
                  </td>
                </tr>
              ) : (
                data.sources.map((src) => {
                  const isRunning = runningSourceId === src.id;
                  return (
                    <tr key={src.id} className="hover:bg-zinc-50/80">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/admin/xml/kaynaklar/${src.id}`}
                            className="font-semibold text-zinc-900 hover:underline"
                          >
                            {src.name}
                          </Link>
                          <span className="rounded border border-zinc-200 bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-zinc-700">
                            {src.kind}
                          </span>
                          {!src.isActive ? (
                            <span className="rounded bg-[#fef3c7] px-1.5 py-0.5 text-[10px] font-semibold text-[#92400e]">
                              Pasif
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-0.5 max-w-md truncate font-mono text-[11px] text-zinc-500">
                          {src.kind === "URL"
                            ? src.url
                            : `Dosya: ${src.fileKey ?? "Yüklenmedi"}`}
                        </div>
                      </td>

                      <td className="px-3 py-3">
                        <div className="font-mono text-xs text-zinc-900">
                          {src.itemPath || "Henüz seçilmedi"}
                        </div>
                        <div className="mt-0.5 text-[11px] text-zinc-600">
                          Eşleşme:{" "}
                          <span className="font-mono font-medium">
                            {src.matchKey}
                          </span>{" "}
                          ({src.categoryMapCount} kategori)
                        </div>
                      </td>

                      <td className="px-3 py-3 text-right font-mono text-xs font-semibold tabular-nums text-zinc-900">
                        {src.linkedProductCount}
                      </td>

                      <td className="px-3 py-3 text-xs text-zinc-700">
                        {src.scheduleMinutes ? (
                          <div>
                            <span className="font-mono font-medium tabular-nums">
                              Her {src.scheduleMinutes} dk
                            </span>
                            {src.nextRunAt ? (
                              <div className="text-[11px] text-zinc-500">
                                Sonraki:{" "}
                                {new Date(src.nextRunAt).toLocaleTimeString(
                                  "tr-TR",
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  }
                                )}
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-zinc-500">Sadece Elle</span>
                        )}
                      </td>

                      <td className="px-3 py-3">
                        {src.lastRunAt ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                  src.lastStatus === "SUCCEEDED"
                                    ? "bg-[#dcfce7] text-[#166534]"
                                    : src.lastStatus === "FAILED"
                                      ? "bg-[#fee2e2] text-[#991b1b]"
                                      : "bg-[#fef3c7] text-[#92400e]"
                                }`}
                              >
                                {src.lastStatus === "SUCCEEDED"
                                  ? "Başarılı"
                                  : src.lastStatus === "FAILED"
                                    ? "Hatalı"
                                    : src.lastStatus}
                              </span>
                              <span className="font-mono text-[11px] text-zinc-600 tabular-nums">
                                {new Date(src.lastRunAt).toLocaleString(
                                  "tr-TR",
                                  {
                                    day: "2-digit",
                                    month: "2-digit",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  }
                                )}
                              </span>
                            </div>
                            {src.lastRunStats ? (
                              <div className="font-mono text-[11px] text-zinc-600 tabular-nums">
                                +{src.lastRunStats.created} yeni, ~
                                {src.lastRunStats.updated} günc, =
                                {src.lastRunStats.unchanged} aynı
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-zinc-500">
                            Henüz çalıştırılmadı
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                          <Link
                            href={`/admin/xml/kaynaklar/${src.id}`}
                            className="inline-flex items-center gap-1 rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-900 hover:bg-zinc-100"
                          >
                            <SlidersHorizontal className="h-3.5 w-3.5" />
                            <span>Sihirbaz</span>
                          </Link>
                          <button
                            type="button"
                            disabled={isRunning}
                            onClick={() => void handleQuickRun(src.id, "PREVIEW")}
                            className="inline-flex items-center gap-1 rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-800 hover:bg-zinc-100 disabled:opacity-50"
                            title="Veritabanını değiştirmeden kuru çalıştırma yap"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>Önizle</span>
                          </button>
                          <button
                            type="button"
                            disabled={isRunning}
                            onClick={() => void handleQuickRun(src.id, "APPLY")}
                            className="inline-flex items-center gap-1 rounded bg-zinc-900 px-2.5 py-1 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
                            title="Ürünleri ve stokları şimdi içeri aktar"
                          >
                            <Play className="h-3.5 w-3.5" />
                            <span>{isRunning ? "Çalışıyor..." : "Aktar"}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void handleDeleteSource(src.id, src.name)
                            }
                            className="inline-flex items-center justify-center rounded border border-zinc-200 bg-white p-1 text-zinc-600 hover:border-[#fecaca] hover:bg-[#fee2e2] hover:text-[#991b1b]"
                            title="Kaynağı sil"
                          >
                            <Trash className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Dışa Aktarma Feed Bölümü */}
      <section className="space-y-4 border-t border-zinc-200 pt-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-sm font-bold text-zinc-900">
              Dışa Aktarma XML Beslemeleri (Google Merchant, Meta, Akakçe / Cimri / Bayi)
            </h2>
            <p className="text-xs text-zinc-600">
              Mağazanızdaki aktif ürünleri filtreleyerek reklam platformları ve fiyat karşılaştırma siteleri için canlı XML URL&apos;leri oluşturun.
            </p>
          </div>
          {!showNewExportForm ? (
            <button
              type="button"
              onClick={() => setShowNewExportForm(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-zinc-100"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Yeni Dışa Aktarma Beslemesi</span>
            </button>
          ) : null}
        </div>

        {showNewExportForm ? (
          <form
            onSubmit={(e) => void handleCreateExportFeed(e)}
            className="space-y-4 rounded-md border border-zinc-300 bg-white p-5"
          >
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <h3 className="text-sm font-bold text-zinc-900">
                Yeni Dışa Aktarma XML Beslemesi Oluştur
              </h3>
              <button
                type="button"
                onClick={() => setShowNewExportForm(false)}
                className="text-xs font-medium text-zinc-600 hover:text-zinc-900"
              >
                Kapat
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-800">
                  Besleme Adı
                </label>
                <input
                  type="text"
                  required
                  value={exportName}
                  onChange={(e) => setExportName(e.target.value)}
                  placeholder="Örn: Google Merchant Tüm Ürünler"
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-800">
                  Çıktı Formatı
                </label>
                <select
                  value={exportFormat}
                  onChange={(e) =>
                    setExportFormat(
                      e.target.value as "GOOGLE" | "META" | "CUSTOM"
                    )
                  }
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900"
                >
                  <option value="GOOGLE">
                    GOOGLE (Google Merchant Center RSS 2.0)
                  </option>
                  <option value="META">
                    META (Facebook / Instagram Katalog)
                  </option>
                  <option value="CUSTOM">
                    CUSTOM (Özel Şablon: Akakçe, Cimri, Bayi XML)
                  </option>
                </select>
              </div>

              <div className="flex items-end pb-1">
                <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-zinc-800">
                  <input
                    type="checkbox"
                    checked={inStockOnly}
                    onChange={(e) => setInStockOnly(e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 text-zinc-900"
                  />
                  <span>Yalnızca stokta olan ürünleri dahil et</span>
                </label>
              </div>
            </div>

            {/* Kategori, Marka, Koleksiyon Filtreleri */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-800">
                  Kategori Filtresi (Seçilmezse Tümü)
                </label>
                <div className="max-h-32 space-y-1 overflow-y-auto rounded border border-zinc-200 bg-[#fafaf9] p-2">
                  {data?.categories.length === 0 ? (
                    <span className="text-[11px] text-zinc-500">
                      Kategori bulunamadı
                    </span>
                  ) : (
                    data?.categories.map((cat) => (
                      <label
                        key={cat.id}
                        className="flex cursor-pointer items-center gap-2 text-xs text-zinc-800"
                      >
                        <input
                          type="checkbox"
                          checked={selectedCategoryIds.includes(cat.id)}
                          onChange={() =>
                            toggleIdInList(
                              selectedCategoryIds,
                              setSelectedCategoryIds,
                              cat.id
                            )
                          }
                          className="h-3.5 w-3.5 rounded border-zinc-300"
                        />
                        <span className="truncate">{cat.label}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-800">
                  Marka Filtresi (Seçilmezse Tümü)
                </label>
                <div className="max-h-32 space-y-1 overflow-y-auto rounded border border-zinc-200 bg-[#fafaf9] p-2">
                  {data?.brands.length === 0 ? (
                    <span className="text-[11px] text-zinc-500">
                      Marka bulunamadı
                    </span>
                  ) : (
                    data?.brands.map((b) => (
                      <label
                        key={b.id}
                        className="flex cursor-pointer items-center gap-2 text-xs text-zinc-800"
                      >
                        <input
                          type="checkbox"
                          checked={selectedBrandIds.includes(b.id)}
                          onChange={() =>
                            toggleIdInList(
                              selectedBrandIds,
                              setSelectedBrandIds,
                              b.id
                            )
                          }
                          className="h-3.5 w-3.5 rounded border-zinc-300"
                        />
                        <span className="truncate">{b.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-800">
                  Koleksiyon Filtresi (Seçilmezse Tümü)
                </label>
                <div className="max-h-32 space-y-1 overflow-y-auto rounded border border-zinc-200 bg-[#fafaf9] p-2">
                  {data?.collections.length === 0 ? (
                    <span className="text-[11px] text-zinc-500">
                      Koleksiyon bulunamadı
                    </span>
                  ) : (
                    data?.collections.map((col) => (
                      <label
                        key={col.id}
                        className="flex cursor-pointer items-center gap-2 text-xs text-zinc-800"
                      >
                        <input
                          type="checkbox"
                          checked={selectedCollectionIds.includes(col.id)}
                          onChange={() =>
                            toggleIdInList(
                              selectedCollectionIds,
                              setSelectedCollectionIds,
                              col.id
                            )
                          }
                          className="h-3.5 w-3.5 rounded border-zinc-300"
                        />
                        <span className="truncate">{col.title}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* CUSTOM Şablon Özelleştirme */}
            {exportFormat === "CUSTOM" ? (
              <div className="space-y-3 rounded-md border border-zinc-200 bg-[#fafaf9] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-xs font-bold text-zinc-900">
                    Özel XML Düğüm ve Alan Etiketi Şablonu
                  </h4>
                  <div className="flex items-center gap-4">
                    <label className="inline-flex items-center gap-1.5 text-xs text-zinc-800">
                      <input
                        type="checkbox"
                        checked={customTemplate.includeVariantsAsItems}
                        onChange={(e) =>
                          setCustomTemplate((prev) => ({
                            ...prev,
                            includeVariantsAsItems: e.target.checked,
                          }))
                        }
                        className="h-3.5 w-3.5 rounded border-zinc-300"
                      />
                      <span>Varyantları ayrı ürün düğümü olarak listele</span>
                    </label>
                    <label className="inline-flex items-center gap-1.5 text-xs text-zinc-800">
                      <input
                        type="checkbox"
                        checked={customTemplate.useCdataForDescription}
                        onChange={(e) =>
                          setCustomTemplate((prev) => ({
                            ...prev,
                            useCdataForDescription: e.target.checked,
                          }))
                        }
                        className="h-3.5 w-3.5 rounded border-zinc-300"
                      />
                      <span>Açıklamada CDATA kullan</span>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-zinc-700">
                      Kök Düğüm
                    </label>
                    <input
                      type="text"
                      value={customTemplate.rootNode}
                      onChange={(e) =>
                        setCustomTemplate((prev) => ({
                          ...prev,
                          rootNode: e.target.value,
                        }))
                      }
                      className="w-full rounded border border-zinc-300 bg-white px-2.5 py-1.5 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-zinc-700">
                      Ürün Düğümü
                    </label>
                    <input
                      type="text"
                      value={customTemplate.itemNode}
                      onChange={(e) =>
                        setCustomTemplate((prev) => ({
                          ...prev,
                          itemNode: e.target.value,
                        }))
                      }
                      className="w-full rounded border border-zinc-300 bg-white px-2.5 py-1.5 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-zinc-700">
                      ID Etiketi
                    </label>
                    <input
                      type="text"
                      value={customTemplate.fields.idTag}
                      onChange={(e) =>
                        setCustomTemplate((prev) => ({
                          ...prev,
                          fields: { ...prev.fields, idTag: e.target.value },
                        }))
                      }
                      className="w-full rounded border border-zinc-300 bg-white px-2.5 py-1.5 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-zinc-700">
                      SKU Etiketi
                    </label>
                    <input
                      type="text"
                      value={customTemplate.fields.skuTag}
                      onChange={(e) =>
                        setCustomTemplate((prev) => ({
                          ...prev,
                          fields: { ...prev.fields, skuTag: e.target.value },
                        }))
                      }
                      className="w-full rounded border border-zinc-300 bg-white px-2.5 py-1.5 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-zinc-700">
                      Barkod Etiketi
                    </label>
                    <input
                      type="text"
                      value={customTemplate.fields.barcodeTag}
                      onChange={(e) =>
                        setCustomTemplate((prev) => ({
                          ...prev,
                          fields: { ...prev.fields, barcodeTag: e.target.value },
                        }))
                      }
                      className="w-full rounded border border-zinc-300 bg-white px-2.5 py-1.5 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-zinc-700">
                      Başlık Etiketi
                    </label>
                    <input
                      type="text"
                      value={customTemplate.fields.titleTag}
                      onChange={(e) =>
                        setCustomTemplate((prev) => ({
                          ...prev,
                          fields: { ...prev.fields, titleTag: e.target.value },
                        }))
                      }
                      className="w-full rounded border border-zinc-300 bg-white px-2.5 py-1.5 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-zinc-700">
                      Fiyat Etiketi
                    </label>
                    <input
                      type="text"
                      value={customTemplate.fields.priceTag}
                      onChange={(e) =>
                        setCustomTemplate((prev) => ({
                          ...prev,
                          fields: { ...prev.fields, priceTag: e.target.value },
                        }))
                      }
                      className="w-full rounded border border-zinc-300 bg-white px-2.5 py-1.5 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-zinc-700">
                      Stok Etiketi
                    </label>
                    <input
                      type="text"
                      value={customTemplate.fields.stockTag}
                      onChange={(e) =>
                        setCustomTemplate((prev) => ({
                          ...prev,
                          fields: { ...prev.fields, stockTag: e.target.value },
                        }))
                      }
                      className="w-full rounded border border-zinc-300 bg-white px-2.5 py-1.5 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-zinc-700">
                      Kategori Etiketi
                    </label>
                    <input
                      type="text"
                      value={customTemplate.fields.categoryTag}
                      onChange={(e) =>
                        setCustomTemplate((prev) => ({
                          ...prev,
                          fields: {
                            ...prev.fields,
                            categoryTag: e.target.value,
                          },
                        }))
                      }
                      className="w-full rounded border border-zinc-300 bg-white px-2.5 py-1.5 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-zinc-700">
                      Görsel URL Etiketi
                    </label>
                    <input
                      type="text"
                      value={customTemplate.fields.imageTag}
                      onChange={(e) =>
                        setCustomTemplate((prev) => ({
                          ...prev,
                          fields: { ...prev.fields, imageTag: e.target.value },
                        }))
                      }
                      className="w-full rounded border border-zinc-300 bg-white px-2.5 py-1.5 font-mono text-xs"
                    />
                  </div>
                </div>
              </div>
            ) : null}

            <div className="flex justify-end gap-2 border-t border-zinc-200 pt-3">
              <button
                type="button"
                onClick={() => setShowNewExportForm(false)}
                className="rounded-md border border-zinc-300 bg-white px-3.5 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
              >
                Vazgeç
              </button>
              <button
                type="submit"
                disabled={submittingExport}
                className="rounded-md bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                {submittingExport
                  ? "Oluşturuluyor..."
                  : "Dışa Aktarma Beslemesini Kaydet"}
              </button>
            </div>
          </form>
        ) : null}

        <div className="overflow-x-auto rounded-md border border-zinc-200 bg-white">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-200 bg-[#fafaf9] text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
                <th className="px-4 py-3">Besleme Adı</th>
                <th className="px-3 py-3">Format / Şablon</th>
                <th className="px-3 py-3">Canlı XML Bağlantısı</th>
                <th className="px-3 py-3">Filtreler</th>
                <th className="px-3 py-3">Son Üretim</th>
                <th className="px-4 py-3 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {!data || data.exportFeeds.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-xs text-zinc-600"
                  >
                    Henüz dışa aktarma XML beslemesi oluşturulmadı.
                  </td>
                </tr>
              ) : (
                data.exportFeeds.map((feed) => {
                  const feedPath = `/feeds/${feed.token}.xml`;
                  const fullFeedUrl =
                    typeof window !== "undefined"
                      ? `${window.location.origin}${feedPath}`
                      : `http://localhost:3000${feedPath}`;

                  return (
                    <tr key={feed.id} className="hover:bg-zinc-50/80">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-zinc-900">
                          {feed.name}
                        </div>
                        <div className="mt-0.5">
                          <span
                            className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                              feed.isActive
                                ? "bg-[#dcfce7] text-[#166534]"
                                : "bg-[#fef3c7] text-[#92400e]"
                            }`}
                          >
                            {feed.isActive ? "Aktif" : "Pasif"}
                          </span>
                        </div>
                      </td>

                      <td className="px-3 py-3">
                        <span className="rounded border border-zinc-300 bg-zinc-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-zinc-800">
                          {feed.format}
                        </span>
                        {feed.format === "CUSTOM" ? (
                          <div className="mt-1 font-mono text-[11px] text-zinc-500">
                            &lt;{feed.template.rootNode}&gt; / &lt;
                            {feed.template.itemNode}&gt;
                          </div>
                        ) : null}
                      </td>

                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <code className="rounded border border-zinc-200 bg-[#fafaf9] px-2 py-1 font-mono text-[11px] text-zinc-800">
                            {feedPath}
                          </code>
                          <button
                            type="button"
                            onClick={() =>
                              void copyText(`feed-${feed.id}`, fullFeedUrl)
                            }
                            className="inline-flex items-center gap-1 rounded border border-zinc-300 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-100"
                          >
                            {copiedKey === `feed-${feed.id}` ? (
                              <>
                                <Check className="h-3 w-3 text-[#166534]" />
                                <span>Kopyalandı</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" />
                                <span>Kopyala</span>
                              </>
                            )}
                          </button>
                        </div>
                      </td>

                      <td className="px-3 py-3 text-xs text-zinc-700">
                        <div>
                          {feed.filters.inStockOnly
                            ? "Sadece Stoktakiler"
                            : "Tüm Stok Durumları"}
                        </div>
                        <div className="text-[11px] text-zinc-500">
                          {feed.filters.categoryIds.length > 0
                            ? `${feed.filters.categoryIds.length} kategori`
                            : "Tüm kategoriler"}
                          {" / "}
                          {feed.filters.brandIds.length > 0
                            ? `${feed.filters.brandIds.length} marka`
                            : "Tüm markalar"}
                        </div>
                      </td>

                      <td className="px-3 py-3 font-mono text-[11px] text-zinc-600 tabular-nums">
                        {feed.lastGeneratedAt
                          ? new Date(feed.lastGeneratedAt).toLocaleString(
                              "tr-TR"
                            )
                          : "Henüz çağrılmadı"}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <a
                            href={feedPath}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-800 hover:bg-zinc-100"
                          >
                            <ArrowSquareOut className="h-3.5 w-3.5" />
                            <span>XML Aç</span>
                          </a>
                          <button
                            type="button"
                            onClick={() =>
                              void handleToggleExportFeed(
                                feed.id,
                                !feed.isActive
                              )
                            }
                            className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                          >
                            {feed.isActive ? "Pasif Yap" : "Aktif Yap"}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void handleDeleteExportFeed(feed.id, feed.name)
                            }
                            className="inline-flex items-center justify-center rounded border border-zinc-200 bg-white p-1 text-zinc-600 hover:border-[#fecaca] hover:bg-[#fee2e2] hover:text-[#991b1b]"
                          >
                            <Trash className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
