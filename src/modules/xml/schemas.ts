import { z } from "zod";

export const feedMappingSchema = z.object({
  externalIdPath: z.string().default("UrunKodu"),
  skuPath: z.string().default("StokKodu"),
  barcodePath: z.string().default("Barkod"),
  titlePath: z.string().default("Baslik"),
  subtitlePath: z.string().default(""),
  descriptionPath: z.string().default("Aciklama"),
  brandPath: z.string().default("Marka"),
  categoryPath: z.string().default("Kategori"),
  pricePath: z.string().default("SatisFiyati"),
  compareAtPricePath: z.string().default("PiyasaFiyati"),
  costPricePath: z.string().default("AlisFiyati"),
  currencyPath: z.string().default("ParaBirimi"),
  taxRatePath: z.string().default("KdvOrani"),
  stockPath: z.string().default("Stok"),
  weightGramsPath: z.string().default("AgirlikGram"),
  imagesPath: z.string().default("Gorseller.Gorsel"),
  variantsPath: z.string().default("Varyantlar.Varyant"),
  variantSkuPath: z.string().default("StokKodu"),
  variantBarcodePath: z.string().default("Barkod"),
  variantTitlePath: z.string().default("Baslik"),
  variantPricePath: z.string().default("Fiyat"),
  variantStockPath: z.string().default("Stok"),
  variantOption1Name: z.string().default("Renk"),
  variantOption1Path: z.string().default("Renk"),
  variantOption2Name: z.string().default("Beden"),
  variantOption2Path: z.string().default("Beden"),
  attributesPath: z.string().default("Ozellikler.Ozellik"),
  attributeNameKey: z.string().default("Ad"),
  attributeValueKey: z.string().default("Deger"),
});

export type FeedMapping = z.infer<typeof feedMappingSchema>;

export const DEFAULT_FEED_MAPPING: FeedMapping = feedMappingSchema.parse({});

export const priceMarginTierSchema = z.object({
  upToMinor: z.number().int().positive(),
  percentBps: z.number().int().default(0),
  fixedMinor: z.number().int().default(0),
});

export type PriceMarginTier = z.infer<typeof priceMarginTierSchema>;

export const textReplacementRuleSchema = z.object({
  find: z.string(),
  replace: z.string(),
});

export type TextReplacementRule = z.infer<typeof textReplacementRuleSchema>;

export const priceRoundingModeSchema = z.enum(["none", "90", "99", "whole"]);
export type PriceRoundingMode = z.infer<typeof priceRoundingModeSchema>;

export const feedTransformSchema = z.object({
  currencyMultiplier: z.number().positive().default(1),
  sourceIncludesVat: z.boolean().default(true),
  vatRateBps: z.number().int().min(0).max(10000).default(2000),
  marginMode: z.enum(["PERCENT", "FIXED", "TIERED"]).default("PERCENT"),
  marginPercentBps: z.number().int().min(-9500).max(100000).default(0),
  marginFixedMinor: z.number().int().default(0),
  tiers: z.array(priceMarginTierSchema).default([]),
  rounding: priceRoundingModeSchema.default("none"),
  minStockThreshold: z.number().int().min(0).default(0),
  titlePrefix: z.string().default(""),
  titleSuffix: z.string().default(""),
  replacements: z.array(textReplacementRuleSchema).default([]),
});

export type FeedTransform = z.infer<typeof feedTransformSchema>;

export const DEFAULT_FEED_TRANSFORM: FeedTransform = feedTransformSchema.parse({});

export const feedFieldSyncPolicySchema = z.enum(["ALWAYS", "CREATE_ONLY"]);
export type FeedFieldSyncPolicy = z.infer<typeof feedFieldSyncPolicySchema>;

export const feedUpdatePolicySchema = z.object({
  updatePrice: z.boolean().default(true),
  updateStock: z.boolean().default(true),
  titlePolicy: feedFieldSyncPolicySchema.default("CREATE_ONLY"),
  descriptionPolicy: feedFieldSyncPolicySchema.default("CREATE_ONLY"),
  imagesPolicy: feedFieldSyncPolicySchema.default("CREATE_ONLY"),
  brandPolicy: feedFieldSyncPolicySchema.default("CREATE_ONLY"),
  categoryPolicy: feedFieldSyncPolicySchema.default("CREATE_ONLY"),
  attributesPolicy: feedFieldSyncPolicySchema.default("ALWAYS"),
});

