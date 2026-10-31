"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowsClockwise,
  Check,
  Eye,
  FileCode,
  Gear,
  ListChecks,
  Play,
  Plus,
  Sparkle,
  Table,
  TreeStructure,
  WarningCircle,
} from "@phosphor-icons/react";
import { formatMoney } from "@/lib/money";
import {
  getFeedSourceRunsAction,
  inspectAndSaveItemPathAction,
  loadXmlSourceWizardAction,
  saveFeedCategoryMappingsAction,
  saveFeedMappingAction,
  saveFeedRulesAndScheduleAction,
  triggerFeedRunAction,
  updateFeedSourceConnectionAction,
  type FeedRunHistoryDto,
  type XmlSourceWizardDataDto,
} from "@/modules/xml/actions";
import { transformPriceMinor } from "@/modules/xml/transform";
import type {
  FeedFieldSyncPolicy,
  FeedMapping,
  FeedTransform,
  FeedUpdatePolicy,
  PriceMarginTier,
  TextReplacementRule,
} from "@/modules/xml/schemas";

type WizardStep = 1 | 2 | 3 | 4 | 5;

const WIZARD_STEPS: Array<{
  step: WizardStep;
  title: string;
  subtitle: string;
}> = [
  {
    step: 1,
    title: "1. Yapı Analizi ve Ürün Düğümü",
    subtitle: "Tekrarlayan düğüm seçimi ve örnek ürün",
  },
  {
    step: 2,
    title: "2. Alan Eşleştirme",
    subtitle: "XML etiketlerini mağaza alanlarına bağlama",
  },
  {
    step: 3,
    title: "3. Kategori Eşleştirme",
    subtitle: "Tedarikçi kategorilerini mağazayla eşleme",
  },
  {
    step: 4,
    title: "4. Fiyat, Stok ve Zamanlama",
    subtitle: "Marj, yuvarlama, eşik ve güncelleme kuralları",
  },
  {
    step: 5,
    title: "5. Önizleme ve İçe Aktarma",
    subtitle: "Kuru çalıştırma, uygulama ve geçmiş raporlar",
  },
];

function getPropertyFlexible(record: Record<string, unknown>, key: string): unknown {
  if (key in record && record[key] !== undefined) return record[key];
  const attrKey = `@_${key}`;
  if (attrKey in record && record[attrKey] !== undefined) return record[attrKey];
  if (key.startsWith("@_")) {
    const stripped = key.slice(2);
    if (stripped in record && record[stripped] !== undefined) return record[stripped];
  }
  const lowerKey = key.toLowerCase();
  const cleanLower = lowerKey.replace(/^@_/, "");
  for (const [k, v] of Object.entries(record)) {
    const kLower = k.toLowerCase();
    const kClean = kLower.replace(/^@_/, "");
    if (kLower === lowerKey || kClean === cleanLower || kLower === `@_${cleanLower}`) {
      return v;
    }
  }
  return undefined;
}

function readPreviewScalar(
  sampleItem: Record<string, unknown> | null,
  path: string
): string {
  if (!sampleItem || !path) return "";
  const parts = path.split(".").filter(Boolean);
  let cur: unknown = sampleItem;
  for (const part of parts) {
    if (Array.isArray(cur)) {
      cur = cur[0];
    }
    if (typeof cur === "object" && cur !== null && !Array.isArray(cur)) {
      cur = getPropertyFlexible(cur as Record<string, unknown>, part);
    } else {
      cur = undefined;
      break;
    }
  }

  // Eğer ana ürün seviyesinde bulunamadıysa varyant düğümü içinde ilk varyantı kontrol et
  if ((cur === null || cur === undefined) && parts.length === 1) {
    const fallbackContainers = [
      "varriants.variant",
      "variants.variant",
      "Varyantlar.Varyant",
      "Secenekler.Secenek",
      "Variants.Variant",
    ];
    for (const fc of fallbackContainers) {
      let sub: unknown = sampleItem;
      for (const p of fc.split(".")) {
        if (Array.isArray(sub)) sub = sub[0];
        if (typeof sub === "object" && sub !== null && !Array.isArray(sub)) {
          sub = getPropertyFlexible(sub as Record<string, unknown>, p);
        } else {
          sub = undefined;
          break;
        }
      }
      if (Array.isArray(sub)) sub = sub[0];
      if (typeof sub === "object" && sub !== null && !Array.isArray(sub)) {
        const found = getPropertyFlexible(sub as Record<string, unknown>, parts[0]!);
        if (found !== undefined && found !== null) {
          cur = found;
          break;
        }
      }
    }
  }

  if (cur === null || cur === undefined) return "";
  if (typeof cur === "string" || typeof cur === "number" || typeof cur === "boolean") {
    return String(cur).slice(0, 100);
  }
  if (Array.isArray(cur)) {
    return `[${cur.length} öğe]`;
  }
  if (typeof cur === "object") {
    const rec = cur as Record<string, unknown>;
    if (typeof rec["#text"] === "string") return rec["#text"].slice(0, 100);
    return "{Nesne}";
  }
  return "";
}

function computeFieldOptions(rawFieldPaths: string[]): string[] {
  const set = new Set<string>(rawFieldPaths);
  for (const fp of rawFieldPaths) {
    if (fp.includes(".")) {
      const parts = fp.split(".");
      const last = parts[parts.length - 1];
      if (last) {
        set.add(last);
        if (last.startsWith("@_")) {
          set.add(last.slice(2));
        }
      }
    }
  }
  return Array.from(set);
}

