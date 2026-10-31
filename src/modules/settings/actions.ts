"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { hashPassword, requireStaff } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import { parseMoneyInput } from "@/lib/money";
import { ALL_PERMISSION_KEYS, type PermissionKey } from "@/lib/rbac/permissions";
import { sendTransactionalEmail } from "@/lib/mail";
import {
  getConversionSettings,
  getInstallmentSettings,
  getClubSettings,
  getPaymentSettings,
  getSeoSettings,
  getStoreSettings,
  getThemeSettings,
  saveConversionSettings,
  saveInstallmentSettings,
  saveClubSettings,
  savePaymentSettings,
  saveSeoSettings,
  saveStoreSettings,
  saveThemeSettings,
} from "@/lib/settings/service";
import {
  installmentSettingsSchema,
  clubSettingsSchema,
  type InstallmentSettings,
  type ClubSettings,
} from "@/lib/settings/schemas";

export async function saveStoreSettingsAction(formData: FormData): Promise<void> {
  const staff = await requireStaff("settings.manage");
  const before = await getStoreSettings();

  const retentionRaw = Number(formData.get("visitorRetentionDays") ?? 180);
  const minOrderSubtotalRaw = String(formData.get("minOrderSubtotalTl") ?? "").trim();
  const minOrderSubtotalMinor = minOrderSubtotalRaw
    ? Math.max(0, parseMoneyInput(minOrderSubtotalRaw))
    : (before.minOrderSubtotalMinor ?? 0);

  const after = await saveStoreSettings({
    storeName: String(formData.get("storeName") ?? "").trim() || before.storeName,
    tagline: String(formData.get("tagline") ?? "").trim(),
    supportEmail: String(formData.get("supportEmail") ?? "").trim() || before.supportEmail,
    supportPhone: String(formData.get("supportPhone") ?? "").trim(),
    currency: String(formData.get("currency") ?? "TRY").trim() || "TRY",
    locale: String(formData.get("locale") ?? "tr-TR").trim() || "tr-TR",
    companyLegalName: String(formData.get("companyLegalName") ?? "").trim(),
    taxOffice: String(formData.get("taxOffice") ?? "").trim(),
    taxNumber: String(formData.get("taxNumber") ?? "").trim(),
    mersisNumber: String(formData.get("mersisNumber") ?? "").trim(),
    kepAddress: String(formData.get("kepAddress") ?? "").trim(),
    address: String(formData.get("address") ?? "").trim(),
    city: String(formData.get("city") ?? "İstanbul").trim(),
    district: String(formData.get("district") ?? "").trim(),
    onlyBuyersCanReview: formData.get("onlyBuyersCanReview") === "on",
    autoApproveReviews: formData.get("autoApproveReviews") === "on",
    visitorRetentionDays:
      Number.isFinite(retentionRaw) && retentionRaw >= 1 && retentionRaw <= 730
        ? Math.round(retentionRaw)
        : 180,
    minOrderSubtotalMinor,
  });

  await recordAudit({
    staffUserId: staff.id,
    action: "settings.store.update",
    entityType: "Setting",
    entityId: "store",
    summary: `Mağaza ve şirket bilgileri güncellendi (${after.storeName})`,
    before: before as unknown as Prisma.InputJsonValue,
    after: after as unknown as Prisma.InputJsonValue,
  });

  revalidatePath("/admin/ayarlar");
  revalidatePath("/admin/ayarlar/denetim");
  revalidatePath("/");
}

import { getThemePresetById } from "@/lib/settings/theme-presets";

