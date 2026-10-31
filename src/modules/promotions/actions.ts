"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import { parseMoneyInput } from "@/lib/money";
import type { Prisma } from "@/generated/prisma/client";
import {
  promotionInputSchema,
  type PromotionInput,
  type PromotionTypeValue,
} from "@/modules/promotions/schemas";

export async function listPromotionsAdmin() {
  await requireStaff("promotions.manage");
  return db.promotion.findMany({
    orderBy: [{ isActive: "desc" }, { priority: "desc" }, { createdAt: "desc" }],
    include: {
      _count: {
        select: { usages: true },
      },
    },
  });
}

export async function savePromotionAction(
  input: PromotionInput
): Promise<{ ok: boolean; error?: string; id?: string }> {
  const staff = await requireStaff("promotions.manage");
  const parsed = promotionInputSchema.safeParse({
    ...input,
    code: input.code?.trim() ? input.code.trim().toUpperCase() : null,
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Geçersiz promosyon bilgileri.",
    };
  }

  const data = parsed.data;

  if (data.code) {
    const existingWithCode = await db.promotion.findFirst({
      where: {
        code: data.code,
        ...(data.id ? { id: { not: data.id } } : {}),
      },
    });
    if (existingWithCode) {
      return {
        ok: false,
        error: `"${data.code}" kupon kodu başka bir kampanyada kullanılıyor.`,
      };
    }
  }

  const payload = {
    name: data.name,
    description: data.description ?? null,
    code: data.code ?? null,
    type: data.type,
    value: data.value,
    conditions: data.conditions as unknown as Prisma.InputJsonValue,
    buyQuantity: data.type === "BUY_X_GET_Y" ? (data.buyQuantity ?? 2) : null,
    getQuantity: data.type === "BUY_X_GET_Y" ? (data.getQuantity ?? 1) : null,
    getDiscountBps: data.type === "BUY_X_GET_Y" ? (data.getDiscountBps ?? 10000) : null,
    maxDiscount: data.maxDiscount && data.maxDiscount > 0 ? data.maxDiscount : null,
    usageLimit: data.usageLimit && data.usageLimit > 0 ? data.usageLimit : null,
    usagePerCustomer:
      data.usagePerCustomer && data.usagePerCustomer > 0 ? data.usagePerCustomer : null,
    startsAt: data.startsAt ?? null,
    endsAt: data.endsAt ?? null,
    isActive: data.isActive,
    isCombinable: data.isCombinable,
    priority: data.priority,
  };

  if (data.id) {
    const updated = await db.promotion.update({
      where: { id: data.id },
      data: payload,
    });
    await recordAudit({
      staffUserId: staff.id,
      action: "promotion.update",
      entityType: "Promotion",
      entityId: updated.id,
      summary: `${updated.name} (${updated.code ?? "Otomatik"}) kampanyası güncellendi`,
    });
    revalidatePath("/admin/promosyonlar");
    return { ok: true, id: updated.id };
  }

  const created = await db.promotion.create({
    data: payload,
  });

  await recordAudit({
    staffUserId: staff.id,
    action: "promotion.create",
    entityType: "Promotion",
    entityId: created.id,
    summary: `${created.name} (${created.code ?? "Otomatik"}) kampanyası oluşturuldu`,
  });

  revalidatePath("/admin/promosyonlar");
  return { ok: true, id: created.id };
}

