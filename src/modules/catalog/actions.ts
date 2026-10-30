"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth/session";
import { parseMoneyInput } from "@/lib/money";
import { importProductsFromCsv } from "@/modules/catalog/csv";
import {
  attributeKindEnum,
  collectionRuleFieldEnum,
  collectionRuleOperatorEnum,
  productStatusEnum,
  type BulkPriceUpdateInput,
  type BulkStatusUpdateInput,
  type CollectionRule,
  type ProductEditorData,
  type ProductUpsertInput,
} from "@/modules/catalog/schemas";
import {
  bulkUpdateProductPrices,
  bulkUpdateProductStatus,
  createTag,
  deleteAttributeDefinition,
  deleteBrand,
  deleteCategory,
  deleteCollection,
  deletePriceList,
  deletePriceListPrice,
  deleteProductType,
  deleteTag,
  deleteTaxClass,
  getProductEditorData,
  softDeleteProduct,
  syncAutomaticCollection,
  upsertAttributeDefinition,
  upsertBrand,
  upsertCategory,
  upsertCollection,
  upsertPriceList,
  upsertPriceListPrice,
  upsertProduct,
  upsertProductType,
  upsertTaxClass,
} from "@/modules/catalog/service";

function getStr(formData: FormData, key: string): string {
  const val = formData.get(key);
  return typeof val === "string" ? val.trim() : "";
}

export async function loadProductEditorDataAction(
  productId?: string
): Promise<ProductEditorData> {
  await requireStaff("catalog.read");
  return getProductEditorData(productId);
}

export async function saveProductAction(
  input: ProductUpsertInput
): Promise<{ ok: true; productId: string; slug: string } | { ok: false; error: string }> {
  try {
    const staff = await requireStaff("catalog.write");
    const product = await upsertProduct(input, staff.id);
    revalidatePath("/admin/katalog/urunler");
    revalidatePath(`/admin/katalog/urunler/${product.id}`);
    revalidatePath("/admin/stok");
    revalidatePath("/");
    return { ok: true, productId: product.id, slug: product.slug };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Ürün kaydedilirken hata oluştu.";
    return { ok: false, error: message };
  }
}

export async function softDeleteProductAction(
  productId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const staff = await requireStaff("catalog.write");
    await softDeleteProduct(productId, staff.id);
    revalidatePath("/admin/katalog/urunler");
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Ürün silinemedi.",
    };
  }
}

export async function deleteProductFormAction(formData: FormData): Promise<void> {
  const staff = await requireStaff("catalog.write");
  const productId = getStr(formData, "productId");
  if (!productId) return;
  await softDeleteProduct(productId, staff.id);
  revalidatePath("/admin/katalog/urunler");
  revalidatePath("/");
}

export async function bulkUpdateProductStatusAction(
  input: BulkStatusUpdateInput
): Promise<{ ok: boolean; count?: number; error?: string }> {
  try {
    const staff = await requireStaff("catalog.write");
    const count = await bulkUpdateProductStatus(input, staff.id);
    revalidatePath("/admin/katalog/urunler");
    revalidatePath("/");
    return { ok: true, count };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Toplu durum güncellenemedi.",
    };
  }
}

export async function bulkUpdateProductPricesAction(
  input: BulkPriceUpdateInput
): Promise<{ ok: boolean; count?: number; error?: string }> {
  try {
    const staff = await requireStaff("catalog.write");
    const count = await bulkUpdateProductPrices(input, staff.id);
    revalidatePath("/admin/katalog/urunler");
    revalidatePath("/");
    return { ok: true, count };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Toplu fiyat güncellenemedi.",
    };
  }
}

export async function bulkCatalogFormAction(formData: FormData): Promise<void> {
  const staff = await requireStaff("catalog.write");
  const operation = getStr(formData, "operation");
  const rawProductIds = formData
    .getAll("productIds")
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0);

  if (rawProductIds.length === 0) return;

  if (operation === "status") {
    const rawStatus = getStr(formData, "status");
    const parsedStatus = productStatusEnum.safeParse(rawStatus);
    if (!parsedStatus.success) return;

    await bulkUpdateProductStatus(
      { productIds: rawProductIds, status: parsedStatus.data },
      staff.id
    );
  } else if (operation === "price") {
    const modeRaw = getStr(formData, "mode");
    const mode = modeRaw === "decrease_pct" ? "decrease_pct" : "increase_pct";
    const percentage = Number.parseFloat(getStr(formData, "percentage")) || 0;
    const roundingRaw = getStr(formData, "rounding");
    const rounding =
      roundingRaw === "90" || roundingRaw === "99" || roundingRaw === "whole"
        ? roundingRaw
        : "none";

    if (percentage > 0) {
      await bulkUpdateProductPrices(
        {
          productIds: rawProductIds,
          mode,
          percentage,
          rounding,
        },
        staff.id
      );
    }
  }

  revalidatePath("/admin/katalog/urunler");
  revalidatePath("/");
}

