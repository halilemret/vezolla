import { NextResponse } from "next/server";
import { authenticateStaffApi } from "@/lib/auth/api-auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { staff, errorResponse } = await authenticateStaffApi();
  if (errorResponse) return errorResponse;

  try {
    const body = await request.json();
    const token = String(body.token ?? "").trim();
    const platform = body.platform ? String(body.platform).trim() : null;
    const deviceInfo = body.deviceInfo ? String(body.deviceInfo).trim() : null;

    if (!token) {
      return NextResponse.json({ error: "Push token boş olamaz" }, { status: 400 });
    }

    const pushToken = await db.staffPushToken.upsert({
      where: { token },
      create: {
        token,
        staffUserId: staff?.id ?? null,
        platform,
        deviceInfo,
      },
      update: {
        staffUserId: staff?.id ?? null,
        platform,
        deviceInfo,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true, id: pushToken.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Token kaydedilemedi";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
