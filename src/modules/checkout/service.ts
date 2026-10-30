import "server-only";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import {
  CART_COOKIE,
  VISITOR_COOKIE,
  getCurrentCustomer,
  getRequestMeta,
} from "@/lib/auth/session";
import { emitDomainEvent } from "@/lib/events";
import { sendExpoPushNotification } from "@/lib/notifications";
import { sendTransactionalEmail } from "@/lib/mail";
import { formatMoney } from "@/lib/money";
import { getPaymentSettings, getStoreSettings } from "@/lib/settings/service";
import type { Prisma } from "@/generated/prisma/client";
import { computeCartSummary } from "@/modules/checkout/cart";
import { generateOrderContracts } from "@/modules/checkout/contracts";
import {
  placeOrderInputSchema,
  type CheckoutAddress,
  type PlaceOrderInput,
} from "@/modules/checkout/schemas";
import {
  getPaymentAdapter,
  getPaymentMethodLabel,
  normalizePaymentMethodCode,
} from "@/modules/payments/registry";

export interface WarehouseStockCandidate {
  levelId: string;
  warehouseId: string;
  warehouseName: string;
  warehousePriority: number;
  warehouseActive: boolean;
  onHand: number;
  reserved: number;
}

export interface PlannedStockAllocation {
  levelId: string;
  warehouseId: string;
  quantity: number;
}

/**
 * Depoların öncelik sırasına (düşük priority önce) göre talep edilen miktarı
 * mevcut kullanılabilir stoktan (onHand - reserved) tahsis eder.
 * Stok yetersizse hata fırlatır (aşırı satışı önler).
 */
export function planWarehouseReservations(
  levels: ReadonlyArray<WarehouseStockCandidate>,
  requiredQuantity: number,
  options?: {
    variantTitle?: string;
    trackInventory?: boolean;
    allowBackorder?: boolean;
  }
): PlannedStockAllocation[] {
  const trackInventory = options?.trackInventory ?? true;
  const allowBackorder = options?.allowBackorder ?? false;

  if (!trackInventory || requiredQuantity <= 0) {
    return [];
  }

  const activeLevels = levels
    .filter((l) => l.warehouseActive)
    .slice()
    .sort((a, b) => a.warehousePriority - b.warehousePriority);

  const totalAvailable = activeLevels.reduce(
    (sum, l) => sum + Math.max(0, l.onHand - l.reserved),
    0
  );

  if (!allowBackorder && totalAvailable < requiredQuantity) {
    const label = options?.variantTitle ? `"${options.variantTitle}"` : "Ürün";
    throw new Error(
      `${label} için yeterli stok bulunmuyor. Talep edilen: ${requiredQuantity}, Mevcut: ${totalAvailable}.`
    );
  }

  const allocations: PlannedStockAllocation[] = [];
  let remaining = requiredQuantity;

  for (const level of activeLevels) {
    if (remaining <= 0) break;
    const available = Math.max(0, level.onHand - level.reserved);
    if (available <= 0) continue;
    const take = Math.min(remaining, available);
    allocations.push({
      levelId: level.levelId,
      warehouseId: level.warehouseId,
      quantity: take,
    });
    remaining -= take;
  }

  if (remaining > 0 && allowBackorder && activeLevels[0]) {
    const first = activeLevels[0];
    const existing = allocations.find((a) => a.levelId === first.levelId);
    if (existing) {
      existing.quantity += remaining;
    } else {
      allocations.push({
        levelId: first.levelId,
        warehouseId: first.warehouseId,
        quantity: remaining,
      });
    }
  }

  return allocations;
}

export interface PlaceOrderResult {
  ok: boolean;
  error?: string;
  orderId?: string;
  orderNumber?: number;
  paymentStatus?: string;
  checkoutFormContent?: string;
  paymentPageUrl?: string;
  bankInstructions?: string;
}

/**
 * Müşteri önizlemesi için sepetin güncel durumuna göre Ön Bilgilendirme Formu
 * ve Mesafeli Satış Sözleşmesi metinlerini üretir.
 */
