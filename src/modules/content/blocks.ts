import { z } from "zod";

export const HOME_BLOCK_TYPES = [
  {
    type: "hero_banner",
    label: "Vitrin Karşılama Bloğu (Hero)",
    description: "Ana başlık, açıklama, birincil eylem butonu ve isteğe bağlı görsel.",
  },
  {
    type: "product_rail",
    label: "Dinamik Ürün Şeridi",
    description:
      "Kişiselleştirilmiş öneri motorundan (Sana Özel, Reklam Ürünü, Son Bakılanlar, Sepette Kalanlar, Çok Satanlar) veya seçili kategori/koleksiyondan ürün listeler.",
  },
  {
    type: "category_grid",
    label: "Kategori vitrini",
    description: "Seçili veya üst seviye kategorileri bağlantılarıyla listeler.",
  },
  {
    type: "split_callout",
    label: "Görsel + Metin Vurgusu",
    description: "Kampanya, hikaye veya duyuru için iki sütunlu içerik alanı.",
  },
  {
    type: "rich_text",
    label: "Serbest Metin / Editoryal Not",
    description: "Tiptap HTML veya düz açıklama bloğu.",
  },
] as const;

export type HomeBlockType = (typeof HOME_BLOCK_TYPES)[number]["type"];

export const PRODUCT_RAIL_SOURCES = [
  { value: "for_you", label: "Sana Özel (İlgi profiline göre)" },
  { value: "ad_campaign", label: "Reklam / Kampanyadan Gelen Ürünler" },
  { value: "recently_viewed", label: "Son İncelenen Ürünler" },
  { value: "abandoned_cart", label: "Sepette Bekleyen Ürünler" },
  { value: "associated", label: "Birlikte Alınanlar / Bakılanlar" },
  { value: "cold_start", label: "Çok Satanlar ve Yeni Gelenler" },
  { value: "category", label: "Belirli Bir Kategori" },
  { value: "collection", label: "Belirli Bir Koleksiyon" },
  { value: "manual", label: "Elle Seçilen Ürünler" },
] as const;

export type ProductRailSource = (typeof PRODUCT_RAIL_SOURCES)[number]["value"];

export const heroBlockConfigSchema = z.object({
  headline: z.string().default("Yeni Sezon Seçkisi"),
  subheadline: z
    .string()
    .default("Kaliteli malzemeler ve şeffaf üretim anlayışıyla hazırlanan güncel koleksiyon."),
  ctaLabel: z.string().default("Kataloğu İncele"),
  ctaHref: z.string().default("/katalog"),
  secondaryCtaLabel: z.string().default(""),
  secondaryCtaHref: z.string().default(""),
  imageUrl: z.string().default(""),
  imageAlt: z.string().default(""),
});

export const productRailConfigSchema = z.object({
  title: z.string().default("Öne Çıkan Ürünler"),
  subtitle: z.string().default(""),
  source: z
    .enum([
      "for_you",
      "ad_campaign",
      "recently_viewed",
      "abandoned_cart",
      "associated",
      "cold_start",
      "category",
      "collection",
      "manual",
    ])
    .default("cold_start"),
  categoryId: z.string().optional(),
  collectionId: z.string().optional(),
  productIds: z.array(z.string()).default([]),
  limit: z.number().int().min(2).max(24).default(8),
  hideIfEmpty: z.boolean().default(true),
});

export const categoryGridConfigSchema = z.object({
  title: z.string().default("Kategoriler"),
  subtitle: z.string().default(""),
  categoryIds: z.array(z.string()).default([]),
  limit: z.number().int().min(2).max(12).default(6),
});

export const splitCalloutConfigSchema = z.object({
  title: z.string().default("Özenli Seçki"),
  body: z.string().default("Her ürün kalite kontrolünden geçerek doğrudan depomuzdan kargolanır."),
  ctaLabel: z.string().default("Ürünleri Gör"),
  ctaHref: z.string().default("/katalog"),
  imageUrl: z.string().default(""),
  imagePosition: z.enum(["left", "right"]).default("right"),
});

export const richTextConfigSchema = z.object({
  title: z.string().default(""),
  html: z.string().default("<p>Bilgilendirme metni.</p>"),
});
