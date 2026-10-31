import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendSms } from "@/lib/sms";
import { schedulePendingLoyaltyPointsForOrder } from "@/modules/loyalty/service";
import type { FulfillmentStatus, ShipmentStatus } from "@/generated/prisma/client";

import {
  type CarrierWebhookPayload,
  normalizeCarrierStatus,
} from "./normalize";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CarrierWebhookPayload;
    const trackingNumber = body.trackingNumber?.trim();
    const carrier = body.carrier?.trim();
    const rawStatus = body.status?.trim() || "IN_TRANSIT";
    const description = body.description?.trim();
    const location = body.location?.trim();

    const parsedOrderNumber = body.orderNumber ? Number(body.orderNumber) : undefined;
    const hasValidOrderNumber = Number.isInteger(parsedOrderNumber) && (parsedOrderNumber as number) > 0;

    if (!trackingNumber && !hasValidOrderNumber) {
      return NextResponse.json(
        { error: "Takip numarası (trackingNumber) veya geçerli bir sipariş numarası (orderNumber) zorunludur." },
        { status: 400 }
      );
    }

    // Gönderiyi bul
    let fulfillment = trackingNumber
      ? await db.fulfillment.findFirst({
          where: { trackingNumber },
          include: { order: true },
        })
      : null;

    if (!fulfillment && hasValidOrderNumber) {
      fulfillment = await db.fulfillment.findFirst({
        where: { order: { number: parsedOrderNumber } },
        include: { order: true },
        orderBy: { createdAt: "desc" },
      });
    }

    if (!fulfillment) {
      return NextResponse.json(
        { error: "Belirtilen takip numarasına ait aktif kargo gönderisi bulunamadı." },
        { status: 404 }
      );
    }

    const { shipmentStatus, fulfillmentStatus, label, isDelivered, isReturned } =
      normalizeCarrierStatus(rawStatus);

    const now = new Date();
    const details = [
      label,
      location ? `Konum: ${location}` : null,
      description ? `Detay: ${description}` : null,
    ]
      .filter(Boolean)
      .join(" | ");

    await db.$transaction(async (tx) => {
      // 1. Gönderi kaydını güncelle
      await tx.fulfillment.update({
        where: { id: fulfillment.id },
        data: {
          status: shipmentStatus,
          carrier: carrier || fulfillment.carrier,
          ...(isDelivered ? { deliveredAt: now } : {}),
        },
      });

      // 2. Sipariş durumunu güncelle
      await tx.order.update({
        where: { id: fulfillment.orderId },
        data: {
          fulfillmentStatus,
          ...(isDelivered ? { status: "COMPLETED" } : {}),
        },
      });

      // 3. Müşterinin ve personelin göreceği canlı zaman çizelgesi (OrderEvent)
      await tx.orderEvent.create({
        data: {
          orderId: fulfillment.orderId,
          type: "fulfillment",
          message: details,
          data: {
            trackingNumber: fulfillment.trackingNumber,
            carrier: carrier || fulfillment.carrier,
            rawStatus,
            normalizedStatus: shipmentStatus,
            location,
            description,
          },
          isInternal: false,
        },
      });
    });

    // 4. Teslimat tamamlandıysa müşteriye SMS bilgilendirmesi yap ve sadakat puanlarını zamanla
    if (isDelivered) {
      schedulePendingLoyaltyPointsForOrder(fulfillment.orderId, new Date()).catch(() => {});
      if (fulfillment.order.phone) {
        sendSms({
          to: fulfillment.order.phone,
          message: `Sayın Müşterimiz, #${fulfillment.order.number} numaralı siparişiniz başarıyla teslim edilmiştir. Ürünlerinizi güzel günlerde kullanmanızı dileriz! Vezolla`,
          isCommercial: false,
        }).catch((err) => {
          console.error("[ShippingWebhook] Teslimat SMS hatası:", err);
        });
      }
    }

    return NextResponse.json({
      ok: true,
      orderId: fulfillment.orderId,
      fulfillmentId: fulfillment.id,
      shipmentStatus,
      fulfillmentStatus,
      message: details,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Webhook işlenirken hata oluştu";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
