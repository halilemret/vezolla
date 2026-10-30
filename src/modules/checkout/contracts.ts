import { formatMoney } from "@/lib/money";
import type { StoreSettings } from "@/lib/settings/schemas";
import type { CheckoutAddress } from "@/modules/checkout/schemas";

export interface ContractLineItem {
  title: string;
  variantTitle?: string | null;
  sku?: string | null;
  quantity: number;
  unitPriceMinor: number;
  discountMinor: number;
  taxRateBps: number;
  totalMinor: number;
}

export interface OrderContractInput {
  orderNumber?: number | string;
  createdAt?: Date;
  store: StoreSettings;
  buyerEmail: string;
  buyerPhone: string;
  shippingAddress: CheckoutAddress;
  billingAddress: CheckoutAddress;
  shippingMethodName: string;
  paymentMethodLabel: string;
  lines: ContractLineItem[];
  subtotalMinor: number;
  discountTotalMinor: number;
  shippingTotalMinor: number;
  paymentFeeMinor: number;
  taxTotalMinor: number;
  totalMinor: number;
  currency?: string;
}

export interface GeneratedContracts {
  preInformation: string;
  distanceSales: string;
}

function formatAddressLine(addr: CheckoutAddress): string {
  const parts = [
    addr.line1,
    addr.neighborhood ? `${addr.neighborhood}` : null,
    `${addr.district} / ${addr.city}`,
    addr.postalCode ? `PK: ${addr.postalCode}` : null,
  ].filter(Boolean);
  return parts.join(", ");
}

function formatInvoiceIdentity(addr: CheckoutAddress): string {
  if (addr.invoiceType === "CORPORATE") {
    return `Kurumsal Fatura: ${addr.companyName ?? ""} (VD: ${addr.taxOffice ?? ""}, VKN: ${addr.taxNumber ?? ""})`;
  }
  return `Bireysel Fatura: ${addr.firstName} ${addr.lastName}${addr.tckn ? ` (TCKN: ${addr.tckn})` : ""}`;
}

