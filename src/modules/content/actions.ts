"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import {
  addMenuItem,
  createHomeBlock,
  createOrUpdatePage,
  deleteMenuItem,
  moveMenuItem,
  deletePage,
  moderateReview,
  moveHomeBlock,
  upsertHomeBlockVariant,
} from "@/modules/content/service";

export async function savePageAction(formData: FormData): Promise<void> {
  const staff = await requireStaff("content.manage");
  const id = String(formData.get("id") ?? "").trim() || undefined;
  const title = String(formData.get("title") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim() || undefined;
  const content = String(formData.get("content") ?? "");
  const status = String(formData.get("status") ?? "PUBLISHED") === "DRAFT" ? "DRAFT" : "PUBLISHED";
  const seoTitle = String(formData.get("seoTitle") ?? "").trim() || undefined;
  const seoDescription = String(formData.get("seoDescription") ?? "").trim() || undefined;

  const page = await createOrUpdatePage({
    id,
    title,
    slug,
    content,
    status,
    seoTitle,
    seoDescription,
  });

  await recordAudit({
    staffUserId: staff.id,
    action: id ? "page.update" : "page.create",
    entityType: "Page",
    entityId: page.id,
    summary: `Sayfa kaydedildi: ${page.title} (/${page.slug})`,
  });

  revalidatePath("/admin/icerik/sayfalar");
  revalidatePath(`/sayfa/${page.slug}`);
}

export async function deletePageAction(formData: FormData): Promise<void> {
  const staff = await requireStaff("content.manage");
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await deletePage(id);
  await recordAudit({
    staffUserId: staff.id,
    action: "page.delete",
    entityType: "Page",
    entityId: id,
    summary: "Sayfa silindi",
  });
  revalidatePath("/admin/icerik/sayfalar");
}

export async function addMenuItemAction(formData: FormData): Promise<void> {
  const staff = await requireStaff("content.manage");
  const menuHandle = String(formData.get("menuHandle") ?? "header");
  let label = String(formData.get("label") ?? "").trim();
  const type = String(formData.get("type") ?? "URL") as
    | "URL"
    | "CATEGORY"
    | "COLLECTION"
    | "PAGE"
    | "PRODUCT"
    | "BRAND";
  let url = String(formData.get("url") ?? "").trim() || undefined;
  let targetId = String(formData.get("targetId") ?? "").trim() || undefined;
  const categoryId = String(formData.get("categoryId") ?? "").trim();

  if (categoryId) {
    const cat = await db.category.findUnique({ where: { id: categoryId } });
    if (cat) {
      if (!label) label = cat.name;
      url = `/kategori/${cat.slug}`;
      targetId = cat.id;
    }
  }

  if (!label) return;
  const item = await addMenuItem({ menuHandle, label, type, url, targetId });
  await recordAudit({
    staffUserId: staff.id,
    action: "menu.item.create",
    entityType: "MenuItem",
    entityId: item.id,
    summary: `${menuHandle} menüsüne "${label}" eklendi`,
  });
  revalidatePath("/admin/icerik/sayfalar");
  revalidatePath("/");
}

export async function deleteMenuItemAction(formData: FormData): Promise<void> {
  await requireStaff("content.manage");
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await deleteMenuItem(id);
  revalidatePath("/admin/icerik/sayfalar");
  revalidatePath("/");
}

export async function moveMenuItemAction(formData: FormData): Promise<void> {
  await requireStaff("content.manage");
  const id = String(formData.get("id") ?? "");
  const direction = String(formData.get("direction") ?? "up") as "up" | "down";
  if (!id) return;
  await moveMenuItem(id, direction);
  revalidatePath("/admin/icerik/sayfalar");
  revalidatePath("/");
}

export async function createRedirectAction(formData: FormData): Promise<void> {
  const staff = await requireStaff("content.manage");
  const fromPath = String(formData.get("fromPath") ?? "").trim();
  const toPath = String(formData.get("toPath") ?? "").trim();
  if (!fromPath.startsWith("/") || !toPath) return;

  await db.redirect.upsert({
    where: { fromPath },
    create: { fromPath, toPath, statusCode: 301 },
    update: { toPath, statusCode: 301 },
  });

  await recordAudit({
    staffUserId: staff.id,
    action: "redirect.upsert",
    entityType: "Redirect",
    summary: `${fromPath} -> ${toPath}`,
  });
  revalidatePath("/admin/icerik/sayfalar");
}

export async function deleteRedirectAction(formData: FormData): Promise<void> {
  await requireStaff("content.manage");
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db.redirect.delete({ where: { id } });
  revalidatePath("/admin/icerik/sayfalar");
}

export async function createHomeBlockAction(formData: FormData): Promise<void> {
  const staff = await requireStaff("content.manage");
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "product_rail");
  const title = String(formData.get("title") ?? name).trim();
  const source = String(formData.get("source") ?? "cold_start");

  if (!name) return;

  const defaultConfig: Record<string, unknown> =
    type === "hero_banner"
      ? {
          headline: title || "Yeni Sezon Seçkisi",
          subheadline: "Güncel ürünler ve hızlı gönderim.",
          ctaLabel: "Kataloğu İncele",
          ctaHref: "/katalog",
          imageUrl: "",
        }
      : type === "product_rail"
        ? {
            title: title || name,
            subtitle: "",
            source,
            limit: 8,
            hideIfEmpty: true,
          }
        : type === "category_grid"
          ? {
              title: title || "Kategoriler",
              limit: 6,
            }
          : type === "split_callout"
            ? {
                title: title || name,
                body: "Detaylı bilgi için ürünleri inceleyin.",
                ctaLabel: "İncele",
                ctaHref: "/katalog",
                imagePosition: "right",
              }
            : {
                title: title || name,
                html: "<p>Bilgilendirme metni.</p>",
              };

  const block = await createHomeBlock({ name, type, defaultConfig });
  await recordAudit({
    staffUserId: staff.id,
    action: "home_block.create",
    entityType: "HomeBlock",
    entityId: block.id,
    summary: `Ana sayfa bloğu eklendi: ${block.name} (${block.type})`,
  });
  revalidatePath("/admin/icerik/bloklar");
  revalidatePath("/");
}

