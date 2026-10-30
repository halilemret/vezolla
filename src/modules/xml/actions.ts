"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import { savePrivateFile } from "@/lib/storage";
import { slugify } from "@/lib/slug";
import type { Prisma } from "@/generated/prisma/client";
import {
  customExportTemplateSchema,
  DEFAULT_CUSTOM_EXPORT_TEMPLATE,
  DEFAULT_FEED_MAPPING,
  DEFAULT_FEED_TRANSFORM,
  DEFAULT_FEED_UPDATE_POLICY,
  exportFeedFiltersSchema,
  feedMappingSchema,
  feedTransformSchema,
  feedUpdatePolicySchema,
  parseCustomExportTemplate,
  parseExportFeedFilters,
  parseFeedMapping,
  parseFeedTransform,
  parseFeedUpdatePolicy,
  type CustomExportTemplate,
  type ExportFeedFilters,
  type FeedMapping,
  type FeedPreviewSampleItem,
  type FeedRunErrorItem,
  type FeedRunStats,
  type FeedTransform,
  type FeedUpdatePolicy,
} from "@/modules/xml/schemas";
import {
  inspectXmlStructure,
  loadFeedXmlBuffer,
  type XmlStructureInspection,
} from "@/modules/xml/parser";
import {
  runFeedImport,
  type RunFeedImportResult,
} from "@/modules/xml/importer";

function parseHeadersText(raw: string): Record<string, string> {
  const trimmed = raw.trim();
  if (!trimmed) return {};

  if (trimmed.startsWith("{")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        const out: Record<string, string> = {};
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === "string" || typeof v === "number") {
            out[k.trim()] = String(v);
          }
        }
        return out;
      }
    } catch {
      // Satır bazlı ayrıştırmaya devam et
    }
  }

  const out: Record<string, string> = {};
  for (const line of trimmed.split(/\r?\n/)) {
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      const val = line.slice(colonIdx + 1).trim();
      if (key && val) {
        out[key] = val;
      }
    }
  }
  return out;
}

export async function createFeedSourceAction(
  formData: FormData
): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const staff = await requireStaff("xml.manage");

    const name = String(formData.get("name") ?? "").trim();
    const kindRaw = String(formData.get("kind") ?? "URL").trim();
    const kind: "URL" | "FILE" = kindRaw === "FILE" ? "FILE" : "URL";
    const url = String(formData.get("url") ?? "").trim() || null;
    const authType = String(formData.get("authType") ?? "none").trim();
    const authUser = String(formData.get("authUser") ?? "").trim() || null;
    const authPassword = String(formData.get("authPassword") ?? "").trim() || null;
    const headersText = String(formData.get("headersText") ?? "").trim();
    const warehouseId = String(formData.get("warehouseId") ?? "").trim() || null;
    const createAsStatusRaw = String(formData.get("createAsStatus") ?? "DRAFT");
    const createAsStatus: "DRAFT" | "ACTIVE" =
      createAsStatusRaw === "ACTIVE" ? "ACTIVE" : "DRAFT";

    if (!name) {
      return { ok: false, error: "Kaynak adı zorunludur." };
    }

    let fileKey: string | null = null;
    if (kind === "FILE") {
      const fileEntry = formData.get("xmlFile");
      if (!(fileEntry instanceof File) || fileEntry.size === 0) {
        return {
          ok: false,
          error: "Lütfen geçerli bir .xml, .xml.gz veya .zip dosyası seçin.",
        };
      }
      const buffer = Buffer.from(await fileEntry.arrayBuffer());
      fileKey = await savePrivateFile("xml-feeds", fileEntry.name, buffer);
    } else if (!url) {
      return { ok: false, error: "XML URL adresi zorunludur." };
    }

    const headersObj = parseHeadersText(headersText);

    const created = await db.feedSource.create({
      data: {
        name,
        kind,
        url: kind === "URL" ? url : null,
        authType,
        authUser,
        authPassword,
        headers: headersObj as unknown as Prisma.InputJsonValue,
        fileKey,
        mapping: DEFAULT_FEED_MAPPING as unknown as Prisma.InputJsonValue,
        transform: DEFAULT_FEED_TRANSFORM as unknown as Prisma.InputJsonValue,
        updatePolicy: DEFAULT_FEED_UPDATE_POLICY as unknown as Prisma.InputJsonValue,
        warehouseId,
        createAsStatus,
      },
    });

    // İlk yapı analizini otomatik çalıştırmayı dene
    try {
      const xmlBuffer = await loadFeedXmlBuffer(created);
      const inspection = inspectXmlStructure(xmlBuffer);
      if (inspection.selectedItemPath) {
        await db.feedSource.update({
          where: { id: created.id },
          data: {
            itemPath: inspection.selectedItemPath,
            mapping: inspection.suggestedMapping as unknown as Prisma.InputJsonValue,
          },
        });
      }
      for (const cat of inspection.categories) {
        await db.feedCategoryMap.upsert({
          where: {
            sourceId_sourceCategory: {
              sourceId: created.id,
              sourceCategory: cat.name,
            },
          },
          create: {
            sourceId: created.id,
            sourceCategory: cat.name,
            itemCount: cat.count,
          },
          update: {
            itemCount: cat.count,
          },
        });
      }
    } catch {
      // İlk bağlantı analizi başarısız olsa bile kaynak kaydı korunur, detay sayfasında tekrar denenebilir
    }

    await recordAudit({
      staffUserId: staff.id,
      action: "xml.source.create",
      entityType: "FeedSource",
      entityId: created.id,
      summary: `XML tedarikçi kaynağı oluşturuldu: ${created.name}`,
    });

    revalidatePath("/admin/xml/kaynaklar");
    return { ok: true, id: created.id };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Kaynak oluşturulurken hata oluştu.",
    };
  }
}

