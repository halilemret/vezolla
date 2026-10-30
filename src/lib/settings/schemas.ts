import { z } from "zod";

export const storeSettingsSchema = z.object({
  storeName: z.string().min(1),
  tagline: z.string().default(""),
  supportEmail: z.string().email(),
  supportPhone: z.string().default(""),
  currency: z.string().default("TRY"),
  locale: z.string().default("tr-TR"),
  companyLegalName: z.string().default(""),
  taxOffice: z.string().default(""),
  taxNumber: z.string().default(""),
  mersisNumber: z.string().default(""),
  kepAddress: z.string().default(""),
  address: z.string().default(""),
  city: z.string().default("İstanbul"),
  district: z.string().default(""),
  onlyBuyersCanReview: z.boolean().default(true),
  autoApproveReviews: z.boolean().default(false),
  visitorRetentionDays: z.number().int().min(1).max(730).default(180),
});

export type StoreSettings = z.infer<typeof storeSettingsSchema>;

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  storeName: "VEZOLLA",
  tagline: "Zarafet İçten Başlar",
  supportEmail: "destek@vezolla.com",
  supportPhone: "0850 840 42 42",
  currency: "TRY",
  locale: "tr-TR",
  companyLegalName: "Vezolla Tekstil ve Mağazacılık A.Ş.",
  taxOffice: "Beyoğlu",
  taxNumber: "1234567890",
  mersisNumber: "0123456789000001",
  kepAddress: "vezolla@hs01.kep.tr",
  address: "Abdi İpekçi Cad. No: 42, Nişantaşı",
  city: "İstanbul",
  district: "Şişli",
  onlyBuyersCanReview: true,
  autoApproveReviews: false,
  visitorRetentionDays: 180,
};

export const themeSettingsSchema = z.object({
  activePresetId: z.string().default("vezolla"),
  logoText: z.string().min(1).default("VEZOLLA"),
  logoImageUrl: z.string().default("/brand/transparan-logo.png"),
  faviconUrl: z.string().default("/favicon.svg"),
  primaryColor: z.string().default("#2C2C2E"),
  surfaceColor: z.string().default("#F6F1ED"),
  cardColor: z.string().default("#FFFFFF"),
  mutedColor: z.string().default("#736E6A"),
  accentColor: z.string().default("#B67878"),
  accentFgColor: z.string().default("#FFFFFF"),
  borderColor: z.string().default("#E8E2DC"),
  headingFont: z.enum(["instrument-serif", "plus-jakarta", "ibm-plex-sans", "system"]).default("instrument-serif"),
  bodyFont: z.enum(["plus-jakarta", "ibm-plex-sans", "system"]).default("plus-jakarta"),
  radiusScale: z.enum(["none", "sm", "md", "full"]).default("sm"),
  themeMode: z.enum(["light", "dark"]).default("light"),
  announcementEnabled: z.boolean().default(true),
  announcementText: z.string().default("Zarafet içten başlar • 1.500 TL üzeri tüm siparişlerde ÜCRETSİZ HIZLI KARGO"),
  announcementHref: z.string().default("/katalog"),
  discreetShippingNotice: z.boolean().default(true),
  isDraftDirection: z.boolean().default(false),
});

export type ThemeSettings = z.infer<typeof themeSettingsSchema>;

export const DEFAULT_THEME_SETTINGS: ThemeSettings = {
  activePresetId: "vezolla",
  logoText: "VEZOLLA",
  logoImageUrl: "/brand/transparan-logo.png",
  faviconUrl: "/favicon.svg",
  primaryColor: "#2C2C2E",
  surfaceColor: "#F6F1ED",
  cardColor: "#FFFFFF",
  mutedColor: "#736E6A",
  accentColor: "#B67878",
  accentFgColor: "#FFFFFF",
  borderColor: "#E8E2DC",
  headingFont: "instrument-serif",
  bodyFont: "plus-jakarta",
  radiusScale: "sm",
  themeMode: "light",
  announcementEnabled: true,
  announcementText: "Zarafet içten başlar • 1.500 TL üzeri tüm siparişlerde ÜCRETSİZ HIZLI KARGO",
  announcementHref: "/katalog",
  discreetShippingNotice: true,
  isDraftDirection: false,
};

export const paymentSettingsSchema = z.object({
  iyzicoEnabled: z.boolean().default(true),
  iyzicoApiKey: z.string().default(""),
  iyzicoSecretKey: z.string().default(""),
  iyzicoBaseUrl: z.string().default("https://sandbox-api.iyzipay.com"),
  bankTransferEnabled: z.boolean().default(true),
  bankAccounts: z
    .array(
      z.object({
        bankName: z.string(),
        accountHolder: z.string(),
        iban: z.string(),
        branch: z.string().optional(),
      })
    )
    .default([
      {
        bankName: "Ziraat Bankası",
        accountHolder: "Örnek Ticaret A.Ş.",
        iban: "TR00 0001 0000 0000 0000 0000 01",
        branch: "Beyoğlu",
      },
    ]),
  bankTransferInstructions: z
    .string()
    .default("Açıklama kısmına sipariş numaranızı yazınız. Ödemeniz onaylandığında siparişiniz hazırlanmaya başlar."),
  codEnabled: z.boolean().default(true),
  codFeeMinor: z.number().int().min(0).default(4900),
  codMaxOrderMinor: z.number().int().min(0).default(500000),
});

export type PaymentSettings = z.infer<typeof paymentSettingsSchema>;

export const DEFAULT_PAYMENT_SETTINGS: PaymentSettings = paymentSettingsSchema.parse({});