export async function applyThemePresetAction(input: FormData | string): Promise<void> {
  const staff = await requireStaff("settings.manage");
  const presetId =
    typeof input === "string"
      ? input
      : String((input as FormData).get("presetId") ?? "");
  const before = await getThemeSettings();
  const preset = getThemePresetById(presetId);
  if (!preset) {
    throw new Error("Geçersiz tema şablonu");
  }

  const after = await saveThemeSettings({
    activePresetId: preset.id,
    logoText: preset.values.logoText,
    logoImageUrl: before.logoImageUrl,
    faviconUrl: before.faviconUrl,
    primaryColor: preset.values.primaryColor,
    surfaceColor: preset.values.surfaceColor,
    cardColor: preset.values.cardColor,
    mutedColor: preset.values.mutedColor,
    accentColor: preset.values.accentColor,
    accentFgColor: preset.values.accentFgColor,
    borderColor: preset.values.borderColor,
    headingFont: preset.values.headingFont,
    bodyFont: preset.values.bodyFont,
    radiusScale: preset.values.radiusScale,
    themeMode: preset.values.themeMode,
    announcementEnabled: preset.values.announcementEnabled,
    announcementText: preset.values.announcementText,
    announcementHref: preset.values.announcementHref,
    discreetShippingNotice: preset.values.discreetShippingNotice,
    isDraftDirection: false,
  });

  await recordAudit({
    staffUserId: staff.id,
    action: "settings.theme.preset",
    entityType: "Setting",
    entityId: "theme",
    summary: `Tema şablonu uygulandı: ${preset.name} (${preset.categoryLabel})`,
    before: before as unknown as Prisma.InputJsonValue,
    after: after as unknown as Prisma.InputJsonValue,
  });

  revalidatePath("/admin/ayarlar");
  revalidatePath("/admin/ayarlar/denetim");
  revalidatePath("/");
  revalidatePath("/katalog");
}

export async function saveThemeSettingsAction(formData: FormData): Promise<void> {
  const staff = await requireStaff("settings.manage");
  const before = await getThemeSettings();

  const headingFontRaw = String(formData.get("headingFont") ?? before.headingFont);
  const bodyFontRaw = String(formData.get("bodyFont") ?? before.bodyFont);
  const radiusScaleRaw = String(formData.get("radiusScale") ?? before.radiusScale);
  const themeModeRaw = String(formData.get("themeMode") ?? before.themeMode);

  const headingFont =
    headingFontRaw === "plus-jakarta" ||
    headingFontRaw === "ibm-plex-sans" ||
    headingFontRaw === "system"
      ? headingFontRaw
      : "instrument-serif";

  const bodyFont =
    bodyFontRaw === "ibm-plex-sans" || bodyFontRaw === "system"
      ? bodyFontRaw
      : "plus-jakarta";

  const radiusScale =
    radiusScaleRaw === "none" || radiusScaleRaw === "md" || radiusScaleRaw === "full"
      ? radiusScaleRaw
      : "sm";

  const themeMode = themeModeRaw === "dark" ? "dark" : "light";

  const after = await saveThemeSettings({
    activePresetId: String(formData.get("activePresetId") ?? before.activePresetId ?? "custom"),
    logoText: String(formData.get("logoText") ?? "").trim() || before.logoText,
    logoImageUrl: String(formData.get("logoImageUrl") ?? "").trim(),
    faviconUrl: String(formData.get("faviconUrl") ?? "").trim(),
    primaryColor: String(formData.get("primaryColor") ?? "#18181b").trim() || "#18181b",
    surfaceColor: String(formData.get("surfaceColor") ?? "#fafaf9").trim() || "#fafaf9",
    cardColor: String(formData.get("cardColor") ?? "#ffffff").trim() || "#ffffff",
    mutedColor: String(formData.get("mutedColor") ?? "#52525b").trim() || "#52525b",
    accentColor: String(formData.get("accentColor") ?? "#9a3412").trim() || "#9a3412",
    accentFgColor: String(formData.get("accentFgColor") ?? "#ffffff").trim() || "#ffffff",
    borderColor: String(formData.get("borderColor") ?? "#e4e4e7").trim() || "#e4e4e7",
    headingFont,
    bodyFont,
    radiusScale,
    themeMode,
    announcementEnabled: formData.get("announcementEnabled") === "on",
    announcementText: String(formData.get("announcementText") ?? "").trim(),
    announcementHref: String(formData.get("announcementHref") ?? "/katalog").trim() || "/katalog",
    discreetShippingNotice: formData.get("discreetShippingNotice") === "on",
    isDraftDirection: formData.get("isDraftDirection") === "on",
  });

  await recordAudit({
    staffUserId: staff.id,
    action: "settings.theme.update",
    entityType: "Setting",
    entityId: "theme",
    summary: `Vitrin tema ayarları güncellendi (Logo: ${after.logoText}, Mod: ${after.themeMode}, Preset: ${after.activePresetId})`,
    before: before as unknown as Prisma.InputJsonValue,
    after: after as unknown as Prisma.InputJsonValue,
  });

  revalidatePath("/admin/ayarlar");
  revalidatePath("/admin/ayarlar/denetim");
  revalidatePath("/");
  revalidatePath("/katalog");
}

