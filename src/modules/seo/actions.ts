"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import {
  saveSeoGeoSettings,
  runSeoGeoAudit,
  addKeyword,
  updateKeywordRank,
  deleteKeyword,
  applyTemplateToCatalogItem,
  applyTemplateToAllMissing,
  recordBotCrawl,
  recordPerformanceMetric,
  getSeoGeoSettings,
} from "./service";
import type { SeoGeoSettings } from "./types";

export async function saveSeoGeoSettingsAction(formData: FormData): Promise<void> {
  const staff = await requireStaff("settings.manage");
  const current = await getSeoGeoSettings();

  const robotsRaw = String(formData.get("robotsDisallowPaths") ?? "");
  const robotsDisallowPaths = robotsRaw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const sameAsRaw = String(formData.get("brandSameAsLinks") ?? "");
  const brandSameAsLinks = sameAsRaw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const citiesRaw = String(formData.get("serviceAreaCities") ?? "");
  const serviceAreaCities = citiesRaw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const hreflangRaw = String(formData.get("hreflangMappings") ?? "");
  let hreflangMappings = current.hreflangMappings;
  if (hreflangRaw) {
    try {
      const parsed = JSON.parse(hreflangRaw);
      if (Array.isArray(parsed)) {
        hreflangMappings = parsed;
      }
    } catch {
      // JSON geçersiz ise eskiyi koru
    }
  }

  const payload: SeoGeoSettings = {
    defaultTitle: String(formData.get("defaultTitle") ?? current.defaultTitle).trim(),
    titleTemplate: String(formData.get("titleTemplate") ?? current.titleTemplate).trim(),
    defaultDescription: String(formData.get("defaultDescription") ?? current.defaultDescription).trim(),
    defaultKeywords: String(formData.get("defaultKeywords") ?? current.defaultKeywords).trim(),
    canonicalBaseUrl: String(formData.get("canonicalBaseUrl") ?? current.canonicalBaseUrl).trim(),
    ogImageUrl: String(formData.get("ogImageUrl") ?? current.ogImageUrl).trim(),
    twitterHandle: String(formData.get("twitterHandle") ?? current.twitterHandle).trim(),
    robotsDisallowPaths: robotsDisallowPaths.length > 0 ? robotsDisallowPaths : current.robotsDisallowPaths,
    autoGenerateSitemap: formData.get("autoGenerateSitemap") === "on" || formData.get("autoGenerateSitemap") === "true",

    productTitleTemplate: String(formData.get("productTitleTemplate") ?? current.productTitleTemplate).trim(),
    productDescTemplate: String(formData.get("productDescTemplate") ?? current.productDescTemplate).trim(),
    categoryTitleTemplate: String(formData.get("categoryTitleTemplate") ?? current.categoryTitleTemplate).trim(),
    categoryDescTemplate: String(formData.get("categoryDescTemplate") ?? current.categoryDescTemplate).trim(),

    llmsEnabled: formData.get("llmsEnabled") === "on" || formData.get("llmsEnabled") === "true",
    llmsSummary: String(formData.get("llmsSummary") ?? current.llmsSummary).trim(),
    llmsGuidelines: String(formData.get("llmsGuidelines") ?? current.llmsGuidelines).trim(),
    brandEntityName: String(formData.get("brandEntityName") ?? current.brandEntityName).trim(),
    brandEntityType: String(formData.get("brandEntityType") ?? current.brandEntityType).trim(),
    brandFoundingYear: String(formData.get("brandFoundingYear") ?? current.brandFoundingYear).trim(),
    brandSameAsLinks: brandSameAsLinks.length > 0 ? brandSameAsLinks : current.brandSameAsLinks,
    aiDirectAnswersEnabled:
      formData.get("aiDirectAnswersEnabled") === "on" || formData.get("aiDirectAnswersEnabled") === "true",
    aiBotPermissions: {
      gptBot: (formData.get("aiBot_gptBot") as "ALLOW" | "DISALLOW") || current.aiBotPermissions.gptBot,
      perplexityBot:
        (formData.get("aiBot_perplexityBot") as "ALLOW" | "DISALLOW") ||
        current.aiBotPermissions.perplexityBot,
      claudeBot:
        (formData.get("aiBot_claudeBot") as "ALLOW" | "DISALLOW") || current.aiBotPermissions.claudeBot,
      googleExtended:
        (formData.get("aiBot_googleExtended") as "ALLOW" | "DISALLOW") ||
        current.aiBotPermissions.googleExtended,
      applebot:
        (formData.get("aiBot_applebot") as "ALLOW" | "DISALLOW") || current.aiBotPermissions.applebot,
    },

    geoTargetCountry: String(formData.get("geoTargetCountry") ?? current.geoTargetCountry).trim(),
    geoTargetRegion: String(formData.get("geoTargetRegion") ?? current.geoTargetRegion).trim(),
    geoLatitude: parseFloat(String(formData.get("geoLatitude") ?? current.geoLatitude)) || current.geoLatitude,
    geoLongitude:
      parseFloat(String(formData.get("geoLongitude") ?? current.geoLongitude)) || current.geoLongitude,
    geoPostalCode: String(formData.get("geoPostalCode") ?? current.geoPostalCode).trim(),
    geoStreetAddress: String(formData.get("geoStreetAddress") ?? current.geoStreetAddress).trim(),
    serviceAreaCities: serviceAreaCities.length > 0 ? serviceAreaCities : current.serviceAreaCities,
    hreflangMappings,
    openingHours: String(formData.get("openingHours") ?? current.openingHours).trim(),
    priceRange: String(formData.get("priceRange") ?? current.priceRange).trim(),
    googlePlaceId: String(formData.get("googlePlaceId") ?? current.googlePlaceId).trim(),
  };

  await saveSeoGeoSettings(payload);

  await recordAudit({
    staffUserId: staff.id,
    action: "settings.update",
    entityType: "SeoGeoSettings",
    summary: "SEO ve GEO ayarları güncellendi",
  });

  revalidatePath("/admin/seo-geo");
  revalidatePath("/admin/ayarlar");
  revalidatePath("/robots.txt");
  revalidatePath("/sitemap.xml");
  revalidatePath("/llms.txt");
}

