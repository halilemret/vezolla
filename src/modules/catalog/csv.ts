import "server-only";
import Papa from "papaparse";
import { db } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { formatMoneyCompact, parseMoneyInput } from "@/lib/money";
import { ensureUniqueSlug, slugify } from "@/lib/slug";
import {
  ensureDefaultWarehouse,
  recordStockMovement,
} from "@/modules/inventory/service";
import {
  ensureTagsByNames,
  recalculateProductAggregates,
} from "@/modules/catalog/service";

export interface CatalogCsvRow {
  productSlug: string;
  productTitle: string;
  subtitle: string;
  status: string;
  brand: string;
  categories: string;
  tags: string;
  variantTitle: string;
  sku: string;
  barcode: string;
  supplierCode: string;
  price: string;
  compareAtPrice: string;
  costPrice: string;
  stock: string;
  imageUrl: string;
}

export async function exportProductsToCsv(): Promise<string> {
  const products = await db.product.findMany({
    where: { deletedAt: null },
    include: {
      brand: true,
      categories: {
        include: { category: true },
        orderBy: { position: "asc" },
      },
      tags: {
        include: { tag: true },
      },
      images: {
        orderBy: { position: "asc" },
      },
      variants: {
        include: {
          inventoryLevels: true,
        },
        orderBy: { position: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const rows: CatalogCsvRow[] = [];

  for (const product of products) {
    const categoryNames = product.categories
      .map((c) => c.category.name)
      .join(", ");
    const tagNames = product.tags.map((t) => t.tag.name).join(", ");
    const primaryImage = product.images[0]?.url ?? "";

    if (product.variants.length === 0) {
      rows.push({
        productSlug: product.slug,
        productTitle: product.title,
        subtitle: product.subtitle ?? "",
        status: product.status,
        brand: product.brand?.name ?? "",
        categories: categoryNames,
        tags: tagNames,
        variantTitle: "Varsayılan",
        sku: "",
        barcode: "",
        supplierCode: "",
        price: formatMoneyCompact(product.minPrice ?? 0),
        compareAtPrice: "",
        costPrice: "",
        stock: String(product.totalStock),
        imageUrl: primaryImage,
      });
      continue;
    }

    for (const variant of product.variants) {
      const variantStock = variant.inventoryLevels.reduce(
        (sum, lvl) => sum + Math.max(0, lvl.onHand),
        0
      );

      rows.push({
        productSlug: product.slug,
        productTitle: product.title,
        subtitle: product.subtitle ?? "",
        status: product.status,
        brand: product.brand?.name ?? "",
        categories: categoryNames,
        tags: tagNames,
        variantTitle: variant.title,
        sku: variant.sku ?? "",
        barcode: variant.barcode ?? "",
        supplierCode: variant.supplierCode ?? "",
        price: formatMoneyCompact(variant.price),
        compareAtPrice:
          variant.compareAtPrice !== null
            ? formatMoneyCompact(variant.compareAtPrice)
            : "",
        costPrice:
          variant.costPrice !== null
            ? formatMoneyCompact(variant.costPrice)
            : "",
        stock: String(variantStock),
        imageUrl: primaryImage,
      });
    }
  }

  return Papa.unparse(rows, {
    quotes: true,
    header: true,
  });
}

export interface CsvImportSummary {
  importedProductsCount: number;
  importedVariantsCount: number;
  errors: string[];
}

export async function importProductsFromCsv(
  csvContent: string,
  staffUserId?: string | null
): Promise<CsvImportSummary> {
  const parsed = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: true,
  });

  const errors: string[] = [];
  for (const err of parsed.errors) {
    errors.push(`Satır ${err.row ?? "?"}: ${err.message}`);
  }

  const grouped = new Map<string, Array<Record<string, string>>>();

  for (let i = 0; i < parsed.data.length; i++) {
    const row = parsed.data[i];
    if (!row) continue;

    const rawTitle = (row.productTitle ?? row.title ?? "").trim();
    const rawSlug = (row.productSlug ?? row.slug ?? "").trim();

    if (!rawTitle && !rawSlug) {
      errors.push(`Satır ${i + 2}: productTitle veya productSlug alanı eksik.`);
      continue;
    }

    const key = rawSlug ? slugify(rawSlug) : slugify(rawTitle);
    const list = grouped.get(key) ?? [];
    list.push(row);
    grouped.set(key, list);
  }

  const defaultWarehouse = await ensureDefaultWarehouse();
  let importedProductsCount = 0;
  let importedVariantsCount = 0;

  for (const [slugKey, groupRows] of grouped.entries()) {
    const firstRow = groupRows[0];
    if (!firstRow) continue;

    try {
      const title = (firstRow.productTitle ?? firstRow.title ?? slugKey).trim();
      const subtitle = (firstRow.subtitle ?? "").trim() || null;
      const rawStatus = (firstRow.status ?? "ACTIVE").trim().toUpperCase();
      const status =
        rawStatus === "DRAFT" || rawStatus === "ARCHIVED"
          ? rawStatus
          : "ACTIVE";

      // Marka eşleştir / oluştur
      let brandId: string | null = null;
      const brandName = (firstRow.brand ?? "").trim();
      if (brandName) {
        const brandSlug = slugify(brandName);
        const existingBrand = await db.brand.findFirst({
          where: {
            OR: [{ name: brandName }, { slug: brandSlug }],
          },
        });
        if (existingBrand) {
          brandId = existingBrand.id;
        } else {
          const createdBrand = await db.brand.create({
            data: { name: brandName, slug: brandSlug },
          });
          brandId = createdBrand.id;
        }
      }

      // Kategorileri eşleştir / oluştur
      const categoryNames = (firstRow.categories ?? "")
        .split(",")
        .map((c) => c.trim())
        .filter((c) => c.length > 0);
      const categoryIds: string[] = [];

      for (const catName of categoryNames) {
        const catSlug = slugify(catName);
        const existingCat = await db.category.findFirst({
          where: {
            OR: [{ name: catName }, { slug: catSlug }],
          },
        });
        if (existingCat) {
          categoryIds.push(existingCat.id);
        } else {
          const createdCat = await db.category.create({
            data: { name: catName, slug: catSlug },
          });
          categoryIds.push(createdCat.id);
        }
      }

      // Etiketleri eşleştir / oluştur
      const tagNames = (firstRow.tags ?? "")
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
      const tagIds = await ensureTagsByNames(tagNames);

      // Mevcut ürün var mı kontrol et
      const existingProduct = await db.product.findUnique({
        where: { slug: slugKey },
      });

      const finalSlug = existingProduct
        ? existingProduct.slug
        : await ensureUniqueSlug(slugKey, async (candidate) => {
            const found = await db.product.findUnique({
              where: { slug: candidate },
            });
            return Boolean(found);
          });

      const product = existingProduct
        ? await db.product.update({
            where: { id: existingProduct.id },
            data: {
              title,
              subtitle,
              status,
              brandId: brandId ?? existingProduct.brandId,
              deletedAt: null,
            },
          })
        : await db.product.create({
            data: {
              title,
              slug: finalSlug,
              subtitle,
              status,
              brandId,
            },
          });

      importedProductsCount++;

      // Görsel varsa ekle
      const imageUrl = (firstRow.imageUrl ?? "").trim();
      if (imageUrl) {
        const existingImg = await db.productImage.findFirst({
          where: { productId: product.id, url: imageUrl },
        });
        if (!existingImg) {
          await db.productImage.create({
            data: {
              productId: product.id,
              url: imageUrl,
              alt: product.title,
              position: 0,
            },
          });
        }
      }

      // Kategori bağlarını güncelle
      if (categoryIds.length > 0) {
        for (let idx = 0; idx < categoryIds.length; idx++) {
          const categoryId = categoryIds[idx];
          if (!categoryId) continue;
          await db.productCategory.upsert({
            where: {
              productId_categoryId: {
                productId: product.id,
                categoryId,
              },
            },
            create: {
              productId: product.id,
              categoryId,
              position: idx,
              isPrimary: idx === 0,
            },
            update: {},
          });
        }
      }

      // Etiket bağlarını güncelle
      if (tagIds.length > 0) {
        for (const tagId of tagIds) {
          await db.productTag.upsert({
            where: {
              productId_tagId: {
                productId: product.id,
                tagId,
              },
            },
            create: {
              productId: product.id,
              tagId,
            },
            update: {},
          });
        }
      }

      // Varyantları işle
      for (let vIdx = 0; vIdx < groupRows.length; vIdx++) {
        const vRow = groupRows[vIdx];
        if (!vRow) continue;

        const variantTitle =
          (vRow.variantTitle ?? "").trim() || "Varsayılan";
        const sku = (vRow.sku ?? "").trim() || null;
        const barcode = (vRow.barcode ?? "").trim() || null;
        const supplierCode = (vRow.supplierCode ?? "").trim() || null;
        const price = parseMoneyInput(vRow.price ?? "0");
        const compareAtRaw = (vRow.compareAtPrice ?? "").trim();
        const compareAtPrice = compareAtRaw
          ? parseMoneyInput(compareAtRaw)
          : null;
        const costRaw = (vRow.costPrice ?? "").trim();
        const costPrice = costRaw ? parseMoneyInput(costRaw) : null;
        const stockQty = Math.max(
          0,
          Number.parseInt((vRow.stock ?? "0").trim(), 10) || 0
        );

        let existingVariant = sku
          ? await db.productVariant.findUnique({ where: { sku } })
          : null;

        if (!existingVariant) {
          existingVariant = await db.productVariant.findFirst({
            where: {
              productId: product.id,
              title: variantTitle,
            },
          });
        }

        const savedVariant = existingVariant
          ? await db.productVariant.update({
              where: { id: existingVariant.id },
              data: {
                productId: product.id,
                title: variantTitle,
                sku,
                barcode,
                supplierCode,
                price,
                compareAtPrice,
                costPrice,
                position: vIdx,
                isActive: true,
              },
            })
          : await db.productVariant.create({
              data: {
                productId: product.id,
                title: variantTitle,
                sku,
                barcode,
                supplierCode,
                price,
                compareAtPrice,
                costPrice,
                position: vIdx,
                isActive: true,
              },
            });

        importedVariantsCount++;

        await recordStockMovement({
          variantId: savedVariant.id,
          warehouseId: defaultWarehouse.id,
          type: "IMPORT",
          mode: "set",
          quantity: stockQty,
          reason: "CSV toplu içe aktarma",
          referenceType: "CSVImport",
          staffUserId: staffUserId ?? null,
        });
      }

      await recalculateProductAggregates(product.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${slugKey}: ${msg}`);
    }
  }

  await recordAudit({
    staffUserId: staffUserId ?? null,
    action: "catalog.csv_import",
    entityType: "Product",
    summary: `CSV ile ${importedProductsCount} ürün ve ${importedVariantsCount} varyant içe aktarıldı.`,
  });

  return {
    importedProductsCount,
    importedVariantsCount,
    errors,
  };
}
