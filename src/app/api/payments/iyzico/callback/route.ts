import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emitDomainEvent } from "@/lib/events";
import { CART_COOKIE } from "@/lib/auth/session";
import { sendTransactionalEmail } from "@/lib/mail";
import { formatMoney } from "@/lib/money";
import { getPaymentSettings } from "@/lib/settings/service";
import { cancelOrder } from "@/modules/orders/service";
import { verifyIyzicoCheckoutToken } from "@/modules/payments/iyzico";
import { earnLoyaltyPoints } from "@/modules/loyalty/service";
import "@/modules/invoicing/auto-invoicing";
import type { Prisma } from "@/generated/prisma/client";

async function handleIyzicoCallback(token: string, orderIdHint: string | null, baseUrl: string) {
  if (!token) {
    return NextResponse.redirect(
      new URL("/odeme?error=Odeme+anahtari+bulunamadi", baseUrl),
      { status: 303 }
    );
  }

  const settings = await getPaymentSettings();
  const verification = await verifyIyzicoCheckoutToken({ token, settings });

  const payment = await db.payment.findFirst({
    where: {
      OR: [
        { providerRef: token },
        ...(verification.conversationId ? [{ orderId: verification.conversationId }] : []),
        ...(orderIdHint ? [{ orderId: orderIdHint }] : []),
      ],
    },
    include: { order: true },
    orderBy: { createdAt: "desc" },
  });

  if (!payment) {
    return NextResponse.redirect(
      new URL("/odeme?error=Odeme+kaydi+bulunamadi", baseUrl),
      { status: 303 }
    );
  }

  // Idempotency: Sipariş daha önce zaten onaylanıp ödendiyse mükerrer işlem/e-posta gönderme
  if (payment.order.paymentStatus === "PAID") {
    const response = NextResponse.redirect(
      new URL(`/siparis-sonuc/${payment.orderId}`, baseUrl),
      { status: 303 }
    );
    response.cookies.delete(CART_COOKIE);
    return response;
  }

  if (verification.ok) {
    const now = new Date();
    await db.$transaction([
      db.payment.update({
        where: { id: payment.id },
        data: {
          status: "CAPTURED",
          capturedAt: now,
          providerRef: verification.paymentId ?? token,
          providerData: (verification.raw ?? {}) as Prisma.InputJsonValue,
          errorMessage: null,
        },
      }),
      db.order.update({
        where: { id: payment.orderId },
        data: {
          paymentStatus: "PAID",
          paidAt: payment.order.paidAt ?? now,
        },
      }),
      db.orderEvent.create({
        data: {
          orderId: payment.orderId,
          type: "payment",
          message: "iyzico kredi/banka kartı ödemesi doğrulandı ve tahsil edildi.",
          isInternal: false,
        },
      }),
      db.cart.updateMany({
        where: { orderId: payment.orderId },
        data: {
          completedAt: now,
        },
      }),
    ]);

    await emitDomainEvent("order.paid", {
      orderId: payment.orderId,
      orderNumber: payment.order.number,
      amount: payment.amount,
    });

    // Sipariş ödendiğinde müşteriye Vezolla Club sadakat puanı kazandır
    if (payment.order.customerId) {
      const earnedPoints = Math.floor(payment.order.total / 100);
      if (earnedPoints > 0) {
        earnLoyaltyPoints({
          customerId: payment.order.customerId,
          points: earnedPoints,
          reason: "ORDER_PURCHASE",
          orderId: payment.order.id,
        }).catch(() => {});
      }
    }

    // Kart ödemesi başarıyla PAID durumuna geçtiğinde sipariş onay e-postasını gönder
    const ship = (payment.order.shippingAddress ?? {}) as Record<string, unknown>;
    const recipientName =
      `${String(ship.firstName ?? "")} ${String(ship.lastName ?? "")}`.trim() || "Değerli Müşterimiz";

    await sendTransactionalEmail({
      to: payment.order.email,
      templateKey: "order_placed",
      variables: {
        customerName: recipientName,
        orderNumber: String(payment.order.number),
        orderTotal: formatMoney(payment.order.total, payment.order.currency),
        paymentMethod: "Kredi / Banka Kartı (iyzico)",
        orderUrl: `${baseUrl}/siparis-sonuc/${payment.orderId}`,
      },
    }).catch(() => {});

    const response = NextResponse.redirect(
      new URL(`/siparis-sonuc/${payment.orderId}`, baseUrl),
      { status: 303 }
    );
    response.cookies.delete(CART_COOKIE);
    return response;
  }

  // Ödeme başarısız veya 3DS iptal:
  // 1. Ödeme kaydını güncelle
  await db.payment.update({
    where: { id: payment.id },
    data: {
      status: "FAILED",
      errorMessage: verification.errorMessage ?? "Kart ödemesi başarısız oldu.",
      providerData: (verification.raw ?? {}) as Prisma.InputJsonValue,
    },
  });

  // 2. Rezerve edilmiş stokları serbest bırak ve siparişi iptal et (zombi rezervasyon oluşmasını engelle)
  await cancelOrder({
    orderId: payment.orderId,
    reason: `iyzico ödeme başarısız: ${verification.errorMessage ?? "Banka reddi"}`,
  });

  // 3. Müşterinin sepetini koru (completedAt null kalsın)
  await db.cart.updateMany({
    where: { orderId: payment.orderId },
    data: {
      completedAt: null,
    },
  });

  const errParam = encodeURIComponent(
    verification.errorMessage ?? "Kart ödemesi onaylanmadı."
  );
  return NextResponse.redirect(new URL(`/odeme?error=${errParam}`, baseUrl), {
    status: 303,
  });
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  let token = url.searchParams.get("token") ?? "";
  let orderId = url.searchParams.get("orderId");

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => ({}))) as {
      token?: string;
      orderId?: string;
    };
    if (body.token) token = body.token;
    if (body.orderId) orderId = body.orderId;
  } else {
    const formData = ((await request.formData().catch(() => null)) as unknown) as
      | globalThis.FormData
      | null;
    if (formData) {
      const formToken = formData.get("token");
      const formOrderId = formData.get("orderId");
      if (typeof formToken === "string" && formToken) token = formToken;
      if (typeof formOrderId === "string" && formOrderId) orderId = formOrderId;
    }
  }

  return handleIyzicoCallback(token.trim(), orderId, url.origin);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = (url.searchParams.get("token") ?? "").trim();
  const orderId = url.searchParams.get("orderId");
  return handleIyzicoCallback(token, orderId, url.origin);
}