export async function runAuditAction(): Promise<void> {
  const staff = await requireStaff();
  const summary = await runSeoGeoAudit();

  await recordAudit({
    staffUserId: staff.id,
    action: "seo.audit",
    entityType: "SeoAuditScore",
    summary: `Canlı SEO/GEO denetimi tamamlandı (Genel Skor: ${summary.overallScore})`,
  });

  revalidatePath("/admin/seo-geo");
}

export async function addKeywordAction(formData: FormData): Promise<void> {
  const staff = await requireStaff("settings.manage");
  const keyword = String(formData.get("keyword") ?? "").trim();
  const targetUrl = String(formData.get("targetUrl") ?? "/").trim();
  const searchEngine = String(formData.get("searchEngine") ?? "google").trim();
  const searchVolume = parseInt(String(formData.get("searchVolume") ?? "0"), 10) || 0;
  const intent = String(formData.get("intent") ?? "COMMERCIAL").trim();
  const difficulty = parseInt(String(formData.get("difficulty") ?? "50"), 10) || 50;
  const currentRank = formData.get("currentRank")
    ? parseInt(String(formData.get("currentRank")), 10)
    : undefined;

  if (!keyword) throw new Error("Anahtar kelime boş olamaz");

  await addKeyword({
    keyword,
    targetUrl,
    searchEngine,
    searchVolume,
    intent,
    difficulty,
    currentRank,
  });

  await recordAudit({
    staffUserId: staff.id,
    action: "seo.keyword.add",
    entityType: "SeoKeyword",
    summary: `İzlenen anahtar kelime eklendi: "${keyword}"`,
  });

  revalidatePath("/admin/seo-geo");
}