export async function updateFeedSourceConnectionAction(
  sourceId: string,
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  try {
    const staff = await requireStaff("xml.manage");
    const existing = await db.feedSource.findUnique({ where: { id: sourceId } });
    if (!existing) {
      return { ok: false, error: "XML kaynağı bulunamadı." };
    }

    const name = String(formData.get("name") ?? existing.name).trim();
    const url = String(formData.get("url") ?? "").trim() || null;
    const authType = String(formData.get("authType") ?? existing.authType).trim();
    const authUser = String(formData.get("authUser") ?? "").trim() || null;
    const authPassword = String(formData.get("authPassword") ?? "").trim() || null;
    const headersText = String(formData.get("headersText") ?? "").trim();

    let fileKey = existing.fileKey;
    const fileEntry = formData.get("xmlFile");
    if (fileEntry instanceof File && fileEntry.size > 0) {
      const buffer = Buffer.from(await fileEntry.arrayBuffer());
      fileKey = await savePrivateFile("xml-feeds", fileEntry.name, buffer);
    }

    const headersObj = parseHeadersText(headersText);

    await db.feedSource.update({
      where: { id: sourceId },
      data: {
        name: name || existing.name,
        url: existing.kind === "URL" ? url : null,
        authType,
        authUser,
        authPassword: authPassword ?? existing.authPassword,
        headers: headersObj as unknown as Prisma.InputJsonValue,
        fileKey,
      },
    });

    await recordAudit({
      staffUserId: staff.id,
      action: "xml.source.update_connection",
      entityType: "FeedSource",
      entityId: sourceId,
      summary: `XML kaynağı bağlantı ayarları güncellendi: ${name}`,
    });

    revalidatePath("/admin/xml/kaynaklar");
    revalidatePath(`/admin/xml/kaynaklar/${sourceId}`);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "Bağlantı bilgileri güncellenemedi.",
    };
  }
}

