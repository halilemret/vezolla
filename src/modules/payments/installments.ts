/**
 * Türkiye'deki 6 Büyük Kredi Kartı Ailesi için iyzico Taksit ve Vade Farkı Hesaplama Motoru
 * (Bonus, World, Axess, Maximum, CardFinans, Paraf)
 */

export interface InstallmentRow {
  count: number;
  monthlyMinor: number;
  totalMinor: number;
  commissionPercent: number;
  isFreeInterest: boolean;
  label: string;
}

export interface CardFamilyInstallment {
  id: string;
  name: string;
  bankNames: string;
  accentColor: string;
  logoUrl?: string;
  installments: InstallmentRow[];
}

export interface InstallmentFamilyConfig {
  id: string;
  name: string;
  bankNames: string;
  accentColor: string;
  logoUrl?: string;
  /**
   * Taksit komisyon oranları (yüzde cinsinden)
   * Örn: 1 -> 0, 2 -> 0 (Peşin Fiyatına), 3 -> 0 (Peşin Fiyatına), 6 -> 6.5, 9 -> 11.5
   */
  rates: Record<number, number>;
}

export const TURKISH_CARD_FAMILIES: InstallmentFamilyConfig[] = [
  {
    id: "bonus",
    name: "Bonus",
    bankNames: "Garanti BBVA, DenizBank, TEB, Şekerbank",
    accentColor: "#059669", // Emerald
    rates: {
      1: 0,
      2: 0,
      3: 0,
      6: 6.45,
      9: 11.25,
    },
  },
  {
    id: "world",
    name: "World",
    bankNames: "Yapı Kredi, Albaraka, VakıfBank, Anadolubank",
    accentColor: "#8b5cf6", // Violet
    rates: {
      1: 0,
      2: 0,
      3: 0,
      6: 6.50,
      9: 11.50,
    },
  },
  {
    id: "axess",
    name: "Axess",
    bankNames: "Akbank",
    accentColor: "#e11d48", // Rose/Red
    rates: {
      1: 0,
      2: 0,
      3: 0,
      6: 6.25,
      9: 10.95,
    },
  },
  {
    id: "maximum",
    name: "Maximum",
    bankNames: "Türkiye İş Bankası",
    accentColor: "#d97706", // Amber
    rates: {
      1: 0,
      2: 0,
      3: 0,
      6: 6.50,
      9: 11.50,
    },
  },
  {
    id: "cardfinans",
    name: "CardFinans",
    bankNames: "QNB Finansbank",
    accentColor: "#0284c7", // Sky/Blue
    rates: {
      1: 0,
      2: 0,
      3: 0,
      6: 6.75,
      9: 11.75,
    },
  },
  {
    id: "paraf",
    name: "Paraf",
    bankNames: "Halkbank",
    accentColor: "#2563eb", // Blue
    rates: {
      1: 0,
      2: 0,
      3: 0,
      6: 6.30,
      9: 11.00,
    },
  },
];

const INSTALLMENT_COUNTS = [1, 2, 3, 6, 9] as const;

/**
 * Belirtilen tutar (kuruş) için 6 kredi kartı ailesine ait taksit tablosunu hesaplar.
 * familiesOrSettings parametresi verilmezse varsayılan TURKISH_CARD_FAMILIES kullanılır.
 */
export function calculateInstallmentPlans(
  priceMinor: number,
  familiesOrSettings:
    | InstallmentFamilyConfig[]
    | { cardFamilies: InstallmentFamilyConfig[] } = TURKISH_CARD_FAMILIES
): CardFamilyInstallment[] {
  const safePrice = Math.max(0, priceMinor);
  let families: InstallmentFamilyConfig[] = TURKISH_CARD_FAMILIES;

  if (Array.isArray(familiesOrSettings) && familiesOrSettings.length > 0) {
    families = familiesOrSettings;
  } else if (
    familiesOrSettings &&
    typeof familiesOrSettings === "object" &&
    "cardFamilies" in familiesOrSettings &&
    Array.isArray(familiesOrSettings.cardFamilies) &&
    familiesOrSettings.cardFamilies.length > 0
  ) {
    families = familiesOrSettings.cardFamilies;
  }

  return families.map((fam) => {
    const installments: InstallmentRow[] = INSTALLMENT_COUNTS.map((count) => {
      const rate = fam.rates[count] ?? 0;
      const isFreeInterest = rate <= 0;

      let totalMinor = safePrice;
      if (!isFreeInterest) {
        // Vade farkı hesaplama
        totalMinor = Math.round(safePrice * (1 + rate / 100));
      }

      const monthlyMinor = count > 0 ? Math.round(totalMinor / count) : totalMinor;

      const label = isFreeInterest
        ? count === 1
          ? "Tek Çekim"
          : "Peşin Fiyatına (%0)"
        : `+%${rate.toFixed(2)}`;

      return {
        count,
        monthlyMinor,
        totalMinor,
        commissionPercent: rate,
        isFreeInterest,
        label,
      };
    });

    return {
      id: fam.id,
      name: fam.name,
      bankNames: fam.bankNames,
      accentColor: fam.accentColor,
      logoUrl: fam.logoUrl,
      installments,
    };
  });
}

/**
 * Taksit planlarını hesaplar.
 * İsteğe bağlı olarak özel kart aileleri verilebilir, aksi halde varsayılan `TURKISH_CARD_FAMILIES` kullanılır.
 */
export function getCalculatedInstallmentPlans(
  priceMinor: number,
  customFamilies?: InstallmentFamilyConfig[]
): CardFamilyInstallment[] {
  return calculateInstallmentPlans(priceMinor, customFamilies ?? TURKISH_CARD_FAMILIES);
}

export const getInstallmentPlans = getCalculatedInstallmentPlans;