export async function updateKeywordRankAction(formData: FormData): Promise<void> {
  const staff = await requireStaff("settings.manage");
  const id = String(formData.get("id") ?? "");
  const rank = parseInt(String(formData.get("rank") ?? "1"), 10);

  if (!id || isNaN(rank) || rank < 1) throw new Error("Geçerli bir sıra giriniz");

  await updateKeywordRank(id, rank);

  await recordAudit({
    staffUserId: staff.id,
    action: "seo.keyword.updateRank",
    entityType: "SeoKeyword",
    entityId: id,
    summary: `Anahtar kelime sırası güncellendi: #${rank}`,
  });

  revalidatePath("/admin/seo-geo");
}

export async function deleteKeywordAction(formData: FormData): Promise<void> {
  const staff = await requireStaff("settings.manage");
  const id = String(formData.get("id") ?? "");

  if (!id) throw new Error("Kelime ID bulunamadı");

  await deleteKeyword(id);

  await recordAudit({
    staffUserId: staff.id,
    action: "seo.keyword.delete",
    entityType: "SeoKeyword",
    entityId: id,
    summary: "İzlenen anahtar kelime silindi",
  });

  revalidatePath("/admin/seo-geo");
}

export async function applyTemplateToCatalogItemAction(formData: FormData): Promise<void> {
  const staff = await requireStaff("catalog.write");
  const id = String(formData.get("id") ?? "");
  const type = String(formData.get("type") ?? "PRODUCT") as "PRODUCT" | "CATEGORY";

  if (!id) throw new Error("Öğe ID bulunamadı");

  await applyTemplateToCatalogItem(id, type);

  await recordAudit({
    staffUserId: staff.id,
    action: "seo.template.apply",
    entityType: type,
    entityId: id,
    summary: `SEO şablonu uygulandı: ${type} #${id}`,
  });

  revalidatePath("/admin/seo-geo");
}

export async function applyTemplateToAllMissingAction(formData: FormData): Promise<void> {
  const staff = await requireStaff("catalog.write");
  const type = String(formData.get("type") ?? "PRODUCT") as "PRODUCT" | "CATEGORY";

  const updatedCount = await applyTemplateToAllMissing(type);

  await recordAudit({
    staffUserId: staff.id,
    action: "seo.template.applyAll",
    entityType: type,
    summary: `Eksik ${type} kayıtlarına toplu SEO şablonu uygulandı (${updatedCount} adet)`,
  });

  revalidatePath("/admin/seo-geo");
}

export async function recordBotCrawlAction(formData: FormData): Promise<void> {
  const staff = await requireStaff();
  const botName = String(formData.get("botName") ?? "GPTBot (ChatGPT Search)");
  const path = String(formData.get("path") ?? "/llms.txt");
  const botCategory = String(formData.get("botCategory") ?? "AI_AGENT");

  await recordBotCrawl({
    botName,
    botCategory,
    path,
    statusCode: 200,
    userAgent: `Simulation Bot 1.0 (${botName})`,
  });

  await recordAudit({
    staffUserId: staff.id,
    action: "seo.crawl.simulate",
    entityType: "BotCrawlLog",
    summary: `Test bot ziyareti simüle edildi: ${botName} -> ${path}`,
  });

  revalidatePath("/admin/seo-geo");
}

export async function recordPerformanceMetricAction(formData: FormData): Promise<void> {
  const staff = await requireStaff("settings.manage");
  const channel = String(formData.get("channel") ?? "GOOGLE_ORGANIC");
  const impressions = parseInt(String(formData.get("impressions") ?? "100"), 10) || 0;
  const clicks = parseInt(String(formData.get("clicks") ?? "10"), 10) || 0;
  const avgPosition = parseFloat(String(formData.get("avgPosition") ?? "3.5")) || 1.0;
  const dateInput = String(formData.get("date") ?? "");
  const date = dateInput ? new Date(dateInput) : new Date();

  await recordPerformanceMetric({
    channel,
    impressions,
    clicks,
    avgPosition,
    date,
  });

  await recordAudit({
    staffUserId: staff.id,
    action: "seo.performance.record",
    entityType: "SearchPerformanceMetric",
    summary: `Arama performans verisi kaydedildi: ${channel} (${clicks} tık)`,
  });

  revalidatePath("/admin/seo-geo");
}