export async function inspectAndSaveItemPathAction(
  sourceId: string,
  preferredItemPath?: string
): Promise<{
  ok: boolean;
  inspection?: XmlStructureInspection;
  error?: string;
}> {
  try {
    await requireStaff("xml.manage");
    const source = await db.feedSource.findUnique({ where: { id: sourceId } });
    if (!source) {
      return { ok: false, error: "XML kaynağı bulunamadı." };
    }

    const currentMapping = parseFeedMapping(source.mapping);
    const xmlBuffer = await loadFeedXmlBuffer(source);
    const inspection = inspectXmlStructure(xmlBuffer, {
      preferredItemPath: preferredItemPath ?? source.itemPath,
      categoryPath: currentMapping.categoryPath,
    });

    if (inspection.selectedItemPath) {
      await db.feedSource.update({
        where: { id: source.id },
        data: {
          itemPath: inspection.selectedItemPath,
          mapping: (source.mapping
            ? currentMapping
            : inspection.suggestedMapping) as unknown as Prisma.InputJsonValue,
        },
      });
    }

    for (const cat of inspection.categories) {
      await db.feedCategoryMap.upsert({
        where: {
          sourceId_sourceCategory: {
            sourceId: source.id,
            sourceCategory: cat.name,
          },
        },
        create: {
          sourceId: source.id,
          sourceCategory: cat.name,
          itemCount: cat.count,
        },
        update: {
          itemCount: cat.count,
        },
      });
    }

    revalidatePath(`/admin/xml/kaynaklar/${sourceId}`);
    return { ok: true, inspection };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "XML yapısı çözümlenemedi.",
    };
  }
}

export async function saveFeedMappingAction(
  sourceId: string,
  input: {
    itemPath: string;
    mapping: FeedMapping;
    matchKey: "SKU" | "BARCODE" | "SUPPLIER_CODE";
  }
): Promise<{ ok: boolean; error?: string }> {
  try {
    const staff = await requireStaff("xml.manage");
    const validatedMapping = feedMappingSchema.parse(input.mapping);

    const source = await db.feedSource.update({
      where: { id: sourceId },
      data: {
        itemPath: input.itemPath.trim() || null,
        mapping: validatedMapping as unknown as Prisma.InputJsonValue,
        matchKey: input.matchKey,
      },
    });

    // Kategori yolu değiştiyse XML'den kategorileri yeniden tara
    try {
      const xmlBuffer = await loadFeedXmlBuffer(source);
      const inspection = inspectXmlStructure(xmlBuffer, {
        preferredItemPath: source.itemPath,
        categoryPath: validatedMapping.categoryPath,
      });
      for (const cat of inspection.categories) {
        await db.feedCategoryMap.upsert({
          where: {
            sourceId_sourceCategory: {
              sourceId: source.id,
              sourceCategory: cat.name,
            },
          },
          create: {
            sourceId: source.id,
            sourceCategory: cat.name,
            itemCount: cat.count,
          },
          update: {
            itemCount: cat.count,
          },
        });
      }
    } catch {
      // Kategori yeniden tarama başarısız olursa mevcut eşleşmeler korunur
    }

    await recordAudit({
      staffUserId: staff.id,
      action: "xml.source.update_mapping",
      entityType: "FeedSource",
      entityId: sourceId,
      summary: `XML alan eşleştirmesi güncellendi: ${source.name}`,
    });

    revalidatePath(`/admin/xml/kaynaklar/${sourceId}`);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "Alan eşleştirmeleri kaydedilemedi.",
    };
  }
}

export async function saveFeedCategoryMappingsAction(
  sourceId: string,
  input: {
    unmatchedCategoryPolicy: "SKIP" | "DEFAULT" | "CREATE";
    defaultCategoryId: string | null;
    mappings: Array<{ sourceCategory: string; categoryId: string | null }>;
  }
): Promise<{ ok: boolean; error?: string }> {
  try {
    const staff = await requireStaff("xml.manage");

    await db.feedSource.update({
      where: { id: sourceId },
      data: {
        unmatchedCategoryPolicy: input.unmatchedCategoryPolicy,
        defaultCategoryId: input.defaultCategoryId || null,
      },
    });

    for (const row of input.mappings) {
      const cleanCat = row.sourceCategory.trim();
      if (!cleanCat) continue;
      await db.feedCategoryMap.upsert({
        where: {
          sourceId_sourceCategory: {
            sourceId,
            sourceCategory: cleanCat,
          },
        },
        create: {
          sourceId,
          sourceCategory: cleanCat,
          categoryId: row.categoryId || null,
        },
        update: {
          categoryId: row.categoryId || null,
        },
      });
    }

    await recordAudit({
      staffUserId: staff.id,
      action: "xml.source.update_categories",
      entityType: "FeedSource",
      entityId: sourceId,
      summary: `XML kategori eşleştirmeleri güncellendi (${input.mappings.length} satır)`,
    });

    revalidatePath(`/admin/xml/kaynaklar/${sourceId}`);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "Kategori eşleştirmeleri kaydedilemedi.",
    };
  }
}