export async function savePaymentSettingsAction(formData: FormData): Promise<void> {
  const staff = await requireStaff("settings.manage");
  const before = await getPaymentSettings();

  const bankNames = formData.getAll("bankName").map((v) => String(v).trim());
  const accountHolders = formData.getAll("accountHolder").map((v) => String(v).trim());
  const ibans = formData.getAll("iban").map((v) => String(v).trim());
  const branches = formData.getAll("branch").map((v) => String(v).trim());

  const bankAccounts: Array<{
    bankName: string;
    accountHolder: string;
    iban: string;
    branch?: string;
  }> = [];

  for (let i = 0; i < bankNames.length; i += 1) {
    const bankName = bankNames[i] ?? "";
    const accountHolder = accountHolders[i] ?? "";
    const iban = ibans[i] ?? "";
    const branch = branches[i] ?? "";
    if (bankName && iban) {
      bankAccounts.push({
        bankName,
        accountHolder: accountHolder || bankName,
        iban,
        ...(branch ? { branch } : {}),
      });
    }
  }

  const codFeeTlRaw = String(formData.get("codFeeTl") ?? "").trim();
  const codMaxOrderTlRaw = String(formData.get("codMaxOrderTl") ?? "").trim();

  const codFeeMinor = codFeeTlRaw
    ? parseMoneyInput(codFeeTlRaw)
    : Number(formData.get("codFeeMinor") ?? before.codFeeMinor);
  const codMaxOrderMinor = codMaxOrderTlRaw
    ? parseMoneyInput(codMaxOrderTlRaw)
    : Number(formData.get("codMaxOrderMinor") ?? before.codMaxOrderMinor);

  const after = await savePaymentSettings({
    iyzicoEnabled: formData.get("iyzicoEnabled") === "on",
    iyzicoApiKey: String(formData.get("iyzicoApiKey") ?? "").trim(),
    iyzicoSecretKey: String(formData.get("iyzicoSecretKey") ?? "").trim(),
    iyzicoBaseUrl:
      String(formData.get("iyzicoBaseUrl") ?? "").trim() || "https://sandbox-api.iyzipay.com",
    bankTransferEnabled: formData.get("bankTransferEnabled") === "on",
    bankAccounts: bankAccounts.length > 0 ? bankAccounts : before.bankAccounts,
    bankTransferInstructions: String(formData.get("bankTransferInstructions") ?? "").trim(),
    codEnabled: formData.get("codEnabled") === "on",
    codFeeMinor: Math.max(0, codFeeMinor),
    codMaxOrderMinor: Math.max(0, codMaxOrderMinor),
  });

  const maskSecret = (s: string) => (s ? `${s.slice(0, 4)}***` : "");

  await recordAudit({
    staffUserId: staff.id,
    action: "settings.payment.update",
    entityType: "Setting",
    entityId: "payment",
    summary: "Ödeme yöntemleri, IBAN hesapları ve kapıda ödeme limitleri güncellendi",
    before: {
      ...before,
      iyzicoSecretKey: maskSecret(before.iyzicoSecretKey),
    } as unknown as Prisma.InputJsonValue,
    after: {
      ...after,
      iyzicoSecretKey: maskSecret(after.iyzicoSecretKey),
    } as unknown as Prisma.InputJsonValue,
  });

  revalidatePath("/admin/ayarlar");
  revalidatePath("/admin/ayarlar/denetim");
  revalidatePath("/odeme");
}

