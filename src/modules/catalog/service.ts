import "server-only";
import { db } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { roundPriceMinor } from "@/lib/money";
import { ensureUniqueSlug, slugify } from "@/lib/slug";
import {
  ensureDefaultWarehouse,
  recordStockMovement,
} from "@/modules/inventory/service";
import {
  attributeDefinitionInputSchema,
  brandInputSchema,
  bulkPriceUpdateSchema,
  bulkStatusUpdateSchema,
  categoryInputSchema,
  collectionInputSchema,
  collectionRuleSchema,
  priceListInputSchema,
  priceListPriceInputSchema,
  productTypeInputSchema,
  productUpsertSchema,
  tagInputSchema,
  taxClassInputSchema,
  type AttributeDefinitionInput,
  type BrandInput,
  type BulkPriceUpdateInput,
  type BulkStatusUpdateInput,
  type CategoryInput,
  type CollectionInput,
  type CollectionRule,
  type PriceListInput,
  type PriceListPriceInput,
  type ProductOptionInput,
  type ProductTypeInput,
  type ProductUpsertInput,
  type ProductVariantInput,
  type ProductEditorData,
  type TagInput,
  type TaxClassInput,
  type VariantOptionSelection,
} from "@/modules/catalog/schemas";
import type { Prisma } from "@/generated/prisma/client";

export interface GeneratedVariantCombination {
  title: string;
  key: string;
  optionValues: VariantOptionSelection[];
}

export function buildOptionValuesKey(selections: VariantOptionSelection[]): string {
  return selections
    .map(
      (s) =>
        `${s.optionName.trim().toLowerCase()}:${s.value.trim().toLowerCase()}`
    )
    .join("|");
}

/**
 * Seçenek tanımlarından (örn. Renk: Siyah, Beyaz; Beden: S, M)
 * Kartezyen çarpım ile tüm varyant kombinasyonlarını üretir.
 */
export function generateOptionCombinations(
  options: Array<{
    name: string;
    values: Array<{ value: string; swatch?: string | null }>;
  }>
): GeneratedVariantCombination[] {
  const cleanOptions = options
    .map((opt) => ({
      name: opt.name.trim(),
      values: opt.values
        .map((v) => ({ value: v.value.trim(), swatch: v.swatch ?? null }))
        .filter((v) => v.value.length > 0),
    }))
    .filter((opt) => opt.name.length > 0 && opt.values.length > 0);

  if (cleanOptions.length === 0) {
    return [];
  }

  let acc: VariantOptionSelection[][] = [[]];

  for (const option of cleanOptions) {
    const next: VariantOptionSelection[][] = [];
    for (const prefix of acc) {
      for (const val of option.values) {
        next.push([
          ...prefix,
          {
            optionName: option.name,
            value: val.value,
          },
        ]);
      }
    }
    acc = next;
  }

  return acc.map((selections) => {
    const title = selections.map((s) => s.value).join(" / ");
    const key = buildOptionValuesKey(selections);
    return {
      title,
      key,
      optionValues: selections,
    };
  });
}

/**
 * Üretilen varyant kombinasyonlarını mevcut varyant listesiyle birleştirir.
 * Eşleşen varyantların id, SKU, barkod, fiyat, maliyet ve stok bilgilerini korur.
 */
export function syncVariantMatrixWithExisting(
  options: ProductOptionInput[],
  existingVariants: ProductVariantInput[],
  defaults?: {
    defaultPrice?: number;
    skuPrefix?: string;
  }
): ProductVariantInput[] {
  const combinations = generateOptionCombinations(options);
  if (combinations.length === 0) {
    if (existingVariants.length > 0) {
      return existingVariants;
    }
    return [
      {
        title: "Varsayılan",
        sku: defaults?.skuPrefix ? `${defaults.skuPrefix}-01` : null,
        barcode: null,
        supplierCode: null,
        price: defaults?.defaultPrice ?? 0,
        compareAtPrice: null,
        costPrice: null,
        weightGrams: null,
        position: 0,
        isActive: true,
        trackInventory: true,
        allowBackorder: false,
        stock: 0,
        optionValues: [],
      },
    ];
  }

  const byKey = new Map<string, ProductVariantInput>();
  const byTitle = new Map<string, ProductVariantInput>();

  for (const existing of existingVariants) {
    if (existing.optionValues && existing.optionValues.length > 0) {
      byKey.set(buildOptionValuesKey(existing.optionValues), existing);
    }
    byTitle.set(existing.title.trim().toLowerCase(), existing);
  }

  const fallbackPrice =
    defaults?.defaultPrice ?? existingVariants[0]?.price ?? 0;

  return combinations.map((comb, index) => {
    const matched =
      byKey.get(comb.key) ?? byTitle.get(comb.title.trim().toLowerCase());

    if (matched) {
      return {
        ...matched,
        title: comb.title,
        position: index,
        optionValues: comb.optionValues,
      };
    }

    const generatedSku = defaults?.skuPrefix
      ? `${defaults.skuPrefix.trim().toUpperCase()}-${slugify(comb.title).toUpperCase()}`
      : null;

    return {
      title: comb.title,
      sku: generatedSku,
      barcode: null,
      supplierCode: null,
      price: fallbackPrice,
      compareAtPrice: null,
      costPrice: null,
      weightGrams: null,
      position: index,
      isActive: true,
      trackInventory: true,
      allowBackorder: false,
      stock: 0,
      optionValues: comb.optionValues,
    };
  });
}

export interface ProductForRuleEvaluation {
  title: string;
  minPrice: number | null;
  maxPrice?: number | null;
  totalStock: number;
  brandId?: string | null;
  brandName?: string | null;
  brandSlug?: string | null;
  tags: string[];
}

function evaluateSingleRule(
  product: ProductForRuleEvaluation,
  rule: CollectionRule
): boolean {
  if (rule.field === "price") {
    const target = Number(rule.value);
    if (!Number.isFinite(target)) return false;
    const price = product.minPrice ?? 0;
    switch (rule.operator) {
      case "eq":
        return price === target;
      case "neq":
        return price !== target;
      case "gt":
        return price > target;
      case "gte":
        return price >= target;
      case "lt":
        return price < target;
      case "lte":
        return price <= target;
      default:
        return false;
    }
  }

  if (rule.field === "stock") {
    const target = Number(rule.value);
    if (!Number.isFinite(target)) return false;
    const stock = product.totalStock;
    switch (rule.operator) {
      case "eq":
        return stock === target;
      case "neq":
        return stock !== target;
      case "gt":
        return stock > target;
      case "gte":
        return stock >= target;
      case "lt":
        return stock < target;
      case "lte":
        return stock <= target;
      default:
        return false;
    }
  }

  if (rule.field === "tag") {
    const target = String(rule.value).trim().toLowerCase();
    const targetSlug = slugify(target);
    if (!target) return false;
    const normalizedTags = product.tags.map((t) => t.trim().toLowerCase());
    const slugTags = product.tags.map((t) => slugify(t));

    switch (rule.operator) {
      case "eq":
        return (
          normalizedTags.includes(target) || slugTags.includes(targetSlug)
        );
      case "neq":
        return (
          !normalizedTags.includes(target) && !slugTags.includes(targetSlug)
        );
      case "contains":
        return normalizedTags.some((t) => t.includes(target));
      default:
        return false;
    }
  }

  if (rule.field === "brand") {
    const target = String(rule.value).trim().toLowerCase();
    const targetSlug = slugify(target);
    if (!target) return false;
    const candidates = [
      product.brandId?.toLowerCase() ?? "",
      product.brandName?.toLowerCase() ?? "",
      product.brandSlug?.toLowerCase() ?? "",
    ].filter((c) => c.length > 0);

    switch (rule.operator) {
      case "eq":
        return (
          candidates.includes(target) || candidates.includes(targetSlug)
        );
      case "neq":
        return (
          !candidates.includes(target) && !candidates.includes(targetSlug)
        );
      case "contains":
        return (product.brandName?.toLowerCase() ?? "").includes(target);
      default:
        return false;
    }
  }

  if (rule.field === "title") {
    const target = String(rule.value).trim().toLowerCase();
    if (!target) return false;
    const titleLower = product.title.toLowerCase();
    switch (rule.operator) {
      case "eq":
        return titleLower === target;
      case "neq":
        return titleLower !== target;
      case "contains":
        return titleLower.includes(target);
      default:
        return false;
    }
  }

  return false;
}

