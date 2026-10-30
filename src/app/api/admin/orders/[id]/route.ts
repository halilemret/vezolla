import { NextResponse } from "next/server";
import { authenticateStaffApi } from "@/lib/auth/api-auth";
import { db } from "@/lib/db";
import {
  addOrderNote,
  cancelOrder,
  createFulfillment,
  markFulfillmentDelivered,
  markOrderPaid,
} from "@/modules/orders/service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { errorResponse } = await authenticateStaffApi("orders.read");
  if (errorResponse) return errorResponse;

  const { id } = await params;

  const order = await db.order.findUnique({
    where: { id },
    include: {
      customer: true,
      items: {
        include: {
          fulfillmentItems: true,
          returnItems: true,
        },
      },
      fulfillments: {
        include: {
          items: true,
        },
        orderBy: { createdAt: "desc" },
      },
      payments: {
        orderBy: { createdAt: "desc" },
      },
      events: {
        orderBy: { createdAt: "desc" },
      },
      returns: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Sipariş bulunamadı" }, { status: 404 });
  }

  return NextResponse.json({ order });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { staff, errorResponse } = await authenticateStaffApi("orders.write");
  if (errorResponse) return errorResponse;

  const { id } = await params;
  const body = await request.json();
  const action = String(body.action ?? "").trim();

  try {
    switch (action) {
      case "mark_paid": {
        const note = body.note ? String(body.note).trim() : undefined;
        const res = await markOrderPaid({
          orderId: id,
          staffUserId: staff?.id ?? null,
          note,
        });
        if (!res.ok) {
          return NextResponse.json({ error: res.error ?? "Ödeme onaylanamadı" }, { status: 400 });
        }
        return NextResponse.json({ ok: true, message: "Sipariş ödendi olarak işaretlendi" });
      }

      case "fulfill": {
        const carrier = String(body.carrier ?? "yurtici").trim();
        const trackingNumber = body.trackingNumber ? String(body.trackingNumber).trim() : null;
        const warehouseId = body.warehouseId ? String(body.warehouseId).trim() : null;

        const res = await createFulfillment({
          orderId: id,
          carrier,
          trackingNumber,
          warehouseId,
          staffUserId: staff?.id ?? null,
        });

        if (!res.ok) {
          return NextResponse.json({ error: res.error ?? "Gönderim oluşturulamadı" }, { status: 400 });
        }
        return NextResponse.json({ ok: true, fulfillmentId: res.fulfillmentId });
      }

      case "deliver": {
        const fulfillmentId = String(body.fulfillmentId ?? "").trim();
        if (!fulfillmentId) {
          return NextResponse.json({ error: "Gönderim ID gereklidir" }, { status: 400 });
        }
        const res = await markFulfillmentDelivered({
          fulfillmentId,
          staffUserId: staff?.id ?? null,
        });
        if (!res.ok) {
          return NextResponse.json({ error: res.error ?? "Teslim edildi işaretlenemedi" }, { status: 400 });
        }
        return NextResponse.json({ ok: true });
      }

      case "cancel": {
        const reason = String(body.reason ?? "Yönetici tarafından iptal edildi").trim();
        const res = await cancelOrder({
          orderId: id,
          reason,
          staffUserId: staff?.id ?? null,
        });
        if (!res.ok) {
          return NextResponse.json({ error: res.error ?? "Sipariş iptal edilemedi" }, { status: 400 });
        }
        return NextResponse.json({ ok: true });
      }

      case "add_note": {
        const content = String(body.content ?? "").trim();
        const isCustomerVisible = Boolean(body.isCustomerVisible);
        if (!content) {
          return NextResponse.json({ error: "Not metni boş olamaz" }, { status: 400 });
        }
        const res = await addOrderNote({
          orderId: id,
          message: content,
          isInternal: !isCustomerVisible,
          staffUserId: staff?.id ?? null,
        });
        if (!res.ok) {
          return NextResponse.json({ error: res.error ?? "Not eklenemedi" }, { status: 400 });
        }
        return NextResponse.json({ ok: true });
      }

      default:
        return NextResponse.json({ error: "Geçersiz aksiyon türü" }, { status: 400 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sunucu hatası";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
