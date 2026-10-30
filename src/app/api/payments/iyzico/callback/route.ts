import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emitDomainEvent } from "@/lib/events";
import { getPaymentSettings } from "@/lib/settings/service";
import { verifyIyzicoCheckoutToken } from "@/modules/payments/iyzico";
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
    ]);

    await emitDomainEvent("order.paid", {
      orderId: payment.orderId,
      orderNumber: payment.order.number,
      amount: payment.amount,
    });

    return NextResponse.redirect(
      new URL(`/siparis-sonuc/${payment.orderId}`, baseUrl),
      { status: 303 }
    );
  }

  await db.$transaction([
    db.payment.update({
      where: { id: payment.id },
      data: {
        status: "FAILED",
        errorMessage: verification.errorMessage ?? "Kart ödemesi başarısız oldu.",
        providerData: (verification.raw ?? {}) as Prisma.InputJsonValue,
      },
    }),
    db.order.update({
      where: { id: payment.orderId },
      data: {
        paymentStatus: "FAILED",
      },
    }),
    db.orderEvent.create({
      data: {
        orderId: payment.orderId,
        type: "payment",
        message: `Kart ödemesi başarısız: ${verification.errorMessage ?? "Banka reddi"}`,
        isInternal: false,
      },
    }),
  ]);

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