export async function saveShippingMethodAction(formData: FormData): Promise<void> {
  const staff = await requireStaff("settings.manage");

  const id = String(formData.get("id") ?? "").trim() || undefined;
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const carrier = String(formData.get("carrier") ?? "").trim() || null;
  const priceTlRaw = String(formData.get("priceTl") ?? "0").trim();
  const freeOverTlRaw = String(formData.get("freeOverTl") ?? "").trim();
  const citiesRaw = String(formData.get("cities") ?? "").trim();
  const estimatedDays = String(formData.get("estimatedDays") ?? "").trim() || null;
  const position = Number(formData.get("position") ?? 0);
  const isActive = formData.get("isActive") !== "false";

  if (!name) {
    throw new Error("Kargo yöntemi adı zorunludur.");
  }

  const price = Math.max(0, parseMoneyInput(priceTlRaw));
  const freeOverAmount = freeOverTlRaw ? Math.max(0, parseMoneyInput(freeOverTlRaw)) : null;
  const cities = citiesRaw
    ? citiesRaw
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean)
    : [];

  const before = id ? await db.shippingMethod.findUnique({ where: { id } }) : null;

  const saved = id
    ? await db.shippingMethod.update({
        where: { id },
        data: {
          name,
          description,
          carrier,
          price,
          freeOverAmount,
          cities,
          estimatedDays,
          position: Number.isFinite(position) ? position : 0,
          isActive,
        },
      })
    : await db.shippingMethod.create({
        data: {
          name,
          description,
          carrier,
          price,
          freeOverAmount,
          cities,
          estimatedDays,
          position: Number.isFinite(position) ? position : 0,
          isActive,
        },
      });

  await recordAudit({
    staffUserId: staff.id,
    action: id ? "shipping_method.update" : "shipping_method.create",
    entityType: "ShippingMethod",
    entityId: saved.id,
    summary: `Kargo yöntemi kaydedildi: ${saved.name}`,
    before: before ? (before as unknown as Prisma.InputJsonValue) : null,
    after: saved as unknown as Prisma.InputJsonValue,
  });

  revalidatePath("/admin/ayarlar");
  revalidatePath("/admin/ayarlar/denetim");
  revalidatePath("/odeme");
}

export async function toggleShippingMethodAction(formData: FormData): Promise<void> {
  const staff = await requireStaff("settings.manage");
  const id = String(formData.get("id") ?? "").trim();
  const isActive = formData.get("isActive") === "true";
  if (!id) return;

  const before = await db.shippingMethod.findUnique({ where: { id } });
  if (!before) return;

  const after = await db.shippingMethod.update({
    where: { id },
    data: { isActive },
  });

  await recordAudit({
    staffUserId: staff.id,
    action: "shipping_method.toggle",
    entityType: "ShippingMethod",
    entityId: id,
    summary: `Kargo yöntemi durumu: ${after.name} -> ${isActive ? "Aktif" : "Pasif"}`,
    before: before as unknown as Prisma.InputJsonValue,
    after: after as unknown as Prisma.InputJsonValue,
  });

  revalidatePath("/admin/ayarlar");
  revalidatePath("/admin/ayarlar/denetim");
}

export async function deleteShippingMethodAction(formData: FormData): Promise<void> {
  const staff = await requireStaff("settings.manage");
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const existing = await db.shippingMethod.findUnique({ where: { id } });
  if (!existing) return;

  await db.shippingMethod.delete({ where: { id } });

  await recordAudit({
    staffUserId: staff.id,
    action: "shipping_method.delete",
    entityType: "ShippingMethod",
    entityId: id,
    summary: `Kargo yöntemi silindi: ${existing.name}`,
    before: existing as unknown as Prisma.InputJsonValue,
  });

  revalidatePath("/admin/ayarlar");
  revalidatePath("/admin/ayarlar/denetim");
}

