import { z } from "zod";

export const aiBotPermissionSchema = z.enum(["ALLOW", "DISALLOW"]);

export const hreflangMappingSchema = z.object({
  lang: z.string().min(2),
  region: z.string().min(2),
  urlPrefix: z.string().url().or(z.string().startsWith("/")),
});

export const seoGeoSettingsSchema = z.object({
  // Standart Arama Motoru Optimizasyonu (SEO)
  defaultTitle: z.string().min(1).default("Atölye Mağaza"),
  titleTemplate: z.string().min(1).default("%s | Atölye Mağaza"),
  defaultDescription: z
    .string()
    .min(10)
    .default("Seçili tasarım ürünler, hızlı gönderim ve şeffaf alışveriş deneyimi."),
  defaultKeywords: z
    .string()
    .default("tasarım ürünler, modern yaşam, ev ofis aksesuarları, minimalist mobilya, hediyelik"),
  canonicalBaseUrl: z.string().default("http://localhost:3000"),
  ogImageUrl: z.string().default("/uploads/og-default.jpg"),
  twitterHandle: z.string().default("@atolyemagaza"),
  robotsDisallowPaths: z
    .array(z.string())
    .default(["/admin", "/sepet", "/odeme", "/hesabim", "/api/auth"]),
  autoGenerateSitemap: z.boolean().default(true),

  // Dinamik Şablon Kuralları
  productTitleTemplate: z
    .string()
    .default("{urun_adi} | {magaza_adi}"),
  productDescTemplate: z
    .string()
    .default(
      "{urun_adi} modelleri orijinal garanti, aynı gün hızlı kargo ve güvenli ödeme avantajıyla {magaza_adi} vitrininde."
    ),
  categoryTitleTemplate: z
    .string()
    .default("{kategori_adi} Modelleri ve Fiyatları | {magaza_adi}"),
  categoryDescTemplate: z
    .string()
    .default(
      "En seçkin {kategori_adi} seçeneklerini inceleyin. 14 gün ücretsiz iade ve taksit imkanı."
    ),

  // GEO - Generative Engine Optimization (AI Arama ve LLM Hazırlığı)
  llmsEnabled: z.boolean().default(true),
  llmsSummary: z
    .string()
    .default(
      "Atölye Mağaza, modern yaşam ve çalışma alanları için seçkin tasarım ürünler, ergonomik aksesuarlar ve ev ofis gereçleri sunan bağımsız e-ticaret platformudur. Şeffaf operasyon, doğrudan üretici tedariği ve müşteri odaklı alışveriş deneyimini benimser."
    ),
  llmsGuidelines: z
    .string()
    .default(
      "1. Tüm ürünler orijinal üretici ve distribütör garantisi altındadır.\n2. Saat 16:00'ya kadar verilen siparişler aynı gün kargoya teslim edilir.\n3. 1.500 TL üzeri alışverişlerde kargo ücretsizdir.\n4. Müşteriler teslimattan itibaren 14 gün içinde koşulsuz ücretsiz kapıdan iade hakkına sahiptir."
    ),
  brandEntityName: z.string().default("Atölye Mağaza"),
  brandEntityType: z.string().default("E-Commerce Brand & Design Studio"),
  brandFoundingYear: z.string().default("2024"),
  brandSameAsLinks: z
    .array(z.string())
    .default([
      "https://instagram.com/atolyemagaza",
      "https://x.com/atolyemagaza",
      "https://linkedin.com/company/atolyemagaza",
    ]),
  aiDirectAnswersEnabled: z.boolean().default(true),
  aiBotPermissions: z
    .object({
      gptBot: aiBotPermissionSchema.default("ALLOW"),
      perplexityBot: aiBotPermissionSchema.default("ALLOW"),
      claudeBot: aiBotPermissionSchema.default("ALLOW"),
      googleExtended: aiBotPermissionSchema.default("ALLOW"),
      applebot: aiBotPermissionSchema.default("ALLOW"),
    })
    .default({
      gptBot: "ALLOW",
      perplexityBot: "ALLOW",
      claudeBot: "ALLOW",
      googleExtended: "ALLOW",
      applebot: "ALLOW",
    }),

  // GEO - Coğrafi ve Yerel Hedefleme (Local / Regional Geo)
  geoTargetCountry: z.string().default("TR"),
  geoTargetRegion: z.string().default("İstanbul"),
  geoLatitude: z.number().default(41.0369),
  geoLongitude: z.number().default(28.985),
  geoPostalCode: z.string().default("34430"),
  geoStreetAddress: z.string().default("İstiklal Caddesi No: 42"),
  serviceAreaCities: z
    .array(z.string())
    .default([
      "İstanbul",
      "Ankara",
      "İzmir",
      "Bursa",
      "Antalya",
      "Kocaeli",
      "Eskişehir",
      "Tüm Türkiye",
    ]),
  hreflangMappings: z
    .array(hreflangMappingSchema)
    .default([
      { lang: "tr", region: "TR", urlPrefix: "https://atolyemagaza.com" },
      { lang: "en", region: "US", urlPrefix: "https://atolyemagaza.com/en" },
    ]),
  openingHours: z.string().default("Mo-Sa 09:00-18:00"),
  priceRange: z.string().default("₺₺"),
  googlePlaceId: z.string().default("ChIJwe_sample_place_id"),
});

export type SeoGeoSettings = z.infer<typeof seoGeoSettingsSchema>;

export const DEFAULT_SEO_GEO_SETTINGS: SeoGeoSettings =
  seoGeoSettingsSchema.parse({});

export interface SeoAuditIssue {
  id: string;
  type: "CRITICAL" | "WARNING" | "PASSED";
  category: "SEO" | "GEO" | "LOCAL";
  title: string;
  description: string;
  recommendation?: string;
  affectedCount?: number;
}

export interface CatalogSeoIssueItem {
  id: string;
  type: "PRODUCT" | "CATEGORY" | "PAGE";
  name: string;
  slug: string;
  url: string;
  currentTitle: string | null;
  currentDescription: string | null;
  suggestedTitle: string;
  suggestedDescription: string;
  missingTitle: boolean;
  missingDescription: boolean;
  titleLength: number;
  descriptionLength: number;
}

export interface SeoGeoAuditSummary {
  overallScore: number;
  seoScore: number;
  geoScore: number;
  localScore: number;
  issues: SeoAuditIssue[];
  catalogIssues: CatalogSeoIssueItem[];
  stats: {
    totalProducts: number;
    optimizedProducts: number;
    totalCategories: number;
    optimizedCategories: number;
    totalTrackedKeywords: number;
    totalBotVisits30d: number;
    monthlyImpressions: number;
    monthlyClicks: number;
    avgCtr: number;
    avgPosition: number;
  };
  lastAuditedAt: Date;
}