/**
 * Otomatik koleksiyon kurallarını bir ürün üzerinde değerlendirir.
 * matchAll=true ise tüm kurallar (AND), matchAll=false ise en az bir kural (OR) sağlanmalıdır.
 */
export function evaluateCollectionRules(
  product: ProductForRuleEvaluation,
  rules: CollectionRule[],
  matchAll = true
): boolean {
  if (rules.length === 0) {
    return false;
  }
  if (matchAll) {
    return rules.every((rule) => evaluateSingleRule(product, rule));
  }
  return rules.some((rule) => evaluateSingleRule(product, rule));
}

export function parseCollectionRulesJson(raw: unknown): CollectionRule[] {
  if (!Array.isArray(raw)) return [];
  const parsed: CollectionRule[] = [];
  for (const item of raw) {
    const res = collectionRuleSchema.safeParse(item);
    if (res.success) {
      parsed.push(res.data);
    }
  }
  return parsed;
}

/**
 * Varyantlardan minPrice, maxPrice, totalStock ve searchText alanlarını hesaplar
 * ve ürün kaydını günceller.
 */
export async function recalculateProductAggregates(productId: string) {
  const product = await db.product.findUnique({
    where: { id: productId },
    include: {
      brand: true,
      tags: {
        include: { tag: true },
      },
      variants: {
        include: {
          inventoryLevels: {
            where: {
              warehouse: { isActive: true },
            },
          },
        },
        orderBy: { position: "asc" },
      },
    },
  });

  if (!product) {
    return null;
  }

  const activeVariants = product.variants.filter((v) => v.isActive);
  const priceSourceVariants =
    activeVariants.length > 0 ? activeVariants : product.variants;

  let minPrice: number | null = null;
  let maxPrice: number | null = null;

  for (const v of priceSourceVariants) {
    if (minPrice === null || v.price < minPrice) {
      minPrice = v.price;
    }
    if (maxPrice === null || v.price > maxPrice) {
      maxPrice = v.price;
    }
  }

  let totalStock = 0;
  for (const v of activeVariants) {
    for (const lvl of v.inventoryLevels) {
      totalStock += Math.max(0, lvl.onHand);
    }
  }

  const searchTokens = new Set<string>();
  const pushToken = (val?: string | null) => {
    if (!val) return;
    const cleaned = val.trim().toLowerCase();
    if (cleaned) searchTokens.add(cleaned);
  };

  pushToken(product.title);
  pushToken(product.subtitle);
  pushToken(product.slug);
  pushToken(product.brand?.name);

  for (const pt of product.tags) {
    pushToken(pt.tag.name);
  }

  for (const v of product.variants) {
    pushToken(v.title);
    pushToken(v.sku);
    pushToken(v.barcode);
    pushToken(v.supplierCode);
  }

  const searchText = Array.from(searchTokens).join(" ");

  const updated = await db.product.update({
    where: { id: product.id },
    data: {
      minPrice,
      maxPrice,
      totalStock,
      searchText,
    },
  });

  await syncAutomaticCollectionsForProduct(product.id);

  return updated;
}

/**
 * Tek bir ürün için tüm aktif otomatik koleksiyonları yeniden değerlendirir.
 */
export async function syncAutomaticCollectionsForProduct(
  productId: string
): Promise<void> {
  const [product, autoCollections] = await Promise.all([
    db.product.findUnique({
      where: { id: productId },
      include: {
        brand: true,
        tags: { include: { tag: true } },
      },
    }),
    db.collection.findMany({
      where: { type: "AUTOMATIC" },
    }),
  ]);

  if (!product || autoCollections.length === 0) return;

  const evalTarget: ProductForRuleEvaluation = {
    title: product.title,
    minPrice: product.minPrice,
    maxPrice: product.maxPrice,
    totalStock: product.totalStock,
    brandId: product.brandId,
    brandName: product.brand?.name ?? null,
    brandSlug: product.brand?.slug ?? null,
    tags: product.tags.map((t) => t.tag.name),
  };

  for (const col of autoCollections) {
    const rules = parseCollectionRulesJson(col.rules);
    const matches =
      product.deletedAt === null &&
      evaluateCollectionRules(evalTarget, rules, col.matchAll);

    if (matches) {
      await db.collectionProduct.upsert({
        where: {
          collectionId_productId: {
            collectionId: col.id,
            productId: product.id,
          },
        },
        create: {
          collectionId: col.id,
          productId: product.id,
          position: 0,
        },
        update: {},
      });
    } else {
      await db.collectionProduct.deleteMany({
        where: {
          collectionId: col.id,
          productId: product.id,
        },
      });
    }
  }
}

/**
 * Otomatik bir koleksiyonun kurallarını tüm ürünler üzerinde çalıştırıp
 * CollectionProduct tablosunu senkronlar.
 */
export async function syncAutomaticCollection(
  collectionId: string
): Promise<number> {
  const collection = await db.collection.findUnique({
    where: { id: collectionId },
  });

  if (!collection || collection.type !== "AUTOMATIC") {
    return 0;
  }

  const rules = parseCollectionRulesJson(collection.rules);
  const products = await db.product.findMany({
    where: { deletedAt: null },
    include: {
      brand: true,
      tags: { include: { tag: true } },
    },
  });

  const matchedProducts = products.filter((p) =>
    evaluateCollectionRules(
      {
        title: p.title,
        minPrice: p.minPrice,
        maxPrice: p.maxPrice,
        totalStock: p.totalStock,
        brandId: p.brandId,
        brandName: p.brand?.name ?? null,
        brandSlug: p.brand?.slug ?? null,
        tags: p.tags.map((t) => t.tag.name),
      },
      rules,
      collection.matchAll
    )
  );

  matchedProducts.sort((a, b) => {
    switch (collection.sortOrder) {
      case "newest":
        return b.createdAt.getTime() - a.createdAt.getTime();
      case "price_asc":
        return (a.minPrice ?? 0) - (b.minPrice ?? 0);
      case "price_desc":
        return (b.minPrice ?? 0) - (a.minPrice ?? 0);
      case "best_selling":
        return b.salesCount - a.salesCount;
      case "title":
        return a.title.localeCompare(b.title, "tr");
      default:
        return 0;
    }
  });

  await db.$transaction(async (tx) => {
    await tx.collectionProduct.deleteMany({
      where: { collectionId: collection.id },
    });

    if (matchedProducts.length > 0) {
      await tx.collectionProduct.createMany({
        data: matchedProducts.map((p, idx) => ({
          collectionId: collection.id,
          productId: p.id,
          position: idx,
        })),
      });
    }
  });

  return matchedProducts.length;
}