export async function saveSeoSettingsAction(formData: FormData): Promise<void> {
  const staff = await requireStaff("settings.manage");
  const before = await getSeoSettings();

  const disallowRaw = String(formData.get("robotsDisallowPaths") ?? "").trim();
  const robotsDisallowPaths = disallowRaw
    ? disallowRaw
        .split(/[\n,]/)
        .map((p) => p.trim())
        .filter(Boolean)
    : before.robotsDisallowPaths;

  const after = await saveSeoSettings({
    defaultTitle: String(formData.get("defaultTitle") ?? "").trim() || before.defaultTitle,
    titleTemplate: String(formData.get("titleTemplate") ?? "").trim() || before.titleTemplate,
    defaultDescription: String(formData.get("defaultDescription") ?? "").trim(),
    ogImageUrl: String(formData.get("ogImageUrl") ?? "").trim(),
    robotsDisallowPaths,
  });

  await recordAudit({
    staffUserId: staff.id,
    action: "settings.seo.update",
    entityType: "Setting",
    entityId: "seo",
    summary: `SEO varsayılanları güncellendi (${after.defaultTitle})`,
    before: before as unknown as Prisma.InputJsonValue,
    after: after as unknown as Prisma.InputJsonValue,
  });

  revalidatePath("/admin/ayarlar");
  revalidatePath("/admin/ayarlar/denetim");
  revalidatePath("/");
}

