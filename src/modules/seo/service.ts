import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import {
  DEFAULT_SEO_GEO_SETTINGS,
  seoGeoSettingsSchema,
  type SeoGeoSettings,
  type SeoAuditIssue,
  type CatalogSeoIssueItem,
  type SeoGeoAuditSummary,
} from "./types";
import { formatMoney } from "@/lib/money";

export async function getSeoGeoSettings(): Promise<SeoGeoSettings> {
  const row = await db.setting.findUnique({ where: { key: "seo_geo" } });
  if (row) {
    const parsed = seoGeoSettingsSchema.safeParse(row.value);
    if (parsed.success) return parsed.data;
  }

  // Eski "seo" ayarı varsa onu temel alıp zenginleştirelim
  const oldRow = await db.setting.findUnique({ where: { key: "seo" } });
  if (oldRow && typeof oldRow.value === "object" && oldRow.value !== null) {
    const merged = { ...DEFAULT_SEO_GEO_SETTINGS, ...oldRow.value };
    const parsed = seoGeoSettingsSchema.safeParse(merged);
    if (parsed.success) return parsed.data;
  }

  return DEFAULT_SEO_GEO_SETTINGS;
}

export async function saveSeoGeoSettings(
  input: SeoGeoSettings
): Promise<SeoGeoSettings> {
  const data = seoGeoSettingsSchema.parse(input);

  // seo_geo anahtarını kaydet
  await db.setting.upsert({
    where: { key: "seo_geo" },
    create: {
      key: "seo_geo",
      value: data as unknown as Prisma.InputJsonValue,
    },
    update: {
      value: data as unknown as Prisma.InputJsonValue,
    },
  });

  // Eski seo ayarı ile çift yönlü uyumluluk
  await db.setting.upsert({
    where: { key: "seo" },
    create: {
      key: "seo",
      value: {
        defaultTitle: data.defaultTitle,
        titleTemplate: data.titleTemplate,
        defaultDescription: data.defaultDescription,
        ogImageUrl: data.ogImageUrl,
        robotsDisallowPaths: data.robotsDisallowPaths,
      } as unknown as Prisma.InputJsonValue,
    },
    update: {
      value: {
        defaultTitle: data.defaultTitle,
        titleTemplate: data.titleTemplate,
        defaultDescription: data.defaultDescription,
        ogImageUrl: data.ogImageUrl,
        robotsDisallowPaths: data.robotsDisallowPaths,
      } as unknown as Prisma.InputJsonValue,
    },
  });

  return data;
}