export function generateOrderContracts(input: OrderContractInput): GeneratedContracts {
  const currency = input.currency ?? input.store.currency ?? "TRY";
  const dateStr = (input.createdAt ?? new Date()).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const orderRef = input.orderNumber ? `#${input.orderNumber}` : "Sipariş Önizleme";
  const sellerName = input.store.companyLegalName || input.store.storeName;
  const sellerAddress = `${input.store.address}, ${input.store.district} / ${input.store.city}`;
  const buyerFullName = `${input.shippingAddress.firstName} ${input.shippingAddress.lastName}`;

  const linesTableText = input.lines
    .map((line, idx) => {
      const fullTitle = line.variantTitle
        ? `${line.title} (${line.variantTitle})`
        : line.title;
      const skuPart = line.sku ? ` [SKU: ${line.sku}]` : "";
      const vatPct = (line.taxRateBps / 100).toFixed(0);
      return `${idx + 1}. ${fullTitle}${skuPart} | Adet: ${line.quantity} | Birim: ${formatMoney(line.unitPriceMinor, currency)} | İndirim: ${formatMoney(line.discountMinor, currency)} | KDV: %${vatPct} | Satır Toplamı: ${formatMoney(line.totalMinor, currency)}`;
    })
    .join("\n");

  const summaryBlock = [
    `Ara Toplam (KDV Dahil): ${formatMoney(input.subtotalMinor, currency)}`,
    `Toplam İndirim: -${formatMoney(input.discountTotalMinor, currency)}`,
    `Teslimat / Kargo (${input.shippingMethodName}): ${formatMoney(input.shippingTotalMinor, currency)}`,
    ...(input.paymentFeeMinor > 0
      ? [`Ödeme Hizmet Bedeli: ${formatMoney(input.paymentFeeMinor, currency)}`]
      : []),
    `Toplam İçindeki KDV: ${formatMoney(input.taxTotalMinor, currency)}`,
    `ÖDENECEK TOPLAM TUTAR: ${formatMoney(input.totalMinor, currency)}`,
    `Ödeme Yöntemi: ${input.paymentMethodLabel}`,
  ].join("\n");

  const preInformation = [
    `ÖN BİLGİLENDİRME FORMU (${orderRef} - Tarih: ${dateStr})`,
    "",
    "1. SATICI BİLGİLERİ",
    `Unvan: ${sellerName}`,
    `Adres: ${sellerAddress}`,
    `Vergi Dairesi ve No: ${input.store.taxOffice} / ${input.store.taxNumber}`,
    `MERSİS No: ${input.store.mersisNumber} | KEP: ${input.store.kepAddress}`,
    `Telefon: ${input.store.supportPhone} | E-posta: ${input.store.supportEmail}`,
    "",
    "2. ALICI BİLGİLERİ",
    `Ad Soyad: ${buyerFullName}`,
    `Teslimat Adresi: ${formatAddressLine(input.shippingAddress)}`,
    `Fatura Bilgisi: ${formatInvoiceIdentity(input.billingAddress)}`,
    `Fatura Adresi: ${formatAddressLine(input.billingAddress)}`,
    `Telefon: ${input.buyerPhone} | E-posta: ${input.buyerEmail}`,
    "",
    "3. SÖZLEŞME KONUSU ÜRÜNLER VE FİYATLANDIRMA",
    linesTableText,
    "",
    summaryBlock,
    "",
    "4. TESLİMAT VE İFA",
    "Sipariş konusu ürünler, yasal 30 günlük süreyi aşmamak kaydıyla alıcının belirttiği teslimat adresine anlaşmalı kargo firması aracılığıyla teslim edilir.",
    "",
    "5. CAYMA HAKKI",
    "Alıcı, 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği uyarınca ürünü teslim aldığı tarihten itibaren 14 (on dört) gün içinde herhangi bir gerekçe göstermeksizin ve cezai şart ödemeksizin sözleşmeden cayma hakkına sahiptir.",
  ].join("\n");

  const distanceSales = [
    `MESAFELİ SATIŞ SÖZLEŞMESİ (${orderRef} - Tarih: ${dateStr})`,
    "",
    "MADDE 1: TARAFLAR",
    `1.1. SATICI: ${sellerName}`,
    `Adres: ${sellerAddress}`,
    `Vergi Dairesi / No: ${input.store.taxOffice} / ${input.store.taxNumber} | MERSİS: ${input.store.mersisNumber}`,
    `İletişim: ${input.store.supportEmail} / ${input.store.supportPhone}`,
    "",
    `1.2. ALICI: ${buyerFullName}`,
    `Teslimat Adresi: ${formatAddressLine(input.shippingAddress)}`,
    `Fatura Bilgisi: ${formatInvoiceIdentity(input.billingAddress)}`,
    `İletişim: ${input.buyerEmail} / ${input.buyerPhone}`,
    "",
    "MADDE 2: KONU",
    "İşbu sözleşmenin konusu, Alıcının Satıcıya ait elektronik ticaret internet sitesinden elektronik ortamda siparişini verdiği, aşağıda nitelikleri ve satış fiyatı belirtilen ürünlerin satışı ve teslimi ile ilgili olarak 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği hükümleri gereğince tarafların hak ve yükümlülüklerinin belirlenmesidir.",
    "",
    "MADDE 3: SÖZLEŞME KONUSU ÜRÜN, FİYAT VE ÖDEME BİLGİLERİ",
    linesTableText,
    "",
    summaryBlock,
    "",
    "MADDE 4: GENEL HÜKÜMLER VE TESLİMAT",
    `4.1. Ürün, Alıcının belirttiği teslimat adresine (${formatAddressLine(input.shippingAddress)}) ${input.shippingMethodName} aracılığı ile gönderilir.`,
    "4.2. Alıcı, sözleşme konusu ürünün temel nitelikleri, KDV dahil satış fiyatı, ödeme şekli ve teslimata ilişkin ön bilgileri okuyup bilgi sahibi olduğunu ve elektronik ortamda gerekli teyidi verdiğini kabul ve beyan eder.",
    "",
    "MADDE 5: CAYMA HAKKI VE İADE PROSEDÜRÜ",
    "5.1. Alıcı, mal teslimine ilişkin sözleşmelerde malın teslim alındığı günden itibaren 14 (on dört) gün içinde cayma hakkını kullanabilir.",
    "5.2. Cayma hakkının kullanılması halinde, ürün bedeli ürünün Satıcıya ulaşmasını takip eden 14 (on dört) gün içinde Alıcının ödeme aracına uygun şekilde iade edilir.",
    "",
    "MADDE 6: YETKİLİ MAHKEME",
    "İşbu sözleşmeden doğabilecek uyuşmazlıklarda Ticaret Bakanlığınca ilan edilen değere kadar Tüketici Hakem Heyetleri, aşan durumlarda Tüketici Mahkemeleri yetkilidir.",
  ].join("\n");

  return {
    preInformation,
    distanceSales,
  };
}
