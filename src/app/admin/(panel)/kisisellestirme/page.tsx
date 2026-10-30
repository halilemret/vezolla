import Link from "next/link";
import { cookies } from "next/headers";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import {
  ArrowsClockwise,
  ArrowSquareOut,
  Eye,
  Funnel,
  Megaphone,
  Plus,
  SlidersHorizontal,
  SplitHorizontal,
  Trash,
} from "@phosphor-icons/react/dist/ssr";
import { db } from "@/lib/db";
import { requireStaff, SEGMENT_PREVIEW_COOKIE } from "@/lib/auth/session";
import { formatMoney } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SEGMENT_FIELD_METADATA } from "@/modules/personalization/segments";
import { listExperimentsWithReports } from "@/modules/personalization/experiments";
import type { SegmentCondition, SegmentRuleGroup } from "@/modules/personalization/schemas";
import {
  activateStorefrontPreviewAction,
  clearStorefrontPreviewAction,
  createExperimentAction,
  deleteAdMappingAction,
  deleteExperimentAction,
  deleteMerchRuleAction,
  deleteSegmentAction,
  rebuildProductAssociationsAction,
  saveAdMappingAction,
  saveMerchRuleAction,
  saveSegmentAction,
  toggleAdMappingAction,
  toggleMerchRuleAction,
  toggleSegmentAction,
  updateExperimentStatusAction,
} from "@/modules/personalization/actions";

export const dynamic = "force-dynamic";

type TabKey = "segmentler" | "reklamlar" | "siralama" | "ab-testleri" | "onizleme";

const TABS: ReadonlyArray<{ key: TabKey; label: string }> = [
  { key: "segmentler", label: "1. Segmentler ve Kural Oluşturucu" },
  { key: "reklamlar", label: "2. Reklam Kimliği Eşleştirme" },
  { key: "siralama", label: "3. Sıralama ve Öne Çıkarma (MerchRule)" },
  { key: "ab-testleri", label: "4. Blok A/B Testleri ve İlişkiler" },
  { key: "onizleme", label: "5. Vitrin Canlı Önizleme Seçicisi" },
];

function formatConditionSummary(c: SegmentCondition): string {
  const opMap: Record<string, string> = {
    eq: "=",
    neq: "!=",
    contains: "içerir",
    in: "içinde",
    gte: ">=",
    lte: "<=",
    is_true: "= Evet",
    is_false: "= Hayır",
  };
  const opLabel = c.operator ? (opMap[c.operator] ?? c.operator) : "=";
  if (c.operator === "is_true" || c.operator === "is_false") {
    return `${c.field} ${opLabel}`;
  }
  const valStr = Array.isArray(c.value) ? c.value.join(", ") : String(c.value ?? "");
  return `${c.field} ${opLabel} ${valStr}`;
}

function parseRulesDisplay(raw: unknown): { match: "ALL" | "ANY"; summaries: string[] } {
  if (!raw || typeof raw !== "object") {
    return { match: "ALL", summaries: [] };
  }
  const group = raw as SegmentRuleGroup;
  const match = group.match === "ANY" ? "ANY" : "ALL";
  const conditions = [
    ...(Array.isArray(group.conditions) ? group.conditions : []),
    ...(Array.isArray(group.rules) ? group.rules : []),
  ];
  return {
    match,
    summaries: conditions.map(formatConditionSummary),
  };
}