export async function runSeoGeoAudit(): Promise<SeoGeoAuditSummary> {
  const [settings, products, categories, pages, trackedKeywordsCount, botVisitsCount, metrics] =
    await Promise.all([
      getSeoGeoSettings(),
      db.product.findMany({
        where: { deletedAt: null },
        select: { id: true, title: true, slug: true, seoTitle: true, seoDescription: true, minPrice: true },
        take: 100,
      }),
      db.category.findMany({
        where: { isActive: true },
        select: { id: true, name: true, slug: true, description: true },
        take: 100,
      }),
      db.page.findMany({
        where: { status: "PUBLISHED" },
        select: { id: true, title: true, slug: true, seoTitle: true, seoDescription: true },
      }),
      db.seoKeyword.count(),
      db.botCrawlLog.count({
        where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      }),
      db.searchPerformanceMetric.findMany({
        where: { date: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      }),
    ]);

  const issues: SeoAuditIssue[] = [];
  const catalogIssues: CatalogSeoIssueItem[] = [];

  // 1. Standart SEO Denetimi
  let missingProductTitleCount = 0;
  let missingProductDescCount = 0;

  for (const product of products) {
    const hasCustomTitle = Boolean(product.seoTitle && product.seoTitle.trim().length > 0);
    const hasCustomDesc = Boolean(product.seoDescription && product.seoDescription.trim().length > 0);
    const title = product.seoTitle || product.title;
    const desc = product.seoDescription || "";

    const suggestedTitle = settings.productTitleTemplate
      .replace(/{urun_adi}/g, product.title)
      .replace(/{magaza_adi}/g, settings.defaultTitle);

    const suggestedDescription = settings.productDescTemplate
      .replace(/{urun_adi}/g, product.title)
      .replace(/{magaza_adi}/g, settings.defaultTitle);

    if (!hasCustomTitle) missingProductTitleCount++;
    if (!hasCustomDesc) missingProductDescCount++;

    if (!hasCustomTitle || !hasCustomDesc || title.length < 20 || title.length > 70) {
      if (catalogIssues.length < 25) {
        catalogIssues.push({
          id: product.id,
          type: "PRODUCT",
          name: product.title,
          slug: product.slug,
          url: `/urun/${product.slug}`,
          currentTitle: product.seoTitle,
          currentDescription: product.seoDescription,
          suggestedTitle,
          suggestedDescription,
          missingTitle: !hasCustomTitle,
          missingDescription: !hasCustomDesc,
          titleLength: (product.seoTitle || product.title).length,
          descriptionLength: (product.seoDescription || "").length,
        });
      }
    }
  }

  // Kategori Kontrolü
  for (const cat of categories) {
    const suggestedTitle = settings.categoryTitleTemplate
      .replace(/{kategori_adi}/g, cat.name)
      .replace(/{magaza_adi}/g, settings.defaultTitle);

    const suggestedDescription = settings.categoryDescTemplate
      .replace(/{kategori_adi}/g, cat.name)
      .replace(/{magaza_adi}/g, settings.defaultTitle);

    if (!cat.description && catalogIssues.length < 35) {
      catalogIssues.push({
        id: cat.id,
        type: "CATEGORY",
        name: cat.name,
        slug: cat.slug,
        url: `/kategori/${cat.slug}`,
        currentTitle: null,
        currentDescription: cat.description,
        suggestedTitle,
        suggestedDescription,
        missingTitle: true,
        missingDescription: true,
        titleLength: cat.name.length,
        descriptionLength: (cat.description || "").length,
      });
    }
  }

  // SEO Puanı Hesaplama
  let seoScore = 95;
  if (missingProductDescCount > 0) {
    const penalty = Math.min(25, Math.ceil((missingProductDescCount / Math.max(1, products.length)) * 25));
    seoScore -= penalty;
    issues.push({
      id: "seo-product-desc",
      type: missingProductDescCount > 10 ? "CRITICAL" : "WARNING",
      category: "SEO",
      title: `${missingProductDescCount} üründe özel SEO meta açıklaması tanımlanmamış`,
      description: "Meta açıklaması eksik sayfalar arama motorlarında dinamik kırpılmış içerikle listelenir ve CTR düşer.",
      recommendation: "Şablon kurallarını kullanarak tüm eksik ürünlere otomatik açıklama atayabilirsiniz.",
      affectedCount: missingProductDescCount,
    });
  } else {
    issues.push({
      id: "seo-product-desc-ok",
      type: "PASSED",
      category: "SEO",
      title: "Tüm taranan ürünlerde meta açıklaması mevcut",
      description: "Arama sonuçlarında zengin ve optimize snippet'ler görüntülenecektir.",
    });
  }

  if (settings.ogImageUrl && settings.ogImageUrl.length > 5) {
    issues.push({
      id: "seo-og-image-ok",
      type: "PASSED",
      category: "SEO",
      title: "Sosyal Medya OpenGraph görseli aktif",
      description: `Varsayılan paylaşım görseli: ${settings.ogImageUrl}`,
    });
  } else {
    seoScore -= 10;
    issues.push({
      id: "seo-og-image-missing",
      type: "WARNING",
      category: "SEO",
      title: "Varsayılan OpenGraph (sosyal paylaşım) görseli boş",
      description: "WhatsApp, Twitter ve LinkedIn paylaşımlarında boş veya kırık önizleme çıkabilir.",
      recommendation: "1200x630 piksel boyutunda kurumsal bir sosyal paylaşım görseli yükleyin.",
    });
  }

  if (settings.canonicalBaseUrl && settings.canonicalBaseUrl.startsWith("http")) {
    issues.push({
      id: "seo-canonical-ok",
      type: "PASSED",
      category: "SEO",
      title: "Canonical ana URL doğrulandı",
      description: `Kanonik kök: ${settings.canonicalBaseUrl}`,
    });
  } else {
    seoScore -= 8;
    issues.push({
      id: "seo-canonical-warn",
      type: "WARNING",
      category: "SEO",
      title: "Canonical Base URL geçerli bir HTTP/HTTPS adresi değil",
      description: "Arama motorlarının tekil URL belirlemesi için geçerli bir alan adı girilmelidir.",
    });
  }

  // 2. GEO - Generative Engine Optimization (AI / LLM) Denetimi
  let geoScore = 95;

  if (settings.llmsEnabled && settings.llmsSummary.length > 60) {
    issues.push({
      id: "geo-llms-ok",
      type: "PASSED",
      category: "GEO",
      title: "llms.txt AI Arama standardı aktif ve zengin",
      description: "ChatGPT, Perplexity ve Claude modelleri mağaza özetini doğrudan tarayabiliyor.",
    });
  } else {
    geoScore -= 25;
    issues.push({
      id: "geo-llms-warn",
      type: "CRITICAL",
      category: "GEO",
      title: "llms.txt özeti yetersiz veya pasif",
      description: "Yapay zeka modelleri e-ticaret sitenizi doğru analiz edemez ve ürünlerinizi doğrudan tavsiye edemez.",
      recommendation: "GEO panelinden llms.txt açıklamasını ve mağaza rehberini doldurun.",
    });
  }

  if (settings.brandEntityName && settings.brandEntityType && settings.brandSameAsLinks.length > 0) {
    issues.push({
      id: "geo-brand-entity-ok",
      type: "PASSED",
      category: "GEO",
      title: "Marka Varlık Grafiği (Entity Knowledge Graph) eksiksiz",
      description: `${settings.brandSameAsLinks.length} adet harici otoriter profil ve varlık türü (${settings.brandEntityType}) tanımlı.`,
    });
  } else {
    geoScore -= 15;
    issues.push({
      id: "geo-brand-entity-missing",
      type: "WARNING",
      category: "GEO",
      title: "Marka Bilgi Grafiği (Entity) eksik tanımlandı",
      description: "Yapay zekanın markanızı otoriter bir satıcı olarak tanıması için sosyal ve kurumsal profiller eklenmelidir.",
    });
  }

  const allowedAiBots = Object.entries(settings.aiBotPermissions).filter(([, v]) => v === "ALLOW").length;
  if (allowedAiBots >= 4) {
    issues.push({
      id: "geo-ai-bots-ok",
      type: "PASSED",
      category: "GEO",
      title: `AI Bot erişim izinleri açık (${allowedAiBots}/5 bot)`,
      description: "GPTBot, PerplexityBot ve ClaudeBot mağaza içeriğinizi dizinleyebilir.",
    });
  } else {
    geoScore -= 15;
    issues.push({
      id: "geo-ai-bots-blocked",
      type: "WARNING",
      category: "GEO",
      title: "Bazı önemli AI botlarının erişimi engellenmiş",
      description: "Engellenen botlar AI Overviews ve üretken aramalarda ürünlerinizi referans gösteremez.",
    });
  }

  // 3. GEO - Coğrafi ve Yerel SEO Denetimi
  let localScore = 95;

  if (settings.geoLatitude && settings.geoLongitude && settings.geoStreetAddress) {
    issues.push({
      id: "local-coords-ok",
      type: "PASSED",
      category: "LOCAL",
      title: "Coğrafi koordinatlar ve işletme adresi tanımlı",
      description: `Enlem: ${settings.geoLatitude}, Boylam: ${settings.geoLongitude} - ${settings.geoStreetAddress}`,
    });
  } else {
    localScore -= 20;
    issues.push({
      id: "local-coords-missing",
      type: "WARNING",
      category: "LOCAL",
      title: "Fiziksel / Coğrafi konum koordinatları eksik",
      description: "Harita servisleri ve yerel aramalarda (Local Pack) görünürlük için koordinat gereklidir.",
    });
  }

  if (settings.serviceAreaCities.length >= 3) {
    issues.push({
      id: "local-cities-ok",
      type: "PASSED",
      category: "LOCAL",
      title: `Hizmet ve sevkiyat alanı tanımlandı (${settings.serviceAreaCities.length} bölge)`,
      description: settings.serviceAreaCities.slice(0, 4).join(", ") + "...",
    });
  } else {
    localScore -= 10;
    issues.push({
      id: "local-cities-warn",
      type: "WARNING",
      category: "LOCAL",
      title: "Hizmet verilen şehir sayısı yetersiz",
      description: "Bölgesel arama sorgularında hedef kitlenizi yakalamak için şehir listesini genişletin.",
    });
  }

  if (settings.hreflangMappings.length > 0) {
    issues.push({
      id: "local-hreflang-ok",
      type: "PASSED",
      category: "LOCAL",
      title: `Uluslararası hedefleme (Hreflang) aktif (${settings.hreflangMappings.length} dil/bölge)`,
      description: settings.hreflangMappings.map((m) => `${m.lang}-${m.region}`).join(", "),
    });
  } else {
    localScore -= 15;
    issues.push({
      id: "local-hreflang-missing",
      type: "WARNING",
      category: "LOCAL",
      title: "Hreflang dil ve bölge eşleştirmesi eksik",
      description: "Farklı ülke ve dillerdeki ziyaretçilere doğru para ve dil sürümünü sunmak için gereklidir.",
    });
  }

  // Genel Ağırlıklı Puan
  seoScore = Math.max(0, Math.min(100, seoScore));
  geoScore = Math.max(0, Math.min(100, geoScore));
  localScore = Math.max(0, Math.min(100, localScore));
  const overallScore = Math.round(seoScore * 0.45 + geoScore * 0.35 + localScore * 0.2);

  const criticalCount = issues.filter((i) => i.type === "CRITICAL").length;
  const warningCount = issues.filter((i) => i.type === "WARNING").length;
  const passedCount = issues.filter((i) => i.type === "PASSED").length;

  // Skor kaydını veritabanına ekle
  await db.seoAuditScore.create({
    data: {
      overallScore,
      seoScore,
      geoScore,
      localScore,
      issuesCount: criticalCount + warningCount,
      warningsCount: warningCount,
      passedCount,
      details: {
        criticalCount,
        warningCount,
        passedCount,
        missingProductTitleCount,
        missingProductDescCount,
      } as unknown as Prisma.InputJsonValue,
    },
  });

  // Metrik istatistikleri
  const monthlyImpressions = metrics.reduce((acc, m) => acc + m.impressions, 0);
  const monthlyClicks = metrics.reduce((acc, m) => acc + m.clicks, 0);
  const avgCtr = monthlyImpressions > 0 ? (monthlyClicks / monthlyImpressions) * 100 : 0;
  const avgPosition =
    metrics.length > 0
      ? metrics.reduce((acc, m) => acc + m.avgPosition, 0) / metrics.length
      : 0;

  return {
    overallScore,
    seoScore,
    geoScore,
    localScore,
    issues,
    catalogIssues,
    stats: {
      totalProducts: products.length,
      optimizedProducts: products.length - missingProductDescCount,
      totalCategories: categories.length,
      optimizedCategories: categories.filter((c) => Boolean(c.description)).length,
      totalTrackedKeywords: trackedKeywordsCount,
      totalBotVisits30d: botVisitsCount,
      monthlyImpressions,
      monthlyClicks,
      avgCtr,
      avgPosition,
    },
    lastAuditedAt: new Date(),
  };
}

export async function getAuditHistory(limit = 10) {
  return db.seoAuditScore.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function ensureDefaultSeoData(): Promise<void> {
  const [keywordCount, metricsCount, crawlCount] = await Promise.all([
    db.seoKeyword.count(),
    db.searchPerformanceMetric.count(),
    db.botCrawlLog.count(),
  ]);

  // Varsayılan anahtar kelimeleri ekle
  if (keywordCount === 0) {
    const defaultKeywords = [
      {
        keyword: "ergonomik laptop standı",
        targetUrl: "/katalog?q=stand",
        searchEngine: "google",
        currentRank: 3,
        previousRank: 5,
        searchVolume: 14800,
        intent: "COMMERCIAL",
        difficulty: 42,
      },
      {
        keyword: "masif meşe masa düzenleyici",
        targetUrl: "/katalog?q=meşe",
        searchEngine: "google",
        currentRank: 1,
        previousRank: 2,
        searchVolume: 6200,
        intent: "TRANSACTIONAL",
        difficulty: 35,
      },
      {
        keyword: "modern ev ofis aksesuarları",
        targetUrl: "/katalog",
        searchEngine: "google",
        currentRank: 7,
        previousRank: 9,
        searchVolume: 22400,
        intent: "INFORMATIONAL",
        difficulty: 64,
      },
      {
        keyword: "su geçirmez tasarım sırt çantası",
        targetUrl: "/katalog?q=çanta",
        searchEngine: "google",
        currentRank: 4,
        previousRank: 4,
        searchVolume: 9800,
        intent: "COMMERCIAL",
        difficulty: 48,
      },
      {
        keyword: "mimari dimmerli masa lambası",
        targetUrl: "/katalog?q=lamba",
        searchEngine: "google",
        currentRank: 2,
        previousRank: 6,
        searchVolume: 4100,
        intent: "TRANSACTIONAL",
        difficulty: 29,
      },
    ];

    for (const kw of defaultKeywords) {
      const created = await db.seoKeyword.create({ data: kw });
      // Geçmiş oluştur
      await db.seoKeywordHistory.createMany({
        data: [
          {
            keywordId: created.id,
            rank: kw.previousRank ?? kw.currentRank ?? 5,
            recordedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
          {
            keywordId: created.id,
            rank: kw.currentRank ?? 3,
            recordedAt: new Date(),
          },
        ],
      });
    }
  }

  // Son 30 günlük arama ve AI performans metrikleri
  if (metricsCount === 0) {
    const channels = [
      { name: "GOOGLE_ORGANIC", baseImpressions: 1200, baseClicks: 65, avgPos: 4.2 },
      { name: "AI_CHATGPT", baseImpressions: 340, baseClicks: 42, avgPos: 1.8 },
      { name: "AI_PERPLEXITY", baseImpressions: 210, baseClicks: 28, avgPos: 1.4 },
      { name: "AI_GEMINI", baseImpressions: 180, baseClicks: 22, avgPos: 2.1 },
      { name: "BING", baseImpressions: 140, baseClicks: 9, avgPos: 5.6 },
    ];

    const records = [];
    const now = new Date();

    for (let dayOffset = 14; dayOffset >= 0; dayOffset--) {
      const targetDate = new Date(now.getTime() - dayOffset * 24 * 60 * 60 * 1000);
      targetDate.setHours(0, 0, 0, 0);

      for (const ch of channels) {
        const factor = 0.85 + ((dayOffset * 7) % 30) / 100;
        const impressions = Math.round(ch.baseImpressions * factor);
        const clicks = Math.round(ch.baseClicks * factor);
        const ctr = impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : 0;
        const avgPosition = Number((ch.avgPos + (dayOffset % 2 === 0 ? -0.2 : 0.3)).toFixed(1));

        records.push({
          date: targetDate,
          channel: ch.name,
          impressions,
          clicks,
          ctr,
          avgPosition,
        });
      }
    }

    for (const rec of records) {
      await db.searchPerformanceMetric.upsert({
        where: {
          date_channel: {
            date: rec.date,
            channel: rec.channel,
          },
        },
        create: rec,
        update: rec,
      });
    }
  }

  // Varsayılan Bot Taramaları
  if (crawlCount === 0) {
    const bots = [
      { name: "Googlebot", cat: "SEARCH_ENGINE", path: "/katalog", status: 200 },
      { name: "Googlebot Mobile", cat: "SEARCH_ENGINE", path: "/", status: 200 },
      { name: "GPTBot (ChatGPT Search)", cat: "AI_AGENT", path: "/llms.txt", status: 200 },
      { name: "PerplexityBot", cat: "AI_AGENT", path: "/llms.txt", status: 200 },
      { name: "ClaudeBot", cat: "AI_AGENT", path: "/", status: 200 },
      { name: "Bingbot", cat: "SEARCH_ENGINE", path: "/sitemap.xml", status: 200 },
      { name: "Applebot", cat: "SEARCH_ENGINE", path: "/katalog", status: 200 },
    ];

    for (let i = 0; i < bots.length; i++) {
      const b = bots[i];
      if (!b) continue;
      await db.botCrawlLog.create({
        data: {
          botName: b.name,
          botCategory: b.cat,
          path: b.path,
          statusCode: b.status,
          userAgent: `Mozilla/5.0 (compatible; ${b.name}/2.1; +http://www.google.com/bot.html)`,
          createdAt: new Date(Date.now() - (i * 4 + 1) * 3600 * 1000),
        },
      });
    }
  }
}

export async function getKeywordsWithHistory() {
  return db.seoKeyword.findMany({
    include: {
      history: {
        orderBy: { recordedAt: "desc" },
        take: 5,
      },
    },
    orderBy: [{ currentRank: "asc" }, { searchVolume: "desc" }],
  });
}

export async function addKeyword(input: {
  keyword: string;
  targetUrl: string;
  searchEngine?: string;
  searchVolume?: number;
  intent?: string;
  difficulty?: number;
  currentRank?: number;
}) {
  const kw = await db.seoKeyword.create({
    data: {
      keyword: input.keyword.trim(),
      targetUrl: input.targetUrl.trim() || "/",
      searchEngine: input.searchEngine || "google",
      searchVolume: input.searchVolume ?? 0,
      intent: input.intent || "COMMERCIAL",
      difficulty: input.difficulty ?? 50,
      currentRank: input.currentRank,
      previousRank: input.currentRank,
    },
  });

  if (input.currentRank) {
    await db.seoKeywordHistory.create({
      data: {
        keywordId: kw.id,
        rank: input.currentRank,
      },
    });
  }

  return kw;
}

export async function updateKeywordRank(id: string, newRank: number) {
  const existing = await db.seoKeyword.findUnique({ where: { id } });
  if (!existing) throw new Error("Anahtar kelime bulunamadı");

  const updated = await db.seoKeyword.update({
    where: { id },
    data: {
      previousRank: existing.currentRank,
      currentRank: newRank,
      lastCheckedAt: new Date(),
    },
  });

  await db.seoKeywordHistory.create({
    data: {
      keywordId: id,
      rank: newRank,
    },
  });

  return updated;
}

export async function deleteKeyword(id: string) {
  return db.seoKeyword.delete({ where: { id } });
}

export async function getBotCrawlLogs(limit = 40) {
  return db.botCrawlLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function recordBotCrawl(data: {
  botName: string;
  botCategory?: string;
  path: string;
  statusCode?: number;
  ip?: string;
  userAgent?: string;
}) {
  return db.botCrawlLog.create({
    data: {
      botName: data.botName,
      botCategory: data.botCategory || "SEARCH_ENGINE",
      path: data.path,
      statusCode: data.statusCode ?? 200,
      ip: data.ip,
      userAgent: data.userAgent,
    },
  });
}

export async function getPerformanceMetrics(days = 30) {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return db.searchPerformanceMetric.findMany({
    where: { date: { gte: startDate } },
    orderBy: [{ date: "asc" }, { channel: "asc" }],
  });
}

export async function recordPerformanceMetric(data: {
  date: Date;
  channel: string;
  impressions: number;
  clicks: number;
  avgPosition: number;
}) {
  const ctr = data.impressions > 0 ? Number(((data.clicks / data.impressions) * 100).toFixed(2)) : 0;
  return db.searchPerformanceMetric.upsert({
    where: {
      date_channel: {
        date: data.date,
        channel: data.channel,
      },
    },
    create: {
      date: data.date,
      channel: data.channel,
      impressions: data.impressions,
      clicks: data.clicks,
      ctr,
      avgPosition: data.avgPosition,
    },
    update: {
      impressions: data.impressions,
      clicks: data.clicks,
      ctr,
      avgPosition: data.avgPosition,
    },
  });
}

export async function applyTemplateToCatalogItem(
  id: string,
  type: "PRODUCT" | "CATEGORY"
): Promise<void> {
  const settings = await getSeoGeoSettings();

  if (type === "PRODUCT") {
    const product = await db.product.findUnique({ where: { id } });
    if (!product) throw new Error("Ürün bulunamadı");

    const seoTitle = settings.productTitleTemplate
      .replace(/{urun_adi}/g, product.title)
      .replace(/{magaza_adi}/g, settings.defaultTitle);

    const seoDescription = settings.productDescTemplate
      .replace(/{urun_adi}/g, product.title)
      .replace(/{magaza_adi}/g, settings.defaultTitle);

    await db.product.update({
      where: { id },
      data: { seoTitle, seoDescription },
    });
  } else if (type === "CATEGORY") {
    const cat = await db.category.findUnique({ where: { id } });
    if (!cat) throw new Error("Kategori bulunamadı");

    const desc = settings.categoryDescTemplate
      .replace(/{kategori_adi}/g, cat.name)
      .replace(/{magaza_adi}/g, settings.defaultTitle);

    await db.category.update({
      where: { id },
      data: { description: desc },
    });
  }
}

export async function applyTemplateToAllMissing(type: "PRODUCT" | "CATEGORY"): Promise<number> {
  const settings = await getSeoGeoSettings();
  let updatedCount = 0;

  if (type === "PRODUCT") {
    const products = await db.product.findMany({
      where: {
        deletedAt: null,
        OR: [{ seoTitle: null }, { seoDescription: null }],
      },
    });

    for (const p of products) {
      const seoTitle =
        p.seoTitle ||
        settings.productTitleTemplate
          .replace(/{urun_adi}/g, p.title)
          .replace(/{magaza_adi}/g, settings.defaultTitle);

      const seoDescription =
        p.seoDescription ||
        settings.productDescTemplate
          .replace(/{urun_adi}/g, p.title)
          .replace(/{magaza_adi}/g, settings.defaultTitle);

      await db.product.update({
        where: { id: p.id },
        data: { seoTitle, seoDescription },
      });
      updatedCount++;
    }
  } else if (type === "CATEGORY") {
    const cats = await db.category.findMany({
      where: { isActive: true, description: null },
    });

    for (const c of cats) {
      const description = settings.categoryDescTemplate
        .replace(/{kategori_adi}/g, c.name)
        .replace(/{magaza_adi}/g, settings.defaultTitle);

      await db.category.update({
        where: { id: c.id },
        data: { description },
      });
      updatedCount++;
    }
  }

  return updatedCount;
}

export async function generateLlmsTxtContent(): Promise<string> {
  const [settings, products, categories] = await Promise.all([
    getSeoGeoSettings(),
    db.product.findMany({
      where: { status: "ACTIVE", deletedAt: null },
      select: { title: true, slug: true, minPrice: true, subtitle: true },
      take: 20,
    }),
    db.category.findMany({
      where: { isActive: true },
      select: { name: true, slug: true },
      take: 15,
    }),
  ]);

  const baseUrl = settings.canonicalBaseUrl.replace(/\/$/, "");

  let markdown = `# ${settings.brandEntityName} - LLM Knowledge Context & Information Sheet\n\n`;
  markdown += `> ${settings.llmsSummary}\n\n`;

  markdown += `## Marka ve Otorite Varlık Bilgileri (Entity Authority)\n`;
  markdown += `- **Marka Adı:** ${settings.brandEntityName}\n`;
  markdown += `- **Faaliyet Alanı:** ${settings.brandEntityType}\n`;
  markdown += `- **Kuruluş Yılı:** ${settings.brandFoundingYear}\n`;
  markdown += `- **Ana Merkez:** ${settings.geoStreetAddress}, ${settings.geoTargetRegion} / ${settings.geoTargetCountry}\n`;
  markdown += `- **Hizmet Verilen Bölgeler:** ${settings.serviceAreaCities.join(", ")}\n`;
  if (settings.brandSameAsLinks.length > 0) {
    markdown += `- **Resmi Profiller & Sosyal Varlık:**\n`;
    for (const link of settings.brandSameAsLinks) {
      markdown += `  - ${link}\n`;
    }
  }
  markdown += `\n`;

  markdown += `## Alışveriş, Garanti ve Teslimat Kuralları (Store Policies)\n`;
  const guidelines = settings.llmsGuidelines.split("\n");
  for (const line of guidelines) {
    if (line.trim()) markdown += `- ${line.trim()}\n`;
  }
  markdown += `\n`;

  markdown += `## Ana Ürün Kategorileri\n`;
  for (const cat of categories) {
    markdown += `- [${cat.name}](${baseUrl}/kategori/${cat.slug})\n`;
  }
  markdown += `\n`;

  markdown += `## Öne Çıkan Seçili Ürünler\n`;
  for (const p of products) {
    const priceText = p.minPrice ? ` - ${formatMoney(p.minPrice)}` : "";
    const descText = p.subtitle ? ` (${p.subtitle})` : "";
    markdown += `- [${p.title}](${baseUrl}/urun/${p.slug})${priceText}${descText}\n`;
  }
  markdown += `\n`;

  markdown += `## İletişim ve Yerel Koordinatlar\n`;
  markdown += `- **Web Sitesi:** ${baseUrl}\n`;
  markdown += `- **Çalışma Saatleri:** ${settings.openingHours}\n`;
  markdown += `- **Coğrafi Konum:** ${settings.geoLatitude}, ${settings.geoLongitude}\n`;
  markdown += `- **Fiyat Segmenti:** ${settings.priceRange}\n`;

  return markdown;
}