export async function ensureTagsByNames(tagNames: string[]) {
  const cleaned = Array.from(
    new Set(
      tagNames
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
    )
  );

  const resultIds: string[] = [];

  for (const name of cleaned) {
    const slug = slugify(name);
    const existing = await db.tag.findFirst({
      where: {
        OR: [{ name }, { slug }],
      },
    });
    if (existing) {
      resultIds.push(existing.id);
    } else {
      const created = await db.tag.create({
        data: { name, slug },
      });
      resultIds.push(created.id);
    }
  }

  return resultIds;
}

/**
 * Ürün oluşturma ve güncelleme (seçenekler, varyantlar, görseller,
 * kategoriler, koleksiyonlar, etiketler, özel alanlar ve stok dahil).
 */
export async function upsertProduct(
  rawInput: ProductUpsertInput,
  staffUserId?: string | null
) {
  const input = productUpsertSchema.parse(rawInput);
  const isUpdate = Boolean(input.id);

  const desiredSlugBase =
    input.slug && input.slug.trim().length > 0
      ? input.slug.trim()
      : input.title;

  const slug = await ensureUniqueSlug(desiredSlugBase, async (candidate) => {
    const found = await db.product.findUnique({ where: { slug: candidate } });
    if (!found) return false;
    if (input.id && found.id === input.id) return false;
    return true;
  });

  const publishedAtDate =
    input.publishedAt && input.publishedAt.trim().length > 0
      ? new Date(input.publishedAt)
      : null;

  const validPublishedAt =
    publishedAtDate && !Number.isNaN(publishedAtDate.getTime())
      ? publishedAtDate
      : null;

  const tagIds = await ensureTagsByNames(input.tagNames);
  const defaultWarehouse = await ensureDefaultWarehouse();

  const product = await db.$transaction(async (tx) => {
    const baseData = {
      title: input.title,
      slug,
      subtitle: input.subtitle || null,
      description: input.description || null,
      status: input.status,
      publishedAt: validPublishedAt,
      brandId: input.brandId || null,
      productTypeId: input.productTypeId || null,
      taxClassId: input.taxClassId || null,
      seoTitle: input.seoTitle || null,
      seoDescription: input.seoDescription || null,
      weightGrams: input.weightGrams ?? null,
      deletedAt: null,
    };

    const savedProduct = input.id
      ? await tx.product.update({
          where: { id: input.id },
          data: baseData,
        })
      : await tx.product.create({
          data: baseData,
        });

    // 1. Seçenekleri ve seçenek değerlerini senkronla
    await tx.productOption.deleteMany({
      where: { productId: savedProduct.id },
    });

    const optionValueIdByPair = new Map<string, string>();
    const orderedOptionNames: string[] = [];

    for (let optIdx = 0; optIdx < input.options.length; optIdx++) {
      const opt = input.options[optIdx];
      if (!opt) continue;
      orderedOptionNames.push(opt.name);

      const createdOption = await tx.productOption.create({
        data: {
          productId: savedProduct.id,
          name: opt.name,
          position: optIdx,
        },
      });

      const seenValues = new Set<string>();
      for (let valIdx = 0; valIdx < opt.values.length; valIdx++) {
        const valObj = opt.values[valIdx];
        if (!valObj) continue;
        const valKey = valObj.value.trim().toLowerCase();
        if (!valKey || seenValues.has(valKey)) continue;
        seenValues.add(valKey);

        const createdVal = await tx.productOptionValue.create({
          data: {
            optionId: createdOption.id,
            value: valObj.value.trim(),
            swatch: valObj.swatch || null,
            position: valIdx,
          },
        });

        optionValueIdByPair.set(
          `${opt.name.trim().toLowerCase()}:${valKey}`,
          createdVal.id
        );
      }
    }

    // 2. Görselleri senkronla
    await tx.productImage.deleteMany({
      where: { productId: savedProduct.id },
    });

    for (let imgIdx = 0; imgIdx < input.images.length; imgIdx++) {
      const img = input.images[imgIdx];
      if (!img || !img.url.trim()) continue;
      await tx.productImage.create({
        data: {
          productId: savedProduct.id,
          url: img.url.trim(),
          alt: img.alt || savedProduct.title,
          width: img.width ?? null,
          height: img.height ?? null,
          position: imgIdx,
        },
      });
    }

    // 3. Kategorileri senkronla
    await tx.productCategory.deleteMany({
      where: { productId: savedProduct.id },
    });

    const uniqueCategoryIds = Array.from(new Set(input.categoryIds));
    const primaryCatId =
      input.primaryCategoryId && uniqueCategoryIds.includes(input.primaryCategoryId)
        ? input.primaryCategoryId
        : (uniqueCategoryIds[0] ?? null);

    for (let catIdx = 0; catIdx < uniqueCategoryIds.length; catIdx++) {
      const categoryId = uniqueCategoryIds[catIdx];
      if (!categoryId) continue;
      await tx.productCategory.create({
        data: {
          productId: savedProduct.id,
          categoryId,
          position: catIdx,
          isPrimary: categoryId === primaryCatId,
        },
      });
    }

    // 4. Manuel koleksiyonları senkronla
    const manualCollections = await tx.collection.findMany({
      where: { type: "MANUAL" },
      select: { id: true },
    });
    const manualCollectionIdSet = new Set(manualCollections.map((c) => c.id));

    await tx.collectionProduct.deleteMany({
      where: {
        productId: savedProduct.id,
        collection: { type: "MANUAL" },
      },
    });

    const uniqueCollectionIds = Array.from(new Set(input.collectionIds)).filter(
      (cid) => manualCollectionIdSet.has(cid)
    );

    for (let colIdx = 0; colIdx < uniqueCollectionIds.length; colIdx++) {
      const collectionId = uniqueCollectionIds[colIdx];
      if (!collectionId) continue;
      await tx.collectionProduct.create({
        data: {
          collectionId,
          productId: savedProduct.id,
          position: colIdx,
        },
      });
    }

    // 5. Etiketleri senkronla
    await tx.productTag.deleteMany({
      where: { productId: savedProduct.id },
    });

    for (const tagId of tagIds) {
      await tx.productTag.create({
        data: {
          productId: savedProduct.id,
          tagId,
        },
      });
    }

    // 6. Özel alan değerlerini senkronla
    await tx.productAttributeValue.deleteMany({
      where: { productId: savedProduct.id },
    });

    for (const attr of input.attributes) {
      const hasValue =
        (attr.valueText !== null &&
          attr.valueText !== undefined &&
          attr.valueText.trim() !== "") ||
        (attr.valueNumber !== null &&
          attr.valueNumber !== undefined &&
          Number.isFinite(attr.valueNumber)) ||
        attr.valueBool !== null && attr.valueBool !== undefined ||
        attr.valueList.length > 0;

      if (!hasValue) continue;

      await tx.productAttributeValue.create({
        data: {
          productId: savedProduct.id,
          attributeId: attr.attributeId,
          valueText: attr.valueText ?? null,
          valueNumber: attr.valueNumber ?? null,
          valueBool: attr.valueBool ?? null,
          valueList: attr.valueList,
        },
      });
    }

    // 7. Varyantları ID / SKU / Başlık eşleşmesiyle senkronla
    const existingDbVariants = await tx.productVariant.findMany({
      where: { productId: savedProduct.id },
    });

    // Geçici SKU çakışmalarını önlemek için mevcut varyantların SKU'larını boşalt
    if (existingDbVariants.length > 0) {
      await tx.productVariant.updateMany({
        where: { productId: savedProduct.id },
        data: { sku: null },
      });
    }

    const usedExistingIds = new Set<string>();
    const keptVariantIds: string[] = [];

    for (let varIdx = 0; varIdx < input.variants.length; varIdx++) {
      const vInput = input.variants[varIdx];
      if (!vInput) continue;

      const cleanSku =
        vInput.sku && vInput.sku.trim().length > 0 ? vInput.sku.trim() : null;
      const cleanBarcode =
        vInput.barcode && vInput.barcode.trim().length > 0
          ? vInput.barcode.trim()
          : null;
      const cleanSupplierCode =
        vInput.supplierCode && vInput.supplierCode.trim().length > 0
          ? vInput.supplierCode.trim()
          : null;

      let matchedDbVariant = existingDbVariants.find(
        (ev) => vInput.id && ev.id === vInput.id && !usedExistingIds.has(ev.id)
      );

      if (!matchedDbVariant && cleanSku) {
        matchedDbVariant = existingDbVariants.find(
          (ev) =>
            ev.sku &&
            ev.sku.toLowerCase() === cleanSku.toLowerCase() &&
            !usedExistingIds.has(ev.id)
        );
      }

      if (!matchedDbVariant) {
        matchedDbVariant = existingDbVariants.find(
          (ev) =>
            ev.title.trim().toLowerCase() ===
              vInput.title.trim().toLowerCase() && !usedExistingIds.has(ev.id)
        );
      }

      const variantPayload = {
        title: vInput.title.trim(),
        sku: cleanSku,
        barcode: cleanBarcode,
        supplierCode: cleanSupplierCode,
        price: vInput.price,
        compareAtPrice: vInput.compareAtPrice ?? null,
        costPrice: vInput.costPrice ?? null,
        weightGrams: vInput.weightGrams ?? null,
        position: varIdx,
        isActive: vInput.isActive,
        trackInventory: vInput.trackInventory,
        allowBackorder: vInput.allowBackorder,
      };

      let savedVariantId: string;
      if (matchedDbVariant) {
        usedExistingIds.add(matchedDbVariant.id);
        const updatedVar = await tx.productVariant.update({
          where: { id: matchedDbVariant.id },
          data: variantPayload,
        });
        savedVariantId = updatedVar.id;
      } else {
        const createdVar = await tx.productVariant.create({
          data: {
            productId: savedProduct.id,
            ...variantPayload,
          },
        });
        savedVariantId = createdVar.id;
      }

      keptVariantIds.push(savedVariantId);

      // Varyant seçenek değerlerini bağla
      await tx.variantOptionValue.deleteMany({
        where: { variantId: savedVariantId },
      });

      const selections: VariantOptionSelection[] =
        vInput.optionValues && vInput.optionValues.length > 0
          ? vInput.optionValues
          : vInput.title.split(" / ").map((part, idx) => ({
              optionName: orderedOptionNames[idx] ?? "",
              value: part.trim(),
            }));

      for (const sel of selections) {
        if (!sel.optionName || !sel.value) continue;
        const ovId = optionValueIdByPair.get(
          `${sel.optionName.trim().toLowerCase()}:${sel.value.trim().toLowerCase()}`
        );
        if (ovId) {
          await tx.variantOptionValue.create({
            data: {
              variantId: savedVariantId,
              optionValueId: ovId,
            },
          });
        }
      }
    }

    // Artık listede olmayan eski varyantları kaldır
    const removedVariantIds = existingDbVariants
      .filter((ev) => !keptVariantIds.includes(ev.id))
      .map((ev) => ev.id);

    if (removedVariantIds.length > 0) {
      await tx.productVariant.deleteMany({
        where: { id: { in: removedVariantIds } },
      });
    }

    return savedProduct;
  });

  // 8. Varyantların başlangıç / düzenleyici stok değerlerini varsayılan depoda senkronla
  const finalVariants = await db.productVariant.findMany({
    where: { productId: product.id },
    include: { inventoryLevels: true },
    orderBy: { position: "asc" },
  });

  for (let idx = 0; idx < finalVariants.length; idx++) {
    const dbVar = finalVariants[idx];
    const inputVar = input.variants[idx];
    if (!dbVar || !inputVar) continue;

    if (inputVar.stock !== undefined) {
      const existingDefaultLevel = dbVar.inventoryLevels.find(
        (lvl) => lvl.warehouseId === defaultWarehouse.id
      );
      const currentStock = existingDefaultLevel?.onHand ?? 0;

      if (!existingDefaultLevel || currentStock !== inputVar.stock) {
        await recordStockMovement({
          variantId: dbVar.id,
          warehouseId: defaultWarehouse.id,
          type: isUpdate ? "COUNT" : "RECEIVE",
          mode: "set",
          quantity: inputVar.stock,
          reason: isUpdate
            ? "Ürün düzenleyici stok güncellemesi"
            : "İlk ürün stok girişi",
          staffUserId: staffUserId ?? null,
        });
      }
    }
  }

  await recalculateProductAggregates(product.id);

  await recordAudit({
    staffUserId: staffUserId ?? null,
    action: isUpdate ? "product.update" : "product.create",
    entityType: "Product",
    entityId: product.id,
    summary: `${product.title} ürünü ${isUpdate ? "güncellendi" : "oluşturuldu"} (${input.variants.length} varyant).`,
  });

  return product;
}

