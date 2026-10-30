"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import {
  Globe,
  Sparkle,
  MapPin,
  ChartBar,
  MagnifyingGlass,
  Robot,
  ArrowUp,
  ArrowDown,
  Minus,
  CheckCircle,
  Warning,
  WarningCircle,
  DeviceMobile,
  Desktop,
  Copy,
  ArrowSquareOut,
  Plus,
  Trash,
  Lightning,
  Tag,
  ArrowsClockwise,
  SlidersHorizontal,
  Code,
  ShieldCheck,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type {
  SeoGeoSettings,
  SeoGeoAuditSummary,
  CatalogSeoIssueItem,
} from "@/modules/seo/types";
import {
  saveSeoGeoSettingsAction,
  runAuditAction,
  addKeywordAction,
  updateKeywordRankAction,
  deleteKeywordAction,
  applyTemplateToCatalogItemAction,
  applyTemplateToAllMissingAction,
  recordBotCrawlAction,
  recordPerformanceMetricAction,
} from "@/modules/seo/actions";

interface KeywordWithHistory {
  id: string;
  keyword: string;
  targetUrl: string;
  searchEngine: string;
  currentRank: number | null;
  previousRank: number | null;
  searchVolume: number;
  intent: string;
  difficulty: number;
  lastCheckedAt: Date;
  history: Array<{ id: string; rank: number; recordedAt: Date }>;
}

interface BotCrawlItem {
  id: string;
  botName: string;
  botCategory: string;
  path: string;
  statusCode: number;
  ip: string | null;
  userAgent: string | null;
  createdAt: Date;
}

interface PerformanceMetricItem {
  id: string;
  date: Date;
  channel: string;
  impressions: number;
  clicks: number;
  ctr: number;
  avgPosition: number;
}

interface AuditHistoryItem {
  id: string;
  overallScore: number;
  seoScore: number;
  geoScore: number;
  localScore: number;
  issuesCount: number;
  warningsCount: number;
  passedCount: number;
  createdAt: Date;
}

