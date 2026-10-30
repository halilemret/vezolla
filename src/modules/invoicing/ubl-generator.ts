import type { InvoiceSettings } from "@/lib/settings/schemas";

function escapeXml(unsafe: string | number | null | undefined): string {
  if (unsafe == null) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export interface UblInvoiceLineInput {
  index: number;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  quantity: number;
  unitCode?: string; // C62 (Adet)
  unitPriceMinor: number;
  discountMinor: number;
  taxRateBps: number; // 2000 => %20
  taxAmountMinor: number;
  totalMinor: number;
}

export interface UblTaxSubtotalInput {
  rateBps: number;
  taxableAmountMinor: number;
  taxAmountMinor: number;
}

export interface UblInvoiceData {
  invoiceNumber: string;
  ettn: string; // UUID v4
  issueDate: Date;
  profileId: "EARSIVFATURA" | "TEMELFATURA" | "TICARIFATURA";
  invoiceTypeCode: "SATIS" | "IADE";
  currency: string;
  notes: string[];
  orderNumber: number;
  paymentMethod: string;
  settings: InvoiceSettings;

  recipient: {
    isCorporate: boolean;
    title: string;
    taxNumber: string; // TCKN veya VKN
    taxOffice?: string | null;
    email?: string | null;
    phone?: string | null;
    address: {
      line1: string;
      district: string;
      city: string;
      postalCode?: string | null;
      country?: string;
    };
  };

  taxSubtotals: UblTaxSubtotalInput[];
  lines: UblInvoiceLineInput[];

  subtotalMinor: number;
  taxTotalMinor: number;
  discountTotalMinor: number;
  shippingTotalMinor: number;
  paymentFeeMinor: number;
  totalMinor: number;
}

function minorToDecimalStr(minor: number): string {
  return (minor / 100).toFixed(2);
}

/**
 * GİB UBL-TR 1.2 standardına uygun e-Fatura / e-Arşiv Fatura XML belgesi üretir.
 */
export function generateUblTrXml(data: UblInvoiceData): string {
  const dateStr = data.issueDate.toISOString().slice(0, 10);
  const timeStr = data.issueDate.toISOString().slice(11, 19);

  const supplier = {
    vkn: data.settings.companyTaxNumber || "1234567890",
    name: data.settings.companySenderTitle || "Vezolla Tekstil ve Mağazacılık A.Ş.",
    taxOffice: data.settings.companyTaxOffice || "Beyoğlu",
    mersis: data.settings.companyMersis || "0123456789000001",
    address: data.settings.companyAddress || "Nişantaşı, Şişli / İstanbul",
    phone: data.settings.companyPhone || "0850 840 42 42",
    email: data.settings.companyEmail || "muhasebe@vezolla.com",
    web: data.settings.companyWeb || "https://vezolla.com",
  };

  const recipientVknTcknScheme = data.recipient.isCorporate ? "VKN" : "TCKN";
  const recipientVkn = data.recipient.taxNumber || (data.recipient.isCorporate ? "1111111111" : "11111111111");

  const taxSubtotalXml = data.taxSubtotals
    .map(
      (sub) => `
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${escapeXml(data.currency)}">${minorToDecimalStr(sub.taxableAmountMinor)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${escapeXml(data.currency)}">${minorToDecimalStr(sub.taxAmountMinor)}</cbc:TaxAmount>
      <cbc:CalculationSequenceNumeric>1</cbc:CalculationSequenceNumeric>
      <cbc:Percent>${(sub.rateBps / 100).toFixed(0)}</cbc:Percent>
      <cac:TaxCategory>
        <cac:TaxScheme>
          <cbc:Name>Katma Değer Vergisi</cbc:Name>
          <cbc:TaxTypeCode>0015</cbc:TaxTypeCode>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>`
    )
    .join("");

  const linesXml = data.lines
    .map((line) => {
      const lineTaxRatePct = (line.taxRateBps / 100).toFixed(0);
      const grossLineAmountMinor = line.unitPriceMinor * line.quantity;
      const netLineAmountMinor = Math.max(0, grossLineAmountMinor - line.discountMinor);

      return `
  <cac:InvoiceLine>
    <cbc:ID>${line.index}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="${escapeXml(line.unitCode || "C62")}">${line.quantity}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="${escapeXml(data.currency)}">${minorToDecimalStr(netLineAmountMinor)}</cbc:LineExtensionAmount>
    ${
      line.discountMinor > 0
        ? `
    <cac:AllowanceCharge>
      <cbc:ChargeIndicator>false</cbc:ChargeIndicator>
      <cbc:Amount currencyID="${escapeXml(data.currency)}">${minorToDecimalStr(line.discountMinor)}</cbc:Amount>
    </cac:AllowanceCharge>`
        : ""
    }
    <cac:TaxTotal>
      <cbc:TaxAmount currencyID="${escapeXml(data.currency)}">${minorToDecimalStr(line.taxAmountMinor)}</cbc:TaxAmount>
      <cac:TaxSubtotal>
        <cbc:TaxableAmount currencyID="${escapeXml(data.currency)}">${minorToDecimalStr(netLineAmountMinor)}</cbc:TaxableAmount>
        <cbc:TaxAmount currencyID="${escapeXml(data.currency)}">${minorToDecimalStr(line.taxAmountMinor)}</cbc:TaxAmount>
        <cbc:Percent>${lineTaxRatePct}</cbc:Percent>
        <cac:TaxCategory>
          <cac:TaxScheme>
            <cbc:Name>Katma Değer Vergisi</cbc:Name>
            <cbc:TaxTypeCode>0015</cbc:TaxTypeCode>
          </cac:TaxScheme>
        </cac:TaxCategory>
      </cac:TaxSubtotal>
    </cac:TaxTotal>
    <cac:Item>
      <cbc:Name>${escapeXml(line.name)}</cbc:Name>
      ${line.sku ? `<cac:SellersItemIdentification><cbc:ID>${escapeXml(line.sku)}</cbc:ID></cac:SellersItemIdentification>` : ""}
      ${line.barcode ? `<cac:ManufacturersItemIdentification><cbc:ID>${escapeXml(line.barcode)}</cbc:ID></cac:ManufacturersItemIdentification>` : ""}
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="${escapeXml(data.currency)}">${minorToDecimalStr(line.unitPriceMinor)}</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>`;
    })
    .join("");

  const notesXml = [
    `Sipariş Numarası: #${data.orderNumber}`,
    `Ödeme Şekli: ${data.paymentMethod}`,
    ...data.notes,
  ]
    .filter(Boolean)
    .map((note) => `<cbc:Note>${escapeXml(note)}</cbc:Note>`)
    .join("\n  ");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
  xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2"
  xmlns:ds="http://www.w3.org/2000/09/xmldsig#"
  xmlns:xades="http://uri.etsi.org/01903/v1.3.2#">
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>TR1.2</cbc:CustomizationID>
  <cbc:ProfileID>${escapeXml(data.profileId)}</cbc:ProfileID>
  <cbc:ID>${escapeXml(data.invoiceNumber)}</cbc:ID>
  <cbc:CopyIndicator>false</cbc:CopyIndicator>
  <cbc:UUID>${escapeXml(data.ettn)}</cbc:UUID>
  <cbc:IssueDate>${dateStr}</cbc:IssueDate>
  <cbc:IssueTime>${timeStr}</cbc:IssueTime>
  <cbc:InvoiceTypeCode>${escapeXml(data.invoiceTypeCode)}</cbc:InvoiceTypeCode>
  ${notesXml}
  <cbc:DocumentCurrencyCode>${escapeXml(data.currency)}</cbc:DocumentCurrencyCode>

  <!-- SATICI (VEZOLLA) -->
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="VKN">${escapeXml(supplier.vkn)}</cbc:ID>
      </cac:PartyIdentification>
      ${
        supplier.mersis
          ? `
      <cac:PartyIdentification>
        <cbc:ID schemeID="MERSISNO">${escapeXml(supplier.mersis)}</cbc:ID>
      </cac:PartyIdentification>`
          : ""
      }
      <cac:PartyName>
        <cbc:Name>${escapeXml(supplier.name)}</cbc:Name>
      </cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${escapeXml(supplier.address)}</cbc:StreetName>
        <cbc:CityName>İstanbul</cbc:CityName>
        <cac:Country>
          <cbc:Name>Türkiye</cbc:Name>
        </cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cac:TaxScheme>
          <cbc:Name>${escapeXml(supplier.taxOffice)}</cbc:Name>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:Contact>
        <cbc:Telephone>${escapeXml(supplier.phone)}</cbc:Telephone>
        <cbc:ElectronicMail>${escapeXml(supplier.email)}</cbc:ElectronicMail>
      </cac:Contact>
    </cac:Party>
  </cac:AccountingSupplierParty>

  <!-- ALICI (MÜŞTERİ) -->
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="${recipientVknTcknScheme}">${escapeXml(recipientVkn)}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName>
        <cbc:Name>${escapeXml(data.recipient.title)}</cbc:Name>
      </cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${escapeXml(data.recipient.address.line1)}</cbc:StreetName>
        <cbc:CitySubdivisionName>${escapeXml(data.recipient.address.district)}</cbc:CitySubdivisionName>
        <cbc:CityName>${escapeXml(data.recipient.address.city)}</cbc:CityName>
        ${
          data.recipient.address.postalCode
            ? `<cbc:PostalZone>${escapeXml(data.recipient.address.postalCode)}</cbc:PostalZone>`
            : ""
        }
        <cac:Country>
          <cbc:Name>${escapeXml(data.recipient.address.country || "Türkiye")}</cbc:Name>
        </cac:Country>
      </cac:PostalAddress>
      ${
        data.recipient.taxOffice
          ? `
      <cac:PartyTaxScheme>
        <cac:TaxScheme>
          <cbc:Name>${escapeXml(data.recipient.taxOffice)}</cbc:Name>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>`
          : ""
      }
      <cac:Contact>
        ${data.recipient.phone ? `<cbc:Telephone>${escapeXml(data.recipient.phone)}</cbc:Telephone>` : ""}
        ${data.recipient.email ? `<cbc:ElectronicMail>${escapeXml(data.recipient.email)}</cbc:ElectronicMail>` : ""}
      </cac:Contact>
    </cac:Party>
  </cac:AccountingCustomerParty>

  <!-- VERGİ TOPLAMI -->
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${escapeXml(data.currency)}">${minorToDecimalStr(data.taxTotalMinor)}</cbc:TaxAmount>${taxSubtotalXml}
  </cac:TaxTotal>

  <!-- PARASAL TOPLAMLAR -->
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${escapeXml(data.currency)}">${minorToDecimalStr(data.subtotalMinor)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${escapeXml(data.currency)}">${minorToDecimalStr(data.subtotalMinor - data.discountTotalMinor)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${escapeXml(data.currency)}">${minorToDecimalStr(data.totalMinor)}</cbc:TaxInclusiveAmount>
    <cbc:AllowanceTotalAmount currencyID="${escapeXml(data.currency)}">${minorToDecimalStr(data.discountTotalMinor)}</cbc:AllowanceTotalAmount>
    <cbc:ChargeTotalAmount currencyID="${escapeXml(data.currency)}">${minorToDecimalStr(data.shippingTotalMinor + data.paymentFeeMinor)}</cbc:ChargeTotalAmount>
    <cbc:PayableAmount currencyID="${escapeXml(data.currency)}">${minorToDecimalStr(data.totalMinor)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>

  <!-- FATURA KALEMLERİ -->${linesXml}
</Invoice>`.trim();
}