export async function saveEmailTemplateAction(formData: FormData): Promise<void> {
  const staff = await requireStaff("settings.manage");

  const key = String(formData.get("key") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const bodyHtml = String(formData.get("bodyHtml") ?? "").trim();
  const isActive = formData.get("isActive") !== "false";

  if (!key || !name || !subject) {
    throw new Error("E-posta şablonu anahtarı, adı ve konusu zorunludur.");
  }

  const before = await db.emailTemplate.findUnique({ where: { key } });

  const saved = await db.emailTemplate.upsert({
    where: { key },
    create: {
      key,
      name,
      subject,
      bodyHtml,
      isActive,
    },
    update: {
      name,
      subject,
      bodyHtml,
      isActive,
    },
  });

  await recordAudit({
    staffUserId: staff.id,
    action: "email_template.save",
    entityType: "EmailTemplate",
    entityId: saved.id,
    summary: `E-posta şablonu güncellendi: ${saved.name} (${saved.key})`,
    before: before ? (before as unknown as Prisma.InputJsonValue) : null,
    after: saved as unknown as Prisma.InputJsonValue,
  });

  revalidatePath("/admin/ayarlar");
  revalidatePath("/admin/ayarlar/denetim");
}

export async function sendTestEmailAction(formData: FormData): Promise<void> {
  const staff = await requireStaff("settings.manage");
  const templateKey = String(formData.get("templateKey") ?? "order_placed").trim();
  const to = String(formData.get("to") ?? staff.email).trim() || staff.email;

  const messageId = await sendTransactionalEmail({
    to,
    templateKey,
    variables: {
      customerName: staff.name,
      orderNumber: "1042",
      orderTotal: "1.490,00 TL",
      paymentMethod: "Kredi Kartı (iyzico)",
      orderUrl: "http://localhost:3000/siparis-takip?no=1042",
      carrier: "Yurtiçi Kargo",
      trackingNumber: "YK908172635",
      productTitle: "Örnek Keten Gömlek",
      productUrl: "http://localhost:3000/katalog",
    },
  });

  await recordAudit({
    staffUserId: staff.id,
    action: "email_template.test_send",
    entityType: "EmailMessage",
    entityId: messageId || null,
    summary: `${to} adresine "${templateKey}" şablonuyla test e-postası gönderildi`,
  });

  revalidatePath("/admin/ayarlar");
}

export async function saveRoleAction(formData: FormData): Promise<void> {
  const staff = await requireStaff("staff.manage");

  const id = String(formData.get("id") ?? "").trim() || undefined;
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const rawPerms = formData.getAll("permissions").map((p) => String(p).trim());

  if (!name) {
    throw new Error("Rol adı zorunludur.");
  }

  const validPermissions = rawPerms.filter(
    (p): p is PermissionKey =>
      p === "*" || ALL_PERMISSION_KEYS.includes(p as PermissionKey)
  );

  const before = id ? await db.role.findUnique({ where: { id } }) : null;

  const saved = id
    ? await db.role.update({
        where: { id },
        data: {
          name: before?.isSystem ? before.name : name,
          description,
          permissions: validPermissions,
        },
      })
    : await db.role.create({
        data: {
          name,
          description,
          permissions: validPermissions,
          isSystem: false,
        },
      });

  await recordAudit({
    staffUserId: staff.id,
    action: id ? "role.update" : "role.create",
    entityType: "Role",
    entityId: saved.id,
    summary: `Rol ve yetki matrisi kaydedildi: ${saved.name} (${saved.permissions.length} yetki)`,
    before: before ? (before as unknown as Prisma.InputJsonValue) : null,
    after: saved as unknown as Prisma.InputJsonValue,
  });

  revalidatePath("/admin/ayarlar");
  revalidatePath("/admin/ayarlar/denetim");
}

export async function deleteRoleAction(formData: FormData): Promise<void> {
  const staff = await requireStaff("staff.manage");
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const role = await db.role.findUnique({
    where: { id },
    include: { _count: { select: { users: true } } },
  });

  if (!role) return;
  if (role.isSystem) {
    throw new Error("Sistem rolleri silinemez; yalnızca izinlerini güncelleyebilirsiniz.");
  }
  if (role._count.users > 0) {
    throw new Error("Bu role atanmış personel hesapları varken rol silinemez.");
  }

  await db.role.delete({ where: { id } });

  await recordAudit({
    staffUserId: staff.id,
    action: "role.delete",
    entityType: "Role",
    entityId: id,
    summary: `Rol silindi: ${role.name}`,
    before: role as unknown as Prisma.InputJsonValue,
  });

  revalidatePath("/admin/ayarlar");
  revalidatePath("/admin/ayarlar/denetim");
}

export async function saveStaffUserAction(formData: FormData): Promise<void> {
  const staff = await requireStaff("staff.manage");

  const id = String(formData.get("id") ?? "").trim() || undefined;
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const roleId = String(formData.get("roleId") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const isActive = formData.get("isActive") !== "false";

  if (!name || !roleId) {
    throw new Error("Personel adı ve rol seçimi zorunludur.");
  }

  if (id) {
    const before = await db.staffUser.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        roleId: true,
        isOwner: true,
        isActive: true,
      },
    });
    if (!before) return;

    const nextActive = before.isOwner ? true : isActive;
    const passwordHash = password.length >= 6 ? await hashPassword(password) : undefined;

    const updated = await db.staffUser.update({
      where: { id },
      data: {
        name,
        roleId,
        isActive: nextActive,
        ...(passwordHash ? { passwordHash } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        roleId: true,
        isOwner: true,
        isActive: true,
      },
    });

    await recordAudit({
      staffUserId: staff.id,
      action: "staff.update",
      entityType: "StaffUser",
      entityId: updated.id,
      summary: `Personel hesabı güncellendi: ${updated.email}`,
      before: before as unknown as Prisma.InputJsonValue,
      after: updated as unknown as Prisma.InputJsonValue,
    });
  } else {
    if (!email || password.length < 6) {
      throw new Error("Yeni personel için geçerli e-posta ve en az 6 karakterli şifre zorunludur.");
    }
    const passwordHash = await hashPassword(password);
    const created = await db.staffUser.create({
      data: {
        name,
        email,
        passwordHash,
        roleId,
        isOwner: false,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        roleId: true,
        isOwner: true,
        isActive: true,
      },
    });

    await recordAudit({
      staffUserId: staff.id,
      action: "staff.create",
      entityType: "StaffUser",
      entityId: created.id,
      summary: `Yeni personel hesabı oluşturuldu: ${created.email}`,
      after: created as unknown as Prisma.InputJsonValue,
    });
  }

  revalidatePath("/admin/ayarlar");
  revalidatePath("/admin/ayarlar/denetim");
}