export default function AdminXmlSourceWizardPage() {
  const params = useParams<{ id: string }>();
  const sourceId = typeof params.id === "string" ? params.id : "";

  const [wizardData, setWizardData] =
    React.useState<XmlSourceWizardDataDto | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [activeStep, setActiveStep] = React.useState<WizardStep>(1);
  const [feedback, setFeedback] = React.useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [busy, setBusy] = React.useState(false);

  // Bağlantı düzenleme paneli
  const [showConnModal, setShowConnModal] = React.useState(false);
  const [connName, setConnName] = React.useState("");
  const [connUrl, setConnUrl] = React.useState("");
  const [connAuthType, setConnAuthType] = React.useState("none");
  const [connAuthUser, setConnAuthUser] = React.useState("");
  const [connAuthPassword, setConnAuthPassword] = React.useState("");
  const [connHeadersText, setConnHeadersText] = React.useState("");
  const [connFile, setConnFile] = React.useState<File | null>(null);

  // Adım 1: Düğüm yolu ve önizleme görünümü
  const [itemPath, setItemPath] = React.useState("");
  const [sampleViewMode, setSampleViewMode] = React.useState<"TABLE" | "JSON">(
    "TABLE"
  );

  // Adım 2: Alan Eşleştirme
  const [matchKey, setMatchKey] = React.useState<
    "SKU" | "BARCODE" | "SUPPLIER_CODE"
  >("SKU");
  const [mapping, setMapping] = React.useState<FeedMapping | null>(null);

  // Adım 3: Kategori Eşleştirme
  const [unmatchedCategoryPolicy, setUnmatchedCategoryPolicy] = React.useState<
    "SKIP" | "DEFAULT" | "CREATE"
  >("SKIP");
  const [defaultCategoryId, setDefaultCategoryId] = React.useState<string>("");
  const [categoryMapRows, setCategoryMapRows] = React.useState<
    Array<{ sourceCategory: string; categoryId: string; itemCount: number }>
  >([]);

  // Adım 4: Dönüşüm, Güncelleme Politikası, Zamanlama
  const [transform, setTransform] = React.useState<FeedTransform | null>(null);
  const [updatePolicy, setUpdatePolicy] =
    React.useState<FeedUpdatePolicy | null>(null);
  const [missingPolicy, setMissingPolicy] = React.useState<
    "IGNORE" | "ZERO_STOCK" | "DRAFT"
  >("ZERO_STOCK");
  const [warehouseId, setWarehouseId] = React.useState<string>("");
  const [createAsStatus, setCreateAsStatus] = React.useState<
    "DRAFT" | "ACTIVE"
  >("DRAFT");
  const [scheduleMinutes, setScheduleMinutes] = React.useState<number>(0);
  const [isActive, setIsActive] = React.useState<boolean>(true);
  const [simulatorInputTl, setSimulatorInputTl] = React.useState<string>("1000");

  // Adım 5: Seçili FeedRun
  const [selectedRunId, setSelectedRunId] = React.useState<string | null>(null);

  const hydrateState = React.useCallback((res: XmlSourceWizardDataDto) => {
    setWizardData(res);
    setConnName(res.source.name);
    setConnUrl(res.source.url ?? "");
    setConnAuthType(res.source.authType);
    setConnAuthUser(res.source.authUser ?? "");
    setConnHeadersText(res.source.headersText);

    setItemPath(
      res.source.itemPath ?? res.inspection?.selectedItemPath ?? "Urunler.Urun"
    );
    setMatchKey(res.source.matchKey);
    setMapping(res.source.mapping);

    setUnmatchedCategoryPolicy(res.source.unmatchedCategoryPolicy);
    setDefaultCategoryId(res.source.defaultCategoryId ?? "");
    setCategoryMapRows(
      res.categoryMaps.map((m) => ({
        sourceCategory: m.sourceCategory,
        categoryId: m.categoryId ?? "",
        itemCount: m.itemCount,
      }))
    );

    setTransform(res.source.transform);
    setUpdatePolicy(res.source.updatePolicy);
    setMissingPolicy(res.source.missingPolicy);
    setWarehouseId(
      res.source.warehouseId ?? res.warehouses[0]?.id ?? ""
    );
    setCreateAsStatus(
      res.source.createAsStatus === "ACTIVE" ? "ACTIVE" : "DRAFT"
    );
    setScheduleMinutes(res.source.scheduleMinutes ?? 0);
    setIsActive(res.source.isActive);

    if (res.runs[0]) {
      setSelectedRunId(res.runs[0].id);
    }
  }, []);

  const loadWizard = React.useCallback(async () => {
    if (!sourceId) return;
    setLoading(true);
    try {
      const res = await loadXmlSourceWizardAction(sourceId);
      if (res) {
        hydrateState(res);
      }
    } catch (err) {
      setFeedback({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "XML kaynağı verileri yüklenemedi.",
      });
    } finally {
      setLoading(false);
    }
  }, [sourceId, hydrateState]);

  React.useEffect(() => {
    void loadWizard();
  }, [loadWizard]);

  // Canlı FeedRun ilerleme takibi
  const isAnyRunRunning =
    Boolean(wizardData?.runs.some((r) => r.status === "RUNNING")) || busy;

  React.useEffect(() => {
    if (!isAnyRunRunning || !sourceId) return;

    const intervalId = setInterval(async () => {
      try {
        const res = await getFeedSourceRunsAction(sourceId);
        if (res.ok && res.runs) {
          setWizardData((prev) =>
            prev ? { ...prev, runs: res.runs! } : prev
          );
          const running = res.runs.find((r) => r.status === "RUNNING");
          if (running) {
            setSelectedRunId(running.id);
          }
        }
      } catch {
        // Sessizce devam et
      }
    }, 1500);

    return () => clearInterval(intervalId);
  }, [isAnyRunRunning, sourceId]);

  if (loading) {
    return (
      <div className="rounded-md border border-zinc-200 bg-white p-8 text-center text-xs text-zinc-600">
        XML kaynağı ve yapı analizi yükleniyor...
      </div>
    );
  }

  if (!wizardData || !mapping || !transform || !updatePolicy) {
    return (
      <div className="space-y-4 rounded-md border border-zinc-200 bg-white p-6">
        <p className="text-sm font-semibold text-zinc-900">
          XML kaynağı bulunamadı.
        </p>
        <Link
          href="/admin/xml/kaynaklar"
          className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-3 py-2 text-xs font-semibold text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>XML Kaynaklarına Dön</span>
        </Link>
      </div>
    );
  }

  const rawFieldPaths = wizardData.inspection?.fieldPaths ?? [];
  const fieldOptions = computeFieldOptions(rawFieldPaths);
  const sampleItem = wizardData.inspection?.sampleItem ?? null;

  const handleSaveConnection = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const fd = new FormData();
      fd.set("name", connName);
      fd.set("url", connUrl);
      fd.set("authType", connAuthType);
      fd.set("authUser", connAuthUser);
      fd.set("authPassword", connAuthPassword);
      fd.set("headersText", connHeadersText);
      if (connFile) {
        fd.set("xmlFile", connFile);
      }
      const res = await updateFeedSourceConnectionAction(sourceId, fd);
      if (!res.ok) {
        setFeedback({
          type: "error",
          text: res.error ?? "Bağlantı güncellenemedi.",
        });
        return;
      }
      setShowConnModal(false);
      setFeedback({
        type: "success",
        text: "Kaynak bağlantı ayarları güncellendi ve XML yeniden analiz edildi.",
      });
      await loadWizard();
    } finally {
      setBusy(false);
    }
  };

  const handleInspectStep1 = async (nextStepAfterSave: boolean) => {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await inspectAndSaveItemPathAction(sourceId, itemPath);
      if (!res.ok) {
        setFeedback({
          type: "error",
          text: res.error ?? "XML yapısı çözümlenemedi.",
        });
        return;
      }
      await loadWizard();
      setFeedback({
        type: "success",
        text: `XML yapısı çözümlendi: "${
          res.inspection?.selectedItemPath ?? itemPath
        }" düğümünde ${res.inspection?.itemCount ?? 0} ürün tespit edildi.`,
      });
      if (nextStepAfterSave) {
        setActiveStep(2);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSaveStep2 = async (nextStepAfterSave: boolean) => {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await saveFeedMappingAction(sourceId, {
        itemPath,
        mapping,
        matchKey,
      });
      if (!res.ok) {
        setFeedback({
          type: "error",
          text: res.error ?? "Alan eşleştirmesi kaydedilemedi.",
        });
        return;
      }
      await loadWizard();
      setFeedback({
        type: "success",
        text: "Alan eşleştirmeleri kaydedildi.",
      });
      if (nextStepAfterSave) {
        setActiveStep(3);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleAutoMatchCategories = () => {
    const storeCats = wizardData.categories;
    setCategoryMapRows((prev) =>
      prev.map((row) => {
        if (row.categoryId) return row;
        const leaf =
          row.sourceCategory
            .split(/>|\/|\|/)
            .map((s) => s.trim())
            .filter(Boolean)
            .pop() ?? row.sourceCategory;
        const found = storeCats.find(
          (sc) =>
            sc.name.toLowerCase() === leaf.toLowerCase() ||
            sc.label.toLowerCase() === row.sourceCategory.toLowerCase()
        );
        return found ? { ...row, categoryId: found.id } : row;
      })
    );
    setFeedback({
      type: "success",
      text: "İsim benzerliğine göre eşleşen kategoriler seçildi. Kaydetmeyi unutmayın.",
    });
  };

  const handleSaveStep3 = async (nextStepAfterSave: boolean) => {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await saveFeedCategoryMappingsAction(sourceId, {
        unmatchedCategoryPolicy,
        defaultCategoryId: defaultCategoryId || null,
        mappings: categoryMapRows.map((r) => ({
          sourceCategory: r.sourceCategory,
          categoryId: r.categoryId || null,
        })),
      });
      if (!res.ok) {
        setFeedback({
          type: "error",
          text: res.error ?? "Kategori eşleştirmeleri kaydedilemedi.",
        });
        return;
      }
      await loadWizard();
      setFeedback({
        type: "success",
        text: "Kategori eşleştirmeleri ve eşlenmemiş kategori politikası kaydedildi.",
      });
      if (nextStepAfterSave) {
        setActiveStep(4);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSaveStep4 = async (nextStepAfterSave: boolean) => {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await saveFeedRulesAndScheduleAction(sourceId, {
        transform,
        updatePolicy,
        missingPolicy,
        warehouseId: warehouseId || null,
        createAsStatus,
        scheduleMinutes: scheduleMinutes > 0 ? scheduleMinutes : null,
        isActive,
      });
      if (!res.ok) {
        setFeedback({
          type: "error",
          text: res.error ?? "Kurallar kaydedilemedi.",
        });
        return;
      }
      await loadWizard();
      setFeedback({
        type: "success",
        text: "Fiyat marjı, stok eşiği, güncelleme politikası ve zamanlama kuralları kaydedildi.",
      });
      if (nextStepAfterSave) {
        setActiveStep(5);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleRunFeed = async (mode: "PREVIEW" | "APPLY") => {
    setBusy(true);
    setFeedback(null);
    setActiveStep(5);
    try {
      const res = await triggerFeedRunAction(sourceId, mode);
      if (!res.ok || !res.result) {
        setFeedback({
          type: "error",
          text: res.error ?? "Senkronizasyon çalıştırılamadı.",
        });
      } else {
        setSelectedRunId(res.result.runId);
        setFeedback({
          type: "success",
          text:
            mode === "PREVIEW"
              ? `Kuru çalıştırma (Önizleme) tamamlandı: ${res.result.stats.total} ürün incelendi (${res.result.stats.created} yeni, ${res.result.stats.updated} güncellenecek).`
              : `Gerçek içe aktarma tamamlandı: ${res.result.stats.created} yeni ürün oluşturuldu, ${res.result.stats.updated} ürün güncellendi.`,
        });
      }
    } catch (err) {
      setFeedback({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Senkronizasyon sırasında bir hata oluştu.",
      });
    } finally {
      try {
        const runsRes = await getFeedSourceRunsAction(sourceId);
        if (runsRes.ok && runsRes.runs) {
          setWizardData((prev) =>
            prev ? { ...prev, runs: runsRes.runs! } : prev
          );
        }
      } catch {
        // Sessizce devam et
      }
      setBusy(false);
    }
  };

  const updateMappingField = (key: keyof FeedMapping, value: string) => {
    setMapping((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const addPriceTier = () => {
    const nextTier: PriceMarginTier = {
      upToMinor: 100000,
      percentBps: 2000,
      fixedMinor: 0,
    };
    setTransform((prev) =>
      prev ? { ...prev, tiers: [...prev.tiers, nextTier] } : prev
    );
  };

  const removePriceTier = (index: number) => {
    setTransform((prev) =>
      prev
        ? { ...prev, tiers: prev.tiers.filter((_, idx) => idx !== index) }
        : prev
    );
  };

  const addReplacementRule = () => {
    const nextRule: TextReplacementRule = { find: "", replace: "" };
    setTransform((prev) =>
      prev ? { ...prev, replacements: [...prev.replacements, nextRule] } : prev
    );
  };

  const removeReplacementRule = (index: number) => {
    setTransform((prev) =>
      prev
        ? {
            ...prev,
            replacements: prev.replacements.filter((_, idx) => idx !== index),
          }
        : prev
    );
  };

  const simBaseMinor = Math.max(
    0,
    Math.round((Number(simulatorInputTl.replace(",", ".")) || 0) * 100)
  );
  const simOutputMinor = transformPriceMinor(simBaseMinor, transform);

  const selectedRun: FeedRunHistoryDto | undefined =
    wizardData.runs.find((r) => r.id === selectedRunId) ?? wizardData.runs[0];

  const renderFieldSelector = (
    label: string,
    fieldKey: keyof FeedMapping,
    helperText?: string
  ) => {
    const currentValue = mapping[fieldKey];
    const previewVal = readPreviewScalar(sampleItem, currentValue);

    return (
      <div className="space-y-1 rounded-md border border-zinc-200 bg-[#fafaf9] p-3">
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs font-semibold text-zinc-900">{label}</label>
          {currentValue ? (
            <span className="rounded bg-zinc-200/80 px-1.5 py-0.5 font-mono text-[10px] text-zinc-700">
              {currentValue}
            </span>
          ) : null}
        </div>
        {helperText ? (
          <p className="text-[11px] text-zinc-500">{helperText}</p>
        ) : null}
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          <select
            value={currentValue}
            onChange={(e) => updateMappingField(fieldKey, e.target.value)}
            className="rounded border border-zinc-300 bg-white px-2.5 py-1.5 font-mono text-xs text-zinc-900 focus:border-zinc-900 focus:outline-none"
          >
            <option value="">-- XML Alanı Seçin --</option>
            {currentValue && !fieldOptions.includes(currentValue) ? (
              <option value={currentValue}>{currentValue} (Geçerli Değer)</option>
            ) : null}
            {fieldOptions.map((fp) => (
              <option key={fp} value={fp}>
                {fp}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={currentValue}
            onChange={(e) => updateMappingField(fieldKey, e.target.value)}
            placeholder="Veya düğüm yolu yazın (örn. Fiyat)"
            className="rounded border border-zinc-300 bg-white px-2.5 py-1.5 font-mono text-xs text-zinc-900 focus:border-zinc-900 focus:outline-none"
          />
        </div>
        {previewVal ? (
          <div className="truncate pt-0.5 font-mono text-[11px] text-[#166534]">
            Örnek değer: {previewVal}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Üst Başlık ve Hızlı Aksiyonlar */}
      <div className="flex flex-col justify-between gap-4 border-b border-zinc-200 pb-4 lg:flex-row lg:items-center">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-zinc-600">
            <Link
              href="/admin/xml/kaynaklar"
              className="inline-flex items-center gap-1 font-medium text-zinc-700 hover:text-zinc-900"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>XML Kaynakları</span>
            </Link>
            <span>/</span>
            <span className="font-mono text-zinc-800">
              {wizardData.source.kind}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <FileCode className="h-5 w-5 text-[#9a3412]" />
            <h1 className="text-xl font-bold tracking-tight text-zinc-900">
              {wizardData.source.name}
            </h1>
            <span
              className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                wizardData.source.isActive
                  ? "bg-[#dcfce7] text-[#166534]"
                  : "bg-[#fef3c7] text-[#92400e]"
              }`}
            >
              {wizardData.source.isActive ? "Aktif Kaynak" : "Pasif"}
            </span>
            <span className="rounded border border-zinc-200 bg-white px-2 py-0.5 font-mono text-[11px] text-zinc-700 tabular-nums">
              {wizardData.source.linkedProductCount} bağlı ürün
            </span>
          </div>
          <p className="font-mono text-xs text-zinc-600">
            {wizardData.source.kind === "URL"
              ? wizardData.source.url
              : `Dosya Anahtarı: ${wizardData.source.fileKey}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowConnModal((prev) => !prev)}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-100"
          >
            <Gear className="h-4 w-4" />
            <span>Bağlantı / Dosya Ayarları</span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleRunFeed("PREVIEW")}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-100 disabled:opacity-50"
          >
            <Eye className="h-4 w-4" />
            <span>Kuru Çalıştırma (Önizle)</span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleRunFeed("APPLY")}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#9a3412] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#7c2d12] disabled:opacity-50"
          >
            <Play className="h-4 w-4" />
            <span>Gerçek İçe Aktar (Uygula)</span>
          </button>
        </div>
      </div>

      {/* Bağlantı / Dosya Güncelleme Formu */}
      {showConnModal ? (
        <form
          onSubmit={(e) => void handleSaveConnection(e)}
          className="space-y-4 rounded-md border border-zinc-300 bg-white p-5"
        >
          <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
            <h2 className="text-sm font-bold text-zinc-900">
              Kaynak Bağlantı ve Kimlik Doğrulama Ayarları
            </h2>
            <button
              type="button"
              onClick={() => setShowConnModal(false)}
              className="text-xs font-medium text-zinc-600 hover:text-zinc-900"
            >
              Kapat
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-800">
                Kaynak Adı
              </label>
              <input
                type="text"
                required
                value={connName}
                onChange={(e) => setConnName(e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-xs"
              />
            </div>

            {wizardData.source.kind === "URL" ? (
              <>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-zinc-800">
                    XML URL Adresi
                  </label>
                  <input
                    type="text"
                    required
                    value={connUrl}
                    onChange={(e) => setConnUrl(e.target.value)}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-800">
                    Kimlik Doğrulama
                  </label>
                  <select
                    value={connAuthType}
                    onChange={(e) => setConnAuthType(e.target.value)}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-xs"
                  >
                    <option value="none">Yok</option>
                    <option value="basic">Basic Auth</option>
                    <option value="header">Özel HTTP Başlığı</option>
                  </select>
                </div>
                {connAuthType === "basic" ? (
                  <>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-zinc-800">
                        Kullanıcı Adı
                      </label>
                      <input
                        type="text"
                        value={connAuthUser}
                        onChange={(e) => setConnAuthUser(e.target.value)}
                        className="w-full rounded-md border border-zinc-300 px-3 py-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-zinc-800">
                        Yeni Şifre (Değiştirmek İçin)
                      </label>
                      <input
                        type="password"
                        value={connAuthPassword}
                        onChange={(e) => setConnAuthPassword(e.target.value)}
                        className="w-full rounded-md border border-zinc-300 px-3 py-2 text-xs"
                      />
                    </div>
                  </>
                ) : null}
                {connAuthType === "header" ? (
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-xs font-semibold text-zinc-800">
                      HTTP Başlıkları (Başlık: Değer)
                    </label>
                    <textarea
                      rows={2}
                      value={connHeadersText}
                      onChange={(e) => setConnHeadersText(e.target.value)}
                      className="w-full rounded-md border border-zinc-300 px-3 py-2 font-mono text-xs"
                    />
                  </div>
                ) : null}
              </>
            ) : (
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-zinc-800">
                  Yeni XML Dosyası Yükle (.xml, .xml.gz, .zip)
                </label>
                <input
                  type="file"
                  accept=".xml,.gz,.zip"
                  onChange={(e) => setConnFile(e.target.files?.[0] ?? null)}
                  className="w-full rounded-md border border-zinc-300 bg-[#fafaf9] px-3 py-2 text-xs"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-zinc-200 pt-3">
            <button
              type="button"
              onClick={() => setShowConnModal(false)}
              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-zinc-900 px-4 py-1.5 text-xs font-semibold text-white"
            >
              Bağlantıyı Güncelle
            </button>
          </div>
        </form>
      ) : null}

      {/* Arka Planda Çalışan Aktarım Bilgilendirmesi */}
      {wizardData?.runs.some((r) => r.status === "RUNNING") ? (
        <div className="flex flex-col gap-2 rounded-md border border-amber-300 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <ArrowsClockwise className="h-5 w-5 animate-spin text-amber-700 shrink-0" />
            <div>
              <div className="text-xs font-bold text-amber-950">
                Arka planda XML senkronizasyonu çalışıyor...
              </div>
              <div className="text-[11px] text-amber-800">
                {wizardData.runs.find((r) => r.status === "RUNNING")?.message ||
                  "Ürünler işleniyor..."}
              </div>
            </div>
          </div>
          {activeStep !== 5 ? (
            <button
              type="button"
              onClick={() => setActiveStep(5)}
              className="inline-flex items-center gap-1.5 self-start rounded-md bg-[#9a3412] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#7c2d12] sm:self-auto"
            >
              <span>Canlı Raporu Gör (Adım 5)</span>
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Bildirim Çubuğu */}
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

      {wizardData.inspectionError ? (
        <div className="flex items-center gap-2 rounded-md border border-[#fecaca] bg-[#fee2e2] px-4 py-3 text-xs font-medium text-[#991b1b]">
          <WarningCircle className="h-4 w-4 shrink-0" />
          <span>
            XML okuma uyarısı: {wizardData.inspectionError}. Bağlantı ayarlarını kontrol edip yeniden analiz edebilirsiniz.
          </span>
        </div>
      ) : null}

      {/* 5 Adımlı Sihirbaz Sekmeleri */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
        {WIZARD_STEPS.map((s) => {
          const isCurrent = activeStep === s.step;
          return (
            <button
              key={s.step}
              type="button"
              onClick={() => setActiveStep(s.step)}
              className={`flex flex-col items-start rounded-md border p-3 text-left transition-colors ${
                isCurrent
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
              }`}
            >
              <span className="text-xs font-bold">{s.title}</span>
              <span
                className={`mt-0.5 text-[11px] ${
                  isCurrent ? "text-zinc-300" : "text-zinc-500"
                }`}
              >
                {s.subtitle}
              </span>
            </button>
          );
        })}
      </div>

      {/* ADIM 1: YAPI ANALİZİ VE ÜRÜN DÜĞÜMÜ SEÇİMİ */}
      {activeStep === 1 ? (
        <div className="space-y-5 rounded-md border border-zinc-200 bg-white p-5">
          <div className="flex flex-col justify-between gap-3 border-b border-zinc-200 pb-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-sm font-bold text-zinc-900">
                Adım 1: XML Yapı Çözümleyici ve Ürün Düğümü Seçimi
              </h2>
              <p className="text-xs text-zinc-600">
                XML içerisindeki tekrarlayan ürün düğüm yolunu seçin ve ilk ürünün ayrıştırılmış veri yapısını inceleyin.
              </p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleInspectStep1(false)}
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-100"
            >
              <ArrowsClockwise className="h-3.5 w-3.5" />
              <span>XML Yapısını Yeniden Analiz Et</span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="space-y-3 rounded-md border border-zinc-200 bg-[#fafaf9] p-4">
              <label className="block text-xs font-bold text-zinc-900">
                Tespit Edilen Tekrarlayan Ürün Düğümleri
              </label>
              {wizardData.inspection &&
              wizardData.inspection.candidateItemPaths.length > 0 ? (
                <div className="space-y-1.5">
                  {wizardData.inspection.candidateItemPaths.map((cand) => (
                    <button
                      key={cand.path}
                      type="button"
                      onClick={() => setItemPath(cand.path)}
                      className={`flex w-full items-center justify-between rounded border px-3 py-2 text-xs font-medium ${
                        itemPath === cand.path
                          ? "border-zinc-900 bg-zinc-900 text-white"
                          : "border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50"
                      }`}
                    >
                      <span className="font-mono">{cand.path}</span>
                      <span className="font-mono text-[11px] tabular-nums">
                        {cand.count} kayıt
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-zinc-600">
                  Otomatik düğüm bulunamadı, aşağıdan elle girebilirsiniz.
                </p>
              )}

              <div className="pt-2">
                <label className="mb-1 block text-xs font-semibold text-zinc-800">
                  Seçili Ürün Düğümü Yolu (Nokta Ayrılmış)
                </label>
                <input
                  type="text"
                  value={itemPath}
                  onChange={(e) => setItemPath(e.target.value)}
                  placeholder="Örn: Urunler.Urun veya Products.Product"
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-xs text-zinc-900"
                />
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 text-center">
                <div className="rounded border border-zinc-200 bg-white p-2">
                  <div className="font-mono text-sm font-bold tabular-nums text-zinc-900">
                    {wizardData.inspection?.itemCount ?? 0}
                  </div>
                  <div className="text-[11px] text-zinc-500">Ürün Sayısı</div>
                </div>
                <div className="rounded border border-zinc-200 bg-white p-2">
                  <div className="font-mono text-sm font-bold tabular-nums text-zinc-900">
                    {fieldOptions.length}
                  </div>
                  <div className="text-[11px] text-zinc-500">Alt Alan Yolu</div>
                </div>
                <div className="rounded border border-zinc-200 bg-white p-2">
                  <div className="font-mono text-sm font-bold tabular-nums text-zinc-900">
                    {wizardData.inspection?.categories.length ?? 0}
                  </div>
                  <div className="text-[11px] text-zinc-500">Kategori</div>
                </div>
              </div>
            </div>

            {/* Örnek Ürün Tablo / JSON Önizlemesi */}
            <div className="space-y-3 lg:col-span-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-zinc-900">
                  İlk Ürün Önizlemesi ({itemPath})
                </h3>
                <div className="inline-flex rounded-md border border-zinc-300 bg-white p-0.5">
                  <button
                    type="button"
                    onClick={() => setSampleViewMode("TABLE")}
                    className={`rounded px-2.5 py-1 text-xs font-medium ${
                      sampleViewMode === "TABLE"
                        ? "bg-zinc-900 text-white"
                        : "text-zinc-700"
                    }`}
                  >
                    Tablo Görünümü
                  </button>
                  <button
                    type="button"
                    onClick={() => setSampleViewMode("JSON")}
                    className={`rounded px-2.5 py-1 text-xs font-medium ${
                      sampleViewMode === "JSON"
                        ? "bg-zinc-900 text-white"
                        : "text-zinc-700"
                    }`}
                  >
                    Ham JSON Görünümü
                  </button>
                </div>
              </div>

              {sampleViewMode === "TABLE" ? (
                <div className="max-h-96 overflow-y-auto rounded-md border border-zinc-200">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-zinc-200 bg-[#fafaf9] text-[11px] font-semibold uppercase text-zinc-600">
                        <th className="px-3 py-2">XML Alt Alan Yolu</th>
                        <th className="px-3 py-2">İlk Üründeki Örnek Değer</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {fieldOptions.map((fp) => (
                        <tr key={fp} className="hover:bg-zinc-50">
                          <td className="px-3 py-2 font-mono text-xs font-medium text-zinc-900">
                            {fp}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs text-zinc-600">
                            {readPreviewScalar(sampleItem, fp) || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <pre className="max-h-96 overflow-auto rounded-md border border-zinc-200 bg-[#fafaf9] p-4 font-mono text-xs text-zinc-800">
                  {JSON.stringify(sampleItem, null, 2)}
                </pre>
              )}
            </div>
          </div>

          <div className="flex justify-end border-t border-zinc-200 pt-4">
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleInspectStep1(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
            >
              <Check className="h-4 w-4" />
              <span>Düğümü Kaydet ve Alan Eşleştirmeye Geç</span>
            </button>
          </div>
        </div>
      ) : null}

      {/* ADIM 2: ALAN EŞLEŞTİRME */}
      {activeStep === 2 ? (
        <div className="space-y-5 rounded-md border border-zinc-200 bg-white p-5">
          <div className="flex flex-col justify-between gap-3 border-b border-zinc-200 pb-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-sm font-bold text-zinc-900">
                Adım 2: XML Alan Eşleştirme ve Eşleşme Anahtarı
              </h2>
              <p className="text-xs text-zinc-600">
                Açılır listelerden XML alt düğümlerini mağaza ürün, varyant ve özel alanlarıyla eşleştirin.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {wizardData.inspection?.suggestedMapping ? (
                <button
                  type="button"
                  onClick={() => {
                    if (wizardData.inspection?.suggestedMapping) {
                      setMapping(wizardData.inspection.suggestedMapping);
                      setFeedback({
                        type: "success",
                        text: "Akıllı alan eşleştirmeleri dolduruldu.",
                      });
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-100"
                >
                  <Sparkle className="h-3.5 w-3.5 text-[#9a3412]" />
                  <span>Otomatik Eşleştir</span>
                </button>
              ) : null}
            </div>
          </div>

          {/* Eşleşme Anahtarı */}
          <div className="rounded-md border border-zinc-200 bg-[#fafaf9] p-4">
            <label className="mb-2 block text-xs font-bold text-zinc-900">
              Mevcut Ürünlerle Eşleşme Anahtarı (Match Key)
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {(
                [
                  {
                    key: "SKU",
                    title: "SKU (Stok Kodu)",
                    desc: "Varyant SKU alanı üzerinden eşleştirir",
                  },
                  {
                    key: "BARCODE",
                    title: "BARCODE (Barkod / EAN)",
                    desc: "Varyant barkod alanı üzerinden eşleştirir",
                  },
                  {
                    key: "SUPPLIER_CODE",
                    title: "SUPPLIER_CODE (Tedarikçi Kodu)",
                    desc: "Tedarikçi ürün kodu üzerinden eşleştirir",
                  },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setMatchKey(opt.key)}
                  className={`flex flex-col items-start rounded-md border p-3 text-left ${
                    matchKey === opt.key
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50"
                  }`}
                >
                  <span className="font-mono text-xs font-bold">
                    {opt.title}
                  </span>
                  <span
                    className={`mt-0.5 text-[11px] ${
                      matchKey === opt.key ? "text-zinc-300" : "text-zinc-500"
                    }`}
                  >
                    {opt.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Temel Ürün Alanları */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-600">
              Temel Kimlik, Metin ve Kategori Alanları
            </h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {renderFieldSelector(
                "Tedarikçi Ürün Kodu (External ID) *",
                "externalIdPath",
                "Benzersiz ürün kimliği"
              )}
              {renderFieldSelector(
                "Stok Kodu (SKU) *",
                "skuPath",
                "Mağaza stok kodu"
              )}
              {renderFieldSelector(
                "Barkod (EAN / GTIN)",
                "barcodePath",
                "13 haneli barkod"
              )}
              {renderFieldSelector(
                "Ürün Başlığı *",
                "titlePath",
                "Vitrin ürün adı"
              )}
              {renderFieldSelector(
                "Alt Başlık / Kısa Açıklama",
                "subtitlePath",
                "İsteğe bağlı özet metin"
              )}
              {renderFieldSelector(
                "Ürün Açıklaması (HTML / CDATA)",
                "descriptionPath",
                "Detaylı açıklama alanı"
              )}
              {renderFieldSelector("Marka Adı", "brandPath", "Ürün markası")}
              {renderFieldSelector(
                "Kategori Yolu",
                "categoryPath",
                "Örn: Ev Tekstili > Sofra"
              )}
              {renderFieldSelector(
                "Görsel Listesi Yolu",
                "imagesPath",
                "Tek URL veya çoklu görsel düğümü"
              )}
            </div>
          </div>

          {/* Fiyat ve Stok Alanları */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-600">
              Fiyat, Vergi, Stok ve Lojistik Alanları
            </h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {renderFieldSelector(
                "Satış Fiyatı *",
                "pricePath",
                "Ana satış fiyatı"
              )}
              {renderFieldSelector(
                "Piyasa / Karşılaştırma Fiyatı",
                "compareAtPricePath",
                "Üstü çizili liste fiyatı"
              )}
              {renderFieldSelector(
                "Alış / Maliyet Fiyatı",
                "costPricePath",
                "Kâr raporu için birim maliyet"
              )}
              {renderFieldSelector(
                "Para Birimi",
                "currencyPath",
                "TRY, USD, EUR"
              )}
              {renderFieldSelector(
                "KDV Oranı (%)",
                "taxRatePath",
                "Ürün bazlı KDV oranı"
              )}
              {renderFieldSelector(
                "Stok Miktarı *",
                "stockPath",
                "Ana ürün stok adedi"
              )}
              {renderFieldSelector(
                "Ağırlık (Gram)",
                "weightGramsPath",
                "Kargo hesaplaması için gram"
              )}
            </div>
          </div>

          {/* Çoklu Varyant ve Özel Alanlar */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-600">
              Varyantlar ve Teknik Özellik (Attribute) Düğümleri
            </h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {renderFieldSelector(
                "Varyant Liste Düğümü",
                "variantsPath",
                "Örn: Varyantlar.Varyant"
              )}
              {renderFieldSelector(
                "Varyant SKU (Varyant İçi)",
                "variantSkuPath",
                "Varyant düğümü içindeki SKU"
              )}
              {renderFieldSelector(
                "Varyant Barkod (Varyant İçi)",
                "variantBarcodePath",
                "Varyant düğümü içindeki Barkod"
              )}
              {renderFieldSelector(
                "Varyant Fiyat (Varyant İçi)",
                "variantPricePath",
                "Varyant düğümü içindeki Fiyat"
              )}
              {renderFieldSelector(
                "Varyant Stok (Varyant İçi)",
                "variantStockPath",
                "Varyant düğümü içindeki Stok"
              )}
              {renderFieldSelector(
                "1. Seçenek Değeri (Örn: Renk)",
                "variantOption1Path",
                "Varyant içindeki 1. seçenek alanı"
              )}
              {renderFieldSelector(
                "2. Seçenek Değeri (Örn: Beden)",
                "variantOption2Path",
                "Varyant içindeki 2. seçenek alanı"
              )}
              {renderFieldSelector(
                "Teknik Özellikler Düğümü",
                "attributesPath",
                "Örn: Ozellikler.Ozellik"
              )}
              <div className="grid grid-cols-2 gap-2 rounded-md border border-zinc-200 bg-[#fafaf9] p-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-900">
                    Özellik Adı Etiketi
                  </label>
                  <input
                    type="text"
                    value={mapping.attributeNameKey}
                    onChange={(e) =>
                      updateMappingField("attributeNameKey", e.target.value)
                    }
                    className="w-full rounded border border-zinc-300 bg-white px-2.5 py-1.5 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-900">
                    Özellik Değeri Etiketi
                  </label>
                  <input
                    type="text"
                    value={mapping.attributeValueKey}
                    onChange={(e) =>
                      updateMappingField("attributeValueKey", e.target.value)
                    }
                    className="w-full rounded border border-zinc-300 bg-white px-2.5 py-1.5 font-mono text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-between border-t border-zinc-200 pt-4">
            <button
              type="button"
              onClick={() => setActiveStep(1)}
              className="rounded-md border border-zinc-300 bg-white px-3.5 py-2 text-xs font-medium text-zinc-700"
            >
              Önceki Adım
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleSaveStep2(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
            >
              <Check className="h-4 w-4" />
              <span>Eşleştirmeyi Kaydet ve Kategorilere Geç</span>
            </button>
          </div>
        </div>
      ) : null}

      {/* ADIM 3: KATEGORİ EŞLEŞTİRME TABLOSU */}
      {activeStep === 3 ? (
        <div className="space-y-5 rounded-md border border-zinc-200 bg-white p-5">
          <div className="flex flex-col justify-between gap-3 border-b border-zinc-200 pb-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-sm font-bold text-zinc-900">
                Adım 3: Kategori Eşleştirme Tablosu ve Eşlenmemiş Kategori Politikası
              </h2>
              <p className="text-xs text-zinc-600">
                XML içerisindeki benzersiz kategori yollarını mağazanızdaki karşılıklarıyla eşleştirin.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAutoMatchCategories}
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-100"
            >
              <TreeStructure className="h-3.5 w-3.5 text-[#9a3412]" />
              <span>İsim Benzerliğine Göre Otomatik Eşle</span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 rounded-md border border-zinc-200 bg-[#fafaf9] p-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-zinc-900">
                Eşlenmemiş Kategori Politikası
              </label>
              <select
                value={unmatchedCategoryPolicy}
                onChange={(e) =>
                  setUnmatchedCategoryPolicy(
                    e.target.value as "SKIP" | "DEFAULT" | "CREATE"
                  )
                }
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900"
              >
                <option value="SKIP">
                  SKIP: Eşlenmemiş kategorideki ürünleri içe aktarma (Atla)
                </option>
                <option value="DEFAULT">
                  DEFAULT: Eşlenmemiş ürünleri varsayılan mağaza kategorisine ata
                </option>
                <option value="CREATE">
                  CREATE: XML kategori ağacını mağazada otomatik oluştur ve bağla
                </option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-zinc-900">
                Varsayılan Mağaza Kategorisi (Politika DEFAULT İse Kullanılır)
              </label>
              <select
                value={defaultCategoryId}
                onChange={(e) => setDefaultCategoryId(e.target.value)}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900"
              >
                <option value="">-- Varsayılan Kategori Seçin --</option>
                {wizardData.categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-md border border-zinc-200">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200 bg-[#fafaf9] text-[11px] font-semibold uppercase text-zinc-600">
                  <th className="px-4 py-2.5">XML Tedarikçi Kategorisi</th>
                  <th className="px-3 py-2.5 text-right">Ürün Sayısı</th>
                  <th className="px-4 py-2.5">Hedef Mağaza Kategorisi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {categoryMapRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-6 text-center text-xs text-zinc-600"
                    >
                      XML içerisinde kategori bulunamadı. 2. adımdan kategori alanı yolunu kontrol edin.
                    </td>
                  </tr>
                ) : (
                  categoryMapRows.map((row, idx) => (
                    <tr key={row.sourceCategory} className="hover:bg-zinc-50">
                      <td className="px-4 py-2.5 font-mono text-xs font-medium text-zinc-900">
                        {row.sourceCategory}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-zinc-700">
                        {row.itemCount}
                      </td>
                      <td className="px-4 py-2.5">
                        <select
                          value={row.categoryId}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCategoryMapRows((prev) =>
                              prev.map((r, i) =>
                                i === idx ? { ...r, categoryId: val } : r
                              )
                            );
                          }}
                          className="w-full max-w-md rounded border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-900"
                        >
                          <option value="">
                            -- Eşlenmedi ({unmatchedCategoryPolicy} politikası uygulanır) --
                          </option>
                          {wizardData.categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.label}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between border-t border-zinc-200 pt-4">
            <button
              type="button"
              onClick={() => setActiveStep(2)}
              className="rounded-md border border-zinc-300 bg-white px-3.5 py-2 text-xs font-medium text-zinc-700"
            >
              Önceki Adım
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleSaveStep3(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
            >
              <Check className="h-4 w-4" />
              <span>Kategorileri Kaydet ve Fiyat/Stok Kurallarına Geç</span>
            </button>
          </div>
        </div>
      ) : null}

      {/* ADIM 4: FİYAT MARJI, YUVARLAMA, STOK EŞİĞİ, GÜNCELLEME POLİTİKASI VE ZAMANLAMA */}
      {activeStep === 4 ? (
        <div className="space-y-6 rounded-md border border-zinc-200 bg-white p-5">
          <div className="border-b border-zinc-200 pb-4">
            <h2 className="text-sm font-bold text-zinc-900">
              Adım 4: Fiyat Marjı, Yuvarlama, Stok Eşiği, Güncelleme Politikası ve Otomatik Zamanlama
            </h2>
            <p className="text-xs text-zinc-600">
              Tedarikçi fiyatlarının mağaza satış fiyatına nasıl dönüştürüleceğini ve mevcut ürünlerin hangi alanlarının güncelleneceğini belirleyin.
            </p>
          </div>

          {/* Fiyat Dönüşüm Kuralları */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-600">
                Fiyat Dönüşümü ve Kâr Marjı
              </h3>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-800">
                    Döviz Kuru Çarpanı
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={transform.currencyMultiplier}
                    onChange={(e) =>
                      setTransform({
                        ...transform,
                        currencyMultiplier: Math.max(
                          0.01,
                          Number(e.target.value) || 1
                        ),
                      })
                    }
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 font-mono text-xs tabular-nums"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-800">
                    XML Fiyatlarında KDV Durumu
                  </label>
                  <select
                    value={transform.sourceIncludesVat ? "incl" : "excl"}
                    onChange={(e) =>
                      setTransform({
                        ...transform,
                        sourceIncludesVat: e.target.value === "incl",
                      })
                    }
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-xs"
                  >
                    <option value="incl">KDV Dahil Geliyor</option>
                    <option value="excl">KDV Hariç Geliyor (Üzerine KDV Ekle)</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-800">
                    Varsayılan KDV Oranı (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={Math.round(transform.vatRateBps / 100)}
                    onChange={(e) =>
                      setTransform({
                        ...transform,
                        vatRateBps: Math.max(
                          0,
                          Math.round((Number(e.target.value) || 0) * 100)
                        ),
                      })
                    }
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 font-mono text-xs tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-800">
                    Kâr Marjı Yöntemi
                  </label>
                  <select
                    value={transform.marginMode}
                    onChange={(e) =>
                      setTransform({
                        ...transform,
                        marginMode: e.target.value as
                          | "PERCENT"
                          | "FIXED"
                          | "TIERED",
                      })
                    }
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-xs"
                  >
                    <option value="PERCENT">Yüzde Marj (%)</option>
                    <option value="FIXED">Sabit Tutar Ekle (TL)</option>
                    <option value="TIERED">
                      Fiyat Aralığına Göre Kademeli Marj
                    </option>
                  </select>
                </div>

                {transform.marginMode !== "FIXED" ? (
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-zinc-800">
                      Yüzde Kâr Marjı (%)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={transform.marginPercentBps / 100}
                      onChange={(e) =>
                        setTransform({
                          ...transform,
                          marginPercentBps: Math.round(
                            (Number(e.target.value) || 0) * 100
                          ),
                        })
                      }
                      className="w-full rounded-md border border-zinc-300 px-3 py-2 font-mono text-xs tabular-nums"
                    />
                  </div>
                ) : null}

                {transform.marginMode !== "PERCENT" ? (
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-zinc-800">
                      Sabit Tutar Ekleme (TL)
                    </label>
                    <input
                      type="number"
                      step="1"
                      value={transform.marginFixedMinor / 100}
                      onChange={(e) =>
                        setTransform({
                          ...transform,
                          marginFixedMinor: Math.round(
                            (Number(e.target.value) || 0) * 100
                          ),
                        })
                      }
                      className="w-full rounded-md border border-zinc-300 px-3 py-2 font-mono text-xs tabular-nums"
                    />
                  </div>
                ) : null}

                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-800">
                    Psikolojik Fiyat Yuvarlama
                  </label>
                  <select
                    value={transform.rounding}
                    onChange={(e) =>
                      setTransform({
                        ...transform,
                        rounding: e.target.value as
                          | "none"
                          | "90"
                          | "99"
                          | "whole",
                      })
                    }
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-xs"
                  >
                    <option value="none">Yuvarlama Yok (Olduğu Gibi)</option>
                    <option value="90">Sonunu ,90 Kuruşa Tamamla</option>
                    <option value="99">Sonunu ,99 Kuruşa Tamamla</option>
                    <option value="whole">Tam Liraya Yuvarla (,00)</option>
                  </select>
                </div>
              </div>

              {/* Kademeli Marj Tablosu */}
              {transform.marginMode === "TIERED" ? (
                <div className="space-y-2 rounded-md border border-zinc-200 bg-[#fafaf9] p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-900">
                      Kademeli Fiyat Aralıkları
                    </span>
                    <button
                      type="button"
                      onClick={addPriceTier}
                      className="inline-flex items-center gap-1 rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-800 hover:bg-zinc-100"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Kademe Ekle</span>
                    </button>
                  </div>
                  {transform.tiers.map((tier, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-1 gap-2 sm:grid-cols-4"
                    >
                      <div>
                        <label className="block text-[11px] text-zinc-600">
                          Üst Sınır (TL&apos;ye kadar)
                        </label>
                        <input
                          type="number"
                          value={tier.upToMinor / 100}
                          onChange={(e) => {
                            const valMinor = Math.max(
                              100,
                              Math.round((Number(e.target.value) || 0) * 100)
                            );
                            setTransform({
                              ...transform,
                              tiers: transform.tiers.map((t, i) =>
                                i === idx ? { ...t, upToMinor: valMinor } : t
                              ),
                            });
                          }}
                          className="w-full rounded border border-zinc-300 bg-white px-2 py-1 font-mono text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-zinc-600">
                          Yüzde Marj (%)
                        </label>
                        <input
                          type="number"
                          value={tier.percentBps / 100}
                          onChange={(e) => {
                            const bps = Math.round(
                              (Number(e.target.value) || 0) * 100
                            );
                            setTransform({
                              ...transform,
                              tiers: transform.tiers.map((t, i) =>
                                i === idx ? { ...t, percentBps: bps } : t
                              ),
                            });
                          }}
                          className="w-full rounded border border-zinc-300 bg-white px-2 py-1 font-mono text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-zinc-600">
                          Sabit Ek (TL)
                        </label>
                        <input
                          type="number"
                          value={tier.fixedMinor / 100}
                          onChange={(e) => {
                            const fixed = Math.round(
                              (Number(e.target.value) || 0) * 100
                            );
                            setTransform({
                              ...transform,
                              tiers: transform.tiers.map((t, i) =>
                                i === idx ? { ...t, fixedMinor: fixed } : t
                              ),
                            });
                          }}
                          className="w-full rounded border border-zinc-300 bg-white px-2 py-1 font-mono text-xs"
                        />
                      </div>
                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={() => removePriceTier(idx)}
                          className="rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs text-[#991b1b] hover:bg-[#fee2e2]"
                        >
                          Kaldır
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            {/* Canlı Fiyat Simülatörü */}
            <div className="space-y-3 rounded-md border border-zinc-200 bg-[#fafaf9] p-4">
              <h3 className="text-xs font-bold text-zinc-900">
                Canlı Fiyat Dönüşüm Simülatörü
              </h3>
              <p className="text-[11px] text-zinc-600">
                Seçtiğiniz döviz, KDV, marj ve yuvarlama kurallarının örnek bir XML fiyatını nasıl dönüştürdüğünü test edin.
              </p>
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-800">
                  Örnek XML Kaynak Fiyatı
                </label>
                <input
                  type="text"
                  value={simulatorInputTl}
                  onChange={(e) => setSimulatorInputTl(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-xs tabular-nums"
                />
              </div>
              <div className="rounded-md border border-zinc-200 bg-white p-3">
                <div className="text-[11px] text-zinc-500">
                  Mağaza Satış Fiyatı (KDV Dahil)
                </div>
                <div className="mt-1 font-mono text-lg font-bold tabular-nums text-[#9a3412]">
                  {formatMoney(simOutputMinor)}
                </div>
              </div>
            </div>
          </div>

          {/* Stok Eşiği ve Metin Kuralları */}
          <div className="grid grid-cols-1 gap-6 border-t border-zinc-200 pt-5 lg:grid-cols-2">
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-600">
                Stok Eşiği ve Başlık Önek / Sonek Kuralları
              </h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-800">
                    Minimum Stok Eşiği
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={transform.minStockThreshold}
                    onChange={(e) =>
                      setTransform({
                        ...transform,
                        minStockThreshold: Math.max(
                          0,
                          Math.floor(Number(e.target.value) || 0)
                        ),
                      })
                    }
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 font-mono text-xs tabular-nums"
                  />
                  <span className="text-[10px] text-zinc-500">
                    Örn: 3 girilirse 3&apos;ün altı 0 sayılır
                  </span>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-800">
                    Başlık Öneki (Prefix)
                  </label>
                  <input
                    type="text"
                    value={transform.titlePrefix}
                    onChange={(e) =>
                      setTransform({
                        ...transform,
                        titlePrefix: e.target.value,
                      })
                    }
                    placeholder="Örn: Atölye"
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-800">
                    Başlık Soneki (Suffix)
                  </label>
                  <input
                    type="text"
                    value={transform.titleSuffix}
                    onChange={(e) =>
                      setTransform({
                        ...transform,
                        titleSuffix: e.target.value,
                      })
                    }
                    placeholder="Örn: Orijinal"
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-2 rounded-md border border-zinc-200 bg-[#fafaf9] p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-900">
                    Metin Bul ve Değiştir Kuralları
                  </span>
                  <button
                    type="button"
                    onClick={addReplacementRule}
                    className="inline-flex items-center gap-1 rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-800"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Kural Ekle</span>
                  </button>
                </div>
                {transform.replacements.map((rule, idx) => (
                  <div key={idx} className="grid grid-cols-5 gap-2">
                    <input
                      type="text"
                      placeholder="Aranan metin"
                      value={rule.find}
                      onChange={(e) =>
                        setTransform({
                          ...transform,
                          replacements: transform.replacements.map((r, i) =>
                            i === idx ? { ...r, find: e.target.value } : r
                          ),
                        })
                      }
                      className="col-span-2 rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Yeni metin"
                      value={rule.replace}
                      onChange={(e) =>
                        setTransform({
                          ...transform,
                          replacements: transform.replacements.map((r, i) =>
                            i === idx ? { ...r, replace: e.target.value } : r
                          ),
                        })
                      }
                      className="col-span-2 rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => removeReplacementRule(idx)}
                      className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-[#991b1b]"
                    >
                      Sil
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Alan Bazında Güncelleme Politikası ve Zamanlama */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-600">
                Alan Bazında Güncelleme Politikası ve Otomatik Zamanlama
              </h3>

              <div className="grid grid-cols-2 gap-3 rounded-md border border-zinc-200 bg-[#fafaf9] p-3">
                <label className="flex items-center gap-2 text-xs font-semibold text-zinc-900">
                  <input
                    type="checkbox"
                    checked={updatePolicy.updatePrice}
                    onChange={(e) =>
                      setUpdatePolicy({
                        ...updatePolicy,
                        updatePrice: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded border-zinc-300"
                  />
                  <span>Fiyatları her senkronda güncelle</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-zinc-900">
                  <input
                    type="checkbox"
                    checked={updatePolicy.updateStock}
                    onChange={(e) =>
                      setUpdatePolicy({
                        ...updatePolicy,
                        updateStock: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded border-zinc-300"
                  />
                  <span>Stokları her senkronda güncelle</span>
                </label>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {(
                  [
                    { key: "titlePolicy", label: "Ürün Başlığı" },
                    { key: "descriptionPolicy", label: "Ürün Açıklaması" },
                    { key: "imagesPolicy", label: "Ürün Görselleri" },
                    { key: "categoryPolicy", label: "Ürün Kategorisi" },
                  ] as const
                ).map((field) => (
                  <div key={field.key}>
                    <label className="mb-1 block text-xs font-semibold text-zinc-800">
                      {field.label} Politikası
                    </label>
                    <select
                      value={updatePolicy[field.key]}
                      onChange={(e) =>
                        setUpdatePolicy({
                          ...updatePolicy,
                          [field.key]: e.target.value as FeedFieldSyncPolicy,
                        })
                      }
                      className="w-full rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs"
                    >
                      <option value="CREATE_ONLY">
                        Sadece ilk oluşturmada, sonra dokunma
                      </option>
                      <option value="ALWAYS">Her senkronda üzerine yaz</option>
                    </select>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-800">
                    XML&apos;den Kalkan Ürünler (Missing Policy)
                  </label>
                  <select
                    value={missingPolicy}
                    onChange={(e) =>
                      setMissingPolicy(
                        e.target.value as "IGNORE" | "ZERO_STOCK" | "DRAFT"
                      )
                    }
                    className="w-full rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs"
                  >
                    <option value="ZERO_STOCK">
                      ZERO_STOCK: Stoğunu sıfırla (Satışa kapat)
                    </option>
                    <option value="DRAFT">
                      DRAFT: Ürünü taslak durumuna çek
                    </option>
                    <option value="IGNORE">IGNORE: Hiçbir şey yapma</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-800">
                    Otomatik Senkron Periyodu (scheduleMinutes)
                  </label>
                  <select
                    value={scheduleMinutes}
                    onChange={(e) =>
                      setScheduleMinutes(Number(e.target.value) || 0)
                    }
                    className="w-full rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs"
                  >
                    <option value={0}>Sadece Elle Çalıştır</option>
                    <option value={15}>Her 15 Dakikada Bir</option>
                    <option value={30}>Her 30 Dakikada Bir</option>
                    <option value={60}>Her 1 Saatte Bir (60 dk)</option>
                    <option value={180}>Her 3 Saatte Bir (180 dk)</option>
                    <option value={360}>Her 6 Saatte Bir (360 dk)</option>
                    <option value={720}>Her 12 Saatte Bir (720 dk)</option>
                    <option value={1440}>Günde Bir Kez (1440 dk)</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-800">
                    Stok Aktarım Deposu
                  </label>
                  <select
                    value={warehouseId}
                    onChange={(e) => setWarehouseId(e.target.value)}
                    className="w-full rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs"
                  >
                    {wizardData.warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-800">
                    Yeni Oluşturulan Ürünlerin Durumu
                  </label>
                  <select
                    value={createAsStatus}
                    onChange={(e) =>
                      setCreateAsStatus(
                        e.target.value === "ACTIVE" ? "ACTIVE" : "DRAFT"
                      )
                    }
                    className="w-full rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs"
                  >
                    <option value="DRAFT">DRAFT (Taslak Olarak Ekle)</option>
                    <option value="ACTIVE">
                      ACTIVE (Doğrudan Vitrinde Yayınla)
                    </option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-between border-t border-zinc-200 pt-4">
            <button
              type="button"
              onClick={() => setActiveStep(3)}
              className="rounded-md border border-zinc-300 bg-white px-3.5 py-2 text-xs font-medium text-zinc-700"
            >
              Önceki Adım
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleSaveStep4(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
            >
              <Check className="h-4 w-4" />
              <span>Kuralları Kaydet ve 5. Adıma (Önizleme / Aktarım) Geç</span>
            </button>
          </div>
        </div>
      ) : null}

      {/* ADIM 5: KURU ÇALIŞTIRMA (ÖNİZLEME), GERÇEK İÇE AKTARMA VE FEEDRUN GEÇMİŞİ */}
      {activeStep === 5 ? (
        <div className="space-y-6 rounded-md border border-zinc-200 bg-white p-5">
          <div className="flex flex-col justify-between gap-4 border-b border-zinc-200 pb-4 lg:flex-row lg:items-center">
            <div>
              <h2 className="text-sm font-bold text-zinc-900">
                Adım 5: Kuru Çalıştırma (Önizleme), Gerçek İçe Aktarma ve Çalışma Raporu
              </h2>
              <p className="text-xs text-zinc-600">
                Veritabanında değişiklik yapmadan ilk 15 ürün için ne değişeceğini önizleyin veya gerçek aktarımı başlatın.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleRunFeed("PREVIEW")}
                className="inline-flex items-center gap-1.5 rounded-md border border-zinc-900 bg-white px-4 py-2 text-xs font-bold text-zinc-900 hover:bg-zinc-100 disabled:opacity-50"
              >
                <Eye className="h-4 w-4" />
                <span>
                  {busy
                    ? "Çalıştırılıyor..."
                    : "Kuru Çalıştırma (Önizleme Başlat)"}
                </span>
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleRunFeed("APPLY")}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#9a3412] px-4 py-2 text-xs font-bold text-white hover:bg-[#7c2d12] disabled:opacity-50"
              >
                <Play className="h-4 w-4" />
                <span>
                  {busy
                    ? "Aktarılıyor..."
                    : "Gerçek İçe Aktarma (Şimdi Uygula)"}
                </span>
              </button>
            </div>
          </div>

          {selectedRun ? (
            <div className="space-y-5">
              {/* Canlı İlerleme Çubuğu */}
              {selectedRun.status === "RUNNING" ? (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ArrowsClockwise className="h-5 w-5 animate-spin text-amber-700" />
                      <span className="text-xs font-bold text-amber-950">
                        Senkronizasyon Devam Ediyor (
                        {selectedRun.mode === "PREVIEW"
                          ? "Önizleme"
                          : "Gerçek Aktarım"}
                        )
                      </span>
                    </div>
                    <span className="font-mono text-xs font-bold text-amber-900">
                      {selectedRun.stats?.total
                        ? `%${Math.min(
                            100,
                            Math.round(
                              (((selectedRun.stats.created ?? 0) +
                                (selectedRun.stats.updated ?? 0) +
                                (selectedRun.stats.unchanged ?? 0) +
                                (selectedRun.stats.skipped ?? 0) +
                                (selectedRun.stats.failed ?? 0)) /
                                selectedRun.stats.total) *
                                100
                            )
                          )}`
                        : "Hazırlanıyor..."}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-amber-800">
                    {selectedRun.message || "XML ürünleri işleniyor..."}
                  </div>
                  {selectedRun.stats && selectedRun.stats.total > 0 && (
                    <div className="mt-3">
                      <div className="h-2 w-full overflow-hidden rounded-full bg-amber-200">
                        <div
                          className="h-full bg-[#9a3412] transition-all duration-300"
                          style={{
                            width: `${Math.min(
                              100,
                              Math.round(
                                (((selectedRun.stats.created ?? 0) +
                                  (selectedRun.stats.updated ?? 0) +
                                  (selectedRun.stats.unchanged ?? 0) +
                                  (selectedRun.stats.skipped ?? 0) +
                                  (selectedRun.stats.failed ?? 0)) /
                                  selectedRun.stats.total) *
                                  100
                              )
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ) : null}

              {/* Seçili Çalışma Özeti */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
                <div className="rounded-md border border-zinc-200 bg-[#fafaf9] p-3">
                  <div className="text-[11px] text-zinc-500">Toplam Okunan</div>
                  <div className="mt-1 font-mono text-base font-bold tabular-nums text-zinc-900">
                    {selectedRun.stats?.total ?? 0}
                  </div>
                </div>
                <div className="rounded-md border border-zinc-200 bg-[#dcfce7]/50 p-3">
                  <div className="text-[11px] font-medium text-[#166534]">
                    Yeni Ürün
                  </div>
                  <div className="mt-1 font-mono text-base font-bold tabular-nums text-[#166534]">
                    {selectedRun.stats?.created ?? 0}
                  </div>
                </div>
                <div className="rounded-md border border-zinc-200 bg-[#ffedd5]/60 p-3">
                  <div className="text-[11px] font-medium text-[#9a3412]">
                    Güncellenen
                  </div>
                  <div className="mt-1 font-mono text-base font-bold tabular-nums text-[#9a3412]">
                    {selectedRun.stats?.updated ?? 0}
                  </div>
                </div>
                <div className="rounded-md border border-zinc-200 bg-[#fafaf9] p-3">
                  <div className="text-[11px] text-zinc-500">Değişmeyen</div>
                  <div className="mt-1 font-mono text-base font-bold tabular-nums text-zinc-800">
                    {selectedRun.stats?.unchanged ?? 0}
                  </div>
                </div>
                <div className="rounded-md border border-zinc-200 bg-[#fef3c7]/60 p-3">
                  <div className="text-[11px] font-medium text-[#92400e]">
                    Atlanan (Skip)
                  </div>
                  <div className="mt-1 font-mono text-base font-bold tabular-nums text-[#92400e]">
                    {selectedRun.stats?.skipped ?? 0}
                  </div>
                </div>
                <div className="rounded-md border border-zinc-200 bg-[#fafaf9] p-3">
                  <div className="text-[11px] text-zinc-500">
                    XML&apos;den Kalkan
                  </div>
                  <div className="mt-1 font-mono text-base font-bold tabular-nums text-zinc-800">
                    {selectedRun.stats?.missing ?? 0}
                  </div>
                </div>
                <div className="rounded-md border border-zinc-200 bg-[#fee2e2]/60 p-3">
                  <div className="text-[11px] font-medium text-[#991b1b]">
                    Hatalı Satır
                  </div>
                  <div className="mt-1 font-mono text-base font-bold tabular-nums text-[#991b1b]">
                    {selectedRun.stats?.failed ?? 0}
                  </div>
                </div>
              </div>

              {/* İlk 15 Ürün Örnek Değişiklik Listesi */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-1.5 text-xs font-bold text-zinc-900">
                    <Table className="h-4 w-4 text-[#9a3412]" />
                    <span>
                      Örnek Değişiklik Listesi (İlk 15 Ürün - Mod:{" "}
                      {selectedRun.mode === "PREVIEW"
                        ? "ÖNİZLEME"
                        : "GERÇEK AKTARIM"}
                      )
                    </span>
                  </h3>
                  <span className="font-mono text-[11px] text-zinc-500">
                    {new Date(selectedRun.createdAt).toLocaleString("tr-TR")}
                  </span>
                </div>

                <div className="overflow-x-auto rounded-md border border-zinc-200">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-zinc-200 bg-[#fafaf9] text-[11px] font-semibold uppercase text-zinc-600">
                        <th className="px-3 py-2.5">İşlem</th>
                        <th className="px-3 py-2.5">Eşleşme Kodu</th>
                        <th className="px-3 py-2.5">Dönüşmüş Ürün Başlığı</th>
                        <th className="px-3 py-2.5">Kategori Eşleşmesi</th>
                        <th className="px-3 py-2.5 text-right">
                          Kaynak / Mağaza Fiyatı
                        </th>
                        <th className="px-3 py-2.5 text-right">
                          Kaynak / Mağaza Stok
                        </th>
                        <th className="px-3 py-2.5 text-right">Varyant</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {selectedRun.sample.length === 0 ? (
                        <tr>
                          <td
                            colSpan={7}
                            className="px-4 py-6 text-center text-xs text-zinc-600"
                          >
                            Bu çalıştırma için örnek ürün kaydı bulunmuyor.
                          </td>
                        </tr>
                      ) : (
                        selectedRun.sample.map((item, idx) => (
                          <tr
                            key={`${item.externalId}-${idx}`}
                            className="hover:bg-zinc-50"
                          >
                            <td className="px-3 py-2.5">
                              <span
                                className={`inline-block rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                                  item.action === "CREATE"
                                    ? "bg-[#dcfce7] text-[#166534]"
                                    : item.action === "UPDATE"
                                      ? "bg-[#ffedd5] text-[#9a3412]"
                                      : item.action === "SKIP"
                                        ? "bg-[#fef3c7] text-[#92400e]"
                                        : "bg-zinc-100 text-zinc-700"
                                }`}
                              >
                                {item.action === "CREATE"
                                  ? "YENİ"
                                  : item.action === "UPDATE"
                                    ? "GÜNCELLE"
                                    : item.action === "SKIP"
                                      ? "ATLA"
                                      : "AYNI"}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 font-mono text-xs text-zinc-800">
                              {item.matchValue || item.externalId}
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="font-medium text-zinc-900">
                                {item.title}
                              </div>
                              {item.reason ? (
                                <div className="text-[11px] text-zinc-500">
                                  {item.reason}
                                </div>
                              ) : null}
                            </td>
                            <td className="px-3 py-2.5 text-xs text-zinc-700">
                              <div>{item.targetCategoryName ?? "Eşlenmedi"}</div>
                              {item.sourceCategory ? (
                                <div className="font-mono text-[10px] text-zinc-500">
                                  XML: {item.sourceCategory}
                                </div>
                              ) : null}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums">
                              <span className="text-zinc-500">
                                {formatMoney(item.sourcePriceMinor)}
                              </span>
                              {" -> "}
                              <span className="font-semibold text-zinc-900">
                                {formatMoney(item.finalPriceMinor)}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums">
                              <span className="text-zinc-500">
                                {item.sourceStock}
                              </span>
                              {" -> "}
                              <span className="font-semibold text-zinc-900">
                                {item.finalStock}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-zinc-800">
                              {item.variantCount}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Hata Raporu */}
              {selectedRun.errors.length > 0 ? (
                <div className="space-y-2 rounded-md border border-[#fecaca] bg-[#fee2e2]/40 p-4">
                  <h4 className="text-xs font-bold text-[#991b1b]">
                    Satır ve Doğrulama Hataları ({selectedRun.errors.length})
                  </h4>
                  <ul className="space-y-1 font-mono text-xs text-[#991b1b]">
                    {selectedRun.errors.map((err, i) => (
                      <li key={i}>
                        [{err.externalId}]: {err.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-md border border-zinc-200 bg-[#fafaf9] p-6 text-center text-xs text-zinc-600">
              Bu kaynak için henüz önizleme veya içe aktarma çalıştırılmadı. Yukarıdaki &quot;Kuru Çalıştırma (Önizleme Başlat)&quot; butonuna tıklayarak ilk simülasyonu başlatın.
            </div>
          )}

          {/* FeedRun Geçmişi */}
          <div className="space-y-2 border-t border-zinc-200 pt-4">
            <h3 className="flex items-center gap-1.5 text-xs font-bold text-zinc-900">
              <ListChecks className="h-4 w-4 text-zinc-700" />
              <span>Çalıştırma Geçmişi (FeedRun Kayıtları)</span>
            </h3>
            <div className="overflow-x-auto rounded-md border border-zinc-200">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 bg-[#fafaf9] text-[11px] font-semibold uppercase text-zinc-600">
                    <th className="px-3 py-2">Tarih</th>
                    <th className="px-3 py-2">Mod / Tetikleyici</th>
                    <th className="px-3 py-2">Durum</th>
                    <th className="px-3 py-2">Özet</th>
                    <th className="px-3 py-2 text-right">Detay</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {wizardData.runs.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-3 py-4 text-center text-xs text-zinc-500"
                      >
                        Henüz geçmiş çalıştırma kaydı yok.
                      </td>
                    </tr>
                  ) : (
                    wizardData.runs.map((r) => (
                      <tr
                        key={r.id}
                        className={
                          selectedRun?.id === r.id
                            ? "bg-zinc-100/80"
                            : "hover:bg-zinc-50"
                        }
                      >
                        <td className="px-3 py-2 font-mono text-xs tabular-nums text-zinc-700">
                          {new Date(r.createdAt).toLocaleString("tr-TR")}
                        </td>
                        <td className="px-3 py-2">
                          <span className="rounded border border-zinc-300 bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-zinc-800">
                            {r.mode}
                          </span>{" "}
                          <span className="text-[11px] text-zinc-500">
                            ({r.trigger})
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                              r.status === "SUCCEEDED"
                                ? "bg-[#dcfce7] text-[#166534]"
                                : r.status === "FAILED"
                                  ? "bg-[#fee2e2] text-[#991b1b]"
                                  : "bg-[#fef3c7] text-[#92400e]"
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs text-zinc-700">
                          {r.message ?? "-"}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedRunId(r.id)}
                            className="rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-800 hover:bg-zinc-100"
                          >
                            Raporu Göster
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