export async function importCsvFormAction(formData: FormData): Promise<void> {
  const staff = await requireStaff("catalog.write");
  const file = formData.get("csvFile");
  let csvText = "";

  if (file instanceof File && file.size > 0) {
    csvText = await file.text();
  } else {
    csvText = getStr(formData, "csvText");
  }

  const cleaned = csvText.replace(/^\uFEFF/, "").trim();
  if (!cleaned) return;

  await importProductsFromCsv(cleaned, staff.id);
  revalidatePath("/admin/katalog/urunler");
  revalidatePath("/admin/stok");
  revalidatePath("/");
}

export async function saveCategoryFormAction(formData: FormData): Promise<void> {
  const staff = await requireStaff("catalog.write");
  const id = getStr(formData, "id") || undefined;
  const name = getStr(formData, "name");
  if (!name) return;

  const slug = getStr(formData, "slug") || undefined;
  const description = getStr(formData, "description") || null;
  const parentId = getStr(formData, "parentId") || null;
  const position = Number.parseInt(getStr(formData, "position"), 10) || 0;
  const imageUrl = getStr(formData, "imageUrl") || null;
  const isActive = formData.get("isActive") !== "false" && formData.get("isActive") !== null;
  const seoTitle = getStr(formData, "seoTitle") || null;
  const seoDescription = getStr(formData, "seoDescription") || null;

  await upsertCategory(
    {
      id,
      name,
      slug,
      description,
      parentId,
      position,
      imageUrl,
      isActive,
      seoTitle,
      seoDescription,
    },
    staff.id
  );

  revalidatePath("/admin/katalog/kategoriler");
  revalidatePath("/admin/katalog/urunler");
  revalidatePath("/");
}

export async function deleteCategoryFormAction(formData: FormData): Promise<void> {
  const staff = await requireStaff("catalog.write");
  const categoryId = getStr(formData, "categoryId");
  if (!categoryId) return;
  await deleteCategory(categoryId, staff.id);
  revalidatePath("/admin/katalog/kategoriler");
  revalidatePath("/");
}

export async function saveCollectionFormAction(formData: FormData): Promise<void> {
  const staff = await requireStaff("catalog.write");
  const id = getStr(formData, "id") || undefined;
  const title = getStr(formData, "title");
  if (!title) return;

  const slug = getStr(formData, "slug") || undefined;
  const description = getStr(formData, "description") || null;
  const imageUrl = getStr(formData, "imageUrl") || null;
  const type = getStr(formData, "type") === "AUTOMATIC" ? "AUTOMATIC" : "MANUAL";
  const matchAll = getStr(formData, "matchAll") !== "false";
  const sortOrderRaw = getStr(formData, "sortOrder");
  const sortOrder =
    sortOrderRaw === "newest" ||
    sortOrderRaw === "price_asc" ||
    sortOrderRaw === "price_desc" ||
    sortOrderRaw === "best_selling" ||
    sortOrderRaw === "title"
      ? sortOrderRaw
      : "manual";
  const isActive = formData.get("isActive") !== "false" && formData.get("isActive") !== null;
  const seoTitle = getStr(formData, "seoTitle") || null;
  const seoDescription = getStr(formData, "seoDescription") || null;

  const productIds = formData
    .getAll("productIds")
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0);

  const ruleFields = formData.getAll("ruleField");
  const ruleOperators = formData.getAll("ruleOperator");
  const ruleValues = formData.getAll("ruleValue");

  const rules: CollectionRule[] = [];
  for (let i = 0; i < ruleFields.length; i++) {
    const rf = ruleFields[i];
    const ro = ruleOperators[i];
    const rv = ruleValues[i];
    const fRaw = typeof rf === "string" ? rf.trim() : "";
    const opRaw = typeof ro === "string" ? ro.trim() : "";
    const vRaw = typeof rv === "string" ? rv.trim() : "";

    if (!fRaw || !opRaw || !vRaw) continue;
    const fParsed = collectionRuleFieldEnum.safeParse(fRaw);
    const opParsed = collectionRuleOperatorEnum.safeParse(opRaw);
    if (!fParsed.success || !opParsed.success) continue;

    if (fParsed.data === "price") {
      // Kullanıcı TL cinsinden girdiyse kuruşa çevir
      rules.push({
        field: "price",
        operator: opParsed.data,
        value: parseMoneyInput(vRaw),
      });
    } else if (fParsed.data === "stock") {
      rules.push({
        field: "stock",
        operator: opParsed.data,
        value: Number.parseInt(vRaw, 10) || 0,
      });
    } else {
      rules.push({
        field: fParsed.data,
        operator: opParsed.data,
        value: vRaw,
      });
    }
  }

  await upsertCollection(
    {
      id,
      title,
      slug,
      description,
      imageUrl,
      type,
      rules,
      matchAll,
      sortOrder,
      isActive,
      seoTitle,
      seoDescription,
      productIds,
    },
    staff.id
  );

  revalidatePath("/admin/katalog/koleksiyonlar");
  revalidatePath("/");
}