export async function deleteStaffUserAction(formData: FormData): Promise<void> {
  const staff = await requireStaff("staff.manage");
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  if (id === staff.id) {
    throw new Error("Kendi aktif personel hesabınızı silemezsiniz.");
  }

  const target = await db.staffUser.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      roleId: true,
      isOwner: true,
    },
  });

  if (!target) return;
  if (target.isOwner) {
    throw new Error("Mağaza sahibi hesabı silinemez.");
  }

  await db.staffUser.delete({ where: { id } });

  await recordAudit({
    staffUserId: staff.id,
    action: "staff.delete",
    entityType: "StaffUser",
    entityId: id,
    summary: `Personel hesabı silindi: ${target.email}`,
    before: target as unknown as Prisma.InputJsonValue,
  });

  revalidatePath("/admin/ayarlar");
  revalidatePath("/admin/ayarlar/denetim");
}

export async function saveConversionSettingsAction(formData: FormData): Promise<void> {
  const staff = await requireStaff("settings.manage");
  const before = await getConversionSettings();

  const flashDealsDurationRaw = Number(formData.get("flashDealsDurationHours") ?? 12);
  const liveToastIntervalRaw = Number(formData.get("liveSalesToastIntervalSeconds") ?? 22);
  const scarcityThresholdRaw = Number(formData.get("scarcityStockThreshold") ?? 5);

  const after = await saveConversionSettings({
    flashDealsEnabled: formData.get("flashDealsEnabled") === "on",
    flashDealsBadgeText:
      String(formData.get("flashDealsBadgeText") ?? "").trim() || before.flashDealsBadgeText,
    flashDealsTitle:
      String(formData.get("flashDealsTitle") ?? "").trim() || before.flashDealsTitle,
    flashDealsPromoCode:
      String(formData.get("flashDealsPromoCode") ?? "").trim() || before.flashDealsPromoCode,
    flashDealsDurationHours:
      Number.isFinite(flashDealsDurationRaw) && flashDealsDurationRaw >= 1 && flashDealsDurationRaw <= 72
        ? Math.round(flashDealsDurationRaw)
        : 12,
    flashDealsTargetHref:
      String(formData.get("flashDealsTargetHref") ?? "/katalog?filter=discount").trim(),

    trustBadgesEnabled: formData.get("trustBadgesEnabled") === "on",
    trustBadge1Title:
      String(formData.get("trustBadge1Title") ?? "").trim() || before.trustBadge1Title,
    trustBadge1Desc:
      String(formData.get("trustBadge1Desc") ?? "").trim() || before.trustBadge1Desc,
    trustBadge2Title:
      String(formData.get("trustBadge2Title") ?? "").trim() || before.trustBadge2Title,
    trustBadge2Desc:
      String(formData.get("trustBadge2Desc") ?? "").trim() || before.trustBadge2Desc,
    trustBadge3Title:
      String(formData.get("trustBadge3Title") ?? "").trim() || before.trustBadge3Title,
    trustBadge3Desc:
      String(formData.get("trustBadge3Desc") ?? "").trim() || before.trustBadge3Desc,
    trustBadge4Title:
      String(formData.get("trustBadge4Title") ?? "").trim() || before.trustBadge4Title,
    trustBadge4Desc:
      String(formData.get("trustBadge4Desc") ?? "").trim() || before.trustBadge4Desc,

    liveSalesToastEnabled: formData.get("liveSalesToastEnabled") === "on",
    liveSalesToastIntervalSeconds:
      Number.isFinite(liveToastIntervalRaw) && liveToastIntervalRaw >= 5 && liveToastIntervalRaw <= 120
        ? Math.round(liveToastIntervalRaw)
        : 22,

    scarcityWarningEnabled: formData.get("scarcityWarningEnabled") === "on",
    scarcityStockThreshold:
      Number.isFinite(scarcityThresholdRaw) && scarcityThresholdRaw >= 1 && scarcityThresholdRaw <= 50
        ? Math.round(scarcityThresholdRaw)
        : 5,
    quickAddToCartEnabled: formData.get("quickAddToCartEnabled") === "on",
    showSavingsBadge: formData.get("showSavingsBadge") === "on",
    showReviewStars: formData.get("showReviewStars") === "on",
  });

  await recordAudit({
    staffUserId: staff.id,
    action: "settings.conversion.update",
    entityType: "Setting",
    entityId: "conversion",
    summary: "Dönüşüm ve psikolojik satış ayarları güncellendi",
    before: before as unknown as Prisma.InputJsonValue,
    after: after as unknown as Prisma.InputJsonValue,
  });

  revalidatePath("/admin/ayarlar");
  revalidatePath("/admin/ayarlar/denetim");
  revalidatePath("/");
  revalidatePath("/katalog");
}