export default async function AdminPersonalizationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireStaff("personalization.manage");
  const params = await searchParams;
  const rawTab = typeof params.tab === "string" ? params.tab : "segmentler";
  const activeTab: TabKey = TABS.some((t) => t.key === rawTab)
    ? (rawTab as TabKey)
    : "segmentler";

  const cookieStore = await cookies();
  const activePreviewSegmentId = cookieStore.get(SEGMENT_PREVIEW_COOKIE)?.value ?? null;

  const [
    segments,
    adMappings,
    merchRules,
    experiments,
    homeBlocks,
    products,
    categories,
    customerGroups,
    coPurchaseCount,
    coViewCount,
    topAssociations,
    visitorStats,
  ] = await Promise.all([
    db.segment.findMany({
      include: {
        _count: {
          select: { adMappings: true, variants: true, merchRules: true },
        },
      },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    }),
    db.adMapping.findMany({
      include: {
        segment: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    db.merchRule.findMany({
      include: {
        segment: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
      },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    }),
    listExperimentsWithReports(),
    db.homeBlock.findMany({
      where: { page: "home" },
      include: { variants: { select: { id: true, name: true, weight: true } } },
      orderBy: { position: "asc" },
    }),
    db.product.findMany({
      where: { status: "ACTIVE", deletedAt: null },
      select: {
        id: true,
        title: true,
        slug: true,
        minPrice: true,
        totalStock: true,
      },
      orderBy: { title: "asc" },
      take: 100,
    }),
    db.category.findMany({
      where: { isActive: true },
      select: { id: true, name: true, slug: true },
      orderBy: { name: "asc" },
    }),
    db.customerGroup.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.productAssociation.count({ where: { kind: "CO_PURCHASE" } }),
    db.productAssociation.count({ where: { kind: "CO_VIEW" } }),
    db.productAssociation.findMany({
      orderBy: { score: "desc" },
      take: 8,
    }),
    Promise.all([
      db.visitor.count({ where: { consent: true } }),
      db.visitorEvent.count(),
      db.visitorAffinity.count(),
    ]),
  ]);

  const [consentedVisitorCount, totalEventCount, totalAffinityCount] = visitorStats;
  const productById = new Map(products.map((p) => [p.id, p]));
  const activePreviewSegment = activePreviewSegmentId
    ? segments.find((s) => s.id === activePreviewSegmentId) ?? null
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 border-b border-zinc-200 pb-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900">
            Kişiselleştirme, Reklam Eşleme ve Öneri Motoru
          </h1>
          <p className="mt-1 text-xs text-zinc-600">
            Reklam kimliklerini (ad_id, campaign_id, utm_campaign) segmentlere bağlayın, sıralama
            kurallarını (Pin, Boost, Bury, Hide) ve blok A/B testlerini gerçek dönüşüm verisiyle
            yönetin.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 tabular-nums text-zinc-700">
            Onaylı Profil: <strong className="font-mono text-zinc-900">{consentedVisitorCount}</strong>
          </div>
          <div className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 tabular-nums text-zinc-700">
            Kayıtlı Olay: <strong className="font-mono text-zinc-900">{totalEventCount}</strong>
          </div>
          <div className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 tabular-nums text-zinc-700">
            İlgi Boyutu: <strong className="font-mono text-zinc-900">{totalAffinityCount}</strong>
          </div>
        </div>
      </div>

      {activePreviewSegment ? (
        <div className="flex flex-col justify-between gap-3 rounded-md border border-[#fed7aa] bg-[#ffedd5] px-4 py-3 text-xs text-[#9a3412] sm:flex-row sm:items-center">
          <div>
            <strong>Canlı Önizleme Aktif:</strong> Vitrin şu anda{" "}
            <span className="font-semibold underline">{activePreviewSegment.name}</span> segmenti
            öncelikli olarak görüntüleniyor.
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded border border-[#9a3412] bg-white px-2.5 py-1 font-medium text-[#9a3412] hover:bg-zinc-50"
            >
              <ArrowSquareOut className="h-3.5 w-3.5" />
              Vitrini Aç
            </Link>
            <form action={clearStorefrontPreviewAction}>
              <button
                type="submit"
                className="rounded bg-[#9a3412] px-2.5 py-1 font-medium text-white hover:bg-[#7c2d12]"
              >
                Önizlemeyi Kapat
              </button>
            </form>
          </div>
        </div>
      ) : null}

      <nav
        aria-label="Kişiselleştirme sekmeleri"
        className="flex flex-wrap gap-1.5 border-b border-zinc-200 pb-3"
      >
        {TABS.map((tab) => {
          const isCurrent = tab.key === activeTab;
          return (
            <Link
              key={tab.key}
              href={`/admin/kisisellestirme?tab=${tab.key}`}
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

      {/* SEKME 1: SEGMENTLER VE KURAL OLUŞTURUCU */}
      {activeTab === "segmentler" ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-7">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-900">
                Tanımlı Ziyaretçi Segmentleri ({segments.length})
              </h2>
              <span className="text-xs text-zinc-600">
                Yüksek öncelikli (priority) segment önce eşleşir
              </span>
            </div>

            {segments.length === 0 ? (
              <EmptyState
                title="Henüz tanımlı bir ziyaretçi segmenti yok"
                description="Sağdaki kural oluşturucuyu kullanarak reklam kimliği, cihaz tipi, şehir veya sepet durumuna göre ilk segmentinizi oluşturun."
              />
            ) : (
              <div className="overflow-x-auto rounded-md border border-zinc-200 bg-white">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50 text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                      <th className="px-3.5 py-2.5">Segment ve Açıklama</th>
                      <th className="px-3.5 py-2.5">Kural Ağacı (VE / VEYA)</th>
                      <th className="px-3.5 py-2.5 text-right">Öncelik</th>
                      <th className="px-3.5 py-2.5">Durum</th>
                      <th className="px-3.5 py-2.5 text-right">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {segments.map((seg) => {
                      const parsedRules = parseRulesDisplay(seg.rules);
                      return (
                        <tr key={seg.id} className="align-top hover:bg-zinc-50/70">
                          <td className="px-3.5 py-3">
                            <div className="font-semibold text-zinc-900">{seg.name}</div>
                            {seg.description ? (
                              <p className="mt-0.5 text-zinc-600">{seg.description}</p>
                            ) : null}
                            <div className="mt-1.5 flex flex-wrap gap-2 text-[11px] text-zinc-600 tabular-nums">
                              <span>Reklam: {seg._count.adMappings}</span>
                              <span>Blok Varyantı: {seg._count.variants}</span>
                              <span>Sıralama Kuralı: {seg._count.merchRules}</span>
                            </div>
                          </td>
                          <td className="px-3.5 py-3">
                            <Badge variant={parsedRules.match === "ALL" ? "neutral" : "accent"}>
                              {parsedRules.match === "ALL"
                                ? "TÜMÜ (VE / ALL)"
                                : "HERHANGİ BİRİ (VEYA / ANY)"}
                            </Badge>
                            {parsedRules.summaries.length > 0 ? (
                              <ul className="mt-1.5 space-y-1 font-mono text-[11px] text-zinc-800">
                                {parsedRules.summaries.map((item, idx) => (
                                  <li
                                    key={`${seg.id}-cond-${idx}`}
                                    className="rounded bg-zinc-100 px-1.5 py-0.5"
                                  >
                                    {item}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="mt-1 text-[11px] text-zinc-600">
                                Doğrudan reklam eşleştirmesiyle tetiklenir
                              </p>
                            )}
                          </td>
                          <td className="px-3.5 py-3 text-right font-mono font-semibold tabular-nums text-zinc-900">
                            {seg.priority}
                          </td>
                          <td className="px-3.5 py-3">
                            <Badge variant={seg.isActive ? "success" : "neutral"}>
                              {seg.isActive ? "Aktif" : "Pasif"}
                            </Badge>
                          </td>
                          <td className="px-3.5 py-3 text-right">
                            <div className="flex flex-wrap items-center justify-end gap-1.5">
                              <form action={activateStorefrontPreviewAction}>
                                <input type="hidden" name="segmentId" value={seg.id} />
                                <input type="hidden" name="openStorefront" value="false" />
                                <button
                                  type="submit"
                                  title="Bu segment olarak önizleme çerezini etkinleştir"
                                  className="inline-flex items-center gap-1 rounded border border-zinc-300 bg-white px-2 py-1 text-[11px] font-medium text-zinc-800 hover:bg-zinc-100"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  Önizle
                                </button>
                              </form>
                              <form action={toggleSegmentAction}>
                                <input type="hidden" name="id" value={seg.id} />
                                <input
                                  type="hidden"
                                  name="isActive"
                                  value={seg.isActive ? "false" : "true"}
                                />
                                <button
                                  type="submit"
                                  className="rounded border border-zinc-300 bg-white px-2 py-1 text-[11px] font-medium text-zinc-800 hover:bg-zinc-100"
                                >
                                  {seg.isActive ? "Duraklat" : "Etkinleştir"}
                                </button>
                              </form>
                              <form action={deleteSegmentAction}>
                                <input type="hidden" name="id" value={seg.id} />
                                <button
                                  type="submit"
                                  aria-label={`${seg.name} segmentini sil`}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded border border-red-200 bg-red-50 text-red-800 hover:bg-red-100"
                                >
                                  <Trash className="h-3.5 w-3.5" />
                                </button>
                              </form>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="lg:col-span-5">
            <form
              action={saveSegmentAction}
              className="space-y-4 rounded-md border border-zinc-200 bg-white p-5"
            >
              <div className="flex items-center gap-2 border-b border-zinc-200 pb-3">
                <Funnel className="h-4 w-4 text-zinc-900" />
                <h3 className="text-sm font-semibold text-zinc-900">
                  Segment ve Kural Oluşturucu
                </h3>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <Label htmlFor="seg-name">Segment Adı</Label>
                  <Input
                    id="seg-name"
                    name="name"
                    required
                    placeholder="Örn: Instagram Keten Kampanyası Ziyaretçileri"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="seg-priority">Öncelik (Priority)</Label>
                  <Input
                    id="seg-priority"
                    name="priority"
                    type="number"
                    defaultValue={10}
                    className="mt-1 font-mono tabular-nums"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="seg-desc">Açıklama</Label>
                <Input
                  id="seg-desc"
                  name="description"
                  placeholder="Segmentin iş hedefi veya hedef kitlesi"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="seg-match">Kural Grubu Eşleşme Mantığı</Label>
                <Select id="seg-match" name="match" defaultValue="ALL" className="mt-1">
                  <option value="ALL">VE (ALL): Girilen tüm koşullar aynı anda sağlanmalı</option>
                  <option value="ANY">
                    VEYA (ANY): Girilen koşullardan herhangi biri sağlanmalı
                  </option>
                </Select>
              </div>

              <div className="space-y-3 rounded-md border border-zinc-200 bg-zinc-50 p-3">
                <div className="text-xs font-semibold text-zinc-800">
                  Kural Satırları (Boş bırakılan satırlar yoksayılır)
                </div>

                {[0, 1, 2, 3].map((rowIdx) => (
                  <div
                    key={`rule-row-${rowIdx}`}
                    className="grid grid-cols-1 gap-2 rounded border border-zinc-200 bg-white p-2.5 sm:grid-cols-12"
                  >
                    <div className="sm:col-span-5">
                      <label
                        htmlFor={`cond-field-${rowIdx}`}
                        className="block text-[11px] font-medium text-zinc-600"
                      >
                        Kural Alanı #{rowIdx + 1}
                      </label>
                      <Select
                        id={`cond-field-${rowIdx}`}
                        name="conditionField"
                        defaultValue={rowIdx === 0 ? "utm_campaign" : ""}
                        className="mt-1 min-h-9 py-1 text-xs"
                      >
                        <option value="">Alan seçiniz...</option>
                        {SEGMENT_FIELD_METADATA.map((meta) => (
                          <option key={meta.field} value={meta.field}>
                            {meta.label}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div className="sm:col-span-3">
                      <label
                        htmlFor={`cond-op-${rowIdx}`}
                        className="block text-[11px] font-medium text-zinc-600"
                      >
                        Operatör
                      </label>
                      <Select
                        id={`cond-op-${rowIdx}`}
                        name="conditionOperator"
                        defaultValue="eq"
                        className="mt-1 min-h-9 py-1 text-xs"
                      >
                        <option value="eq">Eşittir (=)</option>
                        <option value="neq">Eşit Değil (!=)</option>
                        <option value="contains">İçerir</option>
                        <option value="in">Listede (virgüllü)</option>
                        <option value="gte">En Az (&gt;=)</option>
                        <option value="lte">En Fazla (&lt;=)</option>
                        <option value="is_true">Evet (True)</option>
                        <option value="is_false">Hayır (False)</option>
                      </Select>
                    </div>

                    <div className="sm:col-span-4">
                      <label
                        htmlFor={`cond-val-${rowIdx}`}
                        className="block text-[11px] font-medium text-zinc-600"
                      >
                        Değer
                      </label>
                      <Input
                        id={`cond-val-${rowIdx}`}
                        name="conditionValue"
                        placeholder={
                          rowIdx === 0
                            ? "Örn: sonbahar_2026"
                            : "Değer (boolean için true/false)"
                        }
                        className="mt-1 min-h-9 py-1 text-xs"
                      />
                    </div>
                  </div>
                ))}

                <div className="text-[11px] text-zinc-600">
                  <strong>Referans Değerler:</strong> Kategoriler:{" "}
                  {categories.length > 0
                    ? categories
                        .slice(0, 5)
                        .map((c) => `${c.name} (${c.slug})`)
                        .join(", ")
                    : "Henüz kategori yok"}
                  . Müşteri Grupları:{" "}
                  {customerGroups.length > 0
                    ? customerGroups.map((g) => g.name).join(", ")
                    : "Henüz grup yok"}
                  .
                </div>
              </div>

              <Button type="submit" variant="primary" className="w-full">
                <Plus className="h-4 w-4" />
                Segmenti Kaydet
              </Button>
            </form>
          </div>
        </div>
      ) : null}

      {/* SEKME 2: REKLAM KİMLİĞİ EŞLEŞTİRME */}
      {activeTab === "reklamlar" ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-7">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-900">
                Reklam ve Kampanya Eşleştirmeleri ({adMappings.length})
              </h2>
              <span className="text-xs text-zinc-600">
                Öncelik sırası: ad_id &gt; adset_id &gt; campaign_id &gt; utm_campaign
              </span>
            </div>

            {adMappings.length === 0 ? (
              <EmptyState
                title="Henüz reklam kimliği eşleştirmesi eklenmemiş"
                description="Meta, Google veya TikTok reklamlarınızdan gelen ad_id, campaign_id ve utm_campaign parametrelerini bir segmente ve öne çıkan ürünlere bağlayın."
              />
            ) : (
              <div className="overflow-x-auto rounded-md border border-zinc-200 bg-white">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50 text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                      <th className="px-3.5 py-2.5">Kampanya ve Platform</th>
                      <th className="px-3.5 py-2.5">Yakalanan Parametre</th>
                      <th className="px-3.5 py-2.5">Segment ve Öne Çıkan Ürünler</th>
                      <th className="px-3.5 py-2.5">Durum</th>
                      <th className="px-3.5 py-2.5 text-right">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {adMappings.map((mapping) => {
                      const featuredTitles = mapping.featuredProductIds
                        .map((pid) => productById.get(pid)?.title ?? pid)
                        .slice(0, 4);
                      const testHref = `/?${encodeURIComponent(mapping.matchField)}=${encodeURIComponent(mapping.matchValue)}`;

                      return (
                        <tr key={mapping.id} className="align-top hover:bg-zinc-50/70">
                          <td className="px-3.5 py-3">
                            <div className="font-semibold text-zinc-900">{mapping.name}</div>
                            <div className="mt-1">
                              <Badge variant="neutral">{mapping.platform}</Badge>
                            </div>
                          </td>
                          <td className="px-3.5 py-3 font-mono text-[11px] text-zinc-900">
                            <span className="rounded bg-zinc-100 px-1.5 py-0.5">
                              {mapping.matchField}={mapping.matchValue}
                            </span>
                            <div className="mt-1.5">
                              <Link
                                href={testHref}
                                target="_blank"
                                className="inline-flex items-center gap-1 font-sans text-[11px] font-medium text-[#9a3412] underline"
                              >
                                <ArrowSquareOut className="h-3 w-3" />
                                Test Bağlantısını Aç
                              </Link>
                            </div>
                          </td>
                          <td className="px-3.5 py-3">
                            <div className="text-zinc-900">
                              <span className="text-zinc-600">Segment: </span>
                              <strong>{mapping.segment?.name ?? "Atanmadı"}</strong>
                            </div>
                            <div className="mt-1 text-[11px] text-zinc-600">
                              Öne Çıkan Ürünler ({mapping.featuredProductIds.length}):{" "}
                              {featuredTitles.length > 0
                                ? featuredTitles.join(", ")
                                : "Ürün seçilmedi"}
                            </div>
                          </td>
                          <td className="px-3.5 py-3">
                            <Badge variant={mapping.isActive ? "success" : "neutral"}>
                              {mapping.isActive ? "Aktif" : "Pasif"}
                            </Badge>
                          </td>
                          <td className="px-3.5 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <form action={toggleAdMappingAction}>
                                <input type="hidden" name="id" value={mapping.id} />
                                <input
                                  type="hidden"
                                  name="isActive"
                                  value={mapping.isActive ? "false" : "true"}
                                />
                                <button
                                  type="submit"
                                  className="rounded border border-zinc-300 bg-white px-2 py-1 text-[11px] font-medium text-zinc-800 hover:bg-zinc-100"
                                >
                                  {mapping.isActive ? "Duraklat" : "Etkinleştir"}
                                </button>
                              </form>
                              <form action={deleteAdMappingAction}>
                                <input type="hidden" name="id" value={mapping.id} />
                                <button
                                  type="submit"
                                  aria-label={`${mapping.name} eşleştirmesini sil`}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded border border-red-200 bg-red-50 text-red-800 hover:bg-red-100"
                                >
                                  <Trash className="h-3.5 w-3.5" />
                                </button>
                              </form>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="lg:col-span-5">
            <form
              action={saveAdMappingAction}
              className="space-y-4 rounded-md border border-zinc-200 bg-white p-5"
            >
              <div className="flex items-center gap-2 border-b border-zinc-200 pb-3">
                <Megaphone className="h-4 w-4 text-zinc-900" />
                <h3 className="text-sm font-semibold text-zinc-900">
                  Reklam Kimliği Eşleştirmesi Ekle
                </h3>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <Label htmlFor="ad-name">Eşleştirme Adı</Label>
                  <Input
                    id="ad-name"
                    name="name"
                    required
                    placeholder="Örn: Meta Keten Gömlek Reels Reklamı"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="ad-platform">Platform</Label>
                  <Select id="ad-platform" name="platform" defaultValue="META" className="mt-1">
                    <option value="META">META (Instagram / FB)</option>
                    <option value="GOOGLE">GOOGLE Ads</option>
                    <option value="TIKTOK">TIKTOK Ads</option>
                    <option value="OTHER">DİĞER</option>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="ad-field">URL Parametre Alanı</Label>
                  <Select id="ad-field" name="matchField" defaultValue="ad_id" className="mt-1">
                    <option value="ad_id">ad_id (Tekil Reklam ID)</option>
                    <option value="adset_id">adset_id (Reklam Seti ID)</option>
                    <option value="campaign_id">campaign_id (Kampanya ID)</option>
                    <option value="utm_campaign">utm_campaign</option>
                    <option value="utm_content">utm_content</option>
                    <option value="utm_source">utm_source</option>
                    <option value="utm_term">utm_term</option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="ad-value">Parametre Değeri</Label>
                  <Input
                    id="ad-value"
                    name="matchValue"
                    required
                    placeholder="Örn: meta_ad_2026_01"
                    className="mt-1 font-mono"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="ad-segment">Bağlanacak Segment (İsteğe Bağlı)</Label>
                <Select id="ad-segment" name="segmentId" defaultValue="" className="mt-1">
                  <option value="">Segment seçilmedi (Yalnızca ürünleri öne çıkar)</option>
                  {segments.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (Öncelik: {s.priority})
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <Label>Bu Reklamdan Gelen Ziyaretçiye İlk Gösterilecek Ürünler</Label>
                <div className="mt-1.5 max-h-48 space-y-1.5 overflow-y-auto rounded-md border border-zinc-300 bg-zinc-50 p-2.5 text-xs">
                  {products.length === 0 ? (
                    <p className="text-zinc-600">Aktif ürün bulunamadı.</p>
                  ) : (
                    products.map((prod) => (
                      <label
                        key={prod.id}
                        className="flex cursor-pointer items-center justify-between gap-2 rounded px-1.5 py-1 hover:bg-white"
                      >
                        <span className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            name="featuredProductIds"
                            value={prod.id}
                            className="h-4 w-4 rounded border-zinc-300 text-zinc-900"
                          />
                          <span className="font-medium text-zinc-900">{prod.title}</span>
                        </span>
                        <span className="font-mono text-[11px] tabular-nums text-zinc-600">
                          {prod.minPrice ? formatMoney(prod.minPrice) : ""} (Stok: {prod.totalStock})
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <Button type="submit" variant="primary" className="w-full">
                <Plus className="h-4 w-4" />
                Reklam Eşleştirmesini Kaydet
              </Button>
            </form>
          </div>
        </div>
      ) : null}

      {/* SEKME 3: SIRALAMA VE ÖNE ÇIKARMA KURALLARI (MERCHRULE) */}
      {activeTab === "siralama" ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-7">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-900">
                Sıralama ve Öne Çıkarma Kuralları ({merchRules.length})
              </h2>
              <span className="text-xs text-zinc-600">
                Stokta olmayan ürünler otomatik olarak listenin sonuna itilir
              </span>
            </div>

            {merchRules.length === 0 ? (
              <EmptyState
                title="Henüz sıralama kuralı (MerchRule) tanımlanmamış"
                description="Belirli bir segment veya kapsam (Ana sayfa, Kategori, Arama) için ürünleri başa sabitleyin (PIN), puanını artırın (BOOST), sona itin (BURY) veya gizleyin (HIDE)."
              />
            ) : (
              <div className="overflow-x-auto rounded-md border border-zinc-200 bg-white">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50 text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                      <th className="px-3.5 py-2.5">Kural ve Eylem</th>
                      <th className="px-3.5 py-2.5">Kapsam ve Segment</th>
                      <th className="px-3.5 py-2.5">Hedef Ürünler</th>
                      <th className="px-3.5 py-2.5 text-right">Öncelik</th>
                      <th className="px-3.5 py-2.5 text-right">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {merchRules.map((rule) => {
                      const actionBadgeVariant =
                        rule.action === "PIN"
                          ? "accent"
                          : rule.action === "BOOST"
                            ? "success"
                            : rule.action === "BURY"
                              ? "warning"
                              : "danger";

                      const targetTitles = rule.productIds
                        .map((pid) => productById.get(pid)?.title ?? pid)
                        .slice(0, 4);

                      return (
                        <tr key={rule.id} className="align-top hover:bg-zinc-50/70">
                          <td className="px-3.5 py-3">
                            <div className="font-semibold text-zinc-900">{rule.name}</div>
                            <div className="mt-1 flex items-center gap-1.5">
                              <Badge variant={actionBadgeVariant}>{rule.action}</Badge>
                              {(rule.action === "BOOST" || rule.action === "BURY") && (
                                <span className="font-mono text-[11px] tabular-nums text-zinc-600">
                                  Çarpan: {rule.weight}x
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3.5 py-3">
                            <div className="font-medium text-zinc-900">Kapsam: {rule.scope}</div>
                            {rule.category ? (
                              <div className="text-[11px] text-zinc-600">
                                Kategori: {rule.category.name}
                              </div>
                            ) : null}
                            {rule.searchTerm ? (
                              <div className="text-[11px] text-zinc-600">
                                Arama Terimi: &quot;{rule.searchTerm}&quot;
                              </div>
                            ) : null}
                            <div className="mt-0.5 text-[11px] text-zinc-600">
                              Segment: <strong>{rule.segment?.name ?? "Tüm Ziyaretçiler"}</strong>
                            </div>
                          </td>
                          <td className="px-3.5 py-3 text-[11px] text-zinc-700">
                            <div>
                              {targetTitles.join(", ")}
                              {rule.productIds.length > 4
                                ? ` +${rule.productIds.length - 4} ürün`
                                : ""}
                            </div>
                            {rule.startsAt || rule.endsAt ? (
                              <div className="mt-1 font-mono text-[10px] text-zinc-500 tabular-nums">
                                {rule.startsAt
                                  ? format(rule.startsAt, "dd MMM yyyy", { locale: tr })
                                  : "Başlangıçsız"}{" "}
                                /{" "}
                                {rule.endsAt
                                  ? format(rule.endsAt, "dd MMM yyyy", { locale: tr })
                                  : "Süresiz"}
                              </div>
                            ) : null}
                          </td>
                          <td className="px-3.5 py-3 text-right font-mono font-semibold tabular-nums text-zinc-900">
                            {rule.priority}
                          </td>
                          <td className="px-3.5 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <form action={toggleMerchRuleAction}>
                                <input type="hidden" name="id" value={rule.id} />
                                <input
                                  type="hidden"
                                  name="isActive"
                                  value={rule.isActive ? "false" : "true"}
                                />
                                <button
                                  type="submit"
                                  className="rounded border border-zinc-300 bg-white px-2 py-1 text-[11px] font-medium text-zinc-800 hover:bg-zinc-100"
                                >
                                  {rule.isActive ? "Aktif" : "Pasif"}
                                </button>
                              </form>
                              <form action={deleteMerchRuleAction}>
                                <input type="hidden" name="id" value={rule.id} />
                                <button
                                  type="submit"
                                  aria-label={`${rule.name} kuralını sil`}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded border border-red-200 bg-red-50 text-red-800 hover:bg-red-100"
                                >
                                  <Trash className="h-3.5 w-3.5" />
                                </button>
                              </form>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="lg:col-span-5">
            <form
              action={saveMerchRuleAction}
              className="space-y-4 rounded-md border border-zinc-200 bg-white p-5"
            >
              <div className="flex items-center gap-2 border-b border-zinc-200 pb-3">
                <SlidersHorizontal className="h-4 w-4 text-zinc-900" />
                <h3 className="text-sm font-semibold text-zinc-900">
                  Yeni Sıralama / Öne Çıkarma Kuralı
                </h3>
              </div>

              <div>
                <Label htmlFor="merch-name">Kural Adı</Label>
                <Input
                  id="merch-name"
                  name="name"
                  required
                  placeholder="Örn: Yeni Sezon Keten Ürünleri Başa Sabitle"
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="merch-action">Sıralama Eylemi</Label>
                  <Select id="merch-action" name="action" defaultValue="PIN" className="mt-1">
                    <option value="PIN">PIN (En Başa Sabitle)</option>
                    <option value="BOOST">BOOST (Puan Çarpanıyla Yükselt)</option>
                    <option value="BURY">BURY (Listenin Sonuna İt)</option>
                    <option value="HIDE">HIDE (Listeden Gizle)</option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="merch-scope">Uygulama Kapsamı</Label>
                  <Select id="merch-scope" name="scope" defaultValue="ALL" className="mt-1">
                    <option value="ALL">ALL (Tüm Vitrin ve Listeler)</option>
                    <option value="HOME">HOME (Yalnızca Ana Sayfa Şeritleri)</option>
                    <option value="CATEGORY">CATEGORY (Kategori Sayfası)</option>
                    <option value="SEARCH">SEARCH (Arama Sonuçları)</option>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="merch-segment">Hedef Segment</Label>
                  <Select id="merch-segment" name="segmentId" defaultValue="" className="mt-1">
                    <option value="">Tüm Ziyaretçiler</option>
                    {segments.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="merch-category">Kategori Filtresi (İsteğe Bağlı)</Label>
                  <Select id="merch-category" name="categoryId" defaultValue="" className="mt-1">
                    <option value="">Tüm Kategoriler</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <Label htmlFor="merch-search">Arama Sorgusu</Label>
                  <Input
                    id="merch-search"
                    name="searchTerm"
                    placeholder="Örn: keten"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="merch-weight">Çarpan (Weight)</Label>
                  <Input
                    id="merch-weight"
                    name="weight"
                    type="number"
                    step="0.1"
                    defaultValue={2}
                    className="mt-1 font-mono tabular-nums"
                  />
                </div>
                <div>
                  <Label htmlFor="merch-priority">Öncelik</Label>
                  <Input
                    id="merch-priority"
                    name="priority"
                    type="number"
                    defaultValue={10}
                    className="mt-1 font-mono tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="merch-starts">Başlangıç Tarihi (İsteğe Bağlı)</Label>
                  <Input id="merch-starts" name="startsAt" type="date" className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="merch-ends">Bitiş Tarihi (İsteğe Bağlı)</Label>
                  <Input id="merch-ends" name="endsAt" type="date" className="mt-1" />
                </div>
              </div>

              <div>
                <Label>Kuralın Uygulanacağı Ürünler</Label>
                <div className="mt-1.5 max-h-48 space-y-1.5 overflow-y-auto rounded-md border border-zinc-300 bg-zinc-50 p-2.5 text-xs">
                  {products.map((prod) => (
                    <label
                      key={prod.id}
                      className="flex cursor-pointer items-center justify-between gap-2 rounded px-1.5 py-1 hover:bg-white"
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          name="productIds"
                          value={prod.id}
                          className="h-4 w-4 rounded border-zinc-300 text-zinc-900"
                        />
                        <span className="font-medium text-zinc-900">{prod.title}</span>
                      </span>
                      <span className="font-mono text-[11px] tabular-nums text-zinc-600">
                        Stok: {prod.totalStock}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <Button type="submit" variant="primary" className="w-full">
                <Plus className="h-4 w-4" />
                Sıralama Kuralını Kaydet
              </Button>
            </form>
          </div>
        </div>
      ) : null}

      {/* SEKME 4: BLOK A/B TESTLERİ VE İLİŞKİ HESAPLAYICI */}
      {activeTab === "ab-testleri" ? (
        <div className="space-y-6">
          <section className="rounded-md border border-zinc-200 bg-white p-5">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900">
                  Birlikte Satın Alma (CO_PURCHASE) ve Görüntüleme (CO_VIEW) İlişki Motoru
                </h2>
                <p className="mt-1 text-xs text-zinc-600">
                  Gerçek sipariş satırlarından ve ziyaretçi ürün inceleme geçmişinden ürün birliktelik
                  puanlarını (ProductAssociation) hesaplar.
                </p>
                <div className="mt-2 flex flex-wrap gap-4 text-xs text-zinc-800 tabular-nums">
                  <span>
                    Birlikte Satın Alınan Çiftler (CO_PURCHASE):{" "}
                    <strong className="font-mono">{coPurchaseCount}</strong>
                  </span>
                  <span>
                    Birlikte İncelenen Çiftler (CO_VIEW):{" "}
                    <strong className="font-mono">{coViewCount}</strong>
                  </span>
                </div>
              </div>

              <form action={rebuildProductAssociationsAction}>
                <Button type="submit" variant="primary" size="sm">
                  <ArrowsClockwise className="h-4 w-4" />
                  Birlikte Satın Alma / Görüntüleme İlişkilerini Yeniden Hesapla
                </Button>
              </form>
            </div>

            {topAssociations.length > 0 ? (
              <div className="mt-4 overflow-x-auto border-t border-zinc-200 pt-3">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-[11px] font-semibold uppercase text-zinc-500">
                      <th className="py-1.5">Ana Ürün</th>
                      <th className="py-1.5">İlişkili Ürün</th>
                      <th className="py-1.5">İlişki Türü</th>
                      <th className="py-1.5 text-right">Birliktelik Puanı</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {topAssociations.map((assoc) => (
                      <tr key={`${assoc.productId}-${assoc.relatedProductId}-${assoc.kind}`}>
                        <td className="py-1.5 font-medium text-zinc-900">
                          {productById.get(assoc.productId)?.title ?? assoc.productId}
                        </td>
                        <td className="py-1.5 text-zinc-800">
                          {productById.get(assoc.relatedProductId)?.title ?? assoc.relatedProductId}
                        </td>
                        <td className="py-1.5">
                          <Badge variant={assoc.kind === "CO_PURCHASE" ? "accent" : "neutral"}>
                            {assoc.kind}
                          </Badge>
                        </td>
                        <td className="py-1.5 text-right font-mono tabular-nums text-zinc-900">
                          {assoc.score.toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="space-y-4 lg:col-span-8">
              <h2 className="text-sm font-semibold text-zinc-900">
                Blok A/B Testleri ve Gerçek Dönüşüm Tablosu ({experiments.length})
              </h2>

              {experiments.length === 0 ? (
                <EmptyState
                  title="Henüz oluşturulmuş bir A/B testi bulunmuyor"
                  description="Sağdaki formu kullanarak ana sayfa bloklarınız için trafik ağırlıklı varyant testi başlatın ve gerçek dönüşüm oranlarını izleyin."
                />
              ) : (
                <div className="space-y-4">
                  {experiments.map((exp) => (
                    <div
                      key={exp.id}
                      className="rounded-md border border-zinc-200 bg-white p-4"
                    >
                      <div className="flex flex-col justify-between gap-2 border-b border-zinc-200 pb-3 sm:flex-row sm:items-center">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-zinc-900">{exp.name}</h3>
                            <Badge
                              variant={
                                exp.status === "RUNNING"
                                  ? "success"
                                  : exp.status === "PAUSED"
                                    ? "warning"
                                    : "neutral"
                              }
                            >
                              {exp.status}
                            </Badge>
                          </div>
                          <p className="mt-0.5 text-xs text-zinc-600">
                            Blok: <strong>{exp.blockName}</strong> ({exp.blockType}) | Hedef Metrik:{" "}
                            <strong className="font-mono">{exp.goal}</strong>
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {exp.status !== "RUNNING" ? (
                            <form action={updateExperimentStatusAction}>
                              <input type="hidden" name="id" value={exp.id} />
                              <input type="hidden" name="status" value="RUNNING" />
                              <button
                                type="submit"
                                className="rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-800 hover:bg-zinc-100"
                              >
                                Başlat
                              </button>
                            </form>
                          ) : (
                            <form action={updateExperimentStatusAction}>
                              <input type="hidden" name="id" value={exp.id} />
                              <input type="hidden" name="status" value="PAUSED" />
                              <button
                                type="submit"
                                className="rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-800 hover:bg-zinc-100"
                              >
                                Duraklat
                              </button>
                            </form>
                          )}
                          {exp.status !== "COMPLETED" ? (
                            <form action={updateExperimentStatusAction}>
                              <input type="hidden" name="id" value={exp.id} />
                              <input type="hidden" name="status" value="COMPLETED" />
                              <button
                                type="submit"
                                className="rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-800 hover:bg-zinc-100"
                              >
                                Tamamla
                              </button>
                            </form>
                          ) : null}
                          <form action={deleteExperimentAction}>
                            <input type="hidden" name="id" value={exp.id} />
                            <button
                              type="submit"
                              aria-label={`${exp.name} testini sil`}
                              className="inline-flex h-7 w-7 items-center justify-center rounded border border-red-200 bg-red-50 text-red-800 hover:bg-red-100"
                            >
                              <Trash className="h-3.5 w-3.5" />
                            </button>
                          </form>
                        </div>
                      </div>

                      <div className="mt-3 overflow-x-auto">
                        <table className="w-full border-collapse text-left text-xs">
                          <thead>
                            <tr className="border-b border-zinc-200 bg-zinc-50 text-[11px] font-semibold uppercase text-zinc-600">
                              <th className="px-3 py-2">Varyant</th>
                              <th className="px-3 py-2 text-right">Ağırlık</th>
                              <th className="px-3 py-2 text-right">Atanan Ziyaretçi</th>
                              <th className="px-3 py-2 text-right">Görüntülenme</th>
                              <th className="px-3 py-2 text-right">Tıklama (CTR)</th>
                              <th className="px-3 py-2 text-right">Sepete Ekleme</th>
                              <th className="px-3 py-2 text-right">Satın Alma (Dönüşüm)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-200 font-mono tabular-nums">
                            {exp.variants.map((v) => (
                              <tr key={v.variantId} className="hover:bg-zinc-50">
                                <td className="px-3 py-2.5 font-sans">
                                  <span className="font-semibold text-zinc-900">
                                    {v.variantName}
                                  </span>
                                  {v.isLeader ? (
                                    <Badge variant="success" className="ml-2">
                                      Önde
                                    </Badge>
                                  ) : null}
                                </td>
                                <td className="px-3 py-2.5 text-right text-zinc-700">
                                  %{v.weight}
                                </td>
                                <td className="px-3 py-2.5 text-right text-zinc-900">
                                  {v.assignedVisitors}
                                </td>
                                <td className="px-3 py-2.5 text-right text-zinc-900">
                                  {v.impressions}
                                </td>
                                <td className="px-3 py-2.5 text-right text-zinc-900">
                                  {v.clicks} (%{v.ctrPercent.toFixed(2)})
                                </td>
                                <td className="px-3 py-2.5 text-right text-zinc-900">
                                  {v.addToCarts} (%{v.addToCartRatePercent.toFixed(2)})
                                </td>
                                <td className="px-3 py-2.5 text-right font-semibold text-zinc-900">
                                  {v.purchases} (%{v.purchaseConversionPercent.toFixed(2)})
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="lg:col-span-4">
              <form
                action={createExperimentAction}
                className="space-y-4 rounded-md border border-zinc-200 bg-white p-5"
              >
                <div className="flex items-center gap-2 border-b border-zinc-200 pb-3">
                  <SplitHorizontal className="h-4 w-4 text-zinc-900" />
                  <h3 className="text-sm font-semibold text-zinc-900">
                    Yeni Blok A/B Testi Başlat
                  </h3>
                </div>

                <div>
                  <Label htmlFor="exp-name">Test Adı</Label>
                  <Input
                    id="exp-name"
                    name="name"
                    required
                    placeholder="Örn: Ana Sayfa Ürün Şeridi Algoritma Testi"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="exp-block">Test Edilecek Ana Sayfa Bloğu</Label>
                  <Select id="exp-block" name="blockId" required className="mt-1">
                    {homeBlocks.length === 0 ? (
                      <option value="">Önce Ana Sayfa Bloğu oluşturun</option>
                    ) : (
                      homeBlocks.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.type})
                        </option>
                      ))
                    )}
                  </Select>
                </div>

                <div>
                  <Label htmlFor="exp-goal">Birincil Dönüşüm Hedefi</Label>
                  <Select id="exp-goal" name="goal" defaultValue="purchase" className="mt-1">
                    <option value="purchase">Satın Alma Dönüşümü (purchase)</option>
                    <option value="add_to_cart">Sepete Ekleme Oranı (add_to_cart)</option>
                    <option value="block_click">Blok Tıklama Oranı (block_click)</option>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="exp-wa">Varyant A Ağırlık (%)</Label>
                    <Input
                      id="exp-wa"
                      name="variantAWeight"
                      type="number"
                      min={1}
                      max={99}
                      defaultValue={50}
                      className="mt-1 font-mono tabular-nums"
                    />
                  </div>
                  <div>
                    <Label htmlFor="exp-wb">Varyant B Ağırlık (%)</Label>
                    <Input
                      id="exp-wb"
                      name="variantBWeight"
                      type="number"
                      min={1}
                      max={99}
                      defaultValue={50}
                      className="mt-1 font-mono tabular-nums"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="exp-vb-name">Varyant B Adı</Label>
                  <Input
                    id="exp-vb-name"
                    name="variantBName"
                    defaultValue="Varyant B (Kişiselleştirilmiş)"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="exp-vb-title">Varyant B Başlığı (İsteğe Bağlı)</Label>
                  <Input
                    id="exp-vb-title"
                    name="variantBTitle"
                    placeholder="Örn: İlginize Göre Seçilenler"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="exp-vb-source">
                    Varyant B Öneri Kaynağı (Ürün Şeridi İse)
                  </Label>
                  <Select id="exp-vb-source" name="variantBSource" defaultValue="for_you" className="mt-1">
                    <option value="for_you">Sana Özel (VisitorAffinity)</option>
                    <option value="ad_campaign">Reklam Kampanyası Ürünleri</option>
                    <option value="associated">Birlikte Alınanlar / Bakılanlar</option>
                    <option value="recently_viewed">Son İncelenen Ürünler</option>
                    <option value="abandoned_cart">Sepette Bekleyenler</option>
                    <option value="cold_start">Çok Satanlar (Cold Start)</option>
                  </Select>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  disabled={homeBlocks.length === 0}
                  className="w-full"
                >
                  <Plus className="h-4 w-4" />
                  A/B Testini Oluştur ve Başlat
                </Button>
              </form>
            </div>
          </div>
        </div>
      ) : null}

      {/* SEKME 5: VİTRİN CANLI ÖNİZLEME SEÇİCİSİ */}
      {activeTab === "onizleme" ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <form
              action={activateStorefrontPreviewAction}
              className="space-y-4 rounded-md border border-zinc-200 bg-white p-5"
            >
              <div className="flex items-center gap-2 border-b border-zinc-200 pb-3">
                <Eye className="h-4 w-4 text-zinc-900" />
                <h2 className="text-sm font-semibold text-zinc-900">
                  Ana Sayfayı Belirli Bir Segment veya Reklam Kimliğiyle Aç
                </h2>
              </div>

              <p className="text-xs text-zinc-600">
                Seçtiğiniz segment çerez olarak (`{SEGMENT_PREVIEW_COOKIE}`) tarayıcınıza atanır ve
                vitrinde en yüksek öncelikli segment olarak değerlendirilir.
              </p>

              <div>
                <Label htmlFor="prev-segment">Önizlenecek Segment</Label>
                <Select
                  id="prev-segment"
                  name="segmentId"
                  defaultValue={activePreviewSegmentId ?? ""}
                  className="mt-1"
                >
                  <option value="">Normal Ziyaretçi (Önizleme Segmenti Yok)</option>
                  {segments.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (Öncelik: {s.priority})
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <Label htmlFor="prev-admap">Kayıtlı Reklam Eşleştirmesi Simülasyonu</Label>
                <Select id="prev-admap" name="adMappingId" defaultValue="" className="mt-1">
                  <option value="">Reklam eşleştirmesi seçilmedi</option>
                  {adMappings.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.matchField}={m.matchValue})
                    </option>
                  ))}
                </Select>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="prev-adid">Manuel ad_id</Label>
                  <Input
                    id="prev-adid"
                    name="ad_id"
                    placeholder="Örn: meta_ad_101"
                    className="mt-1 font-mono"
                  />
                </div>
                <div>
                  <Label htmlFor="prev-cmpid">Manuel campaign_id</Label>
                  <Input
                    id="prev-cmpid"
                    name="campaign_id"
                    placeholder="Örn: cmp_yaz_2026"
                    className="mt-1 font-mono"
                  />
                </div>
                <div>
                  <Label htmlFor="prev-utmcmp">Manuel utm_campaign</Label>
                  <Input
                    id="prev-utmcmp"
                    name="utm_campaign"
                    placeholder="Örn: sonbahar_lansman"
                    className="mt-1 font-mono"
                  />
                </div>
                <div>
                  <Label htmlFor="prev-utmsrc">Manuel utm_source</Label>
                  <Input
                    id="prev-utmsrc"
                    name="utm_source"
                    placeholder="Örn: instagram"
                    className="mt-1 font-mono"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="submit"
                  name="openStorefront"
                  value="true"
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
                >
                  <ArrowSquareOut className="h-4 w-4" />
                  Vitrini Bu Ziyaretçi Kimliğiyle Aç
                </button>
                <button
                  type="submit"
                  name="openStorefront"
                  value="false"
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-4 py-2 text-xs font-medium text-zinc-900 hover:bg-zinc-50"
                >
                  Yalnızca Önizleme Çerezini Kaydet
                </button>
              </div>
            </form>
          </div>

          <div className="space-y-4 lg:col-span-6">
            <div className="rounded-md border border-zinc-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-zinc-900">
                Hızlı Segment ve Reklam Kısayolları
              </h3>
              <p className="mt-1 text-xs text-zinc-600">
                Aşağıdaki hazır bağlantılarla ana sayfayı doğrudan ilgili reklam parametresiyle yeni
                sekmede test edebilirsiniz.
              </p>

              <div className="mt-4 divide-y divide-zinc-200">
                {adMappings.map((m) => {
                  const previewUrl = `/?${encodeURIComponent(m.matchField)}=${encodeURIComponent(m.matchValue)}`;
                  return (
                    <div
                      key={m.id}
                      className="flex items-center justify-between gap-3 py-2.5 text-xs"
                    >
                      <div>
                        <div className="font-semibold text-zinc-900">{m.name}</div>
                        <div className="font-mono text-[11px] text-zinc-600">
                          {previewUrl}
                        </div>
                      </div>
                      <Link
                        href={previewUrl}
                        target="_blank"
                        className="inline-flex items-center gap-1 rounded border border-zinc-300 bg-white px-2.5 py-1 font-medium text-zinc-900 hover:bg-zinc-100"
                      >
                        <ArrowSquareOut className="h-3.5 w-3.5" />
                        Yeni Sekmede Aç
                      </Link>
                    </div>
                  );
                })}
                {adMappings.length === 0 ? (
                  <p className="py-4 text-xs text-zinc-600">
                    Henüz kayıtlı reklam eşleştirmesi bulunmuyor.
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