export async function syncAutomaticCollectionFormAction(
  formData: FormData
): Promise<void> {
  await requireStaff("catalog.write");
  const collectionId = getStr(formData, "collectionId");
  if (!collectionId) return;
  await syncAutomaticCollection(collectionId);
  revalidatePath("/admin/katalog/koleksiyonlar");
  revalidatePath("/");
}

export async function deleteCollectionFormAction(
  formData: FormData
): Promise<void> {
  const staff = await requireStaff("catalog.write");
  const collectionId = getStr(formData, "collectionId");
  if (!collectionId) return;
  await deleteCollection(collectionId, staff.id);
  revalidatePath("/admin/katalog/koleksiyonlar");
  revalidatePath("/");
}

export async function saveBrandFormAction(formData: FormData): Promise<void> {
  const staff = await requireStaff("catalog.write");
  const id = getStr(formData, "id") || undefined;
  const name = getStr(formData, "name");
  if (!name) return;

  const slug = getStr(formData, "slug") || undefined;
  const logoUrl = getStr(formData, "logoUrl") || null;
  const description = getStr(formData, "description") || null;

  await upsertBrand({ id, name, slug, logoUrl, description }, staff.id);
  revalidatePath("/admin/katalog/koleksiyonlar");
  revalidatePath("/admin/katalog/urunler");
  revalidatePath("/");
}

export async function deleteBrandFormAction(formData: FormData): Promise<void> {
  const staff = await requireStaff("catalog.write");
  const brandId = getStr(formData, "brandId");
  if (!brandId) return;
  await deleteBrand(brandId, staff.id);
  revalidatePath("/admin/katalog/koleksiyonlar");
  revalidatePath("/admin/katalog/urunler");
  revalidatePath("/");
}

export async function createTagFormAction(formData: FormData): Promise<void> {
  const staff = await requireStaff("catalog.write");
  const name = getStr(formData, "name");
  if (!name) return;
  const slug = getStr(formData, "slug") || undefined;
  await createTag({ name, slug }, staff.id);
  revalidatePath("/admin/katalog/koleksiyonlar");
  revalidatePath("/admin/katalog/urunler");
}

export async function deleteTagFormAction(formData: FormData): Promise<void> {
  const staff = await requireStaff("catalog.write");
  const tagId = getStr(formData, "tagId");
  if (!tagId) return;
  await deleteTag(tagId, staff.id);
  revalidatePath("/admin/katalog/koleksiyonlar");
  revalidatePath("/admin/katalog/urunler");
}

export async function saveAttributeDefinitionFormAction(
  formData: FormData
): Promise<void> {
  const staff = await requireStaff("catalog.write");
  const id = getStr(formData, "id") || undefined;
  const label = getStr(formData, "label");
  if (!label) return;

  const key = getStr(formData, "key") || undefined;
  const kindRaw = getStr(formData, "kind");
  const kindParsed = attributeKindEnum.safeParse(kindRaw);
  const kind = kindParsed.success ? kindParsed.data : "TEXT";

  const optionsRaw = getStr(formData, "options");
  const options = optionsRaw
    .split(",")
    .map((o) => o.trim())
    .filter((o) => o.length > 0);

  const unit = getStr(formData, "unit") || null;
  const isFilterable = formData.get("isFilterable") === "on" || formData.get("isFilterable") === "true";
  const isVisibleOnProduct =
    formData.get("isVisibleOnProduct") !== "false" &&
    formData.get("isVisibleOnProduct") !== null;
  const position = Number.parseInt(getStr(formData, "position"), 10) || 0;

  await upsertAttributeDefinition(
    {
      id,
      key,
      label,
      kind,
      options,
      unit,
      isFilterable,
      isVisibleOnProduct,
      position,
    },
    staff.id
  );

  revalidatePath("/admin/katalog/ozel-alanlar");
  revalidatePath("/admin/katalog/urunler");
}