export function SeoGeoClient({
  settings,
  audit,
  auditHistory,
  keywords,
  botLogs,
  metrics,
}: {
  settings: SeoGeoSettings;
  audit: SeoGeoAuditSummary;
  auditHistory: AuditHistoryItem[];
  keywords: KeywordWithHistory[];
  botLogs: BotCrawlItem[];
  metrics: PerformanceMetricItem[];
}) {
  const [activeTab, setActiveTab] = React.useState<
    "audit" | "seo" | "geo" | "stats" | "keywords" | "bots"
  >("audit");

  const [isPending, startTransition] = React.useTransition();
  const [serpViewMode, setSerpViewMode] = React.useState<"desktop" | "mobile">("desktop");
  const [copiedLlms, setCopiedLlms] = React.useState(false);
  const [editingRankId, setEditingRankId] = React.useState<string | null>(null);

  // SERP Simülasyon State'leri
  const [serpTitle, setSerpTitle] = React.useState(settings.defaultTitle);
  const [serpDesc, setSerpDesc] = React.useState(settings.defaultDescription);
  const [serpUrl, setSerpUrl] = React.useState(settings.canonicalBaseUrl);

  const handleRunAudit = () => {
    startTransition(async () => {
      await runAuditAction();
    });
  };

  const copyLlmsContent = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLlms(true);
    setTimeout(() => setCopiedLlms(false), 2000);
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return "text-emerald-700 bg-emerald-50 border-emerald-200";
    if (score >= 70) return "text-amber-800 bg-amber-50 border-amber-200";
    return "text-red-700 bg-red-50 border-red-200";
  };

  const getScoreBadge = (score: number) => {
    if (score >= 90) return { label: "Mükemmel (A+)", color: "bg-emerald-100 text-emerald-800" };
    if (score >= 80) return { label: "İyi (B)", color: "bg-emerald-50 text-emerald-700" };
    if (score >= 65) return { label: "Geliştirilmeli (C)", color: "bg-amber-100 text-amber-800" };
    return { label: "Kritik (D)", color: "bg-red-100 text-red-800" };
  };

  // Toplam kanal bazlı tıklama/gösterim
  const channelTotals = React.useMemo(() => {
    const map = new Map<string, { impressions: number; clicks: number; avgPosSum: number; count: number }>();
    for (const m of metrics) {
      const prev = map.get(m.channel) ?? { impressions: 0, clicks: 0, avgPosSum: 0, count: 0 };
      map.set(m.channel, {
        impressions: prev.impressions + m.impressions,
        clicks: prev.clicks + m.clicks,
        avgPosSum: prev.avgPosSum + m.avgPosition,
        count: prev.count + 1,
      });
    }
    return Array.from(map.entries()).map(([channel, data]) => ({
      channel,
      impressions: data.impressions,
      clicks: data.clicks,
      ctr: data.impressions > 0 ? (data.clicks / data.impressions) * 100 : 0,
      avgPosition: data.count > 0 ? data.avgPosSum / data.count : 0,
    }));
  }, [metrics]);

  return (
    <div className="space-y-6">
      {/* BAŞLIK VE HIZLI AKSİYONLAR */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-zinc-900">
              SEO ve GEO Optimizasyon Merkezi
            </h1>
            <Badge variant="neutral" className="border-zinc-300 font-mono text-[11px] text-zinc-700">
              v2.4 Pro
            </Badge>
          </div>
          <p className="mt-1 text-xs text-zinc-600">
            Arama motorları, üretken yapay zekalar (ChatGPT, Perplexity, Gemini) ve coğrafi yerel aramalar için kapsamlı yönetim, denetim ve istatistik paneli.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRunAudit}
            disabled={isPending}
            className="flex items-center gap-1.5"
          >
            <ArrowsClockwise className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} />
            <span>{isPending ? "Taranıyor..." : "Denetimi Yenile"}</span>
          </Button>

          <a
            href="/llms.txt"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition"
          >
            <Sparkle className="h-3.5 w-3.5 text-zinc-900" />
            <span>llms.txt</span>
            <ArrowSquareOut className="h-3 w-3 text-zinc-400" />
          </a>

          <a
            href="/sitemap.xml"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition"
          >
            <Globe className="h-3.5 w-3.5 text-zinc-900" />
            <span>Sitemap.xml</span>
            <ArrowSquareOut className="h-3 w-3 text-zinc-400" />
          </a>

          <a
            href="/robots.txt"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition"
          >
            <Code className="h-3.5 w-3.5 text-zinc-900" />
            <span>Robots.txt</span>
            <ArrowSquareOut className="h-3 w-3 text-zinc-400" />
          </a>
        </div>
      </div>

      {/* KPI KARTLARI */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* 1. Genel Skor */}
        <div className="rounded-md border border-zinc-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs text-zinc-600">
            <span className="font-medium">Genel Sağlık Skoru</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${getScoreBadge(audit.overallScore).color}`}>
              {getScoreBadge(audit.overallScore).label}
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-zinc-900 font-mono tabular-nums">
              {audit.overallScore}
            </span>
            <span className="text-xs text-zinc-600">/ 100</span>
          </div>
          <div className="mt-2 w-full bg-zinc-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-zinc-900 h-1.5 rounded-full transition-all"
              style={{ width: `${audit.overallScore}%` }}
            />
          </div>
          <p className="mt-2 text-[11px] text-zinc-600">
            SEO (%45), GEO AI (%35) ve Coğrafi (%20) ağırlıklı ortalama.
          </p>
        </div>

        {/* 2. Standart SEO */}
        <div className="rounded-md border border-zinc-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs text-zinc-600">
            <span className="font-medium flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 text-zinc-700" />
              Standart SEO
            </span>
            <span className="font-mono text-xs font-semibold text-zinc-900">
              %{audit.seoScore}
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-zinc-900 font-mono tabular-nums">
              {audit.stats.optimizedProducts}
            </span>
            <span className="text-xs text-zinc-600">/ {audit.stats.totalProducts} ürün optimize</span>
          </div>
          <div className="mt-2 w-full bg-zinc-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-emerald-600 h-1.5 rounded-full"
              style={{ width: `${audit.seoScore}%` }}
            />
          </div>
          <p className="mt-2 text-[11px] text-zinc-600">
            Meta etiketleri, OpenGraph ve XML sitemap kapsama oranı.
          </p>
        </div>

        {/* 3. GEO (Generative Engine) */}
        <div className="rounded-md border border-zinc-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs text-zinc-600">
            <span className="font-medium flex items-center gap-1.5">
              <Sparkle className="h-3.5 w-3.5 text-zinc-700" />
              GEO (AI / LLM) Hazırlığı
            </span>
            <span className="font-mono text-xs font-semibold text-zinc-900">
              %{audit.geoScore}
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-zinc-900 font-mono tabular-nums">
              {settings.llmsEnabled ? "Aktif" : "Pasif"}
            </span>
            <span className="text-xs text-zinc-600">
              ({Object.values(settings.aiBotPermissions).filter((v) => v === "ALLOW").length}/5 bot izinli)
            </span>
          </div>
          <div className="mt-2 w-full bg-zinc-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-indigo-600 h-1.5 rounded-full"
              style={{ width: `${audit.geoScore}%` }}
            />
          </div>
          <p className="mt-2 text-[11px] text-zinc-600">
            llms.txt standardı, varlık grafiği ve ChatGPT/Perplexity uyumu.
          </p>
        </div>

        {/* 4. Yerel / Coğrafi SEO */}
        <div className="rounded-md border border-zinc-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs text-zinc-600">
            <span className="font-medium flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-zinc-700" />
              Coğrafi &amp; Yerel SEO
            </span>
            <span className="font-mono text-xs font-semibold text-zinc-900">
              %{audit.localScore}
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-zinc-900 font-mono tabular-nums">
              {settings.serviceAreaCities.length}
            </span>
            <span className="text-xs text-zinc-600">hedef şehir ve bölge</span>
          </div>
          <div className="mt-2 w-full bg-zinc-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-amber-600 h-1.5 rounded-full"
              style={{ width: `${audit.localScore}%` }}
            />
          </div>
          <p className="mt-2 text-[11px] text-zinc-600">
            Harita koordinatları, adres ve hreflang çoklu bölge etiketleri.
          </p>
        </div>
      </div>

      {/* TAB MENÜSÜ */}
      <div className="border-b border-zinc-200">
        <nav className="flex flex-wrap gap-2 sm:gap-6 -mb-px">
          <button
            type="button"
            onClick={() => setActiveTab("audit")}
            className={`flex items-center gap-2 border-b-2 py-3 px-1 text-xs font-medium transition ${
              activeTab === "audit"
                ? "border-zinc-900 text-zinc-900 font-semibold"
                : "border-transparent text-zinc-600 hover:border-zinc-300 hover:text-zinc-800"
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            <span>Denetim ve Katalog Taraması</span>
            {audit.issues.filter((i) => i.type === "CRITICAL").length > 0 && (
              <span className="rounded bg-red-100 px-1.5 py-0.2 text-[10px] font-bold text-red-700">
                {audit.issues.filter((i) => i.type === "CRITICAL").length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("seo")}
            className={`flex items-center gap-2 border-b-2 py-3 px-1 text-xs font-medium transition ${
              activeTab === "seo"
                ? "border-zinc-900 text-zinc-900 font-semibold"
                : "border-transparent text-zinc-600 hover:border-zinc-300 hover:text-zinc-800"
            }`}
          >
            <Globe className="h-4 w-4" />
            <span>Detaylı SEO ve SERP Simülatörü</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("geo")}
            className={`flex items-center gap-2 border-b-2 py-3 px-1 text-xs font-medium transition ${
              activeTab === "geo"
                ? "border-zinc-900 text-zinc-900 font-semibold"
                : "border-transparent text-zinc-600 hover:border-zinc-300 hover:text-zinc-800"
            }`}
          >
            <Sparkle className="h-4 w-4" />
            <span>GEO (AI Arama ve Yerel Optimizasyon)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("stats")}
            className={`flex items-center gap-2 border-b-2 py-3 px-1 text-xs font-medium transition ${
              activeTab === "stats"
                ? "border-zinc-900 text-zinc-900 font-semibold"
                : "border-transparent text-zinc-600 hover:border-zinc-300 hover:text-zinc-800"
            }`}
          >
            <ChartBar className="h-4 w-4" />
            <span>İstatistikler ve Arama Performansı</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("keywords")}
            className={`flex items-center gap-2 border-b-2 py-3 px-1 text-xs font-medium transition ${
              activeTab === "keywords"
                ? "border-zinc-900 text-zinc-900 font-semibold"
                : "border-transparent text-zinc-600 hover:border-zinc-300 hover:text-zinc-800"
            }`}
          >
            <MagnifyingGlass className="h-4 w-4" />
            <span>Kelime Sıralama Takibi ({keywords.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("bots")}
            className={`flex items-center gap-2 border-b-2 py-3 px-1 text-xs font-medium transition ${
              activeTab === "bots"
                ? "border-zinc-900 text-zinc-900 font-semibold"
                : "border-transparent text-zinc-600 hover:border-zinc-300 hover:text-zinc-800"
            }`}
          >
            <Robot className="h-4 w-4" />
            <span>Tarayıcı Bot Günlüğü ({botLogs.length})</span>
          </button>
        </nav>
      </div>

      {/* 1. SEKME: DENETİM VE KATALOG TARAMASI */}
      {activeTab === "audit" && (
        <div className="space-y-6">
          {/* Kritik Bulgular ve Öneriler */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-md border border-zinc-200 bg-white p-4 lg:col-span-2 space-y-3">
              <h2 className="text-sm font-semibold text-zinc-900 flex items-center justify-between">
                <span>Canlı Denetim Bulguları</span>
                <span className="text-xs text-zinc-600 font-normal">
                  Son kontrol: {format(new Date(audit.lastAuditedAt), "dd MMMM HH:mm", { locale: tr })}
                </span>
              </h2>

              <div className="space-y-2.5">
                {audit.issues.map((issue) => (
                  <div
                    key={issue.id}
                    className={`rounded-md border p-3 text-xs flex items-start gap-3 ${
                      issue.type === "CRITICAL"
                        ? "border-red-200 bg-red-50/50 text-red-900"
                        : issue.type === "WARNING"
                        ? "border-amber-200 bg-amber-50/50 text-amber-900"
                        : "border-emerald-200 bg-emerald-50/40 text-emerald-900"
                    }`}
                  >
                    {issue.type === "CRITICAL" ? (
                      <WarningCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                    ) : issue.type === "WARNING" ? (
                      <Warning className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    )}

                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{issue.title}</span>
                        <span className="rounded bg-white/70 px-1 py-0.5 text-[10px] font-mono border border-zinc-200 text-zinc-700">
                          {issue.category}
                        </span>
                      </div>
                      <p className="text-zinc-600">{issue.description}</p>
                      {issue.recommendation && (
                        <p className="text-[11px] font-medium text-zinc-800">
                          Öneri: {issue.recommendation}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Skor Geçmişi ve Hızlı Durum */}
            <div className="rounded-md border border-zinc-200 bg-white p-4 space-y-3">
              <h2 className="text-sm font-semibold text-zinc-900">Denetim Geçmişi (Trend)</h2>
              <p className="text-xs text-zinc-600">
                Sistem periyodik denetimlerde sağlık puanlarını kaydeder.
              </p>

              <div className="space-y-2 divide-y divide-zinc-100">
                {auditHistory.slice(0, 5).map((h) => (
                  <div key={h.id} className="pt-2 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-mono text-zinc-900 font-semibold">
                        {format(new Date(h.createdAt), "dd MMM HH:mm", { locale: tr })}
                      </div>
                      <div className="text-[11px] text-zinc-600">
                        {h.issuesCount} sorun / {h.passedCount} başarılı
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-0.5 rounded font-mono font-bold text-xs ${getScoreColor(h.overallScore)}`}>
                        {h.overallScore} Puan
                      </span>
                    </div>
                  </div>
                ))}
                {auditHistory.length === 0 && (
                  <p className="text-xs text-zinc-600 py-3">Henüz geçmiş denetim kaydı bulunmuyor.</p>
                )}
              </div>
            </div>
          </div>

          {/* Eksik / Optimize Edilmemiş Katalog Öğeleri Tablosu */}
          <div className="rounded-md border border-zinc-200 bg-white p-5 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900">
                  Optimizasyon Bekleyen Katalog Öğeleri ({audit.catalogIssues.length})
                </h2>
                <p className="text-xs text-zinc-600">
                  Özel meta açıklaması bulunmayan veya karakter sınırlarına uymayan ürün ve kategoriler listelenmektedir.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <form action={applyTemplateToAllMissingAction}>
                  <input type="hidden" name="type" value="PRODUCT" />
                  <Button type="submit" variant="outline" size="sm" className="text-xs flex items-center gap-1.5">
                    <Lightning className="h-3.5 w-3.5 text-amber-600" />
                    <span>Tüm Eksik Ürünlere Şablonu Uygula</span>
                  </Button>
                </form>

                <form action={applyTemplateToAllMissingAction}>
                  <input type="hidden" name="type" value="CATEGORY" />
                  <Button type="submit" variant="outline" size="sm" className="text-xs flex items-center gap-1.5">
                    <Lightning className="h-3.5 w-3.5 text-indigo-600" />
                    <span>Tüm Eksik Kategorilere Uygula</span>
                  </Button>
                </form>
              </div>
            </div>

            <div className="overflow-x-auto border border-zinc-200 rounded-md">
              <table className="w-full text-left text-xs text-zinc-700">
                <thead className="border-b border-zinc-200 bg-zinc-50 text-[11px] font-semibold text-zinc-900">
                  <tr>
                    <th className="py-2.5 px-3">Tür</th>
                    <th className="py-2.5 px-3">Öğe Adı</th>
                    <th className="py-2.5 px-3">Mevcut Durum</th>
                    <th className="py-2.5 px-3">Önerilen Şablon Çıktısı</th>
                    <th className="py-2.5 px-3 text-right">Aksiyon</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {audit.catalogIssues.map((item) => (
                    <tr key={item.id} className="hover:bg-zinc-50/50">
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <Badge variant="neutral" className="text-[10px]">
                          {item.type === "PRODUCT" ? "Ürün" : "Kategori"}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 font-medium text-zinc-900">
                        <div>{item.name}</div>
                        <div className="text-[11px] font-mono text-zinc-600">{item.url}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="space-y-1">
                          {item.missingTitle ? (
                            <span className="inline-block rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-800 border border-amber-200 mr-1">
                              Özel Başlık Yok
                            </span>
                          ) : (
                            <span className="text-[11px] text-zinc-600">
                              Başlık: {item.titleLength} kar.
                            </span>
                          )}

                          {item.missingDescription ? (
                            <span className="inline-block rounded bg-red-50 px-1.5 py-0.5 text-[10px] text-red-800 border border-red-200">
                              Meta Açıklama Boş
                            </span>
                          ) : (
                            <span className="text-[11px] text-zinc-600">
                              Açıklama: {item.descriptionLength} kar.
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 max-w-xs truncate">
                        <div className="text-zinc-900 font-medium truncate">{item.suggestedTitle}</div>
                        <div className="text-[11px] text-zinc-600 truncate">{item.suggestedDescription}</div>
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <form action={applyTemplateToCatalogItemAction} className="inline-block">
                          <input type="hidden" name="id" value={item.id} />
                          <input type="hidden" name="type" value={item.type} />
                          <Button type="submit" variant="primary" size="sm" className="text-xs">
                            Şablonu Uygula
                          </Button>
                        </form>
                      </td>
                    </tr>
                  ))}
                  {audit.catalogIssues.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-xs text-zinc-600">
                        Harika! Tüm taranan ürün ve kategorilerin SEO başlık ve açıklamaları optimize edilmiş durumda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. SEKME: DETAYLI SEO VE CANLI SERP SİMÜLATÖRÜ */}
      {activeTab === "seo" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Sol Kolon: SEO Ayarları ve Şablonlar */}
          <div className="lg:col-span-7 space-y-6">
            <form action={saveSeoGeoSettingsAction} className="rounded-md border border-zinc-200 bg-white p-5 space-y-5">
              <div className="border-b border-zinc-200 pb-3">
                <h2 className="text-sm font-semibold text-zinc-900">Genel SEO ve Meta Yapılandırması</h2>
                <p className="text-xs text-zinc-600">
                  Sitenin varsayılan arama motoru başlığı, açıklaması, kanonik URL ve anahtar kelimeleri.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="defaultTitle">Varsayılan Site Başlığı</Label>
                  <Input
                    id="defaultTitle"
                    name="defaultTitle"
                    defaultValue={settings.defaultTitle}
                    onChange={(e) => setSerpTitle(e.target.value)}
                    required
                    className="mt-1"
                  />
                  <p className="mt-1 text-[11px] text-zinc-600">
                    Önerilen: 40 - 60 karakter ({serpTitle.length} karakter)
                  </p>
                </div>

                <div>
                  <Label htmlFor="titleTemplate">Başlık Şablonu (%s sayfa adıyla değişir)</Label>
                  <Input
                    id="titleTemplate"
                    name="titleTemplate"
                    defaultValue={settings.titleTemplate}
                    required
                    className="mt-1 font-mono text-xs"
                  />
                  <p className="mt-1 text-[11px] text-zinc-600">
                    Örnek: %s | Atölye Mağaza
                  </p>
                </div>
              </div>

              <div>
                <Label htmlFor="defaultDescription">Varsayılan Meta Açıklaması (Description)</Label>
                <Textarea
                  id="defaultDescription"
                  name="defaultDescription"
                  defaultValue={settings.defaultDescription}
                  onChange={(e) => setSerpDesc(e.target.value)}
                  className="mt-1 min-h-20"
                />
                <div className="mt-1 flex items-center justify-between text-[11px] text-zinc-600">
                  <span>Google arama snippet'inde gösterilen açıklama metni.</span>
                  <span className={`font-mono ${serpDesc.length > 160 ? "text-red-600 font-semibold" : ""}`}>
                    {serpDesc.length} / 160 karakter
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="canonicalBaseUrl">Kanonik (Canonical) Ana URL</Label>
                  <Input
                    id="canonicalBaseUrl"
                    name="canonicalBaseUrl"
                    defaultValue={settings.canonicalBaseUrl}
                    onChange={(e) => setSerpUrl(e.target.value)}
                    required
                    className="mt-1 font-mono text-xs"
                  />
                </div>

                <div>
                  <Label htmlFor="ogImageUrl">OpenGraph Paylaşım Görsel URL</Label>
                  <Input
                    id="ogImageUrl"
                    name="ogImageUrl"
                    defaultValue={settings.ogImageUrl}
                    placeholder="/uploads/og-default.jpg"
                    className="mt-1 font-mono text-xs"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="defaultKeywords">Varsayılan Anahtar Kelimeler (Meta Keywords)</Label>
                <Input
                  id="defaultKeywords"
                  name="defaultKeywords"
                  defaultValue={settings.defaultKeywords}
                  className="mt-1"
                />
                <p className="mt-1 text-[11px] text-zinc-600">Virgülle ayırarak giriniz.</p>
              </div>

              <div className="border-t border-zinc-200 pt-4 space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-900">
                  Dinamik Şablon Kuralları (Otomasyon)
                </h3>

                <div className="space-y-3">
                  <div>
                    <Label htmlFor="productTitleTemplate">Ürün Başlık Şablonu</Label>
                    <Input
                      id="productTitleTemplate"
                      name="productTitleTemplate"
                      defaultValue={settings.productTitleTemplate}
                      className="mt-1 font-mono text-xs"
                    />
                    <p className="mt-1 text-[11px] text-zinc-600">
                      Kullanılabilir: <code className="bg-zinc-100 px-1 py-0.5 rounded text-zinc-800">{"{urun_adi}"}</code>, <code className="bg-zinc-100 px-1 py-0.5 rounded text-zinc-800">{"{magaza_adi}"}</code>
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="productDescTemplate">Ürün Açıklama Şablonu</Label>
                    <Textarea
                      id="productDescTemplate"
                      name="productDescTemplate"
                      defaultValue={settings.productDescTemplate}
                      className="mt-1 min-h-16 text-xs"
                    />
                  </div>

                  <div>
                    <Label htmlFor="categoryTitleTemplate">Kategori Başlık Şablonu</Label>
                    <Input
                      id="categoryTitleTemplate"
                      name="categoryTitleTemplate"
                      defaultValue={settings.categoryTitleTemplate}
                      className="mt-1 font-mono text-xs"
                    />
                    <p className="mt-1 text-[11px] text-zinc-600">
                      Kullanılabilir: <code className="bg-zinc-100 px-1 py-0.5 rounded text-zinc-800">{"{kategori_adi}"}</code>, <code className="bg-zinc-100 px-1 py-0.5 rounded text-zinc-800">{"{magaza_adi}"}</code>
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="categoryDescTemplate">Kategori Açıklama Şablonu</Label>
                    <Textarea
                      id="categoryDescTemplate"
                      name="categoryDescTemplate"
                      defaultValue={settings.categoryDescTemplate}
                      className="mt-1 min-h-16 text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-zinc-200 pt-4">
                <Label htmlFor="robotsDisallowPaths">robots.txt Engellenen Yollar (Satır veya virgülle ayırın)</Label>
                <Textarea
                  id="robotsDisallowPaths"
                  name="robotsDisallowPaths"
                  defaultValue={settings.robotsDisallowPaths.join("\n")}
                  className="mt-1 font-mono text-xs min-h-20"
                />
              </div>

              <div className="flex justify-end border-t border-zinc-200 pt-4">
                <Button type="submit" variant="primary">
                  SEO Değişikliklerini Kaydet
                </Button>
              </div>
            </form>
          </div>

          {/* Sağ Kolon: Canlı SERP Simülatörü ve JSON-LD Önizleme */}
          <div className="lg:col-span-5 space-y-6">
            {/* SERP Simülatörü */}
            <div className="rounded-md border border-zinc-200 bg-white p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
                <div>
                  <h2 className="text-sm font-semibold text-zinc-900">Google SERP Canlı Önizlemesi</h2>
                  <p className="text-xs text-zinc-600">Arama sonucunda nasıl görüneceğinin simülasyonu.</p>
                </div>

                <div className="flex items-center gap-1 bg-zinc-100 p-0.5 rounded-md">
                  <button
                    type="button"
                    onClick={() => setSerpViewMode("desktop")}
                    className={`p-1.5 rounded text-xs flex items-center gap-1 ${
                      serpViewMode === "desktop" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-600"
                    }`}
                  >
                    <Desktop className="h-3.5 w-3.5" />
                    <span>Masaüstü</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSerpViewMode("mobile")}
                    className={`p-1.5 rounded text-xs flex items-center gap-1 ${
                      serpViewMode === "mobile" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-600"
                    }`}
                  >
                    <DeviceMobile className="h-3.5 w-3.5" />
                    <span>Mobil</span>
                  </button>
                </div>
              </div>

              {/* SERP Kartı */}
              <div
                className={`p-4 rounded-md border border-zinc-200 bg-white transition-all font-sans ${
                  serpViewMode === "mobile" ? "max-w-sm mx-auto shadow-sm" : "w-full"
                }`}
              >
                <div className="flex items-center gap-2 text-xs text-zinc-700">
                  <div className="h-4 w-4 rounded-full bg-zinc-900 flex items-center justify-center text-white text-[9px] font-bold">
                    A
                  </div>
                  <div className="truncate">
                    <span className="font-semibold text-zinc-900">{settings.brandEntityName}</span>
                    <span className="text-zinc-600 font-mono text-[11px] ml-1">
                      {serpUrl.replace(/\/$/, "")}
                    </span>
                  </div>
                </div>

                <div className="mt-1.5">
                  <h3 className="text-base font-medium text-blue-700 hover:underline cursor-pointer leading-tight">
                    {serpTitle || "Sayfa Başlığı"}
                  </h3>
                </div>

                <p className="mt-1 text-xs text-zinc-600 leading-relaxed line-clamp-3">
                  {serpDesc || "Meta açıklaması girilmemiş. Google sayfa içeriğinden otomatik kesit alacaktır."}
                </p>

                <div className="mt-2 flex items-center gap-2 text-[11px] text-zinc-600 border-t border-zinc-100 pt-2">
                  <span>Orijinal Ürünler</span>
                  <span>•</span>
                  <span>Aynı Gün Kargo</span>
                  <span>•</span>
                  <span>14 Gün İade</span>
                </div>
              </div>

              <div className="rounded-md bg-zinc-50 border border-zinc-200 p-3 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-zinc-600">Başlık Genişliği:</span>
                  <span className={`font-mono font-semibold ${serpTitle.length > 60 ? "text-amber-700" : "text-emerald-700"}`}>
                    {serpTitle.length} karakter {serpTitle.length > 60 ? "(Arama sonuçlarında kırpılabilir)" : "(İdeal)"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-600">Açıklama Genişliği:</span>
                  <span className={`font-mono font-semibold ${serpDesc.length > 160 ? "text-red-700" : "text-emerald-700"}`}>
                    {serpDesc.length} / 160 karakter
                  </span>
                </div>
              </div>
            </div>

            {/* Schema.org JSON-LD Önizleyicisi */}
            <div className="rounded-md border border-zinc-200 bg-white p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-zinc-900">Schema.org Yapılandırılmış Veri</h2>
                  <p className="text-xs text-zinc-600">Organization, Store ve WebSite JSON-LD verisi.</p>
                </div>
                <Badge variant="neutral" className="text-[10px] bg-emerald-50 text-emerald-800 border-emerald-200">
                  Vitrine Enjekte Edildi
                </Badge>
              </div>

              <div className="rounded-md bg-zinc-900 p-3 font-mono text-[11px] text-zinc-300 max-h-48 overflow-y-auto">
                <pre>{JSON.stringify({
                  "@context": "https://schema.org",
                  "@type": "Store",
                  "name": settings.brandEntityName,
                  "address": {
                    "@type": "PostalAddress",
                    "streetAddress": settings.geoStreetAddress,
                    "addressLocality": settings.geoTargetRegion,
                    "addressCountry": settings.geoTargetCountry
                  },
                  "geo": {
                    "@type": "GeoCoordinates",
                    "latitude": settings.geoLatitude,
                    "longitude": settings.geoLongitude
                  },
                  "priceRange": settings.priceRange
                }, null, 2)}</pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. SEKME: GEO (AI ARAMA VE COĞRAFİ YEREL OPTİMİZASYON) */}
      {activeTab === "geo" && (
        <form action={saveSeoGeoSettingsAction} className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* SOL: GENERATIVE ENGINE OPTIMIZATION (AI ARAMA) */}
            <div className="rounded-md border border-zinc-200 bg-white p-5 space-y-5">
              <div className="border-b border-zinc-200 pb-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <Sparkle className="h-4 w-4 text-indigo-600" />
                    <h2 className="text-sm font-semibold text-zinc-900">
                      Generative Engine Optimization (GEO)
                    </h2>
                  </div>
                  <p className="text-xs text-zinc-600">
                    ChatGPT Search, Perplexity AI, Google Gemini ve Claude için bilgi mimarisi ve llms.txt.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <label htmlFor="llmsEnabled" className="text-xs font-medium text-zinc-700 cursor-pointer">
                    llms.txt Aktif
                  </label>
                  <input
                    id="llmsEnabled"
                    type="checkbox"
                    name="llmsEnabled"
                    defaultChecked={settings.llmsEnabled}
                    className="h-4 w-4 rounded border-zinc-300 text-zinc-900"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="llmsSummary">AI Ajanları İçin Mağaza Özeti (llms.txt)</Label>
                <Textarea
                  id="llmsSummary"
                  name="llmsSummary"
                  defaultValue={settings.llmsSummary}
                  className="mt-1 min-h-24 text-xs"
                />
                <p className="mt-1 text-[11px] text-zinc-600">
                  AI botları kullanıcıya mağazanızı tanıtırken bu kurumsal özeti doğrudan referans alır.
                </p>
              </div>

              <div>
                <Label htmlFor="llmsGuidelines">AI İçerik ve Satış Kuralları (Store Policies)</Label>
                <Textarea
                  id="llmsGuidelines"
                  name="llmsGuidelines"
                  defaultValue={settings.llmsGuidelines}
                  className="mt-1 min-h-24 text-xs"
                />
                <p className="mt-1 text-[11px] text-zinc-600">
                  Her kuralı yeni satırda belirtiniz (örn: iade süresi, kargo limiti, garanti kapsamı).
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <Label htmlFor="brandEntityName">Varlık Adı</Label>
                  <Input
                    id="brandEntityName"
                    name="brandEntityName"
                    defaultValue={settings.brandEntityName}
                    className="mt-1 text-xs"
                  />
                </div>

                <div>
                  <Label htmlFor="brandEntityType">Varlık Türü</Label>
                  <Input
                    id="brandEntityType"
                    name="brandEntityType"
                    defaultValue={settings.brandEntityType}
                    className="mt-1 text-xs"
                  />
                </div>

                <div>
                  <Label htmlFor="brandFoundingYear">Kuruluş Yılı</Label>
                  <Input
                    id="brandFoundingYear"
                    name="brandFoundingYear"
                    defaultValue={settings.brandFoundingYear}
                    className="mt-1 text-xs"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="brandSameAsLinks">
                  Otoriter Sosyal ve Dış Varlık Profilleri (sameAs)
                </Label>
                <Textarea
                  id="brandSameAsLinks"
                  name="brandSameAsLinks"
                  defaultValue={settings.brandSameAsLinks.join("\n")}
                  className="mt-1 font-mono text-xs min-h-16"
                />
                <p className="mt-1 text-[11px] text-zinc-600">
                  Instagram, LinkedIn, X, Wikidata profil linkleri (her satıra bir tane).
                </p>
              </div>

              {/* AI Bot İzinleri */}
              <div className="border-t border-zinc-200 pt-4 space-y-3">
                <h3 className="text-xs font-semibold text-zinc-900">
                  AI Tarayıcı ve Bot İzinleri (Robots.txt Entegrasyonu)
                </h3>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="flex items-center justify-between rounded border border-zinc-200 p-2 text-xs">
                    <div>
                      <span className="font-semibold text-zinc-900">GPTBot (ChatGPT)</span>
                      <p className="text-[10px] text-zinc-600">OpenAI arama tarayıcısı</p>
                    </div>
                    <select
                      name="aiBot_gptBot"
                      defaultValue={settings.aiBotPermissions.gptBot}
                      className="rounded border border-zinc-200 px-2 py-1 text-xs"
                    >
                      <option value="ALLOW">İzin Ver</option>
                      <option value="DISALLOW">Engelle</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between rounded border border-zinc-200 p-2 text-xs">
                    <div>
                      <span className="font-semibold text-zinc-900">PerplexityBot</span>
                      <p className="text-[10px] text-zinc-600">Perplexity AI arama motoru</p>
                    </div>
                    <select
                      name="aiBot_perplexityBot"
                      defaultValue={settings.aiBotPermissions.perplexityBot}
                      className="rounded border border-zinc-200 px-2 py-1 text-xs"
                    >
                      <option value="ALLOW">İzin Ver</option>
                      <option value="DISALLOW">Engelle</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between rounded border border-zinc-200 p-2 text-xs">
                    <div>
                      <span className="font-semibold text-zinc-900">ClaudeBot</span>
                      <p className="text-[10px] text-zinc-600">Anthropic Claude botu</p>
                    </div>
                    <select
                      name="aiBot_claudeBot"
                      defaultValue={settings.aiBotPermissions.claudeBot}
                      className="rounded border border-zinc-200 px-2 py-1 text-xs"
                    >
                      <option value="ALLOW">İzin Ver</option>
                      <option value="DISALLOW">Engelle</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between rounded border border-zinc-200 p-2 text-xs">
                    <div>
                      <span className="font-semibold text-zinc-900">Google-Extended</span>
                      <p className="text-[10px] text-zinc-600">Gemini &amp; AI Overviews</p>
                    </div>
                    <select
                      name="aiBot_googleExtended"
                      defaultValue={settings.aiBotPermissions.googleExtended}
                      className="rounded border border-zinc-200 px-2 py-1 text-xs"
                    >
                      <option value="ALLOW">İzin Ver</option>
                      <option value="DISALLOW">Engelle</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* SAĞ: COĞRAFİ VE YEREL SEO (LOCAL GEOTARGETING) */}
            <div className="rounded-md border border-zinc-200 bg-white p-5 space-y-5">
              <div className="border-b border-zinc-200 pb-3">
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-amber-600" />
                  <h2 className="text-sm font-semibold text-zinc-900">
                    Coğrafi ve Yerel Hedefleme (Local Geotargeting)
                  </h2>
                </div>
                <p className="text-xs text-zinc-600">
                  Google Haritalar, Apple Haritalar ve bölgesel SERP sonuçları için coğrafi parametreler.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="geoLatitude">Enlem (Latitude)</Label>
                  <Input
                    id="geoLatitude"
                    name="geoLatitude"
                    type="number"
                    step="any"
                    defaultValue={settings.geoLatitude}
                    className="mt-1 font-mono text-xs"
                  />
                </div>

                <div>
                  <Label htmlFor="geoLongitude">Boylam (Longitude)</Label>
                  <Input
                    id="geoLongitude"
                    name="geoLongitude"
                    type="number"
                    step="any"
                    defaultValue={settings.geoLongitude}
                    className="mt-1 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <Label htmlFor="geoStreetAddress">Fiziksel İşletme Adresi</Label>
                  <Input
                    id="geoStreetAddress"
                    name="geoStreetAddress"
                    defaultValue={settings.geoStreetAddress}
                    className="mt-1 text-xs"
                  />
                </div>

                <div>
                  <Label htmlFor="geoPostalCode">Posta Kodu</Label>
                  <Input
                    id="geoPostalCode"
                    name="geoPostalCode"
                    defaultValue={settings.geoPostalCode}
                    className="mt-1 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="geoTargetRegion">Hedef İl / Eyalet</Label>
                  <Input
                    id="geoTargetRegion"
                    name="geoTargetRegion"
                    defaultValue={settings.geoTargetRegion}
                    className="mt-1 text-xs"
                  />
                </div>

                <div>
                  <Label htmlFor="geoTargetCountry">Ülke Kodu (ISO 2)</Label>
                  <Input
                    id="geoTargetCountry"
                    name="geoTargetCountry"
                    defaultValue={settings.geoTargetCountry}
                    className="mt-1 font-mono text-xs uppercase"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="serviceAreaCities">Hizmet Verilen Şehirler ve Bölgeler</Label>
                <Input
                  id="serviceAreaCities"
                  name="serviceAreaCities"
                  defaultValue={settings.serviceAreaCities.join(", ")}
                  className="mt-1 text-xs"
                />
                <p className="mt-1 text-[11px] text-zinc-600">
                  Virgülle ayırarak giriniz (örn: İstanbul, Ankara, İzmir, Bursa, Tüm Türkiye).
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="openingHours">Çalışma Saatleri</Label>
                  <Input
                    id="openingHours"
                    name="openingHours"
                    defaultValue={settings.openingHours}
                    placeholder="Mo-Sa 09:00-18:00"
                    className="mt-1 font-mono text-xs"
                  />
                </div>

                <div>
                  <Label htmlFor="priceRange">Fiyat Segmenti (Schema)</Label>
                  <Input
                    id="priceRange"
                    name="priceRange"
                    defaultValue={settings.priceRange}
                    placeholder="₺₺"
                    className="mt-1 font-mono text-xs"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="googlePlaceId">Google Business / Maps Place ID</Label>
                <Input
                  id="googlePlaceId"
                  name="googlePlaceId"
                  defaultValue={settings.googlePlaceId}
                  placeholder="ChIJ..."
                  className="mt-1 font-mono text-xs"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end rounded-md border border-zinc-200 bg-white p-4">
            <Button type="submit" variant="primary">
              GEO ve Yerel Ayarları Kaydet
            </Button>
          </div>
        </form>
      )}

      {/* 4. SEKME: İSTATİSTİKLER VE ARAMA PERFORMANSI */}
      {activeTab === "stats" && (
        <div className="space-y-6">
          {/* Kanal Bazlı Kartlar */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {channelTotals.map((ch) => (
              <div key={ch.channel} className="rounded-md border border-zinc-200 bg-white p-4">
                <div className="text-[11px] font-semibold text-zinc-600 uppercase tracking-wide">
                  {ch.channel.replace(/_/g, " ")}
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <div>
                    <span className="text-xl font-bold text-zinc-900 font-mono tabular-nums">
                      {ch.clicks}
                    </span>
                    <span className="text-[11px] text-zinc-600 ml-1">tıklama</span>
                  </div>
                  <span className="text-xs font-mono font-medium text-emerald-700">
                    %{ch.ctr.toFixed(1)} CTR
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-600 border-t border-zinc-100 pt-1.5">
                  <span>{ch.impressions.toLocaleString("tr-TR")} gösterim</span>
                  <span className="font-mono">Sıra: #{ch.avgPosition.toFixed(1)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Günlük Arama ve AI Trend Tablosu */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="rounded-md border border-zinc-200 bg-white p-5 lg:col-span-8 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-zinc-900">
                    Son 14 Günlük Performans Günlüğü
                  </h2>
                  <p className="text-xs text-zinc-600">
                    Organik arama ve AI yönlendirmelerinin günlük metrik dökümü.
                  </p>
                </div>
                <Badge variant="neutral" className="font-mono text-[11px]">
                  {metrics.length} Veri Noktası
                </Badge>
              </div>

              <div className="overflow-x-auto border border-zinc-200 rounded-md">
                <table className="w-full text-left text-xs text-zinc-700">
                  <thead className="border-b border-zinc-200 bg-zinc-50 text-[11px] font-semibold text-zinc-900">
                    <tr>
                      <th className="py-2 px-3">Tarih</th>
                      <th className="py-2 px-3">Kanal</th>
                      <th className="py-2 px-3 text-right">Gösterim</th>
                      <th className="py-2 px-3 text-right">Tıklama</th>
                      <th className="py-2 px-3 text-right">CTR</th>
                      <th className="py-2 px-3 text-right">Ort. Sıra</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 font-mono">
                    {metrics.slice(-15).reverse().map((m) => (
                      <tr key={m.id} className="hover:bg-zinc-50/50">
                        <td className="py-2 px-3 text-zinc-900 font-sans">
                          {format(new Date(m.date), "dd MMM yyyy", { locale: tr })}
                        </td>
                        <td className="py-2 px-3 font-sans">
                          <span className="font-medium text-zinc-800">
                            {m.channel.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums text-zinc-600">
                          {m.impressions.toLocaleString("tr-TR")}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums font-semibold text-zinc-900">
                          {m.clicks}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums text-emerald-700">
                          %{m.ctr.toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums text-zinc-700">
                          #{m.avgPosition.toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Yeni Performans Verisi Ekleme Formu */}
            <div className="rounded-md border border-zinc-200 bg-white p-5 lg:col-span-4 space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900">
                  Performans Verisi Kaydet
                </h2>
                <p className="text-xs text-zinc-600">
                  Search Console veya harici arama metriklerini sisteme işleyin.
                </p>
              </div>

              <form action={recordPerformanceMetricAction} className="space-y-3">
                <div>
                  <Label htmlFor="metricChannel">Kanal</Label>
                  <select
                    id="metricChannel"
                    name="channel"
                    className="mt-1 w-full rounded-md border border-zinc-200 p-2 text-xs"
                  >
                    <option value="GOOGLE_ORGANIC">Google Organic</option>
                    <option value="AI_CHATGPT">AI ChatGPT Search</option>
                    <option value="AI_PERPLEXITY">AI Perplexity</option>
                    <option value="AI_GEMINI">AI Google Gemini</option>
                    <option value="BING">Bing Search</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="metricClicks">Tıklama</Label>
                    <Input
                      id="metricClicks"
                      name="clicks"
                      type="number"
                      required
                      placeholder="85"
                      className="mt-1 text-xs"
                    />
                  </div>
                  <div>
                    <Label htmlFor="metricImpressions">Gösterim</Label>
                    <Input
                      id="metricImpressions"
                      name="impressions"
                      type="number"
                      required
                      placeholder="1450"
                      className="mt-1 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="metricAvgPos">Ort. Konum</Label>
                    <Input
                      id="metricAvgPos"
                      name="avgPosition"
                      type="number"
                      step="0.1"
                      required
                      placeholder="3.2"
                      className="mt-1 text-xs"
                    />
                  </div>
                  <div>
                    <Label htmlFor="metricDate">Tarih</Label>
                    <Input
                      id="metricDate"
                      name="date"
                      type="date"
                      defaultValue={new Date().toISOString().split("T")[0]}
                      className="mt-1 text-xs"
                    />
                  </div>
                </div>

                <Button type="submit" variant="primary" className="w-full text-xs">
                  Metriği Sisteme Ekle
                </Button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 5. SEKME: ANAHTAR KELİME SIRALAMA TAKİBİ */}
      {activeTab === "keywords" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Kelime Listesi Tablosu */}
            <div className="rounded-md border border-zinc-200 bg-white p-5 lg:col-span-8 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-zinc-900">
                    Takip Edilen Anahtar Kelimeler ({keywords.length})
                  </h2>
                  <p className="text-xs text-zinc-600">
                    Önemli ticari ve bilgilendirici anahtar kelimelerin arama motoru sıralamaları.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="neutral" className="bg-emerald-50 text-emerald-800 border-emerald-200 font-mono text-[11px]">
                    Top 3: {keywords.filter((k) => k.currentRank && k.currentRank <= 3).length}
                  </Badge>
                  <Badge variant="neutral" className="bg-zinc-100 text-zinc-800 border-zinc-200 font-mono text-[11px]">
                    Top 10: {keywords.filter((k) => k.currentRank && k.currentRank <= 10).length}
                  </Badge>
                </div>
              </div>

              <div className="overflow-x-auto border border-zinc-200 rounded-md">
                <table className="w-full text-left text-xs text-zinc-700">
                  <thead className="border-b border-zinc-200 bg-zinc-50 text-[11px] font-semibold text-zinc-900">
                    <tr>
                      <th className="py-2.5 px-3">Anahtar Kelime</th>
                      <th className="py-2.5 px-3">Hedef URL</th>
                      <th className="py-2.5 px-3 text-center">Sıra</th>
                      <th className="py-2.5 px-3 text-center">Değişim</th>
                      <th className="py-2.5 px-3 text-right">Aylık Hacim</th>
                      <th className="py-2.5 px-3">Niyet</th>
                      <th className="py-2.5 px-3 text-right">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {keywords.map((kw) => {
                      const diff =
                        kw.previousRank && kw.currentRank
                          ? kw.previousRank - kw.currentRank
                          : 0;

                      return (
                        <tr key={kw.id} className="hover:bg-zinc-50/50">
                          <td className="py-2.5 px-3 font-medium text-zinc-900">
                            <div>{kw.keyword}</div>
                            <div className="text-[10px] text-zinc-600 font-mono">
                              Motor: {kw.searchEngine}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-zinc-600 text-[11px] truncate max-w-32">
                            {kw.targetUrl}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {editingRankId === kw.id ? (
                              <form
                                action={async (formData) => {
                                  await updateKeywordRankAction(formData);
                                  setEditingRankId(null);
                                }}
                                className="flex items-center gap-1 justify-center"
                              >
                                <input type="hidden" name="id" value={kw.id} />
                                <input
                                  type="number"
                                  name="rank"
                                  defaultValue={kw.currentRank ?? 1}
                                  className="w-12 text-center rounded border border-zinc-300 p-0.5 text-xs font-mono"
                                  autoFocus
                                />
                                <Button type="submit" size="sm" variant="primary" className="px-1.5 py-0.5 text-[10px]">
                                  ✓
                                </Button>
                              </form>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setEditingRankId(kw.id)}
                                title="Sıralamayı güncellemek için tıklayın"
                                className={`font-mono font-bold px-2 py-0.5 rounded text-xs hover:ring-1 hover:ring-zinc-400 ${
                                  kw.currentRank && kw.currentRank <= 3
                                    ? "bg-emerald-100 text-emerald-800"
                                    : kw.currentRank && kw.currentRank <= 10
                                    ? "bg-zinc-100 text-zinc-900"
                                    : "bg-zinc-50 text-zinc-600"
                                }`}
                              >
                                #{kw.currentRank ?? "-"}
                              </button>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {diff > 0 ? (
                              <span className="inline-flex items-center gap-0.5 text-emerald-700 font-semibold font-mono text-[11px]">
                                <ArrowUp className="h-3 w-3" />+{diff}
                              </span>
                            ) : diff < 0 ? (
                              <span className="inline-flex items-center gap-0.5 text-red-700 font-semibold font-mono text-[11px]">
                                <ArrowDown className="h-3 w-3" />{diff}
                              </span>
                            ) : (
                              <span className="inline-flex items-center text-zinc-400 font-mono text-[11px]">
                                <Minus className="h-3 w-3" />
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-zinc-700">
                            {kw.searchVolume.toLocaleString("tr-TR")}
                          </td>
                          <td className="py-2.5 px-3">
                            <Badge variant="neutral" className="text-[10px]">
                              {kw.intent}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <form action={deleteKeywordAction} className="inline-block">
                              <input type="hidden" name="id" value={kw.id} />
                              <button
                                type="submit"
                                title="Takip listesinden çıkar"
                                className="text-zinc-400 hover:text-red-600 transition p-1"
                              >
                                <Trash className="h-3.5 w-3.5" />
                              </button>
                            </form>
                          </td>
                        </tr>
                      );
                    })}
                    {keywords.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-xs text-zinc-600">
                          Takip edilen anahtar kelime yok. Sağdaki formdan hemen ekleyebilirsiniz.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Yeni Kelime Ekle Formu */}
            <div className="rounded-md border border-zinc-200 bg-white p-5 lg:col-span-4 space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900">
                  Yeni Anahtar Kelime Takibi
                </h2>
                <p className="text-xs text-zinc-600">
                  Listeye eklediğiniz kelimelerin sıralama geçmişi otomatik tutulur.
                </p>
              </div>

              <form action={addKeywordAction} className="space-y-3">
                <div>
                  <Label htmlFor="kw-name">Anahtar Kelime</Label>
                  <Input
                    id="kw-name"
                    name="keyword"
                    required
                    placeholder="örn: ergonomik laptop standı"
                    className="mt-1 text-xs"
                  />
                </div>

                <div>
                  <Label htmlFor="kw-url">Hedef URL</Label>
                  <Input
                    id="kw-url"
                    name="targetUrl"
                    defaultValue="/katalog"
                    className="mt-1 font-mono text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="kw-rank">Başlangıç Sırası</Label>
                    <Input
                      id="kw-rank"
                      name="currentRank"
                      type="number"
                      placeholder="3"
                      className="mt-1 text-xs font-mono"
                    />
                  </div>

                  <div>
                    <Label htmlFor="kw-vol">Aylık Hacim</Label>
                    <Input
                      id="kw-vol"
                      name="searchVolume"
                      type="number"
                      placeholder="12000"
                      className="mt-1 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="kw-intent">Arama Niyeti</Label>
                    <select
                      id="kw-intent"
                      name="intent"
                      className="mt-1 w-full rounded-md border border-zinc-200 p-2 text-xs"
                    >
                      <option value="COMMERCIAL">Ticari (Commercial)</option>
                      <option value="TRANSACTIONAL">Satın Alma (Transactional)</option>
                      <option value="INFORMATIONAL">Bilgilendirici (Informational)</option>
                      <option value="NAVIGATIONAL">Gezinme (Navigational)</option>
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="kw-diff">Zorluk (1-100)</Label>
                    <Input
                      id="kw-diff"
                      name="difficulty"
                      type="number"
                      defaultValue={40}
                      className="mt-1 text-xs font-mono"
                    />
                  </div>
                </div>

                <Button type="submit" variant="primary" className="w-full text-xs">
                  Kelimeyi Takibe Al
                </Button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 6. SEKME: TARAYICI BOT GÜNLÜĞÜ */}
      {activeTab === "bots" && (
        <div className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">
                Arama ve AI Botu Ziyaret Kayıtları ({botLogs.length})
              </h2>
              <p className="text-xs text-zinc-600">
                Googlebot, Bingbot, GPTBot ve PerplexityBot tarafından yapılan canlı tarama istekleri.
              </p>
            </div>

            <form action={recordBotCrawlAction} className="flex items-center gap-2">
              <input type="hidden" name="botName" value="GPTBot (ChatGPT Search)" />
              <input type="hidden" name="path" value="/llms.txt" />
              <input type="hidden" name="botCategory" value="AI_AGENT" />
              <Button type="submit" variant="outline" size="sm" className="text-xs flex items-center gap-1.5">
                <Robot className="h-3.5 w-3.5 text-zinc-700" />
                <span>Test Bot Ziyareti Simüle Et</span>
              </Button>
            </form>
          </div>

          <div className="overflow-x-auto border border-zinc-200 rounded-md bg-white">
            <table className="w-full text-left text-xs text-zinc-700">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-[11px] font-semibold text-zinc-900">
                <tr>
                  <th className="py-2.5 px-3">Tarih / Saat</th>
                  <th className="py-2.5 px-3">Bot Adı</th>
                  <th className="py-2.5 px-3">Kategori</th>
                  <th className="py-2.5 px-3">Taranan Yol</th>
                  <th className="py-2.5 px-3 text-center">Durum Kodu</th>
                  <th className="py-2.5 px-3">User-Agent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 font-mono">
                {botLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-50/50">
                    <td className="py-2.5 px-3 whitespace-nowrap text-zinc-600">
                      {format(new Date(log.createdAt), "dd MMM HH:mm:ss", { locale: tr })}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-zinc-900 font-sans">
                      {log.botName}
                    </td>
                    <td className="py-2.5 px-3 font-sans">
                      <Badge
                        variant="neutral"
                        className={`text-[10px] ${
                          log.botCategory === "AI_AGENT"
                            ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                            : "border-zinc-200 bg-zinc-50 text-zinc-700"
                        }`}
                      >
                        {log.botCategory === "AI_AGENT" ? "AI Ajanı" : "Arama Motoru"}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 text-blue-700 font-medium">{log.path}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="px-1.5 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">
                        {log.statusCode}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[10px] text-zinc-600 truncate max-w-xs" title={log.userAgent ?? ""}>
                      {log.userAgent ?? "-"}
                    </td>
                  </tr>
                ))}
                {botLogs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-xs text-zinc-600 font-sans">
                      Henüz kaydedilmiş bot tarama aktivitesi yok.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