export async function saveFeedRulesAndScheduleAction(
  sourceId: string,
  input: {
    transform: FeedTransform;
    updatePolicy: FeedUpdatePolicy;
    missingPolicy: "IGNORE" | "ZERO_STOCK" | "DRAFT";
    warehouseId: string | null;
    createAsStatus: "DRAFT" | "ACTIVE";
    scheduleMinutes: number | null;
    isActive: boolean;
  }
): Promise<{ ok: boolean; error?: string }> {
  try {
    const staff = await requireStaff("xml.manage");
    const validatedTransform = feedTransformSchema.parse(input.transform);
    const validatedPolicy = feedUpdatePolicySchema.parse(input.updatePolicy);

    const scheduleMinutes =
      input.scheduleMinutes && input.scheduleMinutes > 0
        ? Math.floor(input.scheduleMinutes)
        : null;
    const nextRunAt =
      scheduleMinutes && input.isActive
        ? new Date(Date.now() + scheduleMinutes * 60_000)
        : null;

    const updated = await db.feedSource.update({
      where: { id: sourceId },
      data: {
        transform: validatedTransform as unknown as Prisma.InputJsonValue,
        updatePolicy: validatedPolicy as unknown as Prisma.InputJsonValue,
        missingPolicy: input.missingPolicy,
        warehouseId: input.warehouseId || null,
        createAsStatus: input.createAsStatus,
        scheduleMinutes,
        nextRunAt,
        isActive: input.isActive,
      },
    });

    await recordAudit({
      staffUserId: staff.id,
      action: "xml.source.update_rules",
      entityType: "FeedSource",
      entityId: sourceId,
      summary: `XML fiyat/stok dönüşüm ve zamanlama kuralları güncellendi: ${updated.name}`,
    });

    revalidatePath("/admin/xml/kaynaklar");
    revalidatePath(`/admin/xml/kaynaklar/${sourceId}`);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "Dönüşüm ve zamanlama kuralları kaydedilemedi.",
    };
  }
}

export async function triggerFeedRunAction(
  sourceId: string,
  mode: "PREVIEW" | "APPLY"
): Promise<{ ok: boolean; result?: RunFeedImportResult; error?: string }> {
  try {
    const staff = await requireStaff("xml.manage");
    const result = await runFeedImport(sourceId, mode, "manual");

    await recordAudit({
      staffUserId: staff.id,
      action: mode === "PREVIEW" ? "xml.source.preview" : "xml.source.apply",
      entityType: "FeedSource",
      entityId: sourceId,
      summary: `XML ${
        mode === "PREVIEW" ? "önizleme" : "gerçek aktarım"
      } çalıştırıldı: ${result.stats.created} yeni, ${
        result.stats.updated
      } güncellendi`,
    });

    revalidatePath("/admin/xml/kaynaklar");
    revalidatePath(`/admin/xml/kaynaklar/${sourceId}`);
    revalidatePath("/admin/katalog/urunler");
    return { ok: true, result };
  } catch (err) {
    revalidatePath(`/admin/xml/kaynaklar/${sourceId}`);
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "XML senkronizasyonu çalıştırılırken hata oluştu.",
    };
  }
}