export async function buildCartContractPreview(params: {
  email?: string;
  phone?: string;
  shippingAddress?: Partial<CheckoutAddress>;
  billingAddress?: Partial<CheckoutAddress>;
  shippingMethodId?: string;
  paymentMethod?: string;
}) {
  const [store, summary] = await Promise.all([
    getStoreSettings(),
    computeCartSummary({
      shippingMethodId: params.shippingMethodId,
      paymentMethod: params.paymentMethod,
      shippingCity: params.shippingAddress?.city ?? null,
    }),
  ]);

  const fallbackAddr: CheckoutAddress = {
    title: "Teslimat Adresi",
    firstName: params.shippingAddress?.firstName || "Alıcı",
    lastName: params.shippingAddress?.lastName || "",
    phone: params.phone || params.shippingAddress?.phone || summary.phone || "-",
    city: params.shippingAddress?.city || summary.shippingAddress?.city || "İstanbul",
    district: params.shippingAddress?.district || summary.shippingAddress?.district || "Merkez",
    neighborhood: params.shippingAddress?.neighborhood || null,
    line1: params.shippingAddress?.line1 || summary.shippingAddress?.line1 || "-",
    postalCode: params.shippingAddress?.postalCode || null,
    invoiceType: params.shippingAddress?.invoiceType || "INDIVIDUAL",
    tckn: params.shippingAddress?.tckn || null,
    companyName: params.shippingAddress?.companyName || null,
    taxOffice: params.shippingAddress?.taxOffice || null,
    taxNumber: params.shippingAddress?.taxNumber || null,
  };

  const billingAddr: CheckoutAddress = params.billingAddress?.line1
    ? {
        ...fallbackAddr,
        ...params.billingAddress,
        firstName: params.billingAddress.firstName || fallbackAddr.firstName,
        lastName: params.billingAddress.lastName || fallbackAddr.lastName,
        phone: params.billingAddress.phone || fallbackAddr.phone,
        city: params.billingAddress.city || fallbackAddr.city,
        district: params.billingAddress.district || fallbackAddr.district,
        line1: params.billingAddress.line1 || fallbackAddr.line1,
        invoiceType: params.billingAddress.invoiceType || fallbackAddr.invoiceType,
      }
    : fallbackAddr;

  return generateOrderContracts({
    store,
    buyerEmail: params.email || summary.email || "-",
    buyerPhone: params.phone || summary.phone || fallbackAddr.phone,
    shippingAddress: fallbackAddr,
    billingAddress: billingAddr,
    shippingMethodName: summary.selectedShippingMethod?.name ?? "Standart Kargo",
    paymentMethodLabel: getPaymentMethodLabel(summary.selectedPaymentMethod),
    lines: summary.lines.map((l) => ({
      title: l.title,
      variantTitle: l.variantTitle,
      sku: l.sku,
      quantity: l.quantity,
      unitPriceMinor: l.unitPriceMinor,
      discountMinor: l.discountMinor,
      taxRateBps: l.taxRateBps,
      totalMinor: l.lineTotalMinor,
    })),
    subtotalMinor: summary.subtotalMinor,
    discountTotalMinor: summary.discountTotalMinor,
    shippingTotalMinor: summary.shippingTotalMinor,
    paymentFeeMinor: summary.paymentFeeMinor,
    taxTotalMinor: summary.taxTotalMinor,
    totalMinor: summary.totalMinor,
    currency: summary.currency,
  });
}

