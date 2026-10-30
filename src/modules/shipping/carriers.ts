export type CarrierCode =
  | "yurtici"
  | "aras"
  | "mng"
  | "ptt"
  | "surat"
  | "kolaygelsin"
  | "hepsijet"
  | "other";

export interface CarrierDefinition {
  code: CarrierCode;
  name: string;
  buildTrackingUrl: (trackingNumber: string) => string;
}

export const CARRIERS: ReadonlyArray<CarrierDefinition> = [
  {
    code: "yurtici",
    name: "Yurtiçi Kargo",
    buildTrackingUrl: (num) =>
      `https://www.yurticikargo.com/tr/online-servisler/gonderi-sorgula?code=${encodeURIComponent(num.trim())}`,
  },
  {
    code: "aras",
    name: "Aras Kargo",
    buildTrackingUrl: (num) =>
      `https://kargotakip.araskargo.com.tr/mainpage.aspx?code=${encodeURIComponent(num.trim())}`,
  },
  {
    code: "mng",
    name: "MNG Kargo (DHL eCommerce)",
    buildTrackingUrl: (num) =>
      `https://kargotakip.mngkargo.com.tr/?takipNo=${encodeURIComponent(num.trim())}`,
  },
  {
    code: "ptt",
    name: "PTT Kargo",
    buildTrackingUrl: (num) =>
      `https://gonderitakip.ptt.gov.tr/Track/Verify?q=${encodeURIComponent(num.trim())}`,
  },
  {
    code: "surat",
    name: "Sürat Kargo",
    buildTrackingUrl: (num) =>
      `https://www.suratkargo.com.tr/KargoTakip/?kargotakipno=${encodeURIComponent(num.trim())}`,
  },
  {
    code: "kolaygelsin",
    name: "Kolay Gelsin",
    buildTrackingUrl: (num) =>
      `https://esube.kolaygelsin.com/anganat?trackingId=${encodeURIComponent(num.trim())}`,
  },
  {
    code: "hepsijet",
    name: "HepsiJet",
    buildTrackingUrl: (num) =>
      `https://www.hepsijet.com/gonderi-takibi/${encodeURIComponent(num.trim())}`,
  },
  {
    code: "other",
    name: "Diğer / Özel Kurye",
    buildTrackingUrl: () => "",
  },
];

export function getCarrierByCode(code: string | null | undefined): CarrierDefinition | undefined {
  if (!code) return undefined;
  const normalized = code.trim().toLowerCase();
  return CARRIERS.find(
    (c) => c.code === normalized || c.name.toLowerCase() === normalized
  );
}

export function getCarrierLabel(code: string | null | undefined): string {
  if (!code) return "Belirtilmedi";
  return getCarrierByCode(code)?.name ?? code;
}

export function buildCarrierTrackingUrl(
  carrierCode: string | null | undefined,
  trackingNumber: string | null | undefined
): string | null {
  if (!trackingNumber || !trackingNumber.trim()) return null;
  const def = getCarrierByCode(carrierCode);
  if (!def) return null;
  const url = def.buildTrackingUrl(trackingNumber.trim());
  return url || null;
}

export const buildTrackingUrl = buildCarrierTrackingUrl;
export const getCarrierName = getCarrierLabel;

const CARRIER_BARCODE_PREFIX: Record<CarrierCode, string> = {
  yurtici: "YK",
  aras: "AR",
  mng: "MN",
  ptt: "PT",
  surat: "SR",
  kolaygelsin: "KG",
  hepsijet: "HJ",
  other: "KR",
};

function luhnLikeCheckDigit(digits: string): number {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    const d = Number(digits[i]);
    sum += (digits.length - i) % 2 === 0 ? d : d * 3;
  }
  return (10 - (sum % 10)) % 10;
}

/**
 * Takip numarası girilmediğinde üretilen firma önekli dahili barkod numarası.
 * Biçim: ÖNEK + 8 haneli sipariş no + 2 haneli gönderi sırası + kontrol hanesi.
 * Bu numara kargo firmasının kendi API'sinden alınmış değildir; etiketi okutulabilir
 * ve sipariş ile eşleşebilir kılar. Firma takip numarası sonradan girilebilir.
 */
