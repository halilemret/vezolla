import "server-only";
import { db } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { emitDomainEvent } from "@/lib/events";
import { sendExpoPushNotification } from "@/lib/notifications";
import { sendTransactionalEmail } from "@/lib/mail";
import { extractIncludedVat, formatMoney } from "@/lib/money";
import { getPaymentSettings, getStoreSettings } from "@/lib/settings/service";
import type { Prisma } from "@/generated/prisma/client";
import { distributeDiscountAcrossLines } from "@/modules/promotions/engine";
import {
  buildCarrierTrackingUrl,
  generateCarrierBarcode,
  getCarrierLabel,
} from "@/modules/shipping/carriers";
import {
  getPaymentAdapter,
  getPaymentMethodLabel,
  normalizePaymentMethodCode,
} from "@/modules/payments/registry";
import { generateOrderContracts } from "@/modules/checkout/contracts";
import "@/modules/invoicing/auto-invoicing";
import {
  planWarehouseReservations,
  type WarehouseStockCandidate,
} from "@/modules/checkout/service";
import type { CheckoutAddress } from "@/modules/checkout/schemas";

export interface OrderFilterParams {
  q?: string;
  status?: string;
  paymentStatus?: string;
  fulfillmentStatus?: string;
  customerId?: string;
  page?: number;
  pageSize?: number;
}

