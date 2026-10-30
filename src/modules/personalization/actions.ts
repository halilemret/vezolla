"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { requireStaff, SEGMENT_PREVIEW_COOKIE } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import {
  adMappingInputSchema,
  experimentInputSchema,
  merchRuleInputSchema,
  segmentInputSchema,
  type SegmentCondition,
  type SegmentRuleField,
  type SegmentRuleGroup,
  type SegmentRuleOperator,
} from "@/modules/personalization/schemas";
import { rebuildProductAssociations } from "@/modules/personalization/recommendations";

function parseIdList(formData: FormData, key: string): string[] {
  const rawAll = formData.getAll(key);
  const result: string[] = [];
  for (const item of rawAll) {
    if (typeof item === "string") {
      for (const part of item.split(",")) {
        const trimmed = part.trim();
        if (trimmed && !result.includes(trimmed)) {
          result.push(trimmed);
        }
      }
    }
  }
  return result;
}

export async function saveSegmentAction(formData: FormData): Promise<void> {
  const staff = await requireStaff("personalization.manage");

  const id = String(formData.get("id") ?? "").trim() || undefined;
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || undefined;
  const priority = Number(formData.get("priority") ?? 0);
  const isActive = formData.get("isActive") !== "false";
  const match = String(formData.get("match") ?? "ALL") === "ANY" ? "ANY" : "ALL";
  const rawRulesJson = String(formData.get("rulesJson") ?? "").trim();

  let ruleGroup: SegmentRuleGroup = { match, conditions: [] };

  if (rawRulesJson) {
    try {
      const parsedJson = JSON.parse(rawRulesJson) as SegmentRuleGroup;
      if (parsedJson && typeof parsedJson === "object") {
        ruleGroup = {
          match: parsedJson.match === "ANY" ? "ANY" : "ALL",
          conditions: Array.isArray(parsedJson.conditions) ? parsedJson.conditions : [],
          groups: Array.isArray(parsedJson.groups) ? parsedJson.groups : undefined,
        };
      }
    } catch {
      // JSON parse edilemezse form alanlarından devam et
    }
  } else {
    const fields = formData.getAll("conditionField").map((v) => String(v).trim());
    const operators = formData.getAll("conditionOperator").map((v) => String(v).trim());
    const values = formData.getAll("conditionValue").map((v) => String(v).trim());

    const conditions: SegmentCondition[] = [];
    for (let i = 0; i < fields.length; i += 1) {
      const field = fields[i] as SegmentRuleField | undefined;
      const rawOperator = (operators[i] || "eq") as SegmentRuleOperator;
      const rawVal = values[i] ?? "";

      if (!field) continue;

      if (field === "abandoned_cart" || field === "first_visit") {
        const boolVal =
          rawOperator === "is_false" || rawVal === "false" || rawVal === "0" ? false : true;
        conditions.push({
          field,
          operator: boolVal ? "is_true" : "is_false",
          value: boolVal,
        });
      } else if (field === "min_orders" || field === "total_spent_min") {
        const numVal = Number(rawVal);
        if (Number.isFinite(numVal)) {
          conditions.push({
            field,
            operator: rawOperator === "lte" || rawOperator === "eq" ? rawOperator : "gte",
            value: numVal,
          });
        }
      } else if (rawVal) {
        conditions.push({
          field,
          operator: rawOperator,
          value: rawVal,
        });
      }
    }
    ruleGroup = { match, conditions };
  }

  const parsed = segmentInputSchema.safeParse({
    id,
    name,
    description,
    priority: Number.isFinite(priority) ? priority : 0,
    isActive,
    rules: ruleGroup,
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Segment bilgileri doğrulanamadı.");
  }

  const data = parsed.data;
  const before = id ? await db.segment.findUnique({ where: { id } }) : null;

  const saved = id
    ? await db.segment.update({
        where: { id },
        data: {
          name: data.name,
          description: data.description ?? null,
          priority: data.priority,
          isActive: data.isActive,
          rules: data.rules as unknown as Prisma.InputJsonValue,
        },
      })
    : await db.segment.create({
        data: {
          name: data.name,
          description: data.description ?? null,
          priority: data.priority,
          isActive: data.isActive,
          rules: data.rules as unknown as Prisma.InputJsonValue,
        },
      });

  await recordAudit({
    staffUserId: staff.id,
    action: id ? "segment.update" : "segment.create",
    entityType: "Segment",
    entityId: saved.id,
    summary: `Segment kaydedildi: ${saved.name} (öncelik: ${saved.priority})`,
    before: before ? (before as unknown as Prisma.InputJsonValue) : null,
    after: saved as unknown as Prisma.InputJsonValue,
  });

  revalidatePath("/admin/kisisellestirme");
  revalidatePath("/");
}

export async function toggleSegmentAction(formData: FormData): Promise<void> {
  const staff = await requireStaff("personalization.manage");
  const id = String(formData.get("id") ?? "").trim();
  const isActive = formData.get("isActive") === "true";
  if (!id) return;

  const updated = await db.segment.update({
    where: { id },
    data: { isActive },
  });

  await recordAudit({
    staffUserId: staff.id,
    action: "segment.toggle",
    entityType: "Segment",
    entityId: id,
    summary: `Segment durumu değiştirildi: ${updated.name} -> ${isActive ? "Aktif" : "Pasif"}`,
  });

  revalidatePath("/admin/kisisellestirme");
  revalidatePath("/");
}

export async function deleteSegmentAction(formData: FormData): Promise<void> {
  const staff = await requireStaff("personalization.manage");
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const existing = await db.segment.findUnique({ where: { id } });
  if (!existing) return;

  await db.segment.delete({ where: { id } });

  await recordAudit({
    staffUserId: staff.id,
    action: "segment.delete",
    entityType: "Segment",
    entityId: id,
    summary: `Segment silindi: ${existing.name}`,
    before: existing as unknown as Prisma.InputJsonValue,
  });

  revalidatePath("/admin/kisisellestirme");
  revalidatePath("/");
}

export async function saveAdMappingAction(formData: FormData): Promise<void> {
  const staff = await requireStaff("personalization.manage");

  const id = String(formData.get("id") ?? "").trim() || undefined;
  const name = String(formData.get("name") ?? "").trim();
  const platform = String(formData.get("platform") ?? "META").trim().toUpperCase();
  const matchField = String(formData.get("matchField") ?? "ad_id").trim();
  const matchValue = String(formData.get("matchValue") ?? "").trim();
  const segmentId = String(formData.get("segmentId") ?? "").trim() || null;
  const featuredProductIds = parseIdList(formData, "featuredProductIds");
  const isActive = formData.get("isActive") !== "false";

  const parsed = adMappingInputSchema.safeParse({
    id,
    name,
    platform,
    matchField,
    matchValue,
    segmentId,
    featuredProductIds,
    isActive,
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Reklam eşleştirmesi doğrulanamadı.");
  }

  const data = parsed.data;
  const before = id ? await db.adMapping.findUnique({ where: { id } }) : null;

  const saved = id
    ? await db.adMapping.update({
        where: { id },
        data: {
          name: data.name,
          platform: data.platform,
          matchField: data.matchField,
          matchValue: data.matchValue,
          segmentId: data.segmentId ?? null,
          featuredProductIds: data.featuredProductIds,
          isActive: data.isActive,
        },
      })
    : await db.adMapping.upsert({
        where: {
          matchField_matchValue: {
            matchField: data.matchField,
            matchValue: data.matchValue,
          },
        },
        create: {
          name: data.name,
          platform: data.platform,
          matchField: data.matchField,
          matchValue: data.matchValue,
          segmentId: data.segmentId ?? null,
          featuredProductIds: data.featuredProductIds,
          isActive: data.isActive,
        },
        update: {
          name: data.name,
          platform: data.platform,
          segmentId: data.segmentId ?? null,
          featuredProductIds: data.featuredProductIds,
          isActive: data.isActive,
        },
      });

  await recordAudit({
    staffUserId: staff.id,
    action: id ? "ad_mapping.update" : "ad_mapping.upsert",
    entityType: "AdMapping",
    entityId: saved.id,
    summary: `Reklam eşleştirmesi kaydedildi: ${saved.name} (${saved.matchField}=${saved.matchValue})`,
    before: before ? (before as unknown as Prisma.InputJsonValue) : null,
    after: saved as unknown as Prisma.InputJsonValue,
  });

  revalidatePath("/admin/kisisellestirme");
  revalidatePath("/");
}

export async function toggleAdMappingAction(formData: FormData): Promise<void> {
  const staff = await requireStaff("personalization.manage");
  const id = String(formData.get("id") ?? "").trim();
  const isActive = formData.get("isActive") === "true";
  if (!id) return;

  const updated = await db.adMapping.update({
    where: { id },
    data: { isActive },
  });

  await recordAudit({
    staffUserId: staff.id,
    action: "ad_mapping.toggle",
    entityType: "AdMapping",
    entityId: id,
    summary: `Reklam eşleştirmesi durumu: ${updated.name} -> ${isActive ? "Aktif" : "Pasif"}`,
  });

  revalidatePath("/admin/kisisellestirme");
  revalidatePath("/");
}

export async function deleteAdMappingAction(formData: FormData): Promise<void> {
  const staff = await requireStaff("personalization.manage");
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const existing = await db.adMapping.findUnique({ where: { id } });
  if (!existing) return;

  await db.adMapping.delete({ where: { id } });

  await recordAudit({
    staffUserId: staff.id,
    action: "ad_mapping.delete",
    entityType: "AdMapping",
    entityId: id,
    summary: `Reklam eşleştirmesi silindi: ${existing.name}`,
    before: existing as unknown as Prisma.InputJsonValue,
  });

  revalidatePath("/admin/kisisellestirme");
  revalidatePath("/");
}

export async function saveMerchRuleAction(formData: FormData): Promise<void> {
  const staff = await requireStaff("personalization.manage");

  const id = String(formData.get("id") ?? "").trim() || undefined;
  const name = String(formData.get("name") ?? "").trim();
  const segmentId = String(formData.get("segmentId") ?? "").trim() || null;
  const scope = String(formData.get("scope") ?? "ALL").trim().toUpperCase();
  const categoryId = String(formData.get("categoryId") ?? "").trim() || null;
  const searchTerm = String(formData.get("searchTerm") ?? "").trim() || null;
  const action = String(formData.get("action") ?? "PIN").trim().toUpperCase();
  const productIds = parseIdList(formData, "productIds");
  const weightRaw = Number(formData.get("weight") ?? 2);
  const priorityRaw = Number(formData.get("priority") ?? 0);
  const startsAtRaw = String(formData.get("startsAt") ?? "").trim() || null;
  const endsAtRaw = String(formData.get("endsAt") ?? "").trim() || null;
  const isActive = formData.get("isActive") !== "false";

  const parsed = merchRuleInputSchema.safeParse({
    id,
    name,
    segmentId,
    scope,
    categoryId,
    searchTerm,
    action,
    productIds,
    weight: Number.isFinite(weightRaw) && weightRaw > 0 ? weightRaw : 2,
    priority: Number.isFinite(priorityRaw) ? priorityRaw : 0,
    startsAt: startsAtRaw,
    endsAt: endsAtRaw,
    isActive,
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Sıralama kuralı doğrulanamadı.");
  }

  const data = parsed.data;
  const before = id ? await db.merchRule.findUnique({ where: { id } }) : null;

  const startsAt = data.startsAt ? new Date(data.startsAt) : null;
  const endsAt = data.endsAt ? new Date(data.endsAt) : null;

  const saved = id
    ? await db.merchRule.update({
        where: { id },
        data: {
          name: data.name,
          segmentId: data.segmentId ?? null,
          scope: data.scope,
          categoryId: data.categoryId ?? null,
          searchTerm: data.searchTerm ?? null,
          action: data.action,
          productIds: data.productIds,
          weight: data.weight,
          priority: data.priority,
          startsAt: startsAt && Number.isFinite(startsAt.getTime()) ? startsAt : null,
          endsAt: endsAt && Number.isFinite(endsAt.getTime()) ? endsAt : null,
          isActive: data.isActive,
        },
      })
    : await db.merchRule.create({
        data: {
          name: data.name,
          segmentId: data.segmentId ?? null,
          scope: data.scope,
          categoryId: data.categoryId ?? null,
          searchTerm: data.searchTerm ?? null,
          action: data.action,
          productIds: data.productIds,
          weight: data.weight,
          priority: data.priority,
          startsAt: startsAt && Number.isFinite(startsAt.getTime()) ? startsAt : null,
          endsAt: endsAt && Number.isFinite(endsAt.getTime()) ? endsAt : null,
          isActive: data.isActive,
        },
      });

  await recordAudit({
    staffUserId: staff.id,
    action: id ? "merch_rule.update" : "merch_rule.create",
    entityType: "MerchRule",
    entityId: saved.id,
    summary: `Sıralama kuralı kaydedildi: ${saved.name} (${saved.action}, kapsam: ${saved.scope})`,
    before: before ? (before as unknown as Prisma.InputJsonValue) : null,
    after: saved as unknown as Prisma.InputJsonValue,
  });

  revalidatePath("/admin/kisisellestirme");
  revalidatePath("/katalog");
  revalidatePath("/");
}

export async function toggleMerchRuleAction(formData: FormData): Promise<void> {
  const staff = await requireStaff("personalization.manage");
  const id = String(formData.get("id") ?? "").trim();
  const isActive = formData.get("isActive") === "true";
  if (!id) return;

  const updated = await db.merchRule.update({
    where: { id },
    data: { isActive },
  });

  await recordAudit({
    staffUserId: staff.id,
    action: "merch_rule.toggle",
    entityType: "MerchRule",
    entityId: id,
    summary: `Sıralama kuralı durumu: ${updated.name} -> ${isActive ? "Aktif" : "Pasif"}`,
  });

  revalidatePath("/admin/kisisellestirme");
  revalidatePath("/katalog");
  revalidatePath("/");
}

export async function deleteMerchRuleAction(formData: FormData): Promise<void> {
  const staff = await requireStaff("personalization.manage");
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const existing = await db.merchRule.findUnique({ where: { id } });
  if (!existing) return;

  await db.merchRule.delete({ where: { id } });

  await recordAudit({
    staffUserId: staff.id,
    action: "merch_rule.delete",
    entityType: "MerchRule",
    entityId: id,
    summary: `Sıralama kuralı silindi: ${existing.name}`,
    before: existing as unknown as Prisma.InputJsonValue,
  });

  revalidatePath("/admin/kisisellestirme");
  revalidatePath("/katalog");
  revalidatePath("/");
}

export async function createExperimentAction(formData: FormData): Promise<void> {
  const staff = await requireStaff("personalization.manage");

  const name = String(formData.get("name") ?? "").trim();
  const blockId = String(formData.get("blockId") ?? "").trim();
  const goal = String(formData.get("goal") ?? "purchase").trim();
  const status = String(formData.get("status") ?? "RUNNING").trim().toUpperCase();

  const variantBName = String(formData.get("variantBName") ?? "Varyant B (Alternatif)").trim();
  const variantBTitle = String(formData.get("variantBTitle") ?? "").trim();
  const variantBSource = String(formData.get("variantBSource") ?? "").trim();
  const variantAWeight = Math.max(1, Math.min(99, Number(formData.get("variantAWeight") ?? 50)));
  const variantBWeight = Math.max(1, Math.min(99, Number(formData.get("variantBWeight") ?? 50)));

  const parsed = experimentInputSchema.safeParse({
    name,
    blockId,
    goal,
    status,
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "A/B testi doğrulanamadı.");
  }

  const block = await db.homeBlock.findUnique({
    where: { id: blockId },
    include: { variants: { orderBy: { createdAt: "asc" } } },
  });

  if (!block) {
    throw new Error("Seçilen ana sayfa bloğu bulunamadı.");
  }

  const experiment = await db.experiment.create({
    data: {
      name: parsed.data.name,
      blockId: parsed.data.blockId,
      goal: parsed.data.goal,
      status: parsed.data.status,
      startedAt: parsed.data.status === "RUNNING" ? new Date() : null,
    },
  });

  const baseVariant = block.variants[0];
  if (baseVariant) {
    await db.homeBlockVariant.update({
      where: { id: baseVariant.id },
      data: {
        experimentId: experiment.id,
        weight: variantAWeight,
      },
    });
  } else {
    await db.homeBlockVariant.create({
      data: {
        blockId: block.id,
        experimentId: experiment.id,
        name: "Varyant A (Kontrol)",
        weight: variantAWeight,
        config: {
          title: block.name,
          source: "cold_start",
          limit: 8,
        } as Prisma.InputJsonValue,
      },
    });
  }

  const existingSecond = block.variants[1];
  if (existingSecond && !variantBTitle) {
    await db.homeBlockVariant.update({
      where: { id: existingSecond.id },
      data: {
        experimentId: experiment.id,
        weight: variantBWeight,
      },
    });
  } else {
    const baseConfig =
      baseVariant?.config &&
      typeof baseVariant.config === "object" &&
      !Array.isArray(baseVariant.config)
        ? { ...(baseVariant.config as Record<string, unknown>) }
        : {};

    if (variantBTitle) {
      if (block.type === "hero_banner") {
        baseConfig.headline = variantBTitle;
      } else {
        baseConfig.title = variantBTitle;
      }
    }
    if (variantBSource && block.type === "product_rail") {
      baseConfig.source = variantBSource;
    }

    await db.homeBlockVariant.create({
      data: {
        blockId: block.id,
        experimentId: experiment.id,
        name: variantBName || "Varyant B",
        weight: variantBWeight,
        config: baseConfig as Prisma.InputJsonValue,
      },
    });
  }

  await recordAudit({
    staffUserId: staff.id,
    action: "experiment.create",
    entityType: "Experiment",
    entityId: experiment.id,
    summary: `Blok A/B testi oluşturuldu: ${experiment.name} (${block.name})`,
    after: experiment as unknown as Prisma.InputJsonValue,
  });

  revalidatePath("/admin/kisisellestirme");
  revalidatePath("/admin/icerik/bloklar");
  revalidatePath("/");
}

export async function updateExperimentStatusAction(formData: FormData): Promise<void> {
  const staff = await requireStaff("personalization.manage");
  const id = String(formData.get("id") ?? "").trim();
  const statusRaw = String(formData.get("status") ?? "RUNNING").trim().toUpperCase();
  if (!id) return;

  const status =
    statusRaw === "PAUSED"
      ? "PAUSED"
      : statusRaw === "COMPLETED"
        ? "COMPLETED"
        : statusRaw === "DRAFT"
          ? "DRAFT"
          : "RUNNING";

  const existing = await db.experiment.findUnique({ where: { id } });
  if (!existing) return;

  const updated = await db.experiment.update({
    where: { id },
    data: {
      status,
      ...(status === "RUNNING" && !existing.startedAt ? { startedAt: new Date() } : {}),
      ...(status === "COMPLETED" ? { endedAt: new Date() } : {}),
    },
  });

  await recordAudit({
    staffUserId: staff.id,
    action: "experiment.status",
    entityType: "Experiment",
    entityId: id,
    summary: `A/B testi durumu güncellendi: ${updated.name} -> ${status}`,
    before: existing as unknown as Prisma.InputJsonValue,
    after: updated as unknown as Prisma.InputJsonValue,
  });

  revalidatePath("/admin/kisisellestirme");
  revalidatePath("/");
}

export async function deleteExperimentAction(formData: FormData): Promise<void> {
  const staff = await requireStaff("personalization.manage");
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const existing = await db.experiment.findUnique({ where: { id } });
  if (!existing) return;

  await db.experiment.delete({ where: { id } });

  await recordAudit({
    staffUserId: staff.id,
    action: "experiment.delete",
    entityType: "Experiment",
    entityId: id,
    summary: `A/B testi silindi: ${existing.name}`,
    before: existing as unknown as Prisma.InputJsonValue,
  });

  revalidatePath("/admin/kisisellestirme");
  revalidatePath("/");
}

export async function rebuildProductAssociationsAction(): Promise<void> {
  const staff = await requireStaff("personalization.manage");
  const stats = await rebuildProductAssociations();

  await recordAudit({
    staffUserId: staff.id,
    action: "product_associations.rebuild",
    entityType: "ProductAssociation",
    summary: `Birlikte satın alma (${stats.coPurchaseCount}) ve görüntüleme (${stats.coViewCount}) ilişkileri yeniden hesaplandı.`,
    after: stats as unknown as Prisma.InputJsonValue,
  });

  revalidatePath("/admin/kisisellestirme");
  revalidatePath("/");
}

export async function activateStorefrontPreviewAction(formData: FormData): Promise<void> {
  await requireStaff("personalization.manage");

  const segmentId = String(formData.get("segmentId") ?? "").trim();
  const adMappingId = String(formData.get("adMappingId") ?? "").trim();
  const customAdId = String(formData.get("ad_id") ?? "").trim();
  const customCampaignId = String(formData.get("campaign_id") ?? "").trim();
  const customUtmCampaign = String(formData.get("utm_campaign") ?? "").trim();
  const customUtmSource = String(formData.get("utm_source") ?? "").trim();
  const openStorefront = formData.get("openStorefront") === "true";

  let effectiveSegmentId = segmentId;
  const query = new URLSearchParams();

  if (adMappingId) {
    const mapping = await db.adMapping.findUnique({ where: { id: adMappingId } });
    if (mapping) {
      query.set(mapping.matchField, mapping.matchValue);
      if (!effectiveSegmentId && mapping.segmentId) {
        effectiveSegmentId = mapping.segmentId;
      }
    }
  }

  if (customAdId) query.set("ad_id", customAdId);
  if (customCampaignId) query.set("campaign_id", customCampaignId);
  if (customUtmCampaign) query.set("utm_campaign", customUtmCampaign);
  if (customUtmSource) query.set("utm_source", customUtmSource);

  const cookieStore = await cookies();
  if (effectiveSegmentId) {
    cookieStore.set(SEGMENT_PREVIEW_COOKIE, effectiveSegmentId, {
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 4,
    });
  } else {
    cookieStore.delete(SEGMENT_PREVIEW_COOKIE);
  }

  revalidatePath("/");
  revalidatePath("/admin/kisisellestirme");

  if (openStorefront) {
    const qs = query.toString();
    redirect(qs ? `/?${qs}` : "/");
  }
}

export async function clearStorefrontPreviewAction(): Promise<void> {
  await requireStaff("personalization.manage");
  const cookieStore = await cookies();
  cookieStore.delete(SEGMENT_PREVIEW_COOKIE);
  revalidatePath("/");
  revalidatePath("/admin/kisisellestirme");
}
