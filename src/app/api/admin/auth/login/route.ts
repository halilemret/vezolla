import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createStaffSession, verifyPassword } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const loginSchema = z.object({
  email: z.string().email("Geçerli bir e-posta adresi giriniz"),
  password: z.string().min(1, "Şifre zorunludur"),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse({
      email: String(body.email ?? "").trim().toLowerCase(),
      password: String(body.password ?? ""),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Geçersiz giriş bilgileri" },
        { status: 400 }
      );
    }

    const user = await db.staffUser.findUnique({
      where: { email: parsed.data.email },
      include: {
        role: true,
      },
    });

    if (!user || !user.isActive) {
      return NextResponse.json(
        { error: "E-posta adresi veya şifre hatalı." },
        { status: 401 }
      );
    }

    const valid = await verifyPassword(user.passwordHash, parsed.data.password);
    if (!valid) {
      return NextResponse.json(
        { error: "E-posta adresi veya şifre hatalı." },
        { status: 401 }
      );
    }

    const token = await createStaffSession(user.id);

    await recordAudit({
      staffUserId: user.id,
      action: "staff.login.mobile",
      entityType: "StaffUser",
      entityId: user.id,
      summary: `${user.email} mobil uygulamadan giriş yaptı`,
    });

    return NextResponse.json({
      token,
      staff: {
        id: user.id,
        email: user.email,
        name: user.name,
        isOwner: user.isOwner,
        isActive: user.isActive,
        roleId: user.roleId,
        role: {
          id: user.role.id,
          name: user.role.name,
          permissions: user.role.permissions,
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sunucu hatası";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
