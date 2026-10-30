import "server-only";
import crypto from "crypto";
import { db } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { getInvoiceSettings } from "@/lib/settings/service";
import { sendTransactionalEmail } from "@/lib/mail";
import { formatMoney } from "@/lib/money";
import type { Prisma } from "@/generated/prisma/client";
import {
  generateUblTrXml,
  type UblInvoiceData,
  type UblInvoiceLineInput,
  type UblTaxSubtotalInput,
} from "./ubl-generator";

export interface CreateInvoiceOptions {
  force?: boolean;
  staffUserId?: string | null;
  customNote?: string;
}

export interface ListInvoicesParams {
  search?: string;
  status?: string;
  type?: string;
  page?: number;
  pageSize?: number;
}

/**
 * 16 haneli GİB standart fatura numarası üretir.
 * Format: [SERI 3 hane][YIL 4 hane][SIRA NO 9 hane] -> Örn: VEZ2026000000001
 */
export async function getNextInvoiceNumber(seriesPrefix = "VEZ"): Promise<string> {
  const cleanPrefix = (seriesPrefix || "VEZ").trim().toUpperCase().slice(0, 3).padEnd(3, "X");
  const currentYear = new Date().getFullYear().toString();
  const patternPrefix = `${cleanPrefix}${currentYear}`;

  const lastInvoice = await db.invoice.findFirst({
    where: {
      invoiceNumber: {
        startsWith: patternPrefix,
      },
    },
    orderBy: { invoiceNumber: "desc" },
    select: { invoiceNumber: true },
  });

  let nextSequence = 1;
  if (lastInvoice?.invoiceNumber && lastInvoice.invoiceNumber.length === 16) {
    const seqStr = lastInvoice.invoiceNumber.slice(7);
    const parsed = parseInt(seqStr, 10);
    if (!Number.isNaN(parsed)) {
      nextSequence = parsed + 1;
    }
  }

  const sequenceStr = nextSequence.toString().padStart(9, "0");
  return `${patternPrefix}${sequenceStr}`;
}

/**
 * Sipariş için e-Fatura / e-Arşiv Fatura düzenler ve veritabanına kaydeder.
 */