export async function toggleHomeBlockAction(formData: FormData): Promise<void> {
  await requireStaff("content.manage");
  const id = String(formData.get("id") ?? "");
  const isActive = formData.get("isActive") === "true";
  await db.homeBlock.update({ where: { id }, data: { isActive } });
  revalidatePath("/admin/icerik/bloklar");
  revalidatePath("/");
}

export async function moveHomeBlockAction(formData: FormData): Promise<void> {
  await requireStaff("content.manage");
  const id = String(formData.get("id") ?? "");
  const direction = String(formData.get("direction") ?? "up") === "down" ? "down" : "up";
  await moveHomeBlock(id, direction);
  revalidatePath("/admin/icerik/bloklar");
  revalidatePath("/");
}

export async function deleteHomeBlockAction(formData: FormData): Promise<void> {
  const staff = await requireStaff("content.manage");
  const id = String(formData.get("id") ?? "");
  await db.homeBlock.delete({ where: { id } });
  await recordAudit({
    staffUserId: staff.id,
    action: "home_block.delete",
    entityType: "HomeBlock",
    entityId: id,
    summary: "Ana sayfa bloğu silindi",
  });
  revalidatePath("/admin/icerik/bloklar");
  revalidatePath("/");
}

export async function saveHomeBlockVariantAction(formData: FormData): Promise<void> {
  const staff = await requireStaff("content.manage");
  const id = String(formData.get("id") ?? "").trim() || undefined;
  const blockId = String(formData.get("blockId") ?? "");
  const name = String(formData.get("name") ?? "Varyant").trim();
  const segmentId = String(formData.get("segmentId") ?? "").trim() || null;
  const isHidden = formData.get("isHidden") === "on";
  const blockType = String(formData.get("blockType") ?? "product_rail");

  let config: Record<string, unknown> = {};
  if (blockType === "hero_banner") {
    config = {
      headline: String(formData.get("headline") ?? ""),
      subheadline: String(formData.get("subheadline") ?? ""),
      ctaLabel: String(formData.get("ctaLabel") ?? "Kataloğu İncele"),
      ctaHref: String(formData.get("ctaHref") ?? "/katalog"),
      imageUrl: String(formData.get("imageUrl") ?? ""),
    };
  } else if (blockType === "product_rail") {
    config = {
      title: String(formData.get("title") ?? ""),
      subtitle: String(formData.get("subtitle") ?? ""),
      source: String(formData.get("source") ?? "cold_start"),
      categoryId: String(formData.get("categoryId") ?? "") || undefined,
      collectionId: String(formData.get("collectionId") ?? "") || undefined,
      limit: Number(formData.get("limit") ?? 8),
      hideIfEmpty: formData.get("hideIfEmpty") === "on",
    };
  } else if (blockType === "category_grid") {
    config = {
      title: String(formData.get("title") ?? "Kategoriler"),
      subtitle: String(formData.get("subtitle") ?? ""),
      limit: Number(formData.get("limit") ?? 6),
    };
  } else if (blockType === "split_callout") {
    config = {
      title: String(formData.get("title") ?? ""),
      body: String(formData.get("body") ?? ""),
      ctaLabel: String(formData.get("ctaLabel") ?? "İncele"),
      ctaHref: String(formData.get("ctaHref") ?? "/katalog"),
      imageUrl: String(formData.get("imageUrl") ?? ""),
      imagePosition: String(formData.get("imagePosition") ?? "right"),
    };
  } else {
    config = {
      title: String(formData.get("title") ?? ""),
      html: String(formData.get("html") ?? ""),
    };
  }

  const variant = await upsertHomeBlockVariant({
    id,
    blockId,
    name,
    segmentId,
    config,
    isHidden,
  });

  await recordAudit({
    staffUserId: staff.id,
    action: "home_block.variant.save",
    entityType: "HomeBlockVariant",
    entityId: variant.id,
    summary: `Blok varyantı kaydedildi: ${variant.name}`,
  });

  revalidatePath("/admin/icerik/bloklar");
  revalidatePath("/");
}

export async function deleteHomeBlockVariantAction(formData: FormData): Promise<void> {
  await requireStaff("content.manage");
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db.homeBlockVariant.delete({ where: { id } });
  revalidatePath("/admin/icerik/bloklar");
  revalidatePath("/");
}

export async function moderateReviewAction(formData: FormData): Promise<void> {
  const staff = await requireStaff("content.manage");
  const reviewId = String(formData.get("reviewId") ?? "");
  const status = String(formData.get("status") ?? "APPROVED") === "REJECTED" ? "REJECTED" : "APPROVED";
  const reply = String(formData.get("reply") ?? "").trim() || undefined;

  const r = await moderateReview({ reviewId, status, reply });
  await recordAudit({
    staffUserId: staff.id,
    action: "review.moderate",
    entityType: "Review",
    entityId: r.id,
    summary: `Yorum durumu: ${status}`,
  });

  revalidatePath("/admin/yorumlar");
}
