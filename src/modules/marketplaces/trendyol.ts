import { normalizeTurkishPhoneNumber } from "@/lib/sms";

/**
 * Trendyol Pazaryeri Entegrasyon Modülü
 * Stok/Fiyat ürün aktarımı ve gelen sipariş webhook ayrıştırma motoru.
 */

export interface ExportableMarketplaceProduct {
  id: string;
  title: string;
  description?: string | null;
  brandName?: string | null;
  brandId?: number;
  categoryId?: number;
  vatRate?: number;
  desi?: number;
  images: string[];
  variants: Array<{
    id: string;
    sku: string;
    barcode: string;
    priceMinor: number;
    compareAtPriceMinor?: number | null;
    stock: number;
    attributes?: Record<string, string>;
  }>;
}

export interface TrendyolProductItem {
  barcode: string;
  title: string;
  productMainId: string;
  brandId?: number;
  categoryId?: number;
  quantity: number;
  stockCode: string;
  dimensionalWeight: number;
  description: string;
  currencyType: "TRY";
  listPrice: number;
  salePrice: number;
  vatRate: number;
  images: Array<{ url: string }>;
  attributes?: Array<{
    attributeId: number;
    attributeValueId?: number;
    customAttributeValue?: string;
  }>;
}

export interface TrendyolOrderWebhookPayload {
  id: number;
  orderNumber: string;
  orderDate: number;
  status: string;
  totalPrice: number;
  currencyCode?: string;
  customerFirstName?: string;
  customerLastName?: string;
  customerEmail?: string;
  shipmentAddress: {
    firstName: string;
    lastName: string;
    address1: string;
    city: string;
    district: string;
    phone?: string;
  };
  invoiceAddress?: {
    firstName?: string;
    lastName?: string;
    address1?: string;
    city?: string;
    district?: string;
    taxNumber?: string;
    taxOffice?: string;
    companyName?: string;
  };
  lines: Array<{
    id?: number;
    lineId?: number;
    quantity: number;
    sku?: string;
    barcode: string;
    productName: string;
    price: number;
    vatBaseAmount?: number;
  }>;
  cargoProviderName?: string;
  cargoTrackingNumber?: string;
}

export interface ParsedTrendyolOrder {
  externalOrderNumber: string;
  source: "trendyol";
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  shippingAddress: {
    firstName: string;
    lastName: string;
    line1: string;
    city: string;
    district: string;
    phone: string;
  };
  billingAddress: {
    firstName: string;
    lastName: string;
    line1: string;
    city: string;
    district: string;
    taxNumber?: string;
    companyName?: string;
  };
  items: Array<{
    sku: string;
    barcode: string;
    title: string;
    quantity: number;
    priceMinor: number;
  }>;
  totalMinor: number;
  carrier?: string;
  trackingNumber?: string;
}

/**
 * Ürün ve varyant listesini Trendyol v2/products API toplu aktarım şemasına dönüştürür.
 */
export function buildTrendyolProductBatch(
  products: ExportableMarketplaceProduct[]
): { items: TrendyolProductItem[] } {
  const items: TrendyolProductItem[] = [];

  for (const product of products) {
    const vatRate = product.vatRate ?? 10;
    const desi = product.desi && product.desi > 0 ? product.desi : 1;
    const images = product.images.map((url) => ({ url }));

    for (const variant of product.variants) {
      if (!variant.barcode || !variant.sku) continue;

      const salePrice = Number((variant.priceMinor / 100).toFixed(2));
      const listPrice =
        variant.compareAtPriceMinor && variant.compareAtPriceMinor > variant.priceMinor
          ? Number((variant.compareAtPriceMinor / 100).toFixed(2))
          : salePrice;

      const item: TrendyolProductItem = {
        barcode: variant.barcode.trim(),
        title: product.title.trim(),
        productMainId: product.id,
        ...(product.brandId ? { brandId: product.brandId } : {}),
        ...(product.categoryId ? { categoryId: product.categoryId } : {}),
        quantity: Math.max(0, variant.stock),
        stockCode: variant.sku.trim(),
        dimensionalWeight: desi,
        description: product.description?.trim() || product.title,
        currencyType: "TRY",
        listPrice,
        salePrice,
        vatRate,
        images: images.length > 0 ? images : [{ url: "https://vezolla.com/placeholder.jpg" }],
      };

      items.push(item);
    }
  }

  return { items };
}