export async function softDeleteProduct(
  productId: string,
  staffUserId?: string | null
) {
  const product = await db.product.update({
    where: { id: productId },
    data: {
      deletedAt: new Date(),
      status: "ARCHIVED",
    },
  });

  await db.collectionProduct.deleteMany({
    where: { productId },
  });

  await recordAudit({
    staffUserId: staffUserId ?? null,
    action: "product.delete",
    entityType: "Product",
    entityId: product.id,
    summary: `${product.title} ürünü arşivlenerek silindi.`,
  });

  return product;
}

export async function bulkUpdateProductStatus(
  rawInput: BulkStatusUpdateInput,
  staffUserId?: string | null
) {
  const input = bulkStatusUpdateSchema.parse(rawInput);

  const res = await db.product.updateMany({
    where: {
      id: { in: input.productIds },
      deletedAt: null,
    },
    data: {
      status: input.status,
    },
  });

  await recordAudit({
    staffUserId: staffUserId ?? null,
    action: "product.bulk_status",
    entityType: "Product",
    summary: `${res.count} ürünün durumu ${input.status} olarak güncellendi.`,
  });

  return res.count;
}

export async function bulkUpdateProductPrices(
  rawInput: BulkPriceUpdateInput,
  staffUserId?: string | null
) {
  const input = bulkPriceUpdateSchema.parse(rawInput);

  const variants = await db.productVariant.findMany({
    where: {
      productId: { in: input.productIds },
      product: { deletedAt: null },
    },
  });

  const multiplier =
    input.mode === "increase_pct"
      ? 1 + input.percentage / 100
      : Math.max(0.01, 1 - input.percentage / 100);

  await db.$transaction(async (tx) => {
    for (const v of variants) {
      const rawNewPrice = Math.round(v.price * multiplier);
      const finalPrice = roundPriceMinor(rawNewPrice, input.rounding);

      await tx.productVariant.update({
        where: { id: v.id },
        data: { price: finalPrice },
      });
    }
  });

  const uniqueProductIds = Array.from(new Set(variants.map((v) => v.productId)));
  for (const pid of uniqueProductIds) {
    await recalculateProductAggregates(pid);
  }

  await recordAudit({
    staffUserId: staffUserId ?? null,
    action: "product.bulk_price",
    entityType: "Product",
    summary: `${uniqueProductIds.length} üründe (%${input.percentage} ${input.mode === "increase_pct" ? "artış" : "indirim"}) toplu fiyat güncellemesi yapıldı.`,
  });

  return uniqueProductIds.length;
}