export async function createPromotionFromFormAction(
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  const type = String(formData.get("type") ?? "PERCENTAGE") as PromotionTypeValue;
  const rawValue = String(formData.get("value") ?? "0").trim();
  const value =
    type === "PERCENTAGE"
      ? Math.round(Number(rawValue.replace(",", ".")) * 100)
      : type === "FIXED_AMOUNT"
        ? parseMoneyInput(rawValue)
        : 0;

  const minSubtotalRaw = String(formData.get("minSubtotal") ?? "").trim();
  const maxDiscountRaw = String(formData.get("maxDiscount") ?? "").trim();
  const usageLimitRaw = String(formData.get("usageLimit") ?? "").trim();
  const usagePerCustomerRaw = String(formData.get("usagePerCustomer") ?? "").trim();
  const buyQuantityRaw = String(formData.get("buyQuantity") ?? "").trim();
  const getQuantityRaw = String(formData.get("getQuantity") ?? "").trim();
  const getDiscountPctRaw = String(formData.get("getDiscountPct") ?? "100").trim();
  const startsAtRaw = String(formData.get("startsAt") ?? "").trim();
  const endsAtRaw = String(formData.get("endsAt") ?? "").trim();

  const categoryIds = formData
    .getAll("categoryIds")
    .map((v) => String(v).trim())
    .filter(Boolean);
  const productIds = formData
    .getAll("productIds")
    .map((v) => String(v).trim())
    .filter(Boolean);
  const customerGroupIds = formData
    .getAll("customerGroupIds")
    .map((v) => String(v).trim())
    .filter(Boolean);

  const customerEmailsRaw = String(formData.get("customerEmails") ?? "").trim();
  const customerEmails = customerEmailsRaw
    ? customerEmailsRaw
        .split(/[\n,;]+/)
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.length > 0 && e.includes("@"))
    : [];

  const customerIds = formData
    .getAll("customerIds")
    .map((v) => String(v).trim())
    .filter(Boolean);

  const id = String(formData.get("id") ?? "").trim() || undefined;
  const codeRaw = String(formData.get("code") ?? "").trim();

  return savePromotionAction({
    id,
    name: String(formData.get("name") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || null,
    code: codeRaw ? codeRaw.toUpperCase() : null,
    type,
    value,
    conditions: {
      minSubtotalMinor: minSubtotalRaw ? parseMoneyInput(minSubtotalRaw) : undefined,
      categoryIds,
      productIds,
      variantIds: [],
      customerGroupIds,
      customerEmails,
      customerIds,
      firstOrderOnly: formData.get("firstOrderOnly") === "on",
    },
    buyQuantity: buyQuantityRaw ? Number.parseInt(buyQuantityRaw, 10) : null,
    getQuantity: getQuantityRaw ? Number.parseInt(getQuantityRaw, 10) : null,
    getDiscountBps: getDiscountPctRaw
      ? Math.round(Number(getDiscountPctRaw.replace(",", ".")) * 100)
      : 10000,
    maxDiscount: maxDiscountRaw ? parseMoneyInput(maxDiscountRaw) : null,
    usageLimit: usageLimitRaw ? Number.parseInt(usageLimitRaw, 10) : null,
    usagePerCustomer: usagePerCustomerRaw ? Number.parseInt(usagePerCustomerRaw, 10) : null,
    startsAt: startsAtRaw ? new Date(startsAtRaw) : null,
    endsAt: endsAtRaw ? new Date(endsAtRaw) : null,
    isActive: formData.get("isActive") !== "false",
    isCombinable: formData.get("isCombinable") === "on",
    priority: Number.parseInt(String(formData.get("priority") ?? "0"), 10) || 0,
  });
}

export async function togglePromotionActiveAction(
  id: string,
  isActive: boolean
): Promise<{ ok: boolean; error?: string }> {
  const staff = await requireStaff("promotions.manage");
  const updated = await db.promotion.update({
    where: { id },
    data: { isActive },
  });

  await recordAudit({
    staffUserId: staff.id,
    action: "promotion.toggle",
    entityType: "Promotion",
    entityId: updated.id,
    summary: `${updated.name} durumu ${isActive ? "aktif" : "pasif"} yapıldı`,
  });

  revalidatePath("/admin/promosyonlar");
  return { ok: true };
}

export async function deletePromotionAction(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const staff = await requireStaff("promotions.manage");
  const promo = await db.promotion.findUnique({ where: { id } });
  if (!promo) {
    return { ok: false, error: "Kampanya bulunamadı." };
  }

  await db.promotion.delete({ where: { id } });
  await recordAudit({
    staffUserId: staff.id,
    action: "promotion.delete",
    entityType: "Promotion",
    entityId: id,
    summary: `${promo.name} (${promo.code ?? "Otomatik"}) kampanyası silindi`,
  });

  revalidatePath("/admin/promosyonlar");
  return { ok: true };
}