/**
 * Gelen Trendyol sipariş webhook paketini doğrular ve iç sipariş modeline dönüştürür.
 */
export function parseTrendyolOrderWebhook(payload: unknown): ParsedTrendyolOrder {
  if (!payload || typeof payload !== "object") {
    throw new Error("Geçersiz Trendyol webhook paketi: Beklenen obje tipi bulunamadı.");
  }

  const data = payload as Partial<TrendyolOrderWebhookPayload>;

  if (!data.orderNumber) {
    throw new Error("Trendyol sipariş numarası (orderNumber) eksik.");
  }

  if (!data.lines || !Array.isArray(data.lines) || data.lines.length === 0) {
    throw new Error("Sipariş satırları (lines) boş veya geçersiz.");
  }

  if (!data.shipmentAddress) {
    throw new Error("Teslimat adresi (shipmentAddress) eksik.");
  }

  const customerFirstName =
    data.customerFirstName?.trim() || data.shipmentAddress.firstName?.trim() || "Müşteri";
  const customerLastName =
    data.customerLastName?.trim() || data.shipmentAddress.lastName?.trim() || "Trendyol";
  const customerEmail =
    data.customerEmail?.trim() || `${data.orderNumber.toLowerCase()}@trendyol-musteri.com`;
  const rawPhone = data.shipmentAddress.phone?.trim() || "";
  const phone = normalizeTurkishPhoneNumber(rawPhone) ?? rawPhone;

  const items = data.lines.map((line) => {
    const qty = Math.max(1, Number(line.quantity) || 1);
    const priceMinor = Math.round(Number(line.price) * 100);
    return {
      sku: line.sku?.trim() || line.barcode?.trim() || "SKU-YOK",
      barcode: line.barcode?.trim() || "",
      title: line.productName?.trim() || "Trendyol Ürünü",
      quantity: qty,
      priceMinor,
    };
  });

  const totalMinor =
    typeof data.totalPrice === "number"
      ? Math.round(data.totalPrice * 100)
      : items.reduce((sum, item) => sum + item.priceMinor * item.quantity, 0);

  const billing = data.invoiceAddress ?? data.shipmentAddress;

  return {
    externalOrderNumber: String(data.orderNumber),
    source: "trendyol",
    customer: {
      firstName: customerFirstName,
      lastName: customerLastName,
      email: customerEmail,
      phone,
    },
    shippingAddress: {
      firstName: data.shipmentAddress.firstName?.trim() || customerFirstName,
      lastName: data.shipmentAddress.lastName?.trim() || customerLastName,
      line1: data.shipmentAddress.address1?.trim() || "Adres belirtilmedi",
      city: data.shipmentAddress.city?.trim() || "İstanbul",
      district: data.shipmentAddress.district?.trim() || "Merkez",
      phone,
    },
    billingAddress: {
      firstName: billing.firstName?.trim() || customerFirstName,
      lastName: billing.lastName?.trim() || customerLastName,
      line1: billing.address1?.trim() || "Adres belirtilmedi",
      city: billing.city?.trim() || "İstanbul",
      district: billing.district?.trim() || "Merkez",
      taxNumber: data.invoiceAddress?.taxNumber?.trim(),
      companyName: data.invoiceAddress?.companyName?.trim(),
    },
    items,
    totalMinor,
    carrier: data.cargoProviderName?.trim(),
    trackingNumber: data.cargoTrackingNumber?.trim(),
  };
}

/**
 * Trendyol kargo takip numarası bildirim paketini hazırlar.
 */
export function buildTrendyolTrackingPayload(params: {
  trackingNumber: string;
  carrier: string;
}): { trackingNumber: string; providerCode: string } {
  let providerCode = "YURTICI";
  const c = params.carrier
    .toUpperCase()
    .replace(/İ/g, "I")
    .replace(/Ü/g, "U")
    .replace(/Ğ/g, "G")
    .replace(/Ş/g, "S")
    .replace(/Ö/g, "O")
    .replace(/Ç/g, "C");
  if (c.includes("ARAS")) providerCode = "ARAS";
  else if (c.includes("MNG")) providerCode = "MNG";
  else if (c.includes("SURAT")) providerCode = "SURAT";
  else if (c.includes("PTT")) providerCode = "PTT";
  else if (c.includes("TEX") || c.includes("EXPRESS")) providerCode = "TRENDYOLEXPRESS";

  return {
    trackingNumber: params.trackingNumber.trim(),
    providerCode,
  };
}