export interface CategoryTreeNode {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  position: number;
  imageUrl: string | null;
  isActive: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  productCount: number;
  depth: number;
  pathNames: string[];
  children: CategoryTreeNode[];
}

export function buildCategoryTree(
  categories: Array<{
    id: string;
    name: string;
    slug: string;
    description: string | null;
    parentId: string | null;
    position: number;
    imageUrl: string | null;
    isActive: boolean;
    seoTitle: string | null;
    seoDescription: string | null;
    _count?: { products: number };
  }>
): CategoryTreeNode[] {
  const byParent = new Map<string | null, typeof categories>();

  for (const cat of categories) {
    const key = cat.parentId ?? null;
    const list = byParent.get(key) ?? [];
    list.push(cat);
    byParent.set(key, list);
  }

  for (const list of byParent.values()) {
    list.sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, "tr"));
  }

  const visited = new Set<string>();

  const buildNodes = (
    parentId: string | null,
    depth: number,
    ancestors: string[]
  ): CategoryTreeNode[] => {
    const childrenRaw = byParent.get(parentId) ?? [];
    const result: CategoryTreeNode[] = [];

    for (const item of childrenRaw) {
      if (visited.has(item.id)) continue;
      visited.add(item.id);
      const pathNames = [...ancestors, item.name];
      result.push({
        id: item.id,
        name: item.name,
        slug: item.slug,
        description: item.description,
        parentId: item.parentId,
        position: item.position,
        imageUrl: item.imageUrl,
        isActive: item.isActive,
        seoTitle: item.seoTitle,
        seoDescription: item.seoDescription,
        productCount: item._count?.products ?? 0,
        depth,
        pathNames,
        children: buildNodes(item.id, depth + 1, pathNames),
      });
    }

    return result;
  };

  return buildNodes(null, 0, []);
}

export function flattenCategoryTree(nodes: CategoryTreeNode[]): CategoryTreeNode[] {
  const flat: CategoryTreeNode[] = [];
  const walk = (list: CategoryTreeNode[]) => {
    for (const node of list) {
      flat.push(node);
      if (node.children.length > 0) {
        walk(node.children);
      }
    }
  };
  walk(nodes);
  return flat;
}

export async function getCategoryTree() {
  const rows = await db.category.findMany({
    include: {
      _count: {
        select: { products: true },
      },
    },
    orderBy: [{ position: "asc" }, { name: "asc" }],
  });

  const tree = buildCategoryTree(rows);
  const flat = flattenCategoryTree(tree);
  return { tree, flat, raw: rows };
}

export async function upsertCategory(
  rawInput: CategoryInput,
  staffUserId?: string | null
) {
  const input = categoryInputSchema.parse(rawInput);

  if (input.id && input.parentId && input.id === input.parentId) {
    throw new Error("Bir kategori kendisinin üst kategorisi olamaz.");
  }

  if (input.id && input.parentId) {
    // Döngü kontrolü
    const allCats = await db.category.findMany({
      select: { id: true, parentId: true },
    });
    const parentMap = new Map(allCats.map((c) => [c.id, c.parentId]));
    let cursor: string | null | undefined = input.parentId;
    while (cursor) {
      if (cursor === input.id) {
        throw new Error("Alt kategori üst kategori olarak seçilemez (döngüsel hiyerarşi).");
      }
      cursor = parentMap.get(cursor);
    }
  }

  const slugBase =
    input.slug && input.slug.trim().length > 0 ? input.slug.trim() : input.name;

  const slug = await ensureUniqueSlug(slugBase, async (candidate) => {
    const found = await db.category.findUnique({ where: { slug: candidate } });
    if (!found) return false;
    if (input.id && found.id === input.id) return false;
    return true;
  });

  const payload = {
    name: input.name,
    slug,
    description: input.description || null,
    parentId: input.parentId || null,
    position: input.position,
    imageUrl: input.imageUrl || null,
    isActive: input.isActive,
    seoTitle: input.seoTitle || null,
    seoDescription: input.seoDescription || null,
  };

  const category = input.id
    ? await db.category.update({
        where: { id: input.id },
        data: payload,
      })
    : await db.category.create({
        data: payload,
      });

  await recordAudit({
    staffUserId: staffUserId ?? null,
    action: input.id ? "category.update" : "category.create",
    entityType: "Category",
    entityId: category.id,
    summary: `${category.name} kategorisi kaydedildi.`,
  });

  return category;
}

export async function deleteCategory(
  categoryId: string,
  staffUserId?: string | null
) {
  const cat = await db.category.findUnique({ where: { id: categoryId } });
  if (!cat) return;

  await db.category.updateMany({
    where: { parentId: categoryId },
    data: { parentId: cat.parentId },
  });

  await db.category.delete({ where: { id: categoryId } });

  await recordAudit({
    staffUserId: staffUserId ?? null,
    action: "category.delete",
    entityType: "Category",
    entityId: categoryId,
    summary: `${cat.name} kategorisi silindi.`,
  });
}