export async function listOrders(params: OrderFilterParams = {}) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 25));
  const q = (params.q ?? "").trim();

  const where: Prisma.OrderWhereInput = {};

  if (params.status && params.status !== "ALL") {
    where.status = params.status as Prisma.EnumOrderStatusFilter["equals"];
  }
  if (params.paymentStatus && params.paymentStatus !== "ALL") {
    where.paymentStatus =
      params.paymentStatus as Prisma.EnumPaymentStatusFilter["equals"];
  }
  if (params.fulfillmentStatus && params.fulfillmentStatus !== "ALL") {
    where.fulfillmentStatus =
      params.fulfillmentStatus as Prisma.EnumFulfillmentStatusFilter["equals"];
  }
  if (params.customerId) {
    where.customerId = params.customerId;
  }

  if (q) {
    const num = Number.parseInt(q.replace(/^#/, ""), 10);
    where.OR = [
      ...(Number.isFinite(num) ? [{ number: num }] : []),
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
      {
        customer: {
          OR: [
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
          ],
        },
      },
    ];
  }

  const [orders, totalCount] = await Promise.all([
    db.order.findMany({
      where,
      include: {
        customer: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        items: {
          select: { id: true, title: true, quantity: true },
        },
      },
      orderBy: { placedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.order.count({ where }),
  ]);

  return {
    orders,
    totalCount,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
  };
}

export async function getOrderDetail(orderId: string) {
  return db.order.findUnique({
    where: { id: orderId },
    include: {
      customer: {
        include: { group: true },
      },
      items: {
        orderBy: { id: "asc" },
      },
      payments: {
        orderBy: { createdAt: "desc" },
      },
      refunds: {
        orderBy: { createdAt: "desc" },
      },
      fulfillments: {
        include: {
          items: {
            include: { orderItem: true },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      returns: {
        include: {
          items: {
            include: { orderItem: true },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      events: {
        orderBy: { createdAt: "desc" },
      },
      promotionUsages: {
        include: { promotion: true },
      },
      reservations: true,
      invoices: {
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

export async function markOrderPaid(params: {
  orderId: string;
  staffUserId?: string | null;
  note?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const order = await db.order.findUnique({
    where: { id: params.orderId },
    include: { payments: true },
  });

  if (!order) {
    return { ok: false, error: "Sipariş bulunamadı." };
  }
  if (order.paymentStatus === "PAID") {
    return { ok: true };
  }

  const now = new Date();
  const latestPayment = order.payments[0];

  await db.$transaction(async (tx) => {
    if (latestPayment) {
      await tx.payment.update({
        where: { id: latestPayment.id },
        data: {
          status: "CAPTURED",
          capturedAt: now,
        },
      });
    } else {
      await tx.payment.create({
        data: {
          orderId: order.id,
          provider: order.paymentMethod,
          amount: order.total,
          status: "CAPTURED",
          capturedAt: now,
        },
      });
    }

    await tx.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: "PAID",
        paidAt: now,
      },
    });

    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        type: "payment",
        message:
          params.note?.trim() ||
          `Sipariş ödemesi onaylandı (${formatMoney(order.total, order.currency)}).`,
        staffUserId: params.staffUserId ?? null,
        isInternal: false,
      },
    });
  });

  await recordAudit({
    staffUserId: params.staffUserId ?? null,
    action: "order.mark_paid",
    entityType: "Order",
    entityId: order.id,
    summary: `Sipariş #${order.number} ödendi olarak işaretlendi`,
  });

  await emitDomainEvent("order.paid", {
    orderId: order.id,
    orderNumber: order.number,
    amount: order.total,
  });

  return { ok: true };
}

export interface CreateFulfillmentInput {
  orderId: string;
  carrier: string;
  trackingNumber?: string | null;
  warehouseId?: string | null;
  items?: Array<{ orderItemId: string; quantity: number }>;
  staffUserId?: string | null;
}

export async function createFulfillment(
  input: CreateFulfillmentInput
): Promise<{ ok: boolean; error?: string; fulfillmentId?: string }> {
  const order = await db.order.findUnique({
    where: { id: input.orderId },
    include: {
      items: true,
      reservations: {
        where: { status: "ACTIVE" },
      },
    },
  });

  if (!order) {
    return { ok: false, error: "Sipariş bulunamadı." };
  }
  if (order.status === "CANCELLED") {
    return { ok: false, error: "İptal edilmiş sipariş kargolanamaz." };
  }

  // Gönderilecek kalemleri belirle (boşsa kalan tüm kalemleri gönder)
  const itemsToFulfill: Array<{ orderItemId: string; quantity: number }> = [];
  if (input.items && input.items.length > 0) {
    for (const reqItem of input.items) {
      if (reqItem.quantity <= 0) continue;
      const orderItem = order.items.find((i) => i.id === reqItem.orderItemId);
      if (!orderItem) continue;
      const remaining = Math.max(0, orderItem.quantity - orderItem.fulfilledQuantity);
      const qty = Math.min(reqItem.quantity, remaining);
      if (qty > 0) {
        itemsToFulfill.push({ orderItemId: orderItem.id, quantity: qty });
      }
    }
  } else {
    for (const orderItem of order.items) {
      const remaining = Math.max(0, orderItem.quantity - orderItem.fulfilledQuantity);
      if (remaining > 0) {
        itemsToFulfill.push({ orderItemId: orderItem.id, quantity: remaining });
      }
    }
  }

  if (itemsToFulfill.length === 0) {
    return {
      ok: false,
      error: "Bu siparişte gönderilmeyi bekleyen ürün kalmadı.",
    };
  }

  const manualTracking = input.trackingNumber?.trim() || null;
  const trackingNumber =
    manualTracking ??
    generateCarrierBarcode(
      input.carrier,
      order.number,
      (await db.fulfillment.count({ where: { orderId: order.id } })) + 1
    );
  const trackingUrl = manualTracking
    ? buildCarrierTrackingUrl(input.carrier, manualTracking)
    : null;

  const now = new Date();

  const defaultWarehouse = await db.warehouse.findFirst({
    where: { isActive: true },
    orderBy: [{ isDefault: "desc" }, { priority: "asc" }],
  });

  const result = await db.$transaction(async (tx) => {
    const fulfillment = await tx.fulfillment.create({
      data: {
        orderId: order.id,
        warehouseId: input.warehouseId ?? defaultWarehouse?.id ?? null,
        carrier: input.carrier,
        trackingNumber,
        trackingUrl,
        status: "SHIPPED",
        shippedAt: now,
        items: {
          create: itemsToFulfill.map((fi) => ({
            orderItemId: fi.orderItemId,
            quantity: fi.quantity,
          })),
        },
      },
    });

    for (const fi of itemsToFulfill) {
      const orderItem = order.items.find((i) => i.id === fi.orderItemId);
      if (!orderItem) continue;

      await tx.orderItem.update({
        where: { id: orderItem.id },
        data: {
          fulfilledQuantity: { increment: fi.quantity },
        },
      });

      // Rezervasyonları CONSUMED yap ve StockMovement SALE yaz
      if (orderItem.variantId) {
        let toConsume = fi.quantity;
        const variantReservations = order.reservations.filter(
          (r) => r.variantId === orderItem.variantId && r.status === "ACTIVE"
        );

        for (const res of variantReservations) {
          if (toConsume <= 0) break;
          const consumeQty = Math.min(toConsume, res.quantity);

          const level = await tx.inventoryLevel.findUnique({
            where: {
              variantId_warehouseId: {
                variantId: res.variantId,
                warehouseId: res.warehouseId,
              },
            },
          });

          if (level) {
            const newOnHand = Math.max(0, level.onHand - consumeQty);
            const newReserved = Math.max(0, level.reserved - consumeQty);
            await tx.inventoryLevel.update({
              where: { id: level.id },
              data: {
                onHand: newOnHand,
                reserved: newReserved,
              },
            });

            await tx.stockMovement.create({
              data: {
                variantId: res.variantId,
                warehouseId: res.warehouseId,
                type: "SALE",
                quantity: -consumeQty,
                balanceAfter: newOnHand,
                reason: `Sipariş #${order.number} kargo çıkışı`,
                referenceType: "Order",
                referenceId: order.id,
                staffUserId: input.staffUserId ?? null,
              },
            });
          }

          if (consumeQty >= res.quantity) {
            await tx.stockReservation.update({
              where: { id: res.id },
              data: { status: "CONSUMED", quantity: consumeQty },
            });
          } else {
            await tx.stockReservation.update({
              where: { id: res.id },
              data: { quantity: res.quantity - consumeQty },
            });
            await tx.stockReservation.create({
              data: {
                orderId: order.id,
                variantId: res.variantId,
                warehouseId: res.warehouseId,
                quantity: consumeQty,
                status: "CONSUMED",
              },
            });
          }

          toConsume -= consumeQty;
        }
      }
    }

    const updatedItems = await tx.orderItem.findMany({
      where: { orderId: order.id },
    });
    const allShipped = updatedItems.every((i) => i.fulfilledQuantity >= i.quantity);
    const nextFulfillmentStatus = allShipped ? "SHIPPED" : "PARTIALLY_SHIPPED";

    await tx.order.update({
      where: { id: order.id },
      data: {
        fulfillmentStatus: nextFulfillmentStatus,
      },
    });

    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        type: "fulfillment",
        message: `${getCarrierLabel(input.carrier)} ile gönderim oluşturuldu (${
          manualTracking ? "Takip No" : "Etiket No"
        }: ${trackingNumber}).`,
        staffUserId: input.staffUserId ?? null,
        isInternal: false,
      },
    });

    return { fulfillment, nextFulfillmentStatus };
  });

  await recordAudit({
    staffUserId: input.staffUserId ?? null,
    action: "order.fulfill",
    entityType: "Order",
    entityId: order.id,
    summary: `Sipariş #${order.number} kargoya verildi (${getCarrierLabel(input.carrier)})`,
  });

  const shippingAddr =
    order.shippingAddress && typeof order.shippingAddress === "object"
      ? (order.shippingAddress as Record<string, unknown>)
      : {};
  const customerName =
    `${String(shippingAddr.firstName ?? "")} ${String(shippingAddr.lastName ?? "")}`.trim() ||
    order.email;

  await sendTransactionalEmail({
    to: order.email,
    templateKey: "order_shipped",
    variables: {
      customerName,
      orderNumber: String(order.number),
      carrier: getCarrierLabel(input.carrier),
      trackingNumber: manualTracking ?? "Belirtilmedi",
    },
  }).catch(() => {});

  await emitDomainEvent("order.shipped", {
    orderId: order.id,
    orderNumber: order.number,
    fulfillmentId: result.fulfillment.id,
    carrier: input.carrier,
    trackingNumber,
  });

  return { ok: true, fulfillmentId: result.fulfillment.id };
}

export async function markFulfillmentDelivered(params: {
  fulfillmentId: string;
  staffUserId?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const fulfillment = await db.fulfillment.findUnique({
    where: { id: params.fulfillmentId },
    include: { order: true },
  });

  if (!fulfillment) {
    return { ok: false, error: "Gönderim kaydı bulunamadı." };
  }

  const now = new Date();
  await db.$transaction([
    db.fulfillment.update({
      where: { id: fulfillment.id },
      data: { status: "DELIVERED", deliveredAt: now },
    }),
    db.order.update({
      where: { id: fulfillment.orderId },
      data: {
        fulfillmentStatus: "DELIVERED",
        status:
          fulfillment.order.paymentStatus === "PAID"
            ? "COMPLETED"
            : fulfillment.order.status,
      },
    }),
    db.orderEvent.create({
      data: {
        orderId: fulfillment.orderId,
        type: "fulfillment",
        message: "Gönderi müşteriye teslim edildi olarak işaretlendi.",
        staffUserId: params.staffUserId ?? null,
        isInternal: false,
      },
    }),
  ]);

  return { ok: true };
}

export async function cancelOrder(params: {
  orderId: string;
  reason?: string | null;
  staffUserId?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const order = await db.order.findUnique({
    where: { id: params.orderId },
    include: {
      items: true,
      reservations: {
        where: { status: "ACTIVE" },
      },
    },
  });

  if (!order) {
    return { ok: false, error: "Sipariş bulunamadı." };
  }
  if (order.status === "CANCELLED") {
    return { ok: true };
  }

  const now = new Date();
  const reasonText = params.reason?.trim() || "Müşteri / Operasyon talebiyle iptal edildi";

  await db.$transaction(async (tx) => {
    for (const res of order.reservations) {
      await tx.inventoryLevel.updateMany({
        where: {
          variantId: res.variantId,
          warehouseId: res.warehouseId,
        },
        data: {
          reserved: { decrement: res.quantity },
        },
      });

      await tx.stockReservation.update({
        where: { id: res.id },
        data: { status: "RELEASED" },
      });
    }

    // Etkilenen ürünlerin totalStock alanını yenile
    const productIds = Array.from(
      new Set(order.items.map((i) => i.productId).filter((id): id is string => Boolean(id)))
    );
    for (const pid of productIds) {
      const levels = await tx.inventoryLevel.findMany({
        where: {
          variant: { productId: pid, isActive: true },
          warehouse: { isActive: true },
        },
      });
      const totalStock = levels.reduce(
        (sum, l) => sum + Math.max(0, l.onHand - l.reserved),
        0
      );
      await tx.product.update({
        where: { id: pid },
        data: { totalStock },
      });
    }

    const nextPaymentStatus =
      order.paymentStatus === "PENDING" ||
      order.paymentStatus === "AWAITING_TRANSFER" ||
      order.paymentStatus === "AWAITING_COD"
        ? "CANCELLED"
        : order.paymentStatus;

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: "CANCELLED",
        paymentStatus: nextPaymentStatus,
        cancelledAt: now,
        cancelReason: reasonText,
      },
    });

    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        type: "status_changed",
        message: `Sipariş iptal edildi: ${reasonText}. Aktif stok rezervasyonları serbest bırakıldı.`,
        staffUserId: params.staffUserId ?? null,
        isInternal: false,
      },
    });
  });

  await recordAudit({
    staffUserId: params.staffUserId ?? null,
    action: "order.cancel",
    entityType: "Order",
    entityId: order.id,
    summary: `Sipariş #${order.number} iptal edildi (${reasonText})`,
  });

  await emitDomainEvent("order.cancelled", {
    orderId: order.id,
    orderNumber: order.number,
    reason: reasonText,
  });

  return { ok: true };
}

export async function addOrderNote(params: {
  orderId: string;
  message: string;
  isInternal?: boolean;
  staffUserId?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const message = params.message.trim();
  if (!message) {
    return { ok: false, error: "Not metni boş olamaz." };
  }

  await db.orderEvent.create({
    data: {
      orderId: params.orderId,
      type: "note",
      message,
      isInternal: params.isInternal ?? true,
      staffUserId: params.staffUserId ?? null,
    },
  });

  return { ok: true };
}

export interface CreateManualOrderInput {
  customerId?: string | null;
  email: string;
  phone: string;
  shippingAddress: CheckoutAddress;
  items: Array<{ variantId: string; quantity: number }>;
  discountMinor?: number;
  shippingMinor?: number;
  paymentMethod: string;
  markAsPaid?: boolean;
  note?: string | null;
  staffUserId: string;
}

export async function createManualOrder(
  input: CreateManualOrderInput
): Promise<{ ok: boolean; error?: string; orderId?: string; orderNumber?: number }> {
  if (input.items.length === 0) {
    return { ok: false, error: "Manuel sipariş için en az 1 ürün seçmelisiniz." };
  }

  const [storeSettings, defaultTaxClass] = await Promise.all([
    getStoreSettings(),
    db.taxClass.findFirst({ where: { isDefault: true } }),
  ]);
  const defaultTaxRateBps = defaultTaxClass?.rateBps ?? 2000;

  try {
    const order = await db.$transaction(async (tx) => {
      const counterRow = await tx.counter.upsert({
        where: { key: "order_number" },
        create: { key: "order_number", value: 1001 },
        update: { value: { increment: 1 } },
      });
      const orderNumber = counterRow.value;

      const variants = await tx.productVariant.findMany({
        where: { id: { in: input.items.map((i) => i.variantId) } },
        include: {
          image: { select: { url: true } },
          inventoryLevels: {
            include: {
              warehouse: {
                select: { id: true, name: true, priority: true, isActive: true },
              },
            },
          },
          product: {
            include: {
              images: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
              taxClass: { select: { rateBps: true } },
            },
          },
        },
      });

      const lineDrafts: Array<{
        lineKey: string;
        variantId: string;
        productId: string;
        title: string;
        variantTitle: string;
        sku: string | null;
        imageUrl: string | null;
        quantity: number;
        unitPriceMinor: number;
        lineSubtotalMinor: number;
        taxRateBps: number;
        costPriceMinor: number | null;
      }> = [];

      const reservationsToCreate: Array<{
        variantId: string;
        warehouseId: string;
        levelId: string;
        quantity: number;
      }> = [];

      let subtotalMinor = 0;

      for (const reqItem of input.items) {
        if (reqItem.quantity <= 0) continue;
        const v = variants.find((x) => x.id === reqItem.variantId);
        if (!v) {
          throw new Error("Seçilen varyantlardan biri bulunamadı.");
        }

        const candidates: WarehouseStockCandidate[] = v.inventoryLevels.map((lvl) => ({
          levelId: lvl.id,
          warehouseId: lvl.warehouseId,
          warehouseName: lvl.warehouse.name,
          warehousePriority: lvl.warehouse.priority,
          warehouseActive: lvl.warehouse.isActive,
          onHand: lvl.onHand,
          reserved: lvl.reserved,
        }));

        const planned = planWarehouseReservations(candidates, reqItem.quantity, {
          variantTitle: `${v.product.title} (${v.title})`,
          trackInventory: v.trackInventory,
          allowBackorder: v.allowBackorder,
        });

        for (const alloc of planned) {
          reservationsToCreate.push({
            variantId: v.id,
            warehouseId: alloc.warehouseId,
            levelId: alloc.levelId,
            quantity: alloc.quantity,
          });
        }

        const lineSubtotalMinor = v.price * reqItem.quantity;
        subtotalMinor += lineSubtotalMinor;

        lineDrafts.push({
          lineKey: v.id,
          variantId: v.id,
          productId: v.productId,
          title: v.product.title,
          variantTitle: v.title,
          sku: v.sku,
          imageUrl: v.image?.url ?? v.product.images[0]?.url ?? null,
          quantity: reqItem.quantity,
          unitPriceMinor: v.price,
          lineSubtotalMinor,
          taxRateBps: v.product.taxClass?.rateBps ?? defaultTaxRateBps,
          costPriceMinor: v.costPrice,
        });
      }

      const requestedDiscount = Math.max(0, Math.min(subtotalMinor, input.discountMinor ?? 0));
      const lineDiscountMap = distributeDiscountAcrossLines(
        lineDrafts.map((d) => ({ lineId: d.lineKey, amountMinor: d.lineSubtotalMinor })),
        requestedDiscount
      );

      let taxTotalMinor = 0;
      const finalItems = lineDrafts.map((d) => {
        const discountAmount = lineDiscountMap[d.lineKey] ?? 0;
        const total = Math.max(0, d.lineSubtotalMinor - discountAmount);
        const taxAmount = extractIncludedVat(total, d.taxRateBps);
        taxTotalMinor += taxAmount;
        return {
          ...d,
          discountAmount,
          total,
          taxAmount,
        };
      });

      const shippingTotalMinor = Math.max(0, input.shippingMinor ?? 0);
      const totalMinor = Math.max(0, subtotalMinor - requestedDiscount + shippingTotalMinor);
      const normalizedEmail = input.email.trim().toLowerCase();

      let customerId = input.customerId ?? null;
      if (!customerId) {
        const existingCustomer = await tx.customer.findUnique({
          where: { email: normalizedEmail },
        });
        if (existingCustomer) {
          customerId = existingCustomer.id;
        } else {
          const createdCust = await tx.customer.create({
            data: {
              email: normalizedEmail,
              firstName: input.shippingAddress.firstName,
              lastName: input.shippingAddress.lastName,
              phone: input.phone,
            },
          });
          customerId = createdCust.id;
        }
      }

      const now = new Date();
      const paymentMethodCode = normalizePaymentMethodCode(input.paymentMethod);
      const paymentStatus = input.markAsPaid
        ? "PAID"
        : paymentMethodCode === "bank_transfer"
          ? "AWAITING_TRANSFER"
          : paymentMethodCode === "cod"
            ? "AWAITING_COD"
            : "PENDING";

      const contracts = generateOrderContracts({
        orderNumber,
        createdAt: now,
        store: storeSettings,
        buyerEmail: normalizedEmail,
        buyerPhone: input.phone,
        shippingAddress: input.shippingAddress,
        billingAddress: input.shippingAddress,
        shippingMethodName: "Standart Kargo",
        paymentMethodLabel: getPaymentMethodLabel(paymentMethodCode),
        lines: finalItems.map((fi) => ({
          title: fi.title,
          variantTitle: fi.variantTitle,
          sku: fi.sku,
          quantity: fi.quantity,
          unitPriceMinor: fi.unitPriceMinor,
          discountMinor: fi.discountAmount,
          taxRateBps: fi.taxRateBps,
          totalMinor: fi.total,
        })),
        subtotalMinor,
        discountTotalMinor: requestedDiscount,
        shippingTotalMinor,
        paymentFeeMinor: 0,
        taxTotalMinor,
        totalMinor,
      });

      const createdOrder = await tx.order.create({
        data: {
          number: orderNumber,
          customerId,
          email: normalizedEmail,
          phone: input.phone,
          status: "OPEN",
          paymentStatus,
          fulfillmentStatus: "UNFULFILLED",
          currency: "TRY",
          subtotal: subtotalMinor,
          discountTotal: requestedDiscount,
          shippingTotal: shippingTotalMinor,
          paymentFee: 0,
          taxTotal: taxTotalMinor,
          total: totalMinor,
          shippingAddress: input.shippingAddress as unknown as Prisma.InputJsonValue,
          billingAddress: input.shippingAddress as unknown as Prisma.InputJsonValue,
          shippingMethodName: "Standart Kargo",
          paymentMethod: paymentMethodCode,
          customerNote: input.note ?? null,
          contracts: contracts as unknown as Prisma.InputJsonValue,
          contractsAcceptedAt: now,
          source: "manual",
          placedAt: now,
          paidAt: input.markAsPaid ? now : null,
          items: {
            create: finalItems.map((fi) => ({
              variantId: fi.variantId,
              productId: fi.productId,
              title: fi.title,
              variantTitle: fi.variantTitle,
              sku: fi.sku,
              imageUrl: fi.imageUrl,
              quantity: fi.quantity,
              unitPrice: fi.unitPriceMinor,
              discountAmount: fi.discountAmount,
              taxRateBps: fi.taxRateBps,
              taxAmount: fi.taxAmount,
              total: fi.total,
              costPrice: fi.costPriceMinor,
            })),
          },
        },
      });

      for (const res of reservationsToCreate) {
        await tx.inventoryLevel.update({
          where: { id: res.levelId },
          data: { reserved: { increment: res.quantity } },
        });
        await tx.stockReservation.create({
          data: {
            orderId: createdOrder.id,
            variantId: res.variantId,
            warehouseId: res.warehouseId,
            quantity: res.quantity,
            status: "ACTIVE",
          },
        });
      }

      await tx.payment.create({
        data: {
          orderId: createdOrder.id,
          provider: "manual",
          amount: totalMinor,
          status: input.markAsPaid ? "CAPTURED" : "PENDING",
          capturedAt: input.markAsPaid ? now : null,
        },
      });

      await tx.orderEvent.create({
        data: {
          orderId: createdOrder.id,
          type: "status_changed",
          message: `Manuel sipariş #${createdOrder.number} yönetim panelinden oluşturuldu.`,
          staffUserId: input.staffUserId,
          isInternal: false,
        },
      });

      if (customerId) {
        await tx.customer.update({
          where: { id: customerId },
          data: {
            orderCount: { increment: 1 },
            totalSpent: { increment: totalMinor },
            lastOrderAt: now,
          },
        });
      }

      return createdOrder;
    });

    await recordAudit({
      staffUserId: input.staffUserId,
      action: "order.create_manual",
      entityType: "Order",
      entityId: order.id,
      summary: `Manuel sipariş #${order.number} oluşturuldu`,
    });

    return {
      ok: true,
      orderId: order.id,
      orderNumber: order.number,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Manuel sipariş oluşturulamadı.",
    };
  }
}

export interface CreateReturnRequestInput {
  orderId: string;
  reason?: string | null;
  customerNote?: string | null;
  restock?: boolean;
  items: Array<{
    orderItemId: string;
    quantity: number;
    reason?: string | null;
  }>;
}

export async function createReturnRequest(
  input: CreateReturnRequestInput
): Promise<{ ok: boolean; error?: string; returnRequestId?: string }> {
  const order = await db.order.findUnique({
    where: { id: input.orderId },
    include: { items: true },
  });

  if (!order) {
    return { ok: false, error: "Sipariş bulunamadı." };
  }

  const validItems: Array<{
    orderItemId: string;
    quantity: number;
    reason: string | null;
    refundableMinor: number;
  }> = [];

  for (const reqItem of input.items) {
    if (reqItem.quantity <= 0) continue;
    const orderItem = order.items.find((i) => i.id === reqItem.orderItemId);
    if (!orderItem) continue;

    const maxReturnable = Math.max(0, orderItem.quantity - orderItem.returnedQuantity);
    const qty = Math.min(reqItem.quantity, maxReturnable);
    if (qty <= 0) continue;

    // Satıra dağıtılmış indirim düşüldükten sonraki net satır tutarından orantılı iade hesapla
    const lineRefundMinor = Math.round((orderItem.total * qty) / orderItem.quantity);

    validItems.push({
      orderItemId: orderItem.id,
      quantity: qty,
      reason: reqItem.reason?.trim() || input.reason?.trim() || null,
      refundableMinor: lineRefundMinor,
    });
  }

  if (validItems.length === 0) {
    return {
      ok: false,
      error: "İade edilebilir miktar seçilmedi veya ürünlerin tamamı zaten iade edilmiş.",
    };
  }

  const totalRefundAmount = validItems.reduce((sum, i) => sum + i.refundableMinor, 0);

  const created = await db.$transaction(async (tx) => {
    const ret = await tx.returnRequest.create({
      data: {
        orderId: order.id,
        status: "REQUESTED",
        reason: input.reason?.trim() || null,
        customerNote: input.customerNote?.trim() || null,
        refundAmount: totalRefundAmount,
        restock: input.restock ?? true,
        items: {
          create: validItems.map((vi) => ({
            orderItemId: vi.orderItemId,
            quantity: vi.quantity,
            reason: vi.reason,
          })),
        },
      },
    });

    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        type: "return",
        message: `İade talebi (RMA) oluşturuldu. Tahmini iade tutarı: ${formatMoney(totalRefundAmount, order.currency)}.`,
        isInternal: false,
      },
    });

    await tx.adminNotification.create({
      data: {
        type: "return.requested",
        title: `Yeni İade Talebi (#${order.number})`,
        body: `Sipariş #${order.number} için ${formatMoney(totalRefundAmount, order.currency)} tutarında RMA talebi açıldı.`,
        link: `/admin/iadeler`,
      },
    });

    return ret;
  });

  sendExpoPushNotification({
    title: `Yeni İade Talebi (#${order.number})`,
    body: `Sipariş #${order.number} için ${formatMoney(totalRefundAmount, order.currency)} tutarında RMA talebi açıldı.`,
    data: {
      type: "return.requested",
      orderId: order.id,
      returnRequestId: created.id,
      orderNumber: order.number,
    },
  }).catch(() => {});

  return { ok: true, returnRequestId: created.id };
}

export async function updateReturnRequestStatus(params: {
  returnRequestId: string;
  status: "APPROVED" | "REJECTED" | "CANCELLED";
  staffNote?: string | null;
  staffUserId?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const ret = await db.returnRequest.findUnique({
    where: { id: params.returnRequestId },
    include: { order: true },
  });

  if (!ret) {
    return { ok: false, error: "İade talebi bulunamadı." };
  }

  await db.$transaction([
    db.returnRequest.update({
      where: { id: ret.id },
      data: {
        status: params.status,
        staffNote: params.staffNote?.trim() ?? ret.staffNote,
      },
    }),
    db.orderEvent.create({
      data: {
        orderId: ret.orderId,
        type: "return",
        message: `İade talebi durumu "${params.status}" olarak güncellendi.${params.staffNote ? ` Not: ${params.staffNote}` : ""}`,
        staffUserId: params.staffUserId ?? null,
        isInternal: false,
      },
    }),
  ]);

  await recordAudit({
    staffUserId: params.staffUserId ?? null,
    action: `return.${params.status.toLowerCase()}`,
    entityType: "ReturnRequest",
    entityId: ret.id,
    summary: `Sipariş #${ret.order.number} iade talebi ${params.status} yapıldı`,
  });

  return { ok: true };
}

export async function receiveReturnRequest(params: {
  returnRequestId: string;
  restock?: boolean;
  warehouseId?: string | null;
  staffNote?: string | null;
  staffUserId?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const ret = await db.returnRequest.findUnique({
    where: { id: params.returnRequestId },
    include: {
      order: { include: { items: true } },
      items: { include: { orderItem: true } },
    },
  });

  if (!ret) {
    return { ok: false, error: "İade talebi bulunamadı." };
  }
  if (ret.receivedAt) {
    return { ok: false, error: "Bu iade talebi zaten teslim alınmış." };
  }

  const shouldRestock = params.restock ?? ret.restock;
  const targetWarehouse = params.warehouseId
    ? await db.warehouse.findUnique({ where: { id: params.warehouseId } })
    : await db.warehouse.findFirst({
        where: { isActive: true },
        orderBy: [{ isDefault: "desc" }, { priority: "asc" }],
      });

  const now = new Date();

  await db.$transaction(async (tx) => {
    await tx.returnRequest.update({
      where: { id: ret.id },
      data: {
        status: "RECEIVED",
        restock: shouldRestock,
        receivedAt: now,
        staffNote: params.staffNote?.trim() ?? ret.staffNote,
      },
    });

    const affectedProductIds = new Set<string>();

    for (const ri of ret.items) {
      await tx.orderItem.update({
        where: { id: ri.orderItemId },
        data: {
          returnedQuantity: { increment: ri.quantity },
        },
      });

      if (shouldRestock && ri.orderItem.variantId && targetWarehouse) {
        if (ri.orderItem.productId) {
          affectedProductIds.add(ri.orderItem.productId);
        }

        const existingLevel = await tx.inventoryLevel.findUnique({
          where: {
            variantId_warehouseId: {
              variantId: ri.orderItem.variantId,
              warehouseId: targetWarehouse.id,
            },
          },
        });

        const newOnHand = (existingLevel?.onHand ?? 0) + ri.quantity;

        if (existingLevel) {
          await tx.inventoryLevel.update({
            where: { id: existingLevel.id },
            data: { onHand: newOnHand },
          });
        } else {
          await tx.inventoryLevel.create({
            data: {
              variantId: ri.orderItem.variantId,
              warehouseId: targetWarehouse.id,
              onHand: newOnHand,
              reserved: 0,
            },
          });
        }

        await tx.stockMovement.create({
          data: {
            variantId: ri.orderItem.variantId,
            warehouseId: targetWarehouse.id,
            type: "RETURN",
            quantity: ri.quantity,
            balanceAfter: newOnHand,
            reason: `Sipariş #${ret.order.number} müşteri iadesi stoğa alındı`,
            referenceType: "ReturnRequest",
            referenceId: ret.id,
            staffUserId: params.staffUserId ?? null,
          },
        });
      }
    }

    for (const pid of affectedProductIds) {
      const levels = await tx.inventoryLevel.findMany({
        where: {
          variant: { productId: pid, isActive: true },
          warehouse: { isActive: true },
        },
      });
      const totalStock = levels.reduce(
        (sum, l) => sum + Math.max(0, l.onHand - l.reserved),
        0
      );
      await tx.product.update({
        where: { id: pid },
        data: { totalStock },
      });
    }

    const updatedOrderItems = await tx.orderItem.findMany({
      where: { orderId: ret.orderId },
    });
    const allReturned = updatedOrderItems.every((i) => i.returnedQuantity >= i.quantity);

    await tx.order.update({
      where: { id: ret.orderId },
      data: {
        fulfillmentStatus: allReturned ? "RETURNED" : "PARTIALLY_RETURNED",
      },
    });

    await tx.orderEvent.create({
      data: {
        orderId: ret.orderId,
        type: "return",
        message: `İade kargosu teslim alındı.${shouldRestock ? " Ürünler depoya (RETURN) geri eklendi." : ""}`,
        staffUserId: params.staffUserId ?? null,
        isInternal: false,
      },
    });
  });

  await recordAudit({
    staffUserId: params.staffUserId ?? null,
    action: "return.receive",
    entityType: "ReturnRequest",
    entityId: ret.id,
    summary: `Sipariş #${ret.order.number} iadesi teslim alındı (Stok iadesi: ${shouldRestock ? "Evet" : "Hayır"})`,
  });

  return { ok: true };
}

export async function refundOrder(params: {
  orderId: string;
  amountMinor: number;
  reason?: string | null;
  returnRequestId?: string | null;
  staffUserId?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const order = await db.order.findUnique({
    where: { id: params.orderId },
    include: { payments: { orderBy: { createdAt: "desc" } } },
  });

  if (!order) {
    return { ok: false, error: "Sipariş bulunamadı." };
  }

  const maxRefundable = Math.max(0, order.total - order.refundedTotal);
  const amountMinor = Math.min(Math.round(params.amountMinor), maxRefundable);
  if (amountMinor <= 0) {
    return {
      ok: false,
      error: "İade edilecek tutar 0'dan büyük olmalı ve kalan sipariş tutarını aşmamalıdır.",
    };
  }

  const payment = order.payments[0] ?? null;
  const paymentSettings = await getPaymentSettings();
  const adapter = getPaymentAdapter(payment?.provider ?? order.paymentMethod);

  const adapterRes = await adapter.refund({
    orderId: order.id,
    paymentId: payment?.id ?? order.id,
    providerRef: payment?.providerRef ?? null,
    amountMinor,
    currency: order.currency,
    reason: params.reason ?? null,
    settings: paymentSettings,
  });

  if (!adapterRes.ok) {
    return {
      ok: false,
      error: adapterRes.errorMessage ?? "Ödeme sağlayıcısında iade işlemi başarısız oldu.",
    };
  }

  const newRefundedTotal = order.refundedTotal + amountMinor;
  const isFullRefund = newRefundedTotal >= order.total;

  await db.$transaction(async (tx) => {
    await tx.refund.create({
      data: {
        orderId: order.id,
        paymentId: payment?.id ?? null,
        returnRequestId: params.returnRequestId ?? null,
        amount: amountMinor,
        reason: params.reason?.trim() || "Müşteri iadesi",
        status: "SUCCEEDED",
        providerRef: adapterRes.providerRef ?? null,
        staffUserId: params.staffUserId ?? null,
      },
    });

    if (payment) {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: isFullRefund ? "REFUNDED" : "PARTIALLY_REFUNDED",
        },
      });
    }

    await tx.order.update({
      where: { id: order.id },
      data: {
        refundedTotal: newRefundedTotal,
        paymentStatus: isFullRefund ? "REFUNDED" : "PARTIALLY_REFUNDED",
      },
    });

    if (params.returnRequestId) {
      await tx.returnRequest.update({
        where: { id: params.returnRequestId },
        data: {
          status: "REFUNDED",
          refundAmount: amountMinor,
        },
      });
    }

    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        type: "refund",
        message: `${formatMoney(amountMinor, order.currency)} tutarında ödeme iadesi gerçekleştirildi.${params.reason ? ` Neden: ${params.reason}` : ""}`,
        staffUserId: params.staffUserId ?? null,
        isInternal: false,
      },
    });
  });

  await recordAudit({
    staffUserId: params.staffUserId ?? null,
    action: "order.refund",
    entityType: "Order",
    entityId: order.id,
    summary: `Sipariş #${order.number} için ${formatMoney(amountMinor, order.currency)} ödeme iadesi yapıldı`,
  });

  await emitDomainEvent("order.refunded", {
    orderId: order.id,
    orderNumber: order.number,
    amountMinor,
    refundedTotal: newRefundedTotal,
  });

  return { ok: true };
}

export async function listReturnRequestsAdmin(statusFilter?: string) {
  return db.returnRequest.findMany({
    where:
      statusFilter && statusFilter !== "ALL"
        ? { status: statusFilter as Prisma.EnumReturnStatusFilter["equals"] }
        : undefined,
    include: {
      order: {
        select: {
          id: true,
          number: true,
          email: true,
          total: true,
          refundedTotal: true,
          currency: true,
          paymentStatus: true,
          customer: { select: { firstName: true, lastName: true } },
        },
      },
      items: {
        include: {
          orderItem: {
            select: {
              id: true,
              title: true,
              variantTitle: true,
              sku: true,
              unitPrice: true,
              discountAmount: true,
              total: true,
              quantity: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}
