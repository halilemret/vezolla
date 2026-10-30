"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import { parseMoneyInput } from "@/lib/money";
import type { Prisma } from "@/generated/prisma/client";
import { weightRuleSchema } from "@/modules/shipping/service";

const shippingMethodInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Kargo yöntemi adı en az 2 karakter olmalıdır."),
  description: z.string().trim().optional().nullable(),
  carrier: z.string().trim().optional().nullable(),
  price: z.number().int().min(0),
  freeOverAmount: z.number().int().min(0).optional().nullable(),
  cities: z.array(z.string()).default([]),
  weightRules: z.array(weightRuleSchema).default([]),
  estimatedDays: z.string().trim().optional().nullable(),
  isActive: z.boolean().default(true),
  position: z.number().int().default(0),
});

export type ShippingMethodInput = z.infer<typeof shippingMethodInputSchema>;

export async function saveShippingMethodAction(
  input: ShippingMethodInput
): Promise<{ ok: boolean; error?: string; id?: string }> {
  const staff = await requireStaff("settings.manage");
  const parsed = shippingMethodInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Geçersiz kargo yöntemi verisi.",
    };
  }

  const data = parsed.data;
  const payload = {
    name: data.name,
    description: data.description ?? null,
    carrier: data.carrier ?? null,
    price: data.price,
    freeOverAmount:
      data.freeOverAmount != null && data.freeOverAmount > 0 ? data.freeOverAmount : null,
    cities: data.cities,
    weightRules: data.weightRules as unknown as Prisma.InputJsonValue,
    estimatedDays: data.estimatedDays ?? null,
    isActive: data.isActive,
    position: data.position,
  };

  if (data.id) {
    const updated = await db.shippingMethod.update({
      where: { id: data.id },
      data: payload,
    });
    await recordAudit({
      staffUserId: staff.id,
      action: "shipping_method.update",
      entityType: "ShippingMethod",
      entityId: updated.id,
      summary: `${updated.name} kargo yöntemi güncellendi`,
    });
    revalidatePath("/admin/ayarlar");
    return { ok: true, id: updated.id };
  }

  const created = await db.shippingMethod.create({
    data: payload,
  });

  await recordAudit({
    staffUserId: staff.id,
    action: "shipping_method.create",
    entityType: "ShippingMethod",
    entityId: created.id,
    summary: `${created.name} kargo yöntemi eklendi`,
  });

  revalidatePath("/admin/ayarlar");
  return { ok: true, id: created.id };
}

export async function saveShippingMethodFromFormAction(
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  const id = String(formData.get("id") ?? "").trim() || undefined;
  const price = parseMoneyInput(String(formData.get("price") ?? "0"));
  const freeOverRaw = String(formData.get("freeOverAmount") ?? "").trim();
  const citiesRaw = String(formData.get("cities") ?? "").trim();
  const cities = citiesRaw
    ? citiesRaw
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean)
    : [];

  let weightRules: Array<{ maxGrams: number; price: number }> = [];
  const weightRulesRaw = String(formData.get("weightRulesJson") ?? "").trim();
  if (weightRulesRaw) {
    try {
      const parsedJson = JSON.parse(weightRulesRaw) as unknown;
      if (Array.isArray(parsedJson)) {
        weightRules = parsedJson
          .map((item) => weightRuleSchema.safeParse(item))
          .filter((r) => r.success)
          .map((r) => r.data);
      }
    } catch {
      weightRules = [];
    }
  }

  return saveShippingMethodAction({
    id,
    name: String(formData.get("name") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || null,
    carrier: String(formData.get("carrier") ?? "").trim() || null,
    price,
    freeOverAmount: freeOverRaw ? parseMoneyInput(freeOverRaw) : null,
    cities,
    weightRules,
    estimatedDays: String(formData.get("estimatedDays") ?? "").trim() || null,
    isActive: formData.get("isActive") !== "false",
    position: Number.parseInt(String(formData.get("position") ?? "0"), 10) || 0,
  });
}

export async function deleteShippingMethodAction(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const staff = await requireStaff("settings.manage");
  const method = await db.shippingMethod.findUnique({ where: { id } });
  if (!method) {
    return { ok: false, error: "Kargo yöntemi bulunamadı." };
  }

  await db.shippingMethod.delete({ where: { id } });
  await recordAudit({
    staffUserId: staff.id,
    action: "shipping_method.delete",
    entityType: "ShippingMethod",
    entityId: id,
    summary: `${method.name} kargo yöntemi silindi`,
  });

  revalidatePath("/admin/ayarlar");
  return { ok: true };
}
