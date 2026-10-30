export interface ThemePresetValues {
  presetId: string;
  logoText: string;
  primaryColor: string; // --ink (ana metin)
  surfaceColor: string; // --surface (sayfa arka planı)
  cardColor: string; // --card (kart ve blok zeminleri)
  mutedColor: string; // --muted (ikincil ve açıklama metinleri)
  accentColor: string; // --accent (vurgu, buton ve aktif durumlar)
  accentFgColor: string; // --accent-fg (vurgu üzerindeki metin rengi)
  borderColor: string; // --border (kenarlık ve ayraç çizgileri)
  headingFont: "instrument-serif" | "plus-jakarta" | "ibm-plex-sans" | "system";
  bodyFont: "plus-jakarta" | "ibm-plex-sans" | "system";
  radiusScale: "none" | "sm" | "md" | "full";
  themeMode: "light" | "dark";
  announcementEnabled: boolean;
  announcementText: string;
  announcementHref: string;
  discreetShippingNotice: boolean;
  isDraftDirection: boolean;
}

export interface ThemePreset {
  id: string;
  name: string;
  subtitle: string;
  category: "intimate" | "apparel";
  categoryLabel: string;
  badge: string;
  description: string;
  tags: string[];
  previewColors: {
    surface: string;
    card: string;
    ink: string;
    accent: string;
    border: string;
  };
  values: ThemePresetValues;
}