export async function createInvoiceForOrder(
  orderId: string,
  options?: CreateInvoiceOptions
): Promise<{ ok: boolean; invoiceId?: string; invoiceNumber?: string; error?: string }> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      customer: true,
      items: true,
      invoices: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!order) {
    return { ok: false, error: "Fatura kesilecek sipariş bulunamadı." };
  }

  // Zaten aktif kesilmiş faturası var mı
  const existingActive = order.invoices.find(
    (inv) => inv.status === "ISSUED" || inv.status === "QUEUED"
  );
  if (existingActive && !options?.force) {
    return {
      ok: true,
      invoiceId: existingActive.id,
      invoiceNumber: existingActive.invoiceNumber,
    };
  }

  const settings = await getInvoiceSettings();
  if (!settings.enabled && !options?.force) {
    return { ok: false, error: "e-Fatura modülü ayarlarda devre dışı bırakılmış." };
  }

  const billingAddr =
    order.billingAddress && typeof order.billingAddress === "object"
      ? (order.billingAddress as Record<string, unknown>)
      : {};

  const isCorporate = billingAddr.invoiceType === "CORPORATE";
  const recipientTitle = isCorporate
    ? String(billingAddr.companyName || `${billingAddr.firstName} ${billingAddr.lastName}`).trim()
    : `${billingAddr.firstName || ""} ${billingAddr.lastName || ""}`.trim() || order.email;

  const recipientTaxNumber = isCorporate
    ? String(billingAddr.taxNumber || "1111111111").trim()
    : String(billingAddr.tckn || "11111111111").trim();

  const recipientTaxOffice = isCorporate ? String(billingAddr.taxOffice || "").trim() || null : null;

  const recipientAddress = {
    line1: String(billingAddr.line1 || ""),
    district: String(billingAddr.district || ""),
    city: String(billingAddr.city || "İstanbul"),
    postalCode: billingAddr.postalCode ? String(billingAddr.postalCode) : null,
    country: "Türkiye",
  };

  const invoiceType = isCorporate ? "EFATURA" : "EARSIV";
  const profile = isCorporate ? "TICARI_FATURA" : "EARSIV_FATURA";

  // Benzersiz ETTN (UUID v4) ve Fatura Numarası (VEZ2026000000001)
  const ettn = crypto.randomUUID();
  const invoiceNumber = await getNextInvoiceNumber(settings.seriesPrefix);
  const now = new Date();

  // KDV Oran Kırılımlarını Hesapla
  const taxGroupMap = new Map<number, { taxableAmountMinor: number; taxAmountMinor: number }>();

  const ublLines: UblInvoiceLineInput[] = order.items.map((it, idx) => {
    const lineNetTotal = Math.max(0, it.quantity * it.unitPrice - it.discountAmount);
    const existingGroup = taxGroupMap.get(it.taxRateBps) ?? {
      taxableAmountMinor: 0,
      taxAmountMinor: 0,
    };
    existingGroup.taxableAmountMinor += lineNetTotal - it.taxAmount;
    existingGroup.taxAmountMinor += it.taxAmount;
    taxGroupMap.set(it.taxRateBps, existingGroup);

    return {
      index: idx + 1,
      name: it.variantTitle ? `${it.title} (${it.variantTitle})` : it.title,
      sku: it.sku,
      quantity: it.quantity,
      unitPriceMinor: it.unitPrice,
      discountMinor: it.discountAmount,
      taxRateBps: it.taxRateBps,
      taxAmountMinor: it.taxAmount,
      totalMinor: lineNetTotal,
    };
  });

  // Kargo bedeli satırı varsa KDV kırılımına ekle (Standart %20)
  if (order.shippingTotal > 0) {
    const shippingTaxRateBps = 2000;
    const shippingTax = Math.round((order.shippingTotal * 2000) / 12000);
    const shippingBase = order.shippingTotal - shippingTax;
    const existingGroup = taxGroupMap.get(shippingTaxRateBps) ?? {
      taxableAmountMinor: 0,
      taxAmountMinor: 0,
    };
    existingGroup.taxableAmountMinor += shippingBase;
    existingGroup.taxAmountMinor += shippingTax;
    taxGroupMap.set(shippingTaxRateBps, existingGroup);

    ublLines.push({
      index: ublLines.length + 1,
      name: `Kargo Gönderim Hizmeti (${order.shippingMethodName || "Standart"})`,
      quantity: 1,
      unitPriceMinor: order.shippingTotal,
      discountMinor: 0,
      taxRateBps: shippingTaxRateBps,
      taxAmountMinor: shippingTax,
      totalMinor: order.shippingTotal,
    });
  }

  // Kapıda ödeme hizmet bedeli varsa ekle
  if (order.paymentFee > 0) {
    const feeTaxRateBps = 2000;
    const feeTax = Math.round((order.paymentFee * 2000) / 12000);
    const feeBase = order.paymentFee - feeTax;
    const existingGroup = taxGroupMap.get(feeTaxRateBps) ?? {
      taxableAmountMinor: 0,
      taxAmountMinor: 0,
    };
    existingGroup.taxableAmountMinor += feeBase;
    existingGroup.taxAmountMinor += feeTax;
    taxGroupMap.set(feeTaxRateBps, existingGroup);

    ublLines.push({
      index: ublLines.length + 1,
      name: "Kapıda Ödeme Tahsilat Hizmet Bedeli",
      quantity: 1,
      unitPriceMinor: order.paymentFee,
      discountMinor: 0,
      taxRateBps: feeTaxRateBps,
      taxAmountMinor: feeTax,
      totalMinor: order.paymentFee,
    });
  }

  const taxSubtotals: UblTaxSubtotalInput[] = Array.from(taxGroupMap.entries()).map(
    ([rateBps, group]) => ({
      rateBps,
      taxableAmountMinor: group.taxableAmountMinor,
      taxAmountMinor: group.taxAmountMinor,
    })
  );

  const ublData: UblInvoiceData = {
    invoiceNumber,
    ettn,
    issueDate: now,
    profileId: isCorporate ? "TICARIFATURA" : "EARSIVFATURA",
    invoiceTypeCode: "SATIS",
    currency: order.currency || "TRY",
    notes: [
      settings.defaultNotes,
      options?.customNote ?? "",
      order.customerNote ? `Müşteri Notu: ${order.customerNote}` : "",
    ].filter(Boolean),
    orderNumber: order.number,
    paymentMethod: order.paymentMethod,
    settings,
    recipient: {
      isCorporate,
      title: recipientTitle,
      taxNumber: recipientTaxNumber,
      taxOffice: recipientTaxOffice,
      email: order.email,
      phone: order.phone,
      address: recipientAddress,
    },
    taxSubtotals,
    lines: ublLines,
    subtotalMinor: order.subtotal,
    taxTotalMinor: order.taxTotal,
    discountTotalMinor: order.discountTotal,
    shippingTotalMinor: order.shippingTotal,
    paymentFeeMinor: order.paymentFee,
    totalMinor: order.total,
  };

  const ublXml = generateUblTrXml(ublData);

  const invoice = await db.invoice.create({
    data: {
      orderId: order.id,
      invoiceNumber,
      ettn,
      invoiceType,
      profile,
      status: "ISSUED",
      issueDate: now,
      currency: order.currency || "TRY",
      subtotal: order.subtotal,
      taxTotal: order.taxTotal,
      discountTotal: order.discountTotal,
      total: order.total,
      taxBreakdown: taxSubtotals as unknown as Prisma.InputJsonValue,
      recipientType: isCorporate ? "CORPORATE" : "INDIVIDUAL",
      recipientTitle,
      recipientTaxNumber,
      recipientTaxOffice,
      recipientEmail: order.email,
      recipientPhone: order.phone,
      recipientAddress: recipientAddress as unknown as Prisma.InputJsonValue,
      provider: settings.provider,
      providerRef: `GIB-${ettn.slice(0, 8).toUpperCase()}`,
      ublXml,
      pdfUrl: `/admin/faturalar/${invoiceNumber}/yazdir`,
    },
  });

  // Sipariş geçmişine olay ekle
  await db.orderEvent.create({
    data: {
      orderId: order.id,
      type: "invoice",
      message: `${invoiceType === "EFATURA" ? "e-Fatura" : "e-Arşiv Fatura"} düzenlendi: ${invoiceNumber} (ETTN: ${ettn})`,
      isInternal: false,
      staffUserId: options?.staffUserId ?? null,
      data: {
        invoiceId: invoice.id,
        invoiceNumber,
        ettn,
        total: order.total,
      },
    },
  });

  // Müşteriye bildirim e-postası (ayarlarda açıksa)
  if (settings.autoSendEmailToCustomer && order.email) {
    try {
      await sendTransactionalEmail({
        to: order.email,
        templateKey: "order_confirmation",
        variables: {
          customerName: recipientTitle,
          orderNumber: String(order.number),
          orderTotal: formatMoney(order.total, order.currency),
          customMessage: `Siparişinize ait ${invoiceNumber} numaralı e-Faturanız elektronik ortamda düzenlenmiştir.`,
        },
      });

      await db.invoice.update({
        where: { id: invoice.id },
        data: { sentToCustomerAt: new Date() },
      });
    } catch (mailErr) {
      console.error("Fatura e-postası gönderilemedi:", mailErr);
    }
  }

  if (options?.staffUserId) {
    await recordAudit({
      staffUserId: options.staffUserId,
      action: "invoice.create",
      entityType: "Invoice",
      entityId: invoice.id,
      summary: `Sipariş #${order.number} için ${invoiceNumber} numaralı fatura kesildi`,
    });
  }

  return {
    ok: true,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
  };
}