export async function upsertCollection(
  rawInput: CollectionInput,
  staffUserId?: string | null
) {
  const input = collectionInputSchema.parse(rawInput);

  const slugBase =
    input.slug && input.slug.trim().length > 0 ? input.slug.trim() : input.title;

  const slug = await ensureUniqueSlug(slugBase, async (candidate) => {
    const found = await db.collection.findUnique({ where: { slug: candidate } });
    if (!found) return false;
    if (input.id && found.id === input.id) return false;
    return true;
  });

  const payload = {
    title: input.title,
    slug,
    description: input.description || null,
    imageUrl: input.imageUrl || null,
    type: input.type,
    rules: input.rules as unknown as Prisma.InputJsonValue,
    matchAll: input.matchAll,
    sortOrder: input.sortOrder,
    isActive: input.isActive,
    seoTitle: input.seoTitle || null,
    seoDescription: input.seoDescription || null,
  };

  const collection = input.id
    ? await db.collection.update({
        where: { id: input.id },
        data: payload,
      })
    : await db.collection.create({
        data: payload,
      });

  if (collection.type === "AUTOMATIC") {
    await syncAutomaticCollection(collection.id);
  } else if (input.productIds.length > 0 || input.id) {
    const uniquePids = Array.from(new Set(input.productIds));
    await db.$transaction(async (tx) => {
      await tx.collectionProduct.deleteMany({
        where: { collectionId: collection.id },
      });
      if (uniquePids.length > 0) {
        await tx.collectionProduct.createMany({
          data: uniquePids.map((productId, idx) => ({
            collectionId: collection.id,
            productId,
            position: idx,
          })),
        });
      }
    });
  }

  await recordAudit({
    staffUserId: staffUserId ?? null,
    action: input.id ? "collection.update" : "collection.create",
    entityType: "Collection",
    entityId: collection.id,
    summary: `${collection.title} koleksiyonu (${collection.type}) kaydedildi.`,
  });

  return collection;
}

export async function deleteCollection(
  collectionId: string,
  staffUserId?: string | null
) {
  const col = await db.collection.delete({
    where: { id: collectionId },
  });

  await recordAudit({
    staffUserId: staffUserId ?? null,
    action: "collection.delete",
    entityType: "Collection",
    entityId: collectionId,
    summary: `${col.title} koleksiyonu silindi.`,
  });
}

export async function upsertBrand(
  rawInput: BrandInput,
  staffUserId?: string | null
) {
  const input = brandInputSchema.parse(rawInput);

  const slugBase =
    input.slug && input.slug.trim().length > 0 ? input.slug.trim() : input.name;

  const slug = await ensureUniqueSlug(slugBase, async (candidate) => {
    const found = await db.brand.findUnique({ where: { slug: candidate } });
    if (!found) return false;
    if (input.id && found.id === input.id) return false;
    return true;
  });

  const brand = input.id
    ? await db.brand.update({
        where: { id: input.id },
        data: {
          name: input.name,
          slug,
          logoUrl: input.logoUrl || null,
          description: input.description || null,
        },
      })
    : await db.brand.create({
        data: {
          name: input.name,
          slug,
          logoUrl: input.logoUrl || null,
          description: input.description || null,
        },
      });

  await recordAudit({
    staffUserId: staffUserId ?? null,
    action: input.id ? "brand.update" : "brand.create",
    entityType: "Brand",
    entityId: brand.id,
    summary: `${brand.name} markası kaydedildi.`,
  });

  return brand;
}

export async function deleteBrand(brandId: string, staffUserId?: string | null) {
  const brand = await db.brand.delete({ where: { id: brandId } });

  await recordAudit({
    staffUserId: staffUserId ?? null,
    action: "brand.delete",
    entityType: "Brand",
    entityId: brandId,
    summary: `${brand.name} markası silindi.`,
  });
}

export async function createTag(rawInput: TagInput, staffUserId?: string | null) {
  const input = tagInputSchema.parse(rawInput);
  const slug = await ensureUniqueSlug(
    input.slug && input.slug.trim().length > 0 ? input.slug.trim() : input.name,
    async (candidate) => {
      const found = await db.tag.findUnique({ where: { slug: candidate } });
      return Boolean(found);
    }
  );

  const tag = await db.tag.upsert({
    where: { name: input.name },
    create: { name: input.name, slug },
    update: {},
  });

  await recordAudit({
    staffUserId: staffUserId ?? null,
    action: "tag.create",
    entityType: "Tag",
    entityId: tag.id,
    summary: `${tag.name} etiketi oluşturuldu.`,
  });

  return tag;
}

export async function deleteTag(tagId: string, staffUserId?: string | null) {
  const tag = await db.tag.delete({ where: { id: tagId } });

  await recordAudit({
    staffUserId: staffUserId ?? null,
    action: "tag.delete",
    entityType: "Tag",
    entityId: tagId,
    summary: `${tag.name} etiketi silindi.`,
  });
}

export async function upsertAttributeDefinition(
  rawInput: AttributeDefinitionInput,
  staffUserId?: string | null
) {
  const input = attributeDefinitionInputSchema.parse(rawInput);

  const desiredKey =
    input.key && input.key.trim().length > 0
      ? slugify(input.key).replace(/-/g, "_")
      : slugify(input.label).replace(/-/g, "_");

  const attr = input.id
    ? await db.attributeDefinition.update({
        where: { id: input.id },
        data: {
          key: desiredKey,
          label: input.label,
          kind: input.kind,
          options: input.options,
          unit: input.unit || null,
          isFilterable: input.isFilterable,
          isVisibleOnProduct: input.isVisibleOnProduct,
          position: input.position,
        },
      })
    : await db.attributeDefinition.create({
        data: {
          key: desiredKey,
          label: input.label,
          kind: input.kind,
          options: input.options,
          unit: input.unit || null,
          isFilterable: input.isFilterable,
          isVisibleOnProduct: input.isVisibleOnProduct,
          position: input.position,
        },
      });

  await recordAudit({
    staffUserId: staffUserId ?? null,
    action: input.id ? "attribute.update" : "attribute.create",
    entityType: "AttributeDefinition",
    entityId: attr.id,
    summary: `${attr.label} (${attr.kind}) özel alanı kaydedildi.`,
  });

  return attr;
}

export async function deleteAttributeDefinition(
  attributeId: string,
  staffUserId?: string | null
) {
  const attr = await db.attributeDefinition.delete({
    where: { id: attributeId },
  });

  await recordAudit({
    staffUserId: staffUserId ?? null,
    action: "attribute.delete",
    entityType: "AttributeDefinition",
    entityId: attributeId,
    summary: `${attr.label} özel alanı silindi.`,
  });
}

export async function upsertProductType(
  rawInput: ProductTypeInput,
  staffUserId?: string | null
) {
  const input = productTypeInputSchema.parse(rawInput);

  const productType = await db.$transaction(async (tx) => {
    const pt = input.id
      ? await tx.productType.update({
          where: { id: input.id },
          data: { name: input.name },
        })
      : await tx.productType.create({
          data: { name: input.name },
        });

    await tx.productTypeAttribute.deleteMany({
      where: { productTypeId: pt.id },
    });

    if (input.attributes.length > 0) {
      await tx.productTypeAttribute.createMany({
        data: input.attributes.map((attr, idx) => ({
          productTypeId: pt.id,
          attributeId: attr.attributeId,
          position: attr.position ?? idx,
          isRequired: attr.isRequired,
        })),
      });
    }

    return pt;
  });

  await recordAudit({
    staffUserId: staffUserId ?? null,
    action: input.id ? "product_type.update" : "product_type.create",
    entityType: "ProductType",
    entityId: productType.id,
    summary: `${productType.name} ürün tipi kaydedildi.`,
  });

  return productType;
}