export async function deleteAttributeDefinitionFormAction(
  formData: FormData
): Promise<void> {
  const staff = await requireStaff("catalog.write");
  const attributeId = getStr(formData, "attributeId");
  if (!attributeId) return;
  await deleteAttributeDefinition(attributeId, staff.id);
  revalidatePath("/admin/katalog/ozel-alanlar");
}

export async function saveProductTypeFormAction(
  formData: FormData
): Promise<void> {
  const staff = await requireStaff("catalog.write");
  const id = getStr(formData, "id") || undefined;
  const name = getStr(formData, "name");
  if (!name) return;

  const selectedAttrIds = formData
    .getAll("attributeIds")
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  const requiredAttrIds = new Set(
    formData
      .getAll("requiredAttributeIds")
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
  );

  await upsertProductType(
    {
      id,
      name,
      attributes: selectedAttrIds.map((attributeId, idx) => ({
        attributeId,
        position: idx,
        isRequired: requiredAttrIds.has(attributeId),
      })),
    },
    staff.id
  );

  revalidatePath("/admin/katalog/ozel-alanlar");
  revalidatePath("/admin/katalog/urunler");
}

export async function deleteProductTypeFormAction(
  formData: FormData
): Promise<void> {
  const staff = await requireStaff("catalog.write");
  const productTypeId = getStr(formData, "productTypeId");
  if (!productTypeId) return;
  await deleteProductType(productTypeId, staff.id);
  revalidatePath("/admin/katalog/ozel-alanlar");
}

export async function saveTaxClassFormAction(formData: FormData): Promise<void> {
  const staff = await requireStaff("catalog.write");
  const id = getStr(formData, "id") || undefined;
  const name = getStr(formData, "name");
  if (!name) return;

  const ratePercent = Number.parseFloat(getStr(formData, "ratePercent"));
  const rateBps = Number.isFinite(ratePercent)
    ? Math.round(ratePercent * 100)
    : Number.parseInt(getStr(formData, "rateBps"), 10) || 2000;
  const isDefault =
    formData.get("isDefault") === "on" || formData.get("isDefault") === "true";

  await upsertTaxClass({ id, name, rateBps, isDefault }, staff.id);
  revalidatePath("/admin/katalog/fiyat-vergi");
  revalidatePath("/admin/katalog/urunler");
}

export async function deleteTaxClassFormAction(
  formData: FormData
): Promise<void> {
  const staff = await requireStaff("catalog.write");
  const taxClassId = getStr(formData, "taxClassId");
  if (!taxClassId) return;
  await deleteTaxClass(taxClassId, staff.id);
  revalidatePath("/admin/katalog/fiyat-vergi");
}

export async function savePriceListFormAction(
  formData: FormData
): Promise<void> {
  const staff = await requireStaff("catalog.write");
  const id = getStr(formData, "id") || undefined;
  const name = getStr(formData, "name");
  if (!name) return;

  const description = getStr(formData, "description") || null;
  const customerGroupId = getStr(formData, "customerGroupId") || null;
  const startsAt = getStr(formData, "startsAt") || null;
  const endsAt = getStr(formData, "endsAt") || null;
  const priority = Number.parseInt(getStr(formData, "priority"), 10) || 0;
  const isActive =
    formData.get("isActive") !== "false" && formData.get("isActive") !== null;

  await upsertPriceList(
    {
      id,
      name,
      description,
      customerGroupId,
      startsAt,
      endsAt,
      isActive,
      priority,
    },
    staff.id
  );

  revalidatePath("/admin/katalog/fiyat-vergi");
}

export async function deletePriceListFormAction(
  formData: FormData
): Promise<void> {
  const staff = await requireStaff("catalog.write");
  const priceListId = getStr(formData, "priceListId");
  if (!priceListId) return;
  await deletePriceList(priceListId, staff.id);
  revalidatePath("/admin/katalog/fiyat-vergi");
}

export async function savePriceListPriceFormAction(
  formData: FormData
): Promise<void> {
  const staff = await requireStaff("catalog.write");
  const priceListId = getStr(formData, "priceListId");
  const variantId = getStr(formData, "variantId");
  const priceRaw = getStr(formData, "price");
  if (!priceListId || !variantId || !priceRaw) return;

  const price = parseMoneyInput(priceRaw);
  await upsertPriceListPrice({ priceListId, variantId, price }, staff.id);
  revalidatePath("/admin/katalog/fiyat-vergi");
}

export async function deletePriceListPriceFormAction(
  formData: FormData
): Promise<void> {
  const staff = await requireStaff("catalog.write");
  const id = getStr(formData, "id");
  if (!id) return;
  await deletePriceListPrice(id, staff.id);
  revalidatePath("/admin/katalog/fiyat-vergi");
}
