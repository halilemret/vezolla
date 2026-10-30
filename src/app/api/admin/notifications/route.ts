import { NextResponse } from "next/server";
import { authenticateStaffApi } from "@/lib/auth/api-auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { errorResponse } = await authenticateStaffApi();
  if (errorResponse) return errorResponse;

  const url = new URL(request.url);
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "20", 10) || 20));
  const unreadOnly = url.searchParams.get("unreadOnly") === "true";

  const where = unreadOnly ? { readAt: null } : {};

  const [total, unreadCount, notifications] = await Promise.all([
    db.adminNotification.count({ where }),
    db.adminNotification.count({ where: { readAt: null } }),
    db.adminNotification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return NextResponse.json({
    notifications,
    unreadCount,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

export async function PATCH(request: Request) {
  const { errorResponse } = await authenticateStaffApi();
  if (errorResponse) return errorResponse;

  const body = await request.json().catch(() => ({}));
  const now = new Date();

  if (body.all) {
    await db.adminNotification.updateMany({
      where: { readAt: null },
      data: { readAt: now },
    });
    return NextResponse.json({ ok: true, message: "Tüm bildirimler okundu olarak işaretlendi" });
  }

  const notificationId = String(body.notificationId ?? "").trim();
  if (!notificationId) {
    return NextResponse.json({ error: "Bildirim ID gereklidir" }, { status: 400 });
  }

  await db.adminNotification.update({
    where: { id: notificationId },
    data: { readAt: now },
  });

  return NextResponse.json({ ok: true });
}
