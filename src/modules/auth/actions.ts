"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  createCustomerSession,
  createStaffSession,
  destroyCustomerSession,
  destroyStaffSession,
  hashPassword,
  verifyPassword,
} from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";

const staffLoginSchema = z.object({
  email: z.string().email("Geçerli bir e-posta adresi giriniz"),
  password: z.string().min(1, "Şifre zorunludur"),
});

export async function loginStaffAction(formData: FormData): Promise<{ error?: string }> {
  const parsed = staffLoginSchema.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz giriş bilgileri" };
  }

  const user = await db.staffUser.findUnique({
    where: { email: parsed.data.email },
  });

  if (!user || !user.isActive) {
    return { error: "E-posta adresi veya şifre hatalı." };
  }

  const valid = await verifyPassword(user.passwordHash, parsed.data.password);
  if (!valid) {
    return { error: "E-posta adresi veya şifre hatalı." };
  }

  await createStaffSession(user.id);
  await recordAudit({
    staffUserId: user.id,
    action: "staff.login",
    entityType: "StaffUser",
    entityId: user.id,
    summary: `${user.email} panele giriş yaptı`,
  });

  redirect("/admin");
}

export async function logoutStaffAction(): Promise<void> {
  await destroyStaffSession();
  redirect("/admin/giris");
}

const customerLoginSchema = z.object({
  email: z.string().email("Geçerli bir e-posta giriniz"),
  password: z.string().min(1, "Şifre giriniz"),
});

export async function loginCustomerAction(formData: FormData): Promise<{ error?: string }> {
  const parsed = customerLoginSchema.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz bilgiler" };
  }

  const customer = await db.customer.findUnique({
    where: { email: parsed.data.email },
  });

  if (!customer || !customer.passwordHash || !customer.isActive) {
    return { error: "E-posta adresi veya şifre hatalı." };
  }

  const valid = await verifyPassword(customer.passwordHash, parsed.data.password);
  if (!valid) {
    return { error: "E-posta adresi veya şifre hatalı." };
  }

  await createCustomerSession(customer.id);
  const nextUrl = String(formData.get("next") ?? "/hesabim");
  redirect(nextUrl.startsWith("/") ? nextUrl : "/hesabim");
}

const customerRegisterSchema = z.object({
  firstName: z.string().min(2, "Ad en az 2 karakter olmalıdır"),
  lastName: z.string().min(2, "Soyad en az 2 karakter olmalıdır"),
  email: z.string().email("Geçerli bir e-posta giriniz"),
  phone: z.string().optional(),
  password: z.string().min(6, "Şifre en az 6 karakter olmalıdır"),
  acceptsMarketing: z.boolean().default(false),
  kvkkAccepted: z.literal(true, {
    error: "KVKK aydınlatma metnini onaylamanız gerekir",
  }),
});

export async function registerCustomerAction(formData: FormData): Promise<{ error?: string }> {
  const parsed = customerRegisterSchema.safeParse({
    firstName: String(formData.get("firstName") ?? "").trim(),
    lastName: String(formData.get("lastName") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    phone: String(formData.get("phone") ?? "").trim() || undefined,
    password: String(formData.get("password") ?? ""),
    acceptsMarketing: formData.get("acceptsMarketing") === "on",
    kvkkAccepted: formData.get("kvkkAccepted") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Lütfen tüm alanları kontrol edin" };
  }

  const existing = await db.customer.findUnique({
    where: { email: parsed.data.email },
  });

  const passwordHash = await hashPassword(parsed.data.password);
  const now = new Date();

  let customerId: string;
  if (existing && !existing.passwordHash) {
    // Daha önce misafir sipariş vermiş müşteriyi tam hesaba yükselt
    const updated = await db.customer.update({
      where: { id: existing.id },
      data: {
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        phone: parsed.data.phone ?? existing.phone,
        passwordHash,
        acceptsMarketing: parsed.data.acceptsMarketing,
        marketingConsentAt: parsed.data.acceptsMarketing ? now : existing.marketingConsentAt,
        kvkkConsentAt: now,
      },
    });
    customerId = updated.id;
  } else if (existing) {
    return { error: "Bu e-posta adresiyle kayıtlı bir hesap zaten var." };
  } else {
    const created = await db.customer.create({
      data: {
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        email: parsed.data.email,
        phone: parsed.data.phone ?? null,
        passwordHash,
        acceptsMarketing: parsed.data.acceptsMarketing,
        marketingConsentAt: parsed.data.acceptsMarketing ? now : null,
        kvkkConsentAt: now,
      },
    });
    customerId = created.id;
  }

  await createCustomerSession(customerId);
  const nextUrl = String(formData.get("next") ?? "/hesabim");
  redirect(nextUrl.startsWith("/") ? nextUrl : "/hesabim");
}

export async function logoutCustomerAction(): Promise<void> {
  await destroyCustomerSession();
  redirect("/");
}