export function generateCarrierBarcode(
  carrierCode: string | null | undefined,
  orderNumber: number,
  shipmentSequence: number
): string {
  const def = getCarrierByCode(carrierCode);
  const prefix = CARRIER_BARCODE_PREFIX[def?.code ?? "other"];
  const body = `${String(orderNumber).padStart(8, "0").slice(-8)}${String(
    Math.max(1, shipmentSequence)
  ).padStart(2, "0").slice(-2)}`;
  return `${prefix}${body}${luhnLikeCheckDigit(body)}`;
}

export interface ShippingLabelParty {
  name: string;
  line1: string;
  district: string;
  city: string;
  phone: string;
}

export interface ShippingLabelData {
  carrierCode: string | null | undefined;
  barcode: string;
  orderNumber: number;
  sender: ShippingLabelParty;
  recipient: ShippingLabelParty;
  /** Kapıda ödeme tahsilat tutarı (kuruş); kapıda ödeme değilse null */
  codAmountMinor: number | null;
  itemSummary: string;
  parcelLabel?: string;
}

/** ZPL kontrol karakterlerini (^ ve ~) ve satır sonlarını alan içeriğinden temizler. */
export function sanitizeZplText(value: string): string {
  return value.replace(/[\^~\\]/g, " ").replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
}

function formatTlForLabel(minor: number): string {
  const major = Math.floor(minor / 100);
  const cents = String(minor % 100).padStart(2, "0");
  return `${major.toLocaleString("tr-TR")},${cents} TL`;
}

/**
 * 100x150 mm (203 dpi, 812x1218 nokta) Zebra ZPL II kargo etiketi üretir.
 * Türkçe karakterler için ^CI28 (UTF-8) kullanılır.
 */
export function buildShippingLabelZpl(data: ShippingLabelData): string {
  const t = sanitizeZplText;
  const carrier = t(getCarrierLabel(data.carrierCode));
  const barcode = t(data.barcode);
  const codAmount = data.codAmountMinor ?? 0;
  const cod = codAmount > 0;

  const lines: string[] = [
    "^XA",
    "^CI28",
    "^PW812",
    "^LL1218",
    "^LH0,0",
    "^FO24,24^GB764,1170,3^FS",
    `^FO48,44^A0N,38,38^FB716,1,0,L^FD${t(data.sender.name)}^FS`,
    `^FO48,92^A0N,24,24^FB716,2,4,L^FD${t(
      `${data.sender.line1}, ${data.sender.district} / ${data.sender.city}`
    )}^FS`,
    "^FO24,160^GB764,3,3^FS",
    "^FO48,178^A0N,26,26^FDALICI^FS",
    `^FO48,212^A0N,50,50^FB716,2,0,L^FD${t(data.recipient.name)}^FS`,
    `^FO48,310^A0N,34,34^FB716,4,6,L^FD${t(data.recipient.line1)}^FS`,
    `^FO48,452^A0N,46,46^FB716,1,0,L^FD${t(
      `${data.recipient.district} / ${data.recipient.city}`
    )}^FS`,
    `^FO48,512^A0N,34,34^FDTel: ${t(data.recipient.phone)}^FS`,
    "^FO24,572^GB764,3,3^FS",
    `^FO48,590^A0N,28,28^FD${carrier}^FS`,
    `^FO48,626^A0N,36,36^FDSiparis No: #${data.orderNumber}${
      data.parcelLabel ? `   ${t(data.parcelLabel)}` : ""
    }^FS`,
  ];

  if (cod) {
    lines.push(
      "^FO48,684^GB716,104,104^FS",
      `^FO68,708^A0N,56,56^FR^FDKAPIDA ODEME: ${formatTlForLabel(codAmount)}^FS`
    );
  }

  lines.push(
    `^FO48,816^A0N,24,24^FB716,3,4,L^FD${t(data.itemSummary)}^FS`,
    "^FO24,910^GB764,3,3^FS",
    `^FO120,950^BY3,3,170^BCN,170,N,N,N^FD${barcode}^FS`,
    `^FO24,1140^A0N,38,38^FB764,1,0,C^FD${barcode}^FS`,
    "^XZ"
  );

  return lines.join("\n") + "\n";
}