export const THEME_PRESETS: ReadonlyArray<ThemePreset> = [
  // 1. VEZOLLA AMİRAL GEMİSİ (Açık Zemin: Sıcak Krem, Antrasit, Toz Gül, Altın)
  {
    id: "vezolla",
    name: "Vezolla Elegance",
    subtitle: "Zarafet İçten Başlar",
    category: "apparel",
    categoryLabel: "Resmi Marka & Zarafet",
    badge: "Resmi Marka",
    description:
      "Vezolla kurumsal kimliği. Sıcak krem zemin (#F6F1ED), asil antrasit tipografi (#2C2C2E), yumuşak toz gül vurgular (#B67878), altın kumaş kıvrımı amblemi ve yüksek kontrastlı Didone / TT Ramillas editoryal serif şıklığı.",
    tags: ["Resmi Marka", "Krem & Antrasit", "Toz Gül", "Altın Amblem", "Zarafet"],
    previewColors: {
      surface: "#F6F1ED",
      card: "#FFFFFF",
      ink: "#2C2C2E",
      accent: "#B67878",
      border: "#E8E2DC",
    },
    values: {
      presetId: "vezolla",
      logoText: "VEZOLLA",
      surfaceColor: "#F6F1ED",
      cardColor: "#FFFFFF",
      primaryColor: "#2C2C2E",
      mutedColor: "#736E6A",
      accentColor: "#B67878",
      accentFgColor: "#FFFFFF",
      borderColor: "#E8E2DC",
      headingFont: "instrument-serif",
      bodyFont: "plus-jakarta",
      radiusScale: "sm",
      themeMode: "light",
      announcementEnabled: true,
      announcementText:
        "Zarafet içten başlar • 1.500 TL üzeri tüm siparişlerde ÜCRETSİZ HIZLI KARGO",
      announcementHref: "/katalog",
      discreetShippingNotice: true,
      isDraftDirection: false,
    },
  },

  // 2. VEZOLLA NOCTURNE (Koyu Zemin: Asil Antrasit, Krem, Toz Gül, Altın)
  {
    id: "vezolla-nocturne",
    name: "Vezolla Nocturne",
    subtitle: "Gece & Asil Antrasit",
    category: "apparel",
    categoryLabel: "Koyu Zemin & Zarafet",
    badge: "Koyu Tema",
    description:
      "Vezolla kurumsal kimliğinin koyu zemin tasarımı. Derin antrasit zemin (#2C2C2E), fildişi krem metin (#F6F1ED), toz gül aksanlar (#B67878) ve parıltılı altın amblem.",
    tags: ["Koyu Zemin", "Antrasit & Krem", "Toz Gül & Altın", "Lüks Gece"],
    previewColors: {
      surface: "#2C2C2E",
      card: "#1E1E20",
      ink: "#F6F1ED",
      accent: "#B67878",
      border: "#3F3F46",
    },
    values: {
      presetId: "vezolla-nocturne",
      logoText: "VEZOLLA",
      surfaceColor: "#2C2C2E",
      cardColor: "#1E1E20",
      primaryColor: "#F6F1ED",
      mutedColor: "#A8A29D",
      accentColor: "#B67878",
      accentFgColor: "#FFFFFF",
      borderColor: "#3F3F46",
      headingFont: "instrument-serif",
      bodyFont: "plus-jakarta",
      radiusScale: "sm",
      themeMode: "dark",
      announcementEnabled: true,
      announcementText:
        "Zarafet içten başlar • Tüm gönderilerde %100 Gizli Paketleme Güvencesi",
      announcementHref: "/katalog",
      discreetShippingNotice: true,
      isDraftDirection: false,
    },
  },

  // 3. İÇ GİYİM & FANTAZİ GİYİM 1: NOIR & VELVET
  {
    id: "noir-velvet",
    name: "Noir & Velvet",
    subtitle: "Gece & Bordo Kadife",
    category: "intimate",
    categoryLabel: "İç Giyim & Fantazi",
    badge: "Fantazi & Gece",
    description:
      "Lüks, şehvetli ve gizemli karanlık atmosfer. Derin kadife siyahı zemin, yakut bordosu vurgular, gizli paketleme güvencesi ve sofistike serif tipografi.",
    tags: ["Koyu Tema", "Gizli Paketleme", "Bordo & Siyah", "Lüks Gece"],
    previewColors: {
      surface: "#0d0b10",
      card: "#16131c",
      ink: "#f5f3f7",
      accent: "#b91c1c",
      border: "#2b2336",
    },
    values: {
      presetId: "noir-velvet",
      logoText: "NOIR ATELIER",
      surfaceColor: "#0d0b10",
      cardColor: "#16131c",
      primaryColor: "#f5f3f7",
      mutedColor: "#a299ad",
      accentColor: "#b91c1c",
      accentFgColor: "#ffffff",
      borderColor: "#2b2336",
      headingFont: "instrument-serif",
      bodyFont: "plus-jakarta",
      radiusScale: "sm",
      themeMode: "dark",
      announcementEnabled: true,
      announcementText:
        "Gizli Paketleme: Tüm siparişler dışarıdan içeriği belli olmayan isimsiz kutuda gönderilir.",
      announcementHref: "/katalog",
      discreetShippingNotice: true,
      isDraftDirection: false,
    },
  },

  // 2. İÇ GİYİM & FANTAZİ GİYİM 2: SATIN & BLUSH
  {
    id: "satin-blush",
    name: "Satin & Blush",
    subtitle: "İpek & Gül Kurusu",
    category: "intimate",
    categoryLabel: "İç Giyim & Romantik",
    badge: "İç Giyim & Dantel",
    description:
      "Pudra, ten ve saten tonlarında romantik ve büyüleyici tasarım. Yumuşak kavisler, zarif mürdüm gül detayları ve ipeksi editoryal estetik.",
    tags: ["Açık Pembe", "Dantel & Saten", "Romantik", "Gizli Paketleme"],
    previewColors: {
      surface: "#fdf8f8",
      card: "#ffffff",
      ink: "#2d1b25",
      accent: "#be185d",
      border: "#fbcfe8",
    },
    values: {
      presetId: "satin-blush",
      logoText: "MAISON DE SOIE",
      surfaceColor: "#fdf8f8",
      cardColor: "#ffffff",
      primaryColor: "#2d1b25",
      mutedColor: "#836978",
      accentColor: "#be185d",
      accentFgColor: "#ffffff",
      borderColor: "#fbcfe8",
      headingFont: "instrument-serif",
      bodyFont: "plus-jakarta",
      radiusScale: "md",
      themeMode: "light",
      announcementEnabled: true,
      announcementText:
        "İpeksi Dokunuş: 1.000 TL üzeri tüm siparişlerde özel saten seyahat kesesi hediye.",
      announcementHref: "/katalog",
      discreetShippingNotice: true,
      isDraftDirection: false,
    },
  },

  // 3. HAZIR GİYİM 1: MINIMALIST STUDIO
  {
    id: "minimal-studio",
    name: "Minimalist Studio",
    subtitle: "İskandinav & Monokrom",
    category: "apparel",
    categoryLabel: "Hazır Giyim & Stüdyo",
    badge: "Modern & Zamansız",
    description:
      "COS, Arket ve Zara Studio tarzı saf monokrom, heykelsi stüdyo grisi, keskin hatlar ve çağdaş mimari sans-serif formu.",
    tags: ["Monokrom", "Keskin Hatlar", "Modern Sans", "Minimalist"],
    previewColors: {
      surface: "#f4f4f5",
      card: "#ffffff",
      ink: "#09090b",
      accent: "#18181b",
      border: "#e4e4e7",
    },
    values: {
      presetId: "minimal-studio",
      logoText: "STUDIO ATÖLYE",
      surfaceColor: "#f4f4f5",
      cardColor: "#ffffff",
      primaryColor: "#09090b",
      mutedColor: "#71717a",
      accentColor: "#18181b",
      accentFgColor: "#ffffff",
      borderColor: "#e4e4e7",
      headingFont: "plus-jakarta",
      bodyFont: "plus-jakarta",
      radiusScale: "none",
      themeMode: "light",
      announcementEnabled: true,
      announcementText:
        "Yeni Sezon: Mimari formlar ve sürdürülebilir kumaş seçkisi yayında.",
      announcementHref: "/katalog",
      discreetShippingNotice: false,
      isDraftDirection: false,
    },
  },

  // 4. HAZIR GİYİM 2: STREETWEAR & NEON
  {
    id: "street-neon",
    name: "Streetwear & Neon",
    subtitle: "Sokak Modası & Kehribar",
    category: "apparel",
    categoryLabel: "Sokak Modası & Hype",
    badge: "Genç & Enerjik",
    description:
      "Yüksek enerjili koyu asfalt zemin, elektrik kehribar sarısı vurgular, brutalist bloklar ve dinamik sokak kültürü estetiği.",
    tags: ["Koyu Tema", "Kehribar Vurgu", "Sokak Giyimi", "Dinamik"],
    previewColors: {
      surface: "#0b0d10",
      card: "#13171f",
      ink: "#f8fafc",
      accent: "#f59e0b",
      border: "#232b38",
    },
    values: {
      presetId: "street-neon",
      logoText: "URBAN DROP",
      surfaceColor: "#0b0d10",
      cardColor: "#13171f",
      primaryColor: "#f8fafc",
      mutedColor: "#94a3b8",
      accentColor: "#f59e0b",
      accentFgColor: "#09090b",
      borderColor: "#232b38",
      headingFont: "plus-jakarta",
      bodyFont: "plus-jakarta",
      radiusScale: "none",
      themeMode: "dark",
      announcementEnabled: true,
      announcementText:
        "DROP CANLI: Sınırlı sayıda üretilen oversize kapsül koleksiyonunu tükenmeden yakalayın.",
      announcementHref: "/katalog?filter=bestseller",
      discreetShippingNotice: false,
      isDraftDirection: false,
    },
  },

  // 5. HAZIR GİYİM 3: EARTH & LINEN
  {
    id: "earth-linen",
    name: "Earth & Linen",
    subtitle: "Bohem & Keten",
    category: "apparel",
    categoryLabel: "Doğal Giyim & Keten",
    badge: "Doğal & Organik",
    description:
      "Doğal keten dokumalar, organik pamuk, kavrulmuş fındık ve kehribar tonları ile sıcak Akdeniz hazır giyim esintisi.",
    tags: ["Toprak Tonları", "Keten Bej", "Bohem", "Yumuşak Kavis"],
    previewColors: {
      surface: "#fbf8f3",
      card: "#ffffff",
      ink: "#29221b",
      accent: "#92400e",
      border: "#e7dec8",
    },
    values: {
      presetId: "earth-linen",
      logoText: "TERRA & LINEN",
      surfaceColor: "#fbf8f3",
      cardColor: "#ffffff",
      primaryColor: "#29221b",
      mutedColor: "#7c6e61",
      accentColor: "#92400e",
      accentFgColor: "#ffffff",
      borderColor: "#e7dec8",
      headingFont: "instrument-serif",
      bodyFont: "plus-jakarta",
      radiusScale: "md",
      themeMode: "light",
      announcementEnabled: true,
      announcementText:
        "Doğal elyaflar ve saf keten dokunuşu: 1.500 TL üzeri siparişlerde kargo ücretsiz.",
      announcementHref: "/katalog",
      discreetShippingNotice: false,
      isDraftDirection: false,
    },
  },

  // 6. HAZIR GİYİM 4: QUIET LUXURY
  {
    id: "quiet-luxury",
    name: "Quiet Luxury",
    subtitle: "Sessiz Lüks & Lacivert",
    category: "apparel",
    categoryLabel: "Sessiz Lüks & Kaşmir",
    badge: "Old Money Zarafeti",
    description:
      "Brunello Cucinelli ve Loro Piana estetiği. Derin gece laciverti, fildişi inci zemin, asil serif başlıklar ve zamansız lüks algısı.",
    tags: ["Lacivert & İnci", "Old Money", "Kaşmir & Yün", "Premium"],
    previewColors: {
      surface: "#f6f7f9",
      card: "#ffffff",
      ink: "#0f172a",
      accent: "#1e3a5f",
      border: "#cbd5e1",
    },
    values: {
      presetId: "quiet-luxury",
      logoText: "VALERIA & CO",
      surfaceColor: "#f6f7f9",
      cardColor: "#ffffff",
      primaryColor: "#0f172a",
      mutedColor: "#475569",
      accentColor: "#1e3a5f",
      accentFgColor: "#ffffff",
      borderColor: "#cbd5e1",
      headingFont: "instrument-serif",
      bodyFont: "plus-jakarta",
      radiusScale: "sm",
      themeMode: "light",
      announcementEnabled: true,
      announcementText:
        "Kusursuz İtalyan kalıpları ve saf kaşmir dokunuşu: Yeni koleksiyon mağazada.",
      announcementHref: "/katalog",
      discreetShippingNotice: false,
      isDraftDirection: false,
    },
  },
];

export function getThemePresetById(id: string): ThemePreset | undefined {
  return THEME_PRESETS.find((p) => p.id === id);
}

export function getDefaultThemePreset(): ThemePreset {
  return THEME_PRESETS[0]!;
}