export async function deleteFeedSourceAction(
  sourceId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const staff = await requireStaff("xml.manage");
    const source = await db.feedSource.findUnique({ where: { id: sourceId } });
    if (!source) {
      return { ok: false, error: "XML kaynağı bulunamadı." };
    }

    await db.feedSource.delete({ where: { id: sourceId } });

    await recordAudit({
      staffUserId: staff.id,
      action: "xml.source.delete",
      entityType: "FeedSource",
      entityId: sourceId,
      summary: `XML kaynağı silindi: ${source.name}`,
    });

    revalidatePath("/admin/xml/kaynaklar");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "XML kaynağı silinemedi.",
    };
  }
}

export async function createExportFeedAction(input: {
  name: string;
  format: "GOOGLE" | "META" | "CUSTOM";
  filters: ExportFeedFilters;
  template?: CustomExportTemplate;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const staff = await requireStaff("xml.manage");
    const cleanName = input.name.trim();
    if (!cleanName) {
      return { ok: false, error: "Dışa aktarma feed adı zorunludur." };
    }

    const validatedFilters = exportFeedFiltersSchema.parse(input.filters);
    const validatedTemplate = input.template
      ? customExportTemplateSchema.parse(input.template)
      : DEFAULT_CUSTOM_EXPORT_TEMPLATE;

    const token = `${slugify(cleanName)}-${randomBytes(4).toString("hex")}`;

    const created = await db.exportFeed.create({
      data: {
        name: cleanName,
        format: input.format,
        token,
        filters: validatedFilters as unknown as Prisma.InputJsonValue,
        template:
          input.format === "CUSTOM"
            ? (validatedTemplate as unknown as Prisma.InputJsonValue)
            : undefined,
        isActive: true,
      },
    });

    await recordAudit({
      staffUserId: staff.id,
      action: "xml.export_feed.create",
      entityType: "ExportFeed",
      entityId: created.id,
      summary: `Dışa aktarma XML beslemesi oluşturuldu: ${created.name} (${created.format})`,
    });

    revalidatePath("/admin/xml/kaynaklar");
    return { ok: true, id: created.id };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "Dışa aktarma beslemesi oluşturulamadı.",
    };
  }
}

export async function toggleExportFeedActiveAction(
  feedId: string,
  isActive: boolean
): Promise<{ ok: boolean; error?: string }> {
  try {
    const staff = await requireStaff("xml.manage");
    const updated = await db.exportFeed.update({
      where: { id: feedId },
      data: { isActive },
    });

    await recordAudit({
      staffUserId: staff.id,
      action: "xml.export_feed.toggle",
      entityType: "ExportFeed",
      entityId: feedId,
      summary: `Dışa aktarma beslemesi durumu değiştirildi: ${updated.name} (${
        isActive ? "Aktif" : "Pasif"
      })`,
    });

    revalidatePath("/admin/xml/kaynaklar");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Besleme durumu güncellenemedi.",
    };
  }
}

export async function deleteExportFeedAction(
  feedId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const staff = await requireStaff("xml.manage");
    const feed = await db.exportFeed.findUnique({ where: { id: feedId } });
    if (!feed) {
      return { ok: false, error: "Dışa aktarma beslemesi bulunamadı." };
    }

    await db.exportFeed.delete({ where: { id: feedId } });

    await recordAudit({
      staffUserId: staff.id,
      action: "xml.export_feed.delete",
      entityType: "ExportFeed",
      entityId: feedId,
      summary: `Dışa aktarma beslemesi silindi: ${feed.name}`,
    });

    revalidatePath("/admin/xml/kaynaklar");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Besleme silinemedi.",
    };
  }
}

export interface XmlSourceListItemDto {
  id: string;
  name: string;
  kind: "URL" | "FILE";
  url: string | null;
  fileKey: string | null;
  itemPath: string | null;
  matchKey: "SKU" | "BARCODE" | "SUPPLIER_CODE";
  scheduleMinutes: number | null;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastStatus: string | null;
  isActive: boolean;
  linkedProductCount: number;
  runCount: number;
  categoryMapCount: number;
  lastRunStats: FeedRunStats | null;
}