/**
 * Faturayı iptal eder.
 */
export async function cancelInvoice(
  invoiceId: string,
  reason: string,
  staffUserId?: string | null
): Promise<{ ok: boolean; error?: string }> {
  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: { order: true },
  });

  if (!invoice) {
    return { ok: false, error: "İptal edilecek fatura bulunamadı." };
  }

  if (invoice.status === "CANCELLED") {
    return { ok: false, error: "Bu fatura zaten iptal edilmiş." };
  }

  const now = new Date();
  await db.invoice.update({
    where: { id: invoiceId },
    data: {
      status: "CANCELLED",
      cancelledAt: now,
      cancelReason: reason,
    },
  });

  await db.orderEvent.create({
    data: {
      orderId: invoice.orderId,
      type: "invoice",
      message: `${invoice.invoiceNumber} numaralı fatura iptal edildi. Gerekçe: ${reason}`,
      isInternal: false,
      staffUserId: staffUserId ?? null,
    },
  });

  if (staffUserId) {
    await recordAudit({
      staffUserId,
      action: "invoice.cancel",
      entityType: "Invoice",
      entityId: invoice.id,
      summary: `${invoice.invoiceNumber} faturası iptal edildi (${reason})`,
    });
  }

  return { ok: true };
}

/**
 * Fatura detayını getirir.
 */
export async function getInvoiceDetail(idOrNumber: string) {
  return db.invoice.findFirst({
    where: {
      OR: [{ id: idOrNumber }, { invoiceNumber: idOrNumber }, { ettn: idOrNumber }],
    },
    include: {
      order: {
        include: {
          items: true,
          customer: true,
        },
      },
    },
  });
}

/**
 * Siparişe ait en son faturayı getirir.
 */
export async function getInvoiceByOrderId(orderId: string) {
  return db.invoice.findFirst({
    where: { orderId },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Faturaları listeler.
 */
export async function listInvoices(params: ListInvoicesParams = {}) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 25));
  const skip = (page - 1) * pageSize;

  const where: Prisma.InvoiceWhereInput = {};

  if (params.status && params.status !== "ALL") {
    where.status = params.status as Prisma.InvoiceWhereInput["status"];
  }

  if (params.type && params.type !== "ALL") {
    where.invoiceType = params.type as Prisma.InvoiceWhereInput["invoiceType"];
  }

  if (params.search?.trim()) {
    const q = params.search.trim();
    where.OR = [
      { invoiceNumber: { contains: q, mode: "insensitive" } },
      { recipientTitle: { contains: q, mode: "insensitive" } },
      { recipientTaxNumber: { contains: q, mode: "insensitive" } },
      { recipientEmail: { contains: q, mode: "insensitive" } },
      { ettn: { contains: q, mode: "insensitive" } },
    ];
  }

  const [invoices, totalCount] = await Promise.all([
    db.invoice.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: {
        order: {
          select: {
            id: true,
            number: true,
            paymentStatus: true,
            fulfillmentStatus: true,
          },
        },
      },
    }),
    db.invoice.count({ where }),
  ]);

  return {
    invoices,
    totalCount,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
  };
}