export async function placeOrder(rawInput: PlaceOrderInput): Promise<PlaceOrderResult> {
  const parsed = placeOrderInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Lütfen sipariş bilgilerini kontrol ediniz.",
    };
  }

  const input = parsed.data;
  const shippingAddress = input.shippingAddress;
  const billingAddress =
    input.billingSameAsShipping || !input.billingAddress
      ? input.shippingAddress
      : input.billingAddress;

  const paymentMethodCode = normalizePaymentMethodCode(input.paymentMethod);

  const [storeSettings, paymentSettings, currentCustomer, reqMeta, cookieStore] =
    await Promise.all([
      getStoreSettings(),
      getPaymentSettings(),
      getCurrentCustomer(),
      getRequestMeta(),
      cookies(),
    ]);

  const visitorId = cookieStore.get(VISITOR_COOKIE)?.value ?? null;
  const summary = await computeCartSummary({
    cartId: input.cartId,
    shippingMethodId: input.shippingMethodId,
    paymentMethod: paymentMethodCode,
    shippingCity: shippingAddress.city,
  });

  if (!summary.cartId || summary.lines.length === 0) {
    return {
      ok: false,
      error: "Sepetiniz boş olduğu için sipariş oluşturulamadı.",
    };
  }

  // Seçilen ödeme yönteminin uygunluğunu sunucu tarafında doğrula
  const adapter = getPaymentAdapter(paymentMethodCode);
  const availability = adapter.isAvailable(
    paymentSettings,
    summary.subtotalAfterDiscountMinor
  );
  if (!availability.available) {
    return {
      ok: false,
      error: availability.reason ?? "Seçilen ödeme yöntemi bu sipariş için kullanılamıyor.",
    };
  }

  if (!summary.selectedShippingMethod) {
    return {
      ok: false,
      error: "Teslimat adresiniz için uygun bir kargo yöntemi bulunamadı.",
    };
  }

  const shippingMethodQuote = summary.selectedShippingMethod;

  try {
    const txResult = await db.$transaction(async (tx) => {
      // 1) Sipariş numarası üret
      const counterRow = await tx.counter.upsert({
        where: { key: "order_number" },
        create: { key: "order_number", value: 1001 },
        update: { value: { increment: 1 } },
      });
      const orderNumber = counterRow.value;

      // 2) Stok seviyelerini kilitleyip depo öncelik sırasına göre kontrol et
      const allReservationsToCreate: Array<{
        variantId: string;
        warehouseId: string;
        levelId: string;
        quantity: number;
      }> = [];
      const affectedProductIds = new Set<string>();

      for (const line of summary.lines) {
        affectedProductIds.add(line.productId);
        const variant = await tx.productVariant.findUnique({
          where: { id: line.variantId },
          include: {
            product: { select: { title: true, status: true, deletedAt: true } },
            inventoryLevels: {
              include: {
                warehouse: {
                  select: { id: true, name: true, priority: true, isActive: true },
                },
              },
            },
          },
        });

        if (
          !variant ||
          !variant.isActive ||
          variant.product.deletedAt !== null ||
          variant.product.status !== "ACTIVE"
        ) {
          throw new Error(`"${line.title}" ürünü artık satışta değil.`);
        }

        const candidates: WarehouseStockCandidate[] = variant.inventoryLevels.map((lvl) => ({
          levelId: lvl.id,
          warehouseId: lvl.warehouseId,
          warehouseName: lvl.warehouse.name,
          warehousePriority: lvl.warehouse.priority,
          warehouseActive: lvl.warehouse.isActive,
          onHand: lvl.onHand,
          reserved: lvl.reserved,
        }));

        const planned = planWarehouseReservations(candidates, line.quantity, {
          variantTitle: `${line.title} (${line.variantTitle})`,
          trackInventory: variant.trackInventory,
          allowBackorder: variant.allowBackorder,
        });

        for (const alloc of planned) {
          allReservationsToCreate.push({
            variantId: line.variantId,
            warehouseId: alloc.warehouseId,
            levelId: alloc.levelId,
            quantity: alloc.quantity,
          });
        }
      }

      // 3) Müşteri kaydını bul veya misafir müşteri olarak oluştur
      const normalizedEmail = input.email.trim().toLowerCase();
      let customerId = currentCustomer?.id ?? null;

      if (!customerId) {
        const existingCustomer = await tx.customer.findUnique({
          where: { email: normalizedEmail },
        });
        if (existingCustomer) {
          customerId = existingCustomer.id;
        } else {
          const createdCustomer = await tx.customer.create({
            data: {
              email: normalizedEmail,
              firstName: shippingAddress.firstName,
              lastName: shippingAddress.lastName,
              phone: input.phone,
              kvkkConsentAt: new Date(),
            },
          });
          customerId = createdCustomer.id;
        }
      }

      // Ziyaretçi attribution verisini oku
      let attribution: Prisma.InputJsonValue | undefined;
      if (visitorId) {
        const visitor = await tx.visitor.findUnique({
          where: { id: visitorId },
          select: { lastTouch: true, firstTouch: true },
        });
        const touch = visitor?.lastTouch ?? visitor?.firstTouch;
        if (touch && typeof touch === "object") {
          attribution = touch as Prisma.InputJsonValue;
        }
      }

      // 4) Sözleşme metinlerini sipariş anındaki verilerle oluştur
      const now = new Date();
      const contracts = generateOrderContracts({
        orderNumber,
        createdAt: now,
        store: storeSettings,
        buyerEmail: normalizedEmail,
        buyerPhone: input.phone,
        shippingAddress,
        billingAddress,
        shippingMethodName: shippingMethodQuote.name,
        paymentMethodLabel: getPaymentMethodLabel(paymentMethodCode),
        lines: summary.lines.map((l) => ({
          title: l.title,
          variantTitle: l.variantTitle,
          sku: l.sku,
          quantity: l.quantity,
          unitPriceMinor: l.unitPriceMinor,
          discountMinor: l.discountMinor,
          taxRateBps: l.taxRateBps,
          totalMinor: l.lineTotalMinor,
        })),
        subtotalMinor: summary.subtotalMinor,
        discountTotalMinor: summary.discountTotalMinor,
        shippingTotalMinor: summary.shippingTotalMinor,
        paymentFeeMinor: summary.paymentFeeMinor,
        taxTotalMinor: summary.taxTotalMinor,
        totalMinor: summary.totalMinor,
        currency: summary.currency,
      });

      // 5) Sipariş ve satırlarını oluştur
      const order = await tx.order.create({
        data: {
          number: orderNumber,
          customerId,
          email: normalizedEmail,
          phone: input.phone,
          status: "OPEN",
          paymentStatus: "PENDING",
          fulfillmentStatus: "UNFULFILLED",
          currency: summary.currency,
          subtotal: summary.subtotalMinor,
          discountTotal: summary.discountTotalMinor,
          shippingTotal: summary.shippingTotalMinor,
          paymentFee: summary.paymentFeeMinor,
          taxTotal: summary.taxTotalMinor,
          total: summary.totalMinor,
          shippingAddress: shippingAddress as unknown as Prisma.InputJsonValue,
          billingAddress: billingAddress as unknown as Prisma.InputJsonValue,
          shippingMethodId:
            shippingMethodQuote.id === "default-standard" ? null : shippingMethodQuote.id,
          shippingMethodName: shippingMethodQuote.name,
          paymentMethod: paymentMethodCode,
          promoCodes: summary.appliedPromotions
            .map((p) => p.code)
            .filter((c): c is string => Boolean(c)),
          customerNote: input.customerNote ?? null,
          contracts: contracts as unknown as Prisma.InputJsonValue,
          contractsAcceptedAt: now,
          visitorId,
          attribution,
          source: "web",
          ip: reqMeta.ip,
          userAgent: reqMeta.userAgent,
          placedAt: now,
          items: {
            create: summary.lines.map((l) => ({
              variantId: l.variantId,
              productId: l.productId,
              title: l.title,
              variantTitle: l.variantTitle,
              sku: l.sku,
              imageUrl: l.imageUrl,
              quantity: l.quantity,
              unitPrice: l.unitPriceMinor,
              discountAmount: l.discountMinor,
              taxRateBps: l.taxRateBps,
              taxAmount: l.taxAmountMinor,
              total: l.lineTotalMinor,
              costPrice: l.costPriceMinor,
            })),
          },
        },
      });

      // 6) Stok rezervasyonlarını oluştur ve InventoryLevel.reserved değerlerini artır
      for (const res of allReservationsToCreate) {
        await tx.inventoryLevel.update({
          where: { id: res.levelId },
          data: {
            reserved: { increment: res.quantity },
          },
        });

        await tx.stockReservation.create({
          data: {
            orderId: order.id,
            variantId: res.variantId,
            warehouseId: res.warehouseId,
            quantity: res.quantity,
            status: "ACTIVE",
          },
        });
      }

      // Ürünlerin türetilmiş totalStock ve salesCount alanlarını güncelle
      for (const line of summary.lines) {
        const levels = await tx.inventoryLevel.findMany({
          where: {
            variant: { productId: line.productId, isActive: true },
            warehouse: { isActive: true },
          },
        });
        const newTotalStock = levels.reduce(
          (sum, l) => sum + Math.max(0, l.onHand - l.reserved),
          0
        );
        await tx.product.update({
          where: { id: line.productId },
          data: {
            totalStock: newTotalStock,
            salesCount: { increment: line.quantity },
          },
        });
      }

      // 7) Promosyon kullanımlarını kaydet
      for (const applied of summary.appliedPromotions) {
        await tx.promotionUsage.create({
          data: {
            promotionId: applied.promotionId,
            orderId: order.id,
            customerId,
            email: normalizedEmail,
            code: applied.code,
            discountAmount: applied.discountMinor,
          },
        });

        await tx.promotion.update({
          where: { id: applied.promotionId },
          data: {
            usageCount: { increment: 1 },
          },
        });
      }

      // 8) Müşteri istatistiklerini güncelle
      if (customerId) {
        await tx.customer.update({
          where: { id: customerId },
          data: {
            orderCount: { increment: 1 },
            totalSpent: { increment: order.total },
            lastOrderAt: now,
          },
        });
      }

      // 9) Sepeti tamamlandı olarak işaretle
      await tx.cart.update({
        where: { id: summary.cartId },
        data: {
          completedAt: now,
          orderId: order.id,
          email: normalizedEmail,
          phone: input.phone,
          shippingAddress: shippingAddress as unknown as Prisma.InputJsonValue,
          billingAddress: billingAddress as unknown as Prisma.InputJsonValue,
          shippingMethodId: shippingMethodQuote.id,
          paymentMethod: paymentMethodCode,
          note: input.customerNote ?? null,
        },
      });

      // 10) Sipariş zaman çizelgesi olayı ve yönetici bildirimi ekle
      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          type: "status_changed",
          message: `Sipariş #${order.number} oluşturuldu (${getPaymentMethodLabel(paymentMethodCode)}).`,
          isInternal: false,
        },
      });

      await tx.adminNotification.create({
        data: {
          type: "order.placed",
          title: `Yeni Sipariş #${order.number}`,
          body: `${shippingAddress.firstName} ${shippingAddress.lastName} - ${formatMoney(order.total, order.currency)}`,
          link: `/admin/siparisler/${order.id}`,
        },
      });

      return {
        order,
        customerId,
        normalizedEmail,
      };
    });

    // Ödeme adaptörünü başlat ve Payment kaydını oluştur
    const appBaseUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(
      /\/+$/,
      ""
    );
    const paymentInit = await adapter.initiate({
      orderId: txResult.order.id,
      orderNumber: txResult.order.number,
      amountMinor: txResult.order.total,
      currency: txResult.order.currency,
      buyer: {
        id: txResult.customerId,
        firstName: shippingAddress.firstName,
        lastName: shippingAddress.lastName,
        email: txResult.normalizedEmail,
        phone: input.phone,
        tckn: billingAddress.tckn,
        ip: reqMeta.ip,
        city: shippingAddress.city,
        district: shippingAddress.district,
        addressLine: shippingAddress.line1,
        postalCode: shippingAddress.postalCode,
      },
      shippingAddress: {
        contactName: `${shippingAddress.firstName} ${shippingAddress.lastName}`,
        city: shippingAddress.city,
        district: shippingAddress.district,
        addressLine: shippingAddress.line1,
        postalCode: shippingAddress.postalCode,
      },
      billingAddress: {
        contactName:
          billingAddress.invoiceType === "CORPORATE" && billingAddress.companyName
            ? billingAddress.companyName
            : `${billingAddress.firstName} ${billingAddress.lastName}`,
        city: billingAddress.city,
        district: billingAddress.district,
        addressLine: billingAddress.line1,
        postalCode: billingAddress.postalCode,
      },
      basketItems: summary.lines.map((l) => ({
        id: l.variantId,
        name: `${l.title} - ${l.variantTitle}`,
        categoryName: l.categoryName,
        priceMinor: Math.max(1, l.lineTotalMinor),
      })),
      callbackUrl: `${appBaseUrl}/api/payments/iyzico/callback`,
      settings: paymentSettings,
    });

    const now = new Date();
    await db.$transaction([
      db.payment.create({
        data: {
          orderId: txResult.order.id,
          provider: paymentMethodCode,
          amount: txResult.order.total,
          status: paymentInit.paymentState,
          providerRef: paymentInit.providerRef ?? null,
          providerData: (paymentInit.providerData ?? {}) as Prisma.InputJsonValue,
          errorMessage: paymentInit.errorMessage ?? null,
          capturedAt: paymentInit.paymentState === "CAPTURED" ? now : null,
        },
      }),
      db.order.update({
        where: { id: txResult.order.id },
        data: {
          paymentStatus: paymentInit.orderPaymentStatus,
          paidAt: paymentInit.orderPaymentStatus === "PAID" ? now : null,
        },
      }),
      db.orderEvent.create({
        data: {
          orderId: txResult.order.id,
          type: "payment",
          message: paymentInit.ok
            ? `Ödeme kaydı açıldı: ${getPaymentMethodLabel(paymentMethodCode)} (${paymentInit.orderPaymentStatus})`
            : `Ödeme başlatma hatası: ${paymentInit.errorMessage ?? "Bilinmeyen hata"}`,
          isInternal: false,
        },
      }),
    ]);

    try {
      cookieStore.delete(CART_COOKIE);
    } catch {
      // Cookie silinemezse devam et
    }

    // Domain olaylarını ve bilgilendirme e-postasını tetikle
    await emitDomainEvent("order.placed", {
      orderId: txResult.order.id,
      orderNumber: txResult.order.number,
      customerId: txResult.customerId,
      email: txResult.normalizedEmail,
      total: txResult.order.total,
      visitorId,
      productIds: summary.lines.map((l) => l.productId),
    });

    sendExpoPushNotification({
      title: `Yeni Sipariş #${txResult.order.number}`,
      body: `${shippingAddress.firstName} ${shippingAddress.lastName} - ${formatMoney(txResult.order.total, txResult.order.currency)}`,
      data: {
        type: "order.placed",
        orderId: txResult.order.id,
        orderNumber: txResult.order.number,
      },
    }).catch(() => {});

    if (paymentInit.orderPaymentStatus === "PAID") {
      await emitDomainEvent("order.paid", {
        orderId: txResult.order.id,
        orderNumber: txResult.order.number,
        amount: txResult.order.total,
      });
    }

    await sendTransactionalEmail({
      to: txResult.normalizedEmail,
      templateKey: "order_placed",
      variables: {
        customerName: `${shippingAddress.firstName} ${shippingAddress.lastName}`,
        orderNumber: String(txResult.order.number),
        orderTotal: formatMoney(txResult.order.total, txResult.order.currency),
        paymentMethod: getPaymentMethodLabel(paymentMethodCode),
        orderUrl: `${appBaseUrl}/siparis-sonuc/${txResult.order.id}`,
      },
    }).catch(() => {});

    return {
      ok: paymentInit.ok,
      error: paymentInit.errorMessage,
      orderId: txResult.order.id,
      orderNumber: txResult.order.number,
      paymentStatus: paymentInit.orderPaymentStatus,
      checkoutFormContent: paymentInit.checkoutFormContent,
      paymentPageUrl: paymentInit.paymentPageUrl,
      bankInstructions: paymentInit.instructions,
    };
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Sipariş oluşturulurken beklenmeyen bir hata oluştu.";
    return {
      ok: false,
      error: message,
    };
  }
}