export const seoSettingsSchema = z.object({
  defaultTitle: z.string().default("Atölye Mağaza"),
  titleTemplate: z.string().default("%s | Atölye Mağaza"),
  defaultDescription: z
    .string()
    .default("Seçili ürünler, hızlı gönderim ve şeffaf alışveriş deneyimi."),
  ogImageUrl: z.string().default(""),
  robotsDisallowPaths: z.array(z.string()).default(["/admin", "/sepet", "/odeme", "/hesabim"]),
});

export type SeoSettings = z.infer<typeof seoSettingsSchema>;

export const DEFAULT_SEO_SETTINGS: SeoSettings = seoSettingsSchema.parse({});

export const abandonedCartSettingsSchema = z.object({
  autoRecoveryEnabled: z.boolean().default(false),
  idleMinutesBeforeAbandoned: z.number().int().min(15).max(10080).default(60),
  autoDiscountCode: z.string().default(""),
  maxAutoRecoveryEmailsPerCart: z.number().int().min(1).max(3).default(1),
  /// Hatırlatma e-postası ve çıkış niyeti kuponunun yüzde indirim oranı
  discountPercent: z.number().int().min(1).max(90).default(10),
  /// Sepetli ziyaretçi sekmeyi kapatırken tek seferlik kupon pop-up'ı göster
  exitIntentEnabled: z.boolean().default(true),
});

export type AbandonedCartSettings = z.infer<typeof abandonedCartSettingsSchema>;

export const DEFAULT_ABANDONED_CART_SETTINGS: AbandonedCartSettings =
  abandonedCartSettingsSchema.parse({});

export const conversionSettingsSchema = z.object({
  // Flaş İndirim Bandı
  flashDealsEnabled: z.boolean().default(true),
  flashDealsBadgeText: z.string().default("GÜNÜN FLAŞ İNDİRİMİ"),
  flashDealsTitle: z.string().default("Seçili Tasarım Ürünlerinde Sepette Ekstra %15 İndirim"),
  flashDealsPromoCode: z.string().default("FLAS15"),
  flashDealsDurationHours: z.number().int().min(1).max(72).default(12),
  flashDealsTargetHref: z.string().default("/katalog?filter=discount"),

  // 4 Temel Güven Sütunu (Trust Badges)
  trustBadgesEnabled: z.boolean().default(true),
  trustBadge1Title: z.string().default("Aynı Gün Hızlı Kargo"),
  trustBadge1Desc: z.string().default("1.500 TL üzeri siparişlerde kargo ücretsiz"),
  trustBadge2Title: z.string().default("%100 Orijinal Ürün"),
  trustBadge2Desc: z.string().default("2 yıl resmi distribütör ve marka garantisi"),
  trustBadge3Title: z.string().default("14 Gün Kolay İade"),
  trustBadge3Desc: z.string().default("Koşulsuz ve ücretsiz kapıdan iade imkanı"),
  trustBadge4Title: z.string().default("Güvenli Ödeme & Taksit"),
  trustBadge4Desc: z.string().default("12 aya varan taksit ve 3D Secure koruması"),

  // Canlı Satın Alma Bildirimi (Social Proof Toast)
  liveSalesToastEnabled: z.boolean().default(true),
  liveSalesToastIntervalSeconds: z.number().int().min(5).max(120).default(22),

  // Satın Alma Psikolojisi ve Kıtlık Algısı
  scarcityWarningEnabled: z.boolean().default(true),
  scarcityStockThreshold: z.number().int().min(1).max(50).default(5),
  quickAddToCartEnabled: z.boolean().default(true),
  showSavingsBadge: z.boolean().default(true),
  showReviewStars: z.boolean().default(true),
});

export type ConversionSettings = z.infer<typeof conversionSettingsSchema>;

export const DEFAULT_CONVERSION_SETTINGS: ConversionSettings =
  conversionSettingsSchema.parse({});

export const invoiceSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  autoInvoiceOnPaid: z.boolean().default(true),
  autoSendEmailToCustomer: z.boolean().default(true),
  seriesPrefix: z.string().trim().min(3).max(3).toUpperCase().default("VEZ"),
  provider: z
    .enum(["vezolla_einvoice", "parasut", "uyumsoft", "edm", "gib_portal"])
    .default("vezolla_einvoice"),
  isTestMode: z.boolean().default(false),
  defaultNotes: z
    .string()
    .default(
      "İşbu e-Arşiv/e-Fatura 213 sayılı Vergi Usul Kanunu ve ilgili mevzuat hükümlerine uygun olarak elektronik ortamda düzenlenmiştir."
    ),
  companySenderTitle: z.string().default("Vezolla Tekstil ve Mağazacılık A.Ş."),
  companyTaxOffice: z.string().default("Beyoğlu"),
  companyTaxNumber: z.string().default("1234567890"),
  companyMersis: z.string().default("0123456789000001"),
  companyKepAddress: z.string().default("vezolla@hs01.kep.tr"),
  companyAddress: z.string().default("Abdi İpekçi Cad. No: 42, Nişantaşı, Şişli / İstanbul"),
  companyPhone: z.string().default("0850 840 42 42"),
  companyEmail: z.string().default("muhasebe@vezolla.com"),
  companyWeb: z.string().default("https://vezolla.com"),
});

export type InvoiceSettings = z.infer<typeof invoiceSettingsSchema>;

export const DEFAULT_INVOICE_SETTINGS: InvoiceSettings = invoiceSettingsSchema.parse({});

