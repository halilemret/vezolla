import { NextResponse } from "next/server";
import { destroyStaffSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    let token: string | undefined;
    if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
      token = authHeader.slice(7).trim();
    }

    await destroyStaffSession(token);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Çıkış hatası";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
