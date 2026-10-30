import { describe, expect, it } from "vitest";
import { generateUblTrXml, type UblInvoiceData } from "./ubl-generator";
import { listInvoices } from "./service";
import { DEFAULT_INVOICE_SETTINGS } from "@/lib/settings/schemas";

describe("e-Fatura / e-Arşiv UBL-TR 1.2 Motoru", () => {
  const sampleInvoiceData: UblInvoiceData = {
    invoiceNumber: "VEZ2026000000001",
    ettn: "12345678-1234-4234-8234-1234567890ab",
    issueDate: new Date("2026-10-29T10:00:00Z"),
    profileId: "EARSIVFATURA",
    invoiceTypeCode: "SATIS",
    currency: "TRY",
    notes: ["İşbu fatura elektronik ortamda düzenlenmiştir."],
    orderNumber: 1001,
    paymentMethod: "credit_card",
    settings: DEFAULT_INVOICE_SETTINGS,
    recipient: {
      isCorporate: false,
      title: "Ayşe Yılmaz",
      taxNumber: "12345678901",
      email: "ayse@example.com",
      phone: "05551234567",
      address: {
        line1: "Bağdat Cad. No: 100",
        district: "Kadıköy",
        city: "İstanbul",
        postalCode: "34710",
        country: "Türkiye",
      },
    },
    taxSubtotals: [
      {
        rateBps: 2000, // %20
        taxableAmountMinor: 100000, // 1.000 TL
        taxAmountMinor: 20000, // 200 TL
      },
    ],
    lines: [
      {
        index: 1,
        name: "İpek Dantelli Bralet & Külot Takım",
        sku: "VZ-BR-01",
        quantity: 1,
        unitPriceMinor: 120000,
        discountMinor: 0,
        taxRateBps: 2000,
        taxAmountMinor: 20000,
        totalMinor: 120000,
      },
    ],
    subtotalMinor: 100000,
    taxTotalMinor: 20000,
    discountTotalMinor: 0,
    shippingTotalMinor: 0,
    paymentFeeMinor: 0,
    totalMinor: 120000,
  };

  it("GİB UBL-TR 1.2 standardına uygun XML belgesi üretir", () => {
    const xml = generateUblTrXml(sampleInvoiceData);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"');
    expect(xml).toContain("<cbc:UBLVersionID>2.1</cbc:UBLVersionID>");
    expect(xml).toContain("<cbc:CustomizationID>TR1.2</cbc:CustomizationID>");
    expect(xml).toContain("<cbc:ProfileID>EARSIVFATURA</cbc:ProfileID>");
    expect(xml).toContain("<cbc:ID>VEZ2026000000001</cbc:ID>");
    expect(xml).toContain("<cbc:UUID>12345678-1234-4234-8234-1234567890ab</cbc:UUID>");
    expect(xml).toContain("<cbc:InvoiceTypeCode>SATIS</cbc:InvoiceTypeCode>");
  });

  it("satıcı (Vezolla) ve alıcı vergi bilgilerini doğru alanlara yerleştirir", () => {
    const xml = generateUblTrXml(sampleInvoiceData);

    // Satıcı
    expect(xml).toContain('<cac:AccountingSupplierParty>');
    expect(xml).toContain('<cbc:ID schemeID="VKN">1234567890</cbc:ID>');
    expect(xml).toContain('<cbc:Name>Vezolla Tekstil ve Mağazacılık A.Ş.</cbc:Name>');

    // Alıcı
    expect(xml).toContain('<cac:AccountingCustomerParty>');
    expect(xml).toContain('<cbc:ID schemeID="TCKN">12345678901</cbc:ID>');
    expect(xml).toContain('<cbc:Name>Ayşe Yılmaz</cbc:Name>');
    expect(xml).toContain('<cbc:CityName>İstanbul</cbc:CityName>');
  });

  it("kurumsal e-fatura için VKN ve TICARIFATURA senaryosunu uygular", () => {
    const corporateData: UblInvoiceData = {
      ...sampleInvoiceData,
      profileId: "TICARIFATURA",
      recipient: {
        isCorporate: true,
        title: "Moda Tekstil Ltd. Şti.",
        taxNumber: "9876543210",
        taxOffice: "Mecidiyeköy",
        email: "muhasebe@modatekstil.com",
        address: {
          line1: "Büyükdere Cad. No: 50",
          district: "Şişli",
          city: "İstanbul",
        },
      },
    };

    const xml = generateUblTrXml(corporateData);

    expect(xml).toContain("<cbc:ProfileID>TICARIFATURA</cbc:ProfileID>");
    expect(xml).toContain('<cbc:ID schemeID="VKN">9876543210</cbc:ID>');
    expect(xml).toContain("<cbc:Name>Moda Tekstil Ltd. Şti.</cbc:Name>");
    expect(xml).toContain("<cbc:Name>Mecidiyeköy</cbc:Name>");
  });

  it("KDV matrahı, KDV tutarı ve satır toplamlarını kuruşu kuruşuna yansıtır", () => {
    const xml = generateUblTrXml(sampleInvoiceData);

    expect(xml).toContain('<cbc:TaxAmount currencyID="TRY">200.00</cbc:TaxAmount>');
    expect(xml).toContain('<cbc:PayableAmount currencyID="TRY">1200.00</cbc:PayableAmount>');
    expect(xml).toContain('<cbc:LineExtensionAmount currencyID="TRY">1000.00</cbc:LineExtensionAmount>');
    expect(xml).toContain("<cbc:Percent>20</cbc:Percent>");
  });

  it("özel XML karakterlerini (&, <, >, vb.) güvenli şekilde escape eder", () => {
    const unsafeData: UblInvoiceData = {
      ...sampleInvoiceData,
      lines: [
        {
          index: 1,
          name: "Saten Gömlek & Pantolon <Özel Seri>",
          quantity: 1,
          unitPriceMinor: 10000,
          discountMinor: 0,
          taxRateBps: 2000,
          taxAmountMinor: 2000,
          totalMinor: 10000,
        },
      ],
    };

    const xml = generateUblTrXml(unsafeData);
    expect(xml).toContain("Saten Gömlek &amp; Pantolon &lt;Özel Seri&gt;");
    expect(xml).not.toContain("<Özel Seri>");
  });

  it("listInvoices fonksiyonu veritabanından faturaları hatasız listeler", async () => {
    const res = await listInvoices({ page: 1, pageSize: 10 });
    expect(res).toBeDefined();
    expect(Array.isArray(res.invoices)).toBe(true);
    expect(typeof res.totalCount).toBe("number");
  });
});