export async function deleteProductType(
  productTypeId: string,
  staffUserId?: string | null
) {
  const pt = await db.productType.delete({
    where: { id: productTypeId },
  });

  await recordAudit({
    staffUserId: staffUserId ?? null,
    action: "product_type.delete",
    entityType: "ProductType",
    entityId: productTypeId,
    summary: `${pt.name} ürün tipi silindi.`,
  });
}

export async function upsertTaxClass(
  rawInput: TaxClassInput,
  staffUserId?: string | null
) {
  const input = taxClassInputSchema.parse(rawInput);

  const taxClass = await db.$transaction(async (tx) => {
    if (input.isDefault) {
      await tx.taxClass.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    if (input.id) {
      return tx.taxClass.update({
        where: { id: input.id },
        data: {
          name: input.name,
          rateBps: input.rateBps,
          isDefault: input.isDefault,
        },
      });
    }

    const count = await tx.taxClass.count();
    return tx.taxClass.create({
      data: {
        name: input.name,
        rateBps: input.rateBps,
        isDefault: count === 0 ? true : input.isDefault,
      },
    });
  });

  await recordAudit({
    staffUserId: staffUserId ?? null,
    action: input.id ? "tax_class.update" : "tax_class.create",
    entityType: "TaxClass",
    entityId: taxClass.id,
    summary: `${taxClass.name} (%${(taxClass.rateBps / 100).toFixed(0)}) KDV sınıfı kaydedildi.`,
  });

  return taxClass;
}

export async function deleteTaxClass(
  taxClassId: string,
  staffUserId?: string | null
) {
  const tc = await db.taxClass.delete({ where: { id: taxClassId } });

  await recordAudit({
    staffUserId: staffUserId ?? null,
    action: "tax_class.delete",
    entityType: "TaxClass",
    entityId: taxClassId,
    summary: `${tc.name} KDV sınıfı silindi.`,
  });
}

export async function upsertPriceList(
  rawInput: PriceListInput,
  staffUserId?: string | null
) {
  const input = priceListInputSchema.parse(rawInput);

  const startsAt =
    input.startsAt && input.startsAt.trim().length > 0
      ? new Date(input.startsAt)
      : null;
  const endsAt =
    input.endsAt && input.endsAt.trim().length > 0
      ? new Date(input.endsAt)
      : null;

  const payload = {
    name: input.name,
    description: input.description || null,
    customerGroupId: input.customerGroupId || null,
    startsAt: startsAt && !Number.isNaN(startsAt.getTime()) ? startsAt : null,
    endsAt: endsAt && !Number.isNaN(endsAt.getTime()) ? endsAt : null,
    isActive: input.isActive,
    priority: input.priority,
  };

  const priceList = input.id
    ? await db.priceList.update({
        where: { id: input.id },
        data: payload,
      })
    : await db.priceList.create({
        data: payload,
      });

  await recordAudit({
    staffUserId: staffUserId ?? null,
    action: input.id ? "price_list.update" : "price_list.create",
    entityType: "PriceList",
    entityId: priceList.id,
    summary: `${priceList.name} fiyat listesi kaydedildi.`,
  });

  return priceList;
}

export async function deletePriceList(
  priceListId: string,
  staffUserId?: string | null
) {
  const pl = await db.priceList.delete({ where: { id: priceListId } });

  await recordAudit({
    staffUserId: staffUserId ?? null,
    action: "price_list.delete",
    entityType: "PriceList",
    entityId: priceListId,
    summary: `${pl.name} fiyat listesi silindi.`,
  });
}

export async function upsertPriceListPrice(
  rawInput: PriceListPriceInput,
  staffUserId?: string | null
) {
  const input = priceListPriceInputSchema.parse(rawInput);

  const item = await db.priceListPrice.upsert({
    where: {
      priceListId_variantId: {
        priceListId: input.priceListId,
        variantId: input.variantId,
      },
    },
    create: {
      priceListId: input.priceListId,
      variantId: input.variantId,
      price: input.price,
    },
    update: {
      price: input.price,
    },
  });

  await recordAudit({
    staffUserId: staffUserId ?? null,
    action: "price_list_price.upsert",
    entityType: "PriceList",
    entityId: input.priceListId,
    summary: `Fiyat listesi varyant fiyatı güncellendi.`,
  });

  return item;
}

export async function deletePriceListPrice(
  id: string,
  staffUserId?: string | null
) {
  const deleted = await db.priceListPrice.delete({ where: { id } });

  await recordAudit({
    staffUserId: staffUserId ?? null,
    action: "price_list_price.delete",
    entityType: "PriceList",
    entityId: deleted.priceListId,
    summary: `Fiyat listesinden özel varyant fiyatı kaldırıldı.`,
  });
}

export async function getProductEditorContext(productId?: string) {
  const [
    product,
    categoriesData,
    brands,
    collections,
    productTypes,
    attributes,
    taxClasses,
    tags,
  ] = await Promise.all([
    productId
      ? db.product.findFirst({
          where: { id: productId, deletedAt: null },
          include: {
            options: {
              orderBy: { position: "asc" },
              include: {
                values: { orderBy: { position: "asc" } },
              },
            },
            variants: {
              orderBy: { position: "asc" },
              include: {
                optionValues: {
                  include: {
                    optionValue: {
                      include: { option: true },
                    },
                  },
                },
                inventoryLevels: {
                  include: { warehouse: true },
                },
              },
            },
            images: { orderBy: { position: "asc" } },
            categories: { orderBy: { position: "asc" } },
            collections: { orderBy: { position: "asc" } },
            tags: { include: { tag: true } },
            attributes: true,
          },
        })
      : Promise.resolve(null),
    getCategoryTree(),
    db.brand.findMany({ orderBy: { name: "asc" } }),
    db.collection.findMany({
      where: { type: "MANUAL" },
      orderBy: { title: "asc" },
    }),
    db.productType.findMany({
      orderBy: { name: "asc" },
      include: {
        attributes: {
          orderBy: { position: "asc" },
          include: { attribute: true },
        },
      },
    }),
    db.attributeDefinition.findMany({
      orderBy: [{ position: "asc" }, { label: "asc" }],
    }),
    db.taxClass.findMany({
      orderBy: [{ isDefault: "desc" }, { rateBps: "desc" }],
    }),
    db.tag.findMany({ orderBy: { name: "asc" } }),
  ]);

  return {
    product,
    categoriesFlat: categoriesData.flat,
    brands,
    collections,
    productTypes,
    attributes,
    taxClasses,
    tags,
  };
}

export async function getProductEditorData(
  productId?: string
): Promise<ProductEditorData> {
  const ctx = await getProductEditorContext(productId);
  const p = ctx.product;

  return {
    product: p
      ? {
          id: p.id,
          title: p.title,
          slug: p.slug,
          subtitle: p.subtitle ?? "",
          description: p.description ?? "",
          status: p.status,
          publishedAt: p.publishedAt
            ? p.publishedAt.toISOString().slice(0, 16)
            : "",
          brandId: p.brandId ?? "",
          productTypeId: p.productTypeId ?? "",
          taxClassId: p.taxClassId ?? "",
          seoTitle: p.seoTitle ?? "",
          seoDescription: p.seoDescription ?? "",
          weightGrams: p.weightGrams ?? null,
          categoryIds: p.categories.map((c) => c.categoryId),
          primaryCategoryId:
            p.categories.find((c) => c.isPrimary)?.categoryId ??
            p.categories[0]?.categoryId ??
            null,
          collectionIds: p.collections.map((c) => c.collectionId),
          tagNames: p.tags.map((t) => t.tag.name),
          options: p.options.map((o, oIdx) => ({
            id: o.id,
            name: o.name,
            position: oIdx,
            values: o.values.map((v, vIdx) => ({
              id: v.id,
              value: v.value,
              swatch: v.swatch ?? null,
              position: vIdx,
            })),
          })),
          variants: p.variants.map((v, vIdx) => {
            const totalVarStock = v.inventoryLevels.reduce(
              (sum, lvl) => sum + Math.max(0, lvl.onHand),
              0
            );
            return {
              id: v.id,
              title: v.title,
              sku: v.sku ?? null,
              barcode: v.barcode ?? null,
              supplierCode: v.supplierCode ?? null,
              price: v.price,
              compareAtPrice: v.compareAtPrice ?? null,
              costPrice: v.costPrice ?? null,
              weightGrams: v.weightGrams ?? null,
              position: vIdx,
              isActive: v.isActive,
              trackInventory: v.trackInventory,
              allowBackorder: v.allowBackorder,
              stock: totalVarStock,
              optionValues: v.optionValues.map((ov) => ({
                optionName: ov.optionValue.option.name,
                value: ov.optionValue.value,
              })),
            };
          }),
          images: p.images.map((img, iIdx) => ({
            id: img.id,
            url: img.url,
            alt: img.alt ?? null,
            width: img.width ?? null,
            height: img.height ?? null,
            position: iIdx,
          })),
          attributes: p.attributes.map((a) => ({
            attributeId: a.attributeId,
            valueText: a.valueText ?? null,
            valueNumber: a.valueNumber ?? null,
            valueBool: a.valueBool ?? null,
            valueList: a.valueList,
          })),
        }
      : null,
    categoriesFlat: ctx.categoriesFlat.map((c) => ({
      id: c.id,
      name: c.name,
      depth: c.depth,
      pathNames: c.pathNames,
    })),
    brands: ctx.brands.map((b) => ({ id: b.id, name: b.name })),
    collections: ctx.collections.map((c) => ({ id: c.id, title: c.title })),
    productTypes: ctx.productTypes.map((pt) => ({
      id: pt.id,
      name: pt.name,
      attributes: pt.attributes.map((pta) => ({
        attributeId: pta.attributeId,
        position: pta.position,
        isRequired: pta.isRequired,
        attribute: {
          id: pta.attribute.id,
          key: pta.attribute.key,
          label: pta.attribute.label,
          kind: pta.attribute.kind,
          options: pta.attribute.options,
          unit: pta.attribute.unit ?? null,
        },
      })),
    })),
    attributes: ctx.attributes.map((a) => ({
      id: a.id,
      key: a.key,
      label: a.label,
      kind: a.kind,
      options: a.options,
      unit: a.unit ?? null,
    })),
    taxClasses: ctx.taxClasses.map((tc) => ({
      id: tc.id,
      name: tc.name,
      rateBps: tc.rateBps,
      isDefault: tc.isDefault,
    })),
    tags: ctx.tags.map((t) => ({ id: t.id, name: t.name })),
  };
}

/**
 * Verilen kategori ID veya slug değeri için o kategorinin kendisi ve TÜM alt/torun kategorilerinin ID listesini döner.
 * Ağaç yapısında kaç seviye derinlikte olursa olsun tüm alt kategori ID'lerini toplar.
 */
export async function getCategoryAndDescendantIds(target: {
  id?: string;
  slug?: string;
}): Promise<string[]> {
  const allCategories = await db.category.findMany({
    where: { isActive: true },
    select: { id: true, slug: true, parentId: true },
  });

  const root = allCategories.find(
    (c) => (target.id && c.id === target.id) || (target.slug && c.slug === target.slug)
  );

  if (!root) return [];

  const resultIds = new Set<string>([root.id]);
  let added = true;
  while (added) {
    added = false;
    for (const cat of allCategories) {
      if (cat.parentId && resultIds.has(cat.parentId) && !resultIds.has(cat.id)) {
        resultIds.add(cat.id);
        added = true;
      }
    }
  }

  return Array.from(resultIds);
}

/**
 * Verilen kategori için köke kadar tüm ata (parent, grandparent...) kategorileri sırasıyla döner.
 */
export async function getCategoryAncestors(
  categoryId: string
): Promise<Array<{ id: string; name: string; slug: string }>> {
  const allCategories = await db.category.findMany({
    where: { isActive: true },
    select: { id: true, name: true, slug: true, parentId: true },
  });

  const categoryMap = new Map(allCategories.map((c) => [c.id, c]));
  const ancestors: Array<{ id: string; name: string; slug: string }> = [];

  let current = categoryMap.get(categoryId);
  while (current && current.parentId) {
    const parent = categoryMap.get(current.parentId);
    if (!parent) break;
    ancestors.unshift({ id: parent.id, name: parent.name, slug: parent.slug });
    current = parent;
  }

  return ancestors;
}

/**
 * Tüm aktif kategorileri, alt kategorilerindeki ürünleri de toplayarak (recursive productCount) döner.
 */
export async function getCategoriesWithRecursiveCounts(): Promise<
  Array<{
    id: string;
    name: string;
    slug: string;
    parentId: string | null;
    position: number;
    productCount: number;
  }>
> {
  const [categories, productCategories] = await Promise.all([
    db.category.findMany({
      where: { isActive: true },
      orderBy: [{ position: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        parentId: true,
        position: true,
      },
    }),
    db.productCategory.findMany({
      where: {
        product: {
          status: "ACTIVE",
          deletedAt: null,
        },
      },
      select: {
        productId: true,
        categoryId: true,
      },
    }),
  ]);

  const catToProducts = new Map<string, Set<string>>();
  for (const cat of categories) {
    catToProducts.set(cat.id, new Set<string>());
  }
  for (const pc of productCategories) {
    const s = catToProducts.get(pc.categoryId);
    if (s) s.add(pc.productId);
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const cat of categories) {
      if (!cat.parentId) continue;
      const childSet = catToProducts.get(cat.id);
      const parentSet = catToProducts.get(cat.parentId);
      if (childSet && parentSet) {
        const prevSize = parentSet.size;
        for (const pid of childSet) {
          parentSet.add(pid);
        }
        if (parentSet.size > prevSize) {
          changed = true;
        }
      }
    }
  }

  return categories.map((cat) => ({
    ...cat,
    productCount: catToProducts.get(cat.id)?.size ?? 0,
  }));
}