export interface ExportFeedListItemDto {
  id: string;
  name: string;
  format: "GOOGLE" | "META" | "CUSTOM";
  token: string;
  filters: ExportFeedFilters;
  template: CustomExportTemplate;
  isActive: boolean;
  lastGeneratedAt: string | null;
  createdAt: string;
}

export interface XmlDashboardDataDto {
  sources: XmlSourceListItemDto[];
  exportFeeds: ExportFeedListItemDto[];
  warehouses: Array<{ id: string; name: string; code: string; isDefault: boolean }>;
  categories: Array<{ id: string; name: string; label: string }>;
  brands: Array<{ id: string; name: string }>;
  collections: Array<{ id: string; title: string }>;
}

function buildCategoryLabels(
  categories: Array<{ id: string; name: string; parentId: string | null }>
): Array<{ id: string; name: string; label: string }> {
  const byId = new Map(categories.map((c) => [c.id, c]));

  const getPathLabel = (cat: {
    id: string;
    name: string;
    parentId: string | null;
  }): string => {
    const parts: string[] = [cat.name];
    let currentParentId = cat.parentId;
    let guard = 0;
    while (currentParentId && guard < 10) {
      guard++;
      const parent = byId.get(currentParentId);
      if (!parent) break;
      parts.unshift(parent.name);
      currentParentId = parent.parentId;
    }
    return parts.join(" > ");
  };

  return categories
    .map((c) => ({
      id: c.id,
      name: c.name,
      label: getPathLabel(c),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "tr"));
}

function parseRunStats(raw: unknown): FeedRunStats | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return null;
  }
  const rec = raw as Record<string, unknown>;
  return {
    total: Number(rec.total ?? 0),
    created: Number(rec.created ?? 0),
    updated: Number(rec.updated ?? 0),
    unchanged: Number(rec.unchanged ?? 0),
    skipped: Number(rec.skipped ?? 0),
    failed: Number(rec.failed ?? 0),
    missing: Number(rec.missing ?? 0),
  };
}

function parseRunSample(raw: unknown): FeedPreviewSampleItem[] {
  if (!Array.isArray(raw)) return [];
  const list: FeedPreviewSampleItem[] = [];
  for (const el of raw) {
    if (typeof el === "object" && el !== null && !Array.isArray(el)) {
      const r = el as Record<string, unknown>;
      const actRaw = String(r.action ?? "UNCHANGED");
      const action: "CREATE" | "UPDATE" | "UNCHANGED" | "SKIP" =
        actRaw === "CREATE" ||
        actRaw === "UPDATE" ||
        actRaw === "SKIP" ||
        actRaw === "UNCHANGED"
          ? actRaw
          : "UNCHANGED";
      list.push({
        externalId: String(r.externalId ?? ""),
        matchValue: String(r.matchValue ?? ""),
        title: String(r.title ?? ""),
        action,
        reason: typeof r.reason === "string" ? r.reason : undefined,
        sourcePriceMinor: Number(r.sourcePriceMinor ?? 0),
        finalPriceMinor: Number(r.finalPriceMinor ?? 0),
        sourceStock: Number(r.sourceStock ?? 0),
        finalStock: Number(r.finalStock ?? 0),
        sourceCategory:
          typeof r.sourceCategory === "string" ? r.sourceCategory : null,
        targetCategoryName:
          typeof r.targetCategoryName === "string"
            ? r.targetCategoryName
            : null,
        variantCount: Number(r.variantCount ?? 1),
      });
    }
  }
  return list;
}

function parseRunErrors(raw: unknown): FeedRunErrorItem[] {
  if (!Array.isArray(raw)) return [];
  const list: FeedRunErrorItem[] = [];
  for (const el of raw) {
    if (typeof el === "object" && el !== null && !Array.isArray(el)) {
      const r = el as Record<string, unknown>;
      list.push({
        externalId: String(r.externalId ?? ""),
        message: String(r.message ?? ""),
      });
    }
  }
  return list;
}