export async function updateInstallmentSettingsAction(
  input: InstallmentSettings | FormData
): Promise<{ success: boolean; data?: InstallmentSettings; error?: string }> {
  const staff = await requireStaff("settings.manage");
  const before = await getInstallmentSettings();

  let parsed: InstallmentSettings;
  try {
    if (input instanceof FormData) {
      const rawJson = input.get("payload");
      if (typeof rawJson === "string") {
        parsed = installmentSettingsSchema.parse(JSON.parse(rawJson));
      } else {
        throw new Error("Geçersiz form verisi");
      }
    } else {
      parsed = installmentSettingsSchema.parse(input);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Geçersiz taksit ayarları verisi";
    return { success: false, error: msg };
  }

  const after = await saveInstallmentSettings(parsed);

  await recordAudit({
    staffUserId: staff.id,
    action: "settings.installment.update",
    entityType: "Setting",
    entityId: "installment",
    summary: `Taksit ayarları ve 6 kart ailesi oranları güncellendi (Durum: ${after.enabled ? "Aktif" : "Pasif"})`,
    before: before as unknown as Prisma.InputJsonValue,
    after: after as unknown as Prisma.InputJsonValue,
  });

  revalidatePath("/admin/ayarlar");
  revalidatePath("/admin/ayarlar/taksit");
  revalidatePath("/admin/ayarlar/denetim");
  revalidatePath("/odeme");
  revalidatePath("/katalog");
  revalidatePath("/");

  return { success: true, data: after };
}

export async function updateClubSettingsAction(
  input: ClubSettings | FormData
): Promise<{ success: boolean; data?: ClubSettings; error?: string }> {
  const staff = await requireStaff("settings.manage");
  const before = await getClubSettings();

  let parsed: ClubSettings;
  try {
    if (input instanceof FormData) {
      const rawJson = input.get("payload");
      if (typeof rawJson === "string") {
        parsed = clubSettingsSchema.parse(JSON.parse(rawJson));
      } else {
        throw new Error("Geçersiz form verisi");
      }
    } else {
      parsed = clubSettingsSchema.parse(input);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Geçersiz VezollaClub ayarları verisi";
    return { success: false, error: msg };
  }

  const after = await saveClubSettings(parsed);

  await recordAudit({
    staffUserId: staff.id,
    action: "settings.vezollaclub.update",
    entityType: "Setting",
    entityId: "vezollaclub",
    summary: `VezollaClub ayarları güncellendi (1 Puan = ${after.pointValueKurus} Kuruş, Durum: ${after.enabled ? "Aktif" : "Pasif"})`,
    before: before as unknown as Prisma.InputJsonValue,
    after: after as unknown as Prisma.InputJsonValue,
  });

  revalidatePath("/admin/ayarlar");
  revalidatePath("/admin/ayarlar/vezollaclub");
  revalidatePath("/admin/ayarlar/denetim");
  revalidatePath("/hesabim");
  revalidatePath("/odeme");
  revalidatePath("/sepet");
  revalidatePath("/katalog");
  revalidatePath("/");

  return { success: true, data: after };
}