export type FeedUpdatePolicy = z.infer<typeof feedUpdatePolicySchema>;

export const DEFAULT_FEED_UPDATE_POLICY: FeedUpdatePolicy = feedUpdatePolicySchema.parse({});

export const exportFeedFiltersSchema = z.object({
  categoryIds: z.array(z.string()).default([]),
  brandIds: z.array(z.string()).default([]),
  collectionIds: z.array(z.string()).default([]),
  inStockOnly: z.boolean().default(false),
});

export type ExportFeedFilters = z.infer<typeof exportFeedFiltersSchema>;

export const DEFAULT_EXPORT_FEED_FILTERS: ExportFeedFilters = exportFeedFiltersSchema.parse({});

export const customExportFieldMapSchema = z.object({
  idTag: z.string().min(1).default("UrunKodu"),
  skuTag: z.string().min(1).default("StokKodu"),
  barcodeTag: z.string().min(1).default("Barkod"),
  titleTag: z.string().min(1).default("Baslik"),
  descriptionTag: z.string().min(1).default("Aciklama"),
  brandTag: z.string().min(1).default("Marka"),
  categoryTag: z.string().min(1).default("Kategori"),
  priceTag: z.string().min(1).default("Fiyat"),
  compareAtPriceTag: z.string().min(1).default("PiyasaFiyati"),
  stockTag: z.string().min(1).default("Stok"),
  urlTag: z.string().min(1).default("UrunUrl"),
  imageTag: z.string().min(1).default("ResimUrl"),
  currencyTag: z.string().min(1).default("ParaBirimi"),
});

export type CustomExportFieldMap = z.infer<typeof customExportFieldMapSchema>;

export const customExportTemplateSchema = z.object({
  rootNode: z.string().min(1).default("Urunler"),
  itemNode: z.string().min(1).default("Urun"),
  includeVariantsAsItems: z.boolean().default(false),
  useCdataForDescription: z.boolean().default(true),
  fields: customExportFieldMapSchema.default({
    idTag: "UrunKodu",
    skuTag: "StokKodu",
    barcodeTag: "Barkod",
    titleTag: "Baslik",
    descriptionTag: "Aciklama",
    brandTag: "Marka",
    categoryTag: "Kategori",
    priceTag: "Fiyat",
    compareAtPriceTag: "PiyasaFiyati",
    stockTag: "Stok",
    urlTag: "UrunUrl",
    imageTag: "ResimUrl",
    currencyTag: "ParaBirimi",
  }),
});

export type CustomExportTemplate = z.infer<typeof customExportTemplateSchema>;

export const DEFAULT_CUSTOM_EXPORT_TEMPLATE: CustomExportTemplate =
  customExportTemplateSchema.parse({});

export interface FeedRunStats {
  total: number;
  created: number;
  updated: number;
  unchanged: number;
  skipped: number;
  failed: number;
  missing: number;
}

export interface FeedPreviewSampleItem {
  externalId: string;
  matchValue: string;
  title: string;
  action: "CREATE" | "UPDATE" | "UNCHANGED" | "SKIP";
  reason?: string;
  sourcePriceMinor: number;
  finalPriceMinor: number;
  sourceStock: number;
  finalStock: number;
  sourceCategory: string | null;
  targetCategoryName: string | null;
  variantCount: number;
}

export interface FeedRunErrorItem {
  externalId: string;
  message: string;
}

export function parseFeedMapping(raw: unknown): FeedMapping {
  const parsed = feedMappingSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : DEFAULT_FEED_MAPPING;
}

export function parseFeedTransform(raw: unknown): FeedTransform {
  const parsed = feedTransformSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : DEFAULT_FEED_TRANSFORM;
}

export function parseFeedUpdatePolicy(raw: unknown): FeedUpdatePolicy {
  const parsed = feedUpdatePolicySchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : DEFAULT_FEED_UPDATE_POLICY;
}

export function parseExportFeedFilters(raw: unknown): ExportFeedFilters {
  const parsed = exportFeedFiltersSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : DEFAULT_EXPORT_FEED_FILTERS;
}

export function parseCustomExportTemplate(raw: unknown): CustomExportTemplate {
  const parsed = customExportTemplateSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : DEFAULT_CUSTOM_EXPORT_TEMPLATE;
}