export async function loadXmlSourcesDashboardAction(): Promise<XmlDashboardDataDto> {
  await requireStaff("xml.manage");

  const [sources, exportFeeds, warehouses, rawCategories, brands, collections] =
    await Promise.all([
      db.feedSource.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: {
              links: true,
              runs: true,
              categoryMaps: true,
            },
          },
          runs: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      }),
      db.exportFeed.findMany({
        orderBy: { createdAt: "desc" },
      }),
      db.warehouse.findMany({
        where: { isActive: true },
        orderBy: [{ isDefault: "desc" }, { priority: "asc" }],
        select: { id: true, name: true, code: true, isDefault: true },
      }),
      db.category.findMany({
        where: { isActive: true },
        select: { id: true, name: true, parentId: true },
      }),
      db.brand.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      db.collection.findMany({
        where: { isActive: true },
        orderBy: { title: "asc" },
        select: { id: true, title: true },
      }),
    ]);

  return {
    sources: sources.map((s) => ({
      id: s.id,
      name: s.name,
      kind: s.kind,
      url: s.url,
      fileKey: s.fileKey,
      itemPath: s.itemPath,
      matchKey: s.matchKey,
      scheduleMinutes: s.scheduleMinutes,
      nextRunAt: s.nextRunAt ? s.nextRunAt.toISOString() : null,
      lastRunAt: s.lastRunAt ? s.lastRunAt.toISOString() : null,
      lastStatus: s.lastStatus,
      isActive: s.isActive,
      linkedProductCount: s._count.links,
      runCount: s._count.runs,
      categoryMapCount: s._count.categoryMaps,
      lastRunStats: s.runs[0] ? parseRunStats(s.runs[0].stats) : null,
    })),
    exportFeeds: exportFeeds.map((f) => ({
      id: f.id,
      name: f.name,
      format: f.format,
      token: f.token,
      filters: parseExportFeedFilters(f.filters),
      template: parseCustomExportTemplate(f.template),
      isActive: f.isActive,
      lastGeneratedAt: f.lastGeneratedAt
        ? f.lastGeneratedAt.toISOString()
        : null,
      createdAt: f.createdAt.toISOString(),
    })),
    warehouses,
    categories: buildCategoryLabels(rawCategories),
    brands,
    collections,
  };
}

export interface FeedRunHistoryDto {
  id: string;
  mode: "PREVIEW" | "APPLY";
  status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";
  trigger: string;
  stats: FeedRunStats | null;
  errors: FeedRunErrorItem[];
  sample: FeedPreviewSampleItem[];
  message: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

export interface XmlSourceWizardDataDto {
  source: {
    id: string;
    name: string;
    kind: "URL" | "FILE";
    url: string | null;
    authType: string;
    authUser: string | null;
    headersText: string;
    fileKey: string | null;
    itemPath: string | null;
    mapping: FeedMapping;
    transform: FeedTransform;
    updatePolicy: FeedUpdatePolicy;
    matchKey: "SKU" | "BARCODE" | "SUPPLIER_CODE";
    missingPolicy: "IGNORE" | "ZERO_STOCK" | "DRAFT";
    unmatchedCategoryPolicy: "SKIP" | "DEFAULT" | "CREATE";
    defaultCategoryId: string | null;
    warehouseId: string | null;
    createAsStatus: "DRAFT" | "ACTIVE" | "ARCHIVED";
    scheduleMinutes: number | null;
    nextRunAt: string | null;
    lastRunAt: string | null;
    lastStatus: string | null;
    isActive: boolean;
    linkedProductCount: number;
  };
  categoryMaps: Array<{
    id: string;
    sourceCategory: string;
    categoryId: string | null;
    itemCount: number;
  }>;
  runs: FeedRunHistoryDto[];
  inspection: XmlStructureInspection | null;
  inspectionError: string | null;
  categories: Array<{ id: string; name: string; label: string }>;
  warehouses: Array<{ id: string; name: string; code: string; isDefault: boolean }>;
}

export async function loadXmlSourceWizardAction(
  sourceId: string
): Promise<XmlSourceWizardDataDto | null> {
  await requireStaff("xml.manage");

  const source = await db.feedSource.findUnique({
    where: { id: sourceId },
    include: {
      categoryMaps: {
        orderBy: [{ itemCount: "desc" }, { sourceCategory: "asc" }],
      },
      runs: {
        orderBy: { createdAt: "desc" },
        take: 15,
      },
      _count: {
        select: { links: true },
      },
    },
  });

  if (!source) return null;

  const [rawCategories, warehouses] = await Promise.all([
    db.category.findMany({
      where: { isActive: true },
      select: { id: true, name: true, parentId: true },
    }),
    db.warehouse.findMany({
      where: { isActive: true },
      orderBy: [{ isDefault: "desc" }, { priority: "asc" }],
      select: { id: true, name: true, code: true, isDefault: true },
    }),
  ]);

  const mapping = parseFeedMapping(source.mapping);
  const transform = parseFeedTransform(source.transform);
  const updatePolicy = parseFeedUpdatePolicy(source.updatePolicy);

  let inspection: XmlStructureInspection | null = null;
  let inspectionError: string | null = null;

  try {
    const xmlBuffer = await loadFeedXmlBuffer(source);
    inspection = inspectXmlStructure(xmlBuffer, {
      preferredItemPath: source.itemPath,
      categoryPath: mapping.categoryPath,
    });

    for (const cat of inspection.categories) {
      const existsInList = source.categoryMaps.some(
        (m) => m.sourceCategory === cat.name
      );
      if (!existsInList) {
        const upserted = await db.feedCategoryMap.upsert({
          where: {
            sourceId_sourceCategory: {
              sourceId: source.id,
              sourceCategory: cat.name,
            },
          },
          create: {
            sourceId: source.id,
            sourceCategory: cat.name,
            itemCount: cat.count,
          },
          update: {
            itemCount: cat.count,
          },
        });
        source.categoryMaps.push(upserted);
      }
    }
  } catch (err) {
    inspectionError =
      err instanceof Error
        ? err.message
        : "XML kaynağı okunurken hata oluştu.";
  }

  let headersText = "";
  if (
    typeof source.headers === "object" &&
    source.headers !== null &&
    !Array.isArray(source.headers)
  ) {
    headersText = Object.entries(source.headers as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${String(v ?? "")}`)
      .join("\n");
  }

  return {
    source: {
      id: source.id,
      name: source.name,
      kind: source.kind,
      url: source.url,
      authType: source.authType,
      authUser: source.authUser,
      headersText,
      fileKey: source.fileKey,
      itemPath: source.itemPath ?? inspection?.selectedItemPath ?? null,
      mapping,
      transform,
      updatePolicy,
      matchKey: source.matchKey,
      missingPolicy: source.missingPolicy,
      unmatchedCategoryPolicy: source.unmatchedCategoryPolicy,
      defaultCategoryId: source.defaultCategoryId,
      warehouseId: source.warehouseId,
      createAsStatus: source.createAsStatus,
      scheduleMinutes: source.scheduleMinutes,
      nextRunAt: source.nextRunAt ? source.nextRunAt.toISOString() : null,
      lastRunAt: source.lastRunAt ? source.lastRunAt.toISOString() : null,
      lastStatus: source.lastStatus,
      isActive: source.isActive,
      linkedProductCount: source._count.links,
    },
    categoryMaps: source.categoryMaps.map((m) => ({
      id: m.id,
      sourceCategory: m.sourceCategory,
      categoryId: m.categoryId,
      itemCount: m.itemCount,
    })),
    runs: source.runs.map((r) => ({
      id: r.id,
      mode: r.mode,
      status: r.status,
      trigger: r.trigger,
      stats: parseRunStats(r.stats),
      errors: parseRunErrors(r.errors),
      sample: parseRunSample(r.sample),
      message: r.message,
      startedAt: r.startedAt ? r.startedAt.toISOString() : null,
      finishedAt: r.finishedAt ? r.finishedAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
    })),
    inspection,
    inspectionError,
    categories: buildCategoryLabels(rawCategories),
    warehouses,
  };
}

