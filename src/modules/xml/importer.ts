import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { parseMoneyInput } from "@/lib/money";
import { ensureUniqueSlug, slugify } from "@/lib/slug";
import { emitDomainEvent } from "@/lib/events";
import type { Prisma } from "@/generated/prisma/client";
import {
  extractItemsByPath,
  getObjectListByPath,
  getStringByPath,
  getStringListByPath,
  inspectXmlStructure,
  loadFeedXmlBuffer,
} from "@/modules/xml/parser";
import {
  parseFeedMapping,
  parseFeedTransform,
  parseFeedUpdatePolicy,
  type FeedMapping,
  type FeedPreviewSampleItem,
  type FeedRunErrorItem,
  type FeedRunStats,
  type FeedTransform,
  type FeedUpdatePolicy,
} from "@/modules/xml/schemas";
import {
  parseAndTransformPrice,
  transformDescriptionText,
  transformProductTitle,
  transformStockQuantity,
  transformText,
} from "@/modules/xml/transform";

interface NormalizedVariantInput {
  sku: string;
  barcode: string | null;
  supplierCode: string;
  title: string;
  priceMinor: number;
  compareAtPriceMinor: number | null;
  costPriceMinor: number | null;
  stock: number;
  weightGrams: number | null;
  option1Value: string;
  option2Value: string;
}

interface NormalizedAttributeInput {
  name: string;
  value: string;
}

interface NormalizedProductInput {
  externalId: string;
  matchValue: string;
  sku: string;
  barcode: string | null;
  title: string;
  subtitle: string | null;
  description: string | null;
  brandName: string | null;
  sourceCategory: string | null;
  sourcePriceMinor: number;
  finalPriceMinor: number;
  compareAtPriceMinor: number | null;
  costPriceMinor: number | null;
  sourceStock: number;
  finalStock: number;
  weightGrams: number | null;
  images: string[];
  option1Name: string;
  option2Name: string;
  variants: NormalizedVariantInput[];
  attributes: NormalizedAttributeInput[];
}

export interface RunFeedImportResult {
  runId: string;
  mode: "PREVIEW" | "APPLY";
  stats: FeedRunStats;
  sample: FeedPreviewSampleItem[];
  errors: FeedRunErrorItem[];
}

function getVariantFieldValue(
  vNode: Record<string, unknown>,
  path: string,
  variantsPath?: string
): string {
  if (!path) return "";
  let val = getStringByPath(vNode, path);
  if (val) return val;

  if (variantsPath && path.toLowerCase().startsWith(variantsPath.toLowerCase() + ".")) {
    const relativePath = path.slice(variantsPath.length + 1);
    val = getStringByPath(vNode, relativePath);
    if (val) return val;
  }

  const lastPart = path.split(".").pop();
  if (lastPart && lastPart !== path) {
    val = getStringByPath(vNode, lastPart);
    if (val) return val;
  }

  return "";
}

export function normalizeXmlItem(
  rawItem: Record<string, unknown>,
  mapping: FeedMapping,
  transform: FeedTransform,
  matchKey: "SKU" | "BARCODE" | "SUPPLIER_CODE"
): NormalizedProductInput {
  const rawExternalId =
    getStringByPath(rawItem, mapping.externalIdPath) ||
    getStringByPath(rawItem, "product_code") ||
    getStringByPath(rawItem, "product_id") ||
    getStringByPath(rawItem, "UrunKodu") ||
    getStringByPath(rawItem, "id") ||
    getStringByPath(rawItem, "code");

  const rawSku =
    getStringByPath(rawItem, mapping.skuPath) ||
    getStringByPath(rawItem, "product_code") ||
    getStringByPath(rawItem, "product_model") ||
    getStringByPath(rawItem, "StokKodu") ||
    getStringByPath(rawItem, "sku");

  const rawBarcode =
    getStringByPath(rawItem, mapping.barcodePath) ||
    getStringByPath(rawItem, "Barkod") ||
    getStringByPath(rawItem, "Barcode") ||
    getStringByPath(rawItem, "barcode") ||
    getStringByPath(rawItem, "ean");

  const externalId = rawExternalId || rawSku || rawBarcode;
  const sku = rawSku || externalId;
  const barcode = rawBarcode || null;

  const rawTitle =
    getStringByPath(rawItem, mapping.titlePath) ||
    getStringByPath(rawItem, "product_name") ||
    getStringByPath(rawItem, "product_title") ||
    getStringByPath(rawItem, "Baslik") ||
    getStringByPath(rawItem, "UrunAdi") ||
    getStringByPath(rawItem, "Title") ||
    getStringByPath(rawItem, "Name") ||
    getStringByPath(rawItem, "title") ||
    getStringByPath(rawItem, "name");
  const title = transformProductTitle(rawTitle, transform);

  const rawSubtitle = mapping.subtitlePath
    ? getStringByPath(rawItem, mapping.subtitlePath)
    : "";
  const subtitle = rawSubtitle
    ? transformText(rawSubtitle, transform, { isTitle: false })
    : null;

  const rawDescription =
    (mapping.descriptionPath ? getStringByPath(rawItem, mapping.descriptionPath) : "") ||
    getStringByPath(rawItem, "product_description") ||
    getStringByPath(rawItem, "Aciklama") ||
    getStringByPath(rawItem, "Description") ||
    getStringByPath(rawItem, "description") ||
    getStringByPath(rawItem, "Detay");
  const description = rawDescription
    ? transformDescriptionText(rawDescription, transform)
    : null;

  const brandName =
    (mapping.brandPath ? getStringByPath(rawItem, mapping.brandPath) : "") ||
    getStringByPath(rawItem, "brand") ||
    getStringByPath(rawItem, "Marka") ||
    getStringByPath(rawItem, "Brand") ||
    null;

  const sourceCategory =
    (mapping.categoryPath ? getStringByPath(rawItem, mapping.categoryPath) : "") ||
    getStringByPath(rawItem, "category") ||
    getStringByPath(rawItem, "Kategori") ||
    getStringByPath(rawItem, "Category") ||
    null;

  const rawVat =
    (mapping.taxRatePath ? getStringByPath(rawItem, mapping.taxRatePath) : "") ||
    getStringByPath(rawItem, "vat") ||
    getStringByPath(rawItem, "KdvOrani") ||
    null;

  const rawPrice =
    (mapping.pricePath ? getStringByPath(rawItem, mapping.pricePath) : "") ||
    getStringByPath(rawItem, "sale_price") ||
    getStringByPath(rawItem, "price") ||
    getStringByPath(rawItem, "SatisFiyati") ||
    getStringByPath(rawItem, "Fiyat");
  const sourcePriceMinor = parseMoneyInput(rawPrice);
  const finalPriceMinor = parseAndTransformPrice(rawPrice, transform, rawVat);

  const rawCompareAt = mapping.compareAtPricePath
    ? getStringByPath(rawItem, mapping.compareAtPricePath)
    : (getStringByPath(rawItem, "sale_price") ? getStringByPath(rawItem, "price") : "") ||
      getStringByPath(rawItem, "PiyasaFiyati");
  const compareAtTransformed = rawCompareAt
    ? parseAndTransformPrice(rawCompareAt, transform, rawVat)
    : 0;
  const compareAtPriceMinor =
    compareAtTransformed > finalPriceMinor ? compareAtTransformed : null;

  const rawCost = mapping.costPricePath
    ? getStringByPath(rawItem, mapping.costPricePath)
    : getStringByPath(rawItem, "buy_price") || getStringByPath(rawItem, "AlisFiyati");
  const costParsed = rawCost ? parseMoneyInput(rawCost) : 0;
  const costPriceMinor =
    costParsed > 0
      ? Math.round(costParsed * transform.currencyMultiplier)
      : null;

  const rawStock =
    (mapping.stockPath ? getStringByPath(rawItem, mapping.stockPath) : "") ||
    getStringByPath(rawItem, "stock") ||
    getStringByPath(rawItem, "Stok");
  const parsedSourceStock = Math.floor(
    Number(String(rawStock || "0").replace(",", ".").trim())
  );
  const sourceStock =
    Number.isFinite(parsedSourceStock) && parsedSourceStock > 0
      ? parsedSourceStock
      : 0;
  const finalStock = transformStockQuantity(rawStock, transform);

  const rawWeight = mapping.weightGramsPath
    ? getStringByPath(rawItem, mapping.weightGramsPath)
    : "";
  const parsedWeight = Math.round(
    Number(String(rawWeight || "0").replace(",", ".").trim())
  );
  const weightGrams =
    Number.isFinite(parsedWeight) && parsedWeight > 0 ? parsedWeight : null;

  const images = (() => {
    const list = getStringListByPath(rawItem, mapping.imagesPath);
    if (list.length > 0) return list;
    const fromImages = getStringListByPath(rawItem, "images.image");
    if (fromImages.length > 0) return fromImages;
    const fromResimler = getStringListByPath(rawItem, "Resimler.Resim");
    if (fromResimler.length > 0) return fromResimler;
    return getStringListByPath(rawItem, "Gorseller.Gorsel");
  })();

  let rawVariantNodes = getObjectListByPath(rawItem, mapping.variantsPath);
  if (rawVariantNodes.length === 0) {
    const fallbackVariantPaths = [
      "varriants.variant",
      "variants.variant",
      "Varyantlar.Varyant",
      "Secenekler.Secenek",
      "Variants.Variant",
      "urun_secenek.secenek",
      "subproducts.subproduct",
      "options.option",
      "varriants",
      "variants",
    ];
    for (const fbPath of fallbackVariantPaths) {
      const candNodes = getObjectListByPath(rawItem, fbPath);
      if (candNodes.length > 0) {
        rawVariantNodes = candNodes;
        break;
      }
    }
  }

  const variants: NormalizedVariantInput[] = [];
  let discoveredOption1Name = mapping.variantOption1Name || "";
  let discoveredOption2Name = mapping.variantOption2Name || "";

  if (rawVariantNodes.length > 0) {
    for (let idx = 0; idx < rawVariantNodes.length; idx++) {
      const vNode = rawVariantNodes[idx];
      if (!vNode) continue;
      const vSku =
        getVariantFieldValue(vNode, mapping.variantSkuPath, mapping.variantsPath) ||
        getVariantFieldValue(vNode, "@_Sku") ||
        getVariantFieldValue(vNode, "Sku") ||
        getVariantFieldValue(vNode, "sku") ||
        getVariantFieldValue(vNode, "StokKodu") ||
        getVariantFieldValue(vNode, "stok_kodu") ||
        getVariantFieldValue(vNode, "Barkod") ||
        getVariantFieldValue(vNode, "Barcode") ||
        `${sku}-${idx + 1}`;
      const vBarcode =
        getVariantFieldValue(vNode, mapping.variantBarcodePath, mapping.variantsPath) ||
        getVariantFieldValue(vNode, "@_Barkod") ||
        getVariantFieldValue(vNode, "Barkod") ||
        getVariantFieldValue(vNode, "@_Barcode") ||
        getVariantFieldValue(vNode, "Barcode") ||
        getVariantFieldValue(vNode, "barcode") ||
        getVariantFieldValue(vNode, "Ean") ||
        null;
      let opt1 =
        getVariantFieldValue(vNode, mapping.variantOption1Path, mapping.variantsPath) ||
        getVariantFieldValue(vNode, "@_Renk") ||
        getVariantFieldValue(vNode, "Renk") ||
        getVariantFieldValue(vNode, "@_Color") ||
        getVariantFieldValue(vNode, "Color") ||
        "";
      let opt2 =
        getVariantFieldValue(vNode, mapping.variantOption2Path, mapping.variantsPath) ||
        getVariantFieldValue(vNode, "@_Beden") ||
        getVariantFieldValue(vNode, "Beden") ||
        getVariantFieldValue(vNode, "@_Size") ||
        getVariantFieldValue(vNode, "Size") ||
        "";

      if (opt1 && !discoveredOption1Name) discoveredOption1Name = "Renk";
      if (opt2 && !discoveredOption2Name) discoveredOption2Name = "Beden";

      // Dinamik seçenek keşfi (Renk ve Beden dışındaki özellikler için)
      if (!opt1 || !opt2) {
        const IGNORED_OPTION_KEYS = new Set([
          "sku",
          "stokkodu",
          "stok_kodu",
          "stock_code",
          "code",
          "barcode",
          "barkod",
          "ean",
          "gtin",
          "price",
          "fiyat",
          "satisfiyati",
          "indirimlifiyat",
          "sale_price",
          "stock",
          "stok",
          "miktar",
          "quantity",
          "stokadedi",
          "id",
          "variantid",
          "variant_id",
          "title",
          "baslik",
          "name",
          "ad",
          "#text",
          "#cdata",
        ]);

        for (const [k, val] of Object.entries(vNode)) {
          const cleanK = k.replace(/^@_/, "").trim();
          const kNorm = cleanK.toLowerCase().replace(/[_-]/g, "");
          if (IGNORED_OPTION_KEYS.has(kNorm)) continue;
          const valStr = typeof val === "string" ? val.trim() : typeof val === "number" ? String(val) : "";
          if (!valStr) continue;

          if (!opt1) {
            opt1 = valStr;
            discoveredOption1Name = cleanK;
          } else if (!opt2 && valStr !== opt1) {
            opt2 = valStr;
            discoveredOption2Name = cleanK;
          }
        }
      }

      const explicitVTitle = getVariantFieldValue(vNode, mapping.variantTitlePath, mapping.variantsPath);
      const vTitle =
        explicitVTitle ||
        [opt1, opt2].filter(Boolean).join(" / ") ||
        `Varyant ${idx + 1}`;

      const vPriceStr =
        getVariantFieldValue(vNode, mapping.variantPricePath, mapping.variantsPath) ||
        getVariantFieldValue(vNode, "@_Price") ||
        getVariantFieldValue(vNode, "Price") ||
        getVariantFieldValue(vNode, "price") ||
        getVariantFieldValue(vNode, "@_Fiyat") ||
        getVariantFieldValue(vNode, "Fiyat") ||
        getVariantFieldValue(vNode, "fiyat") ||
        rawPrice;
      const vPriceMinor =
        parseAndTransformPrice(vPriceStr, transform, rawVat) ||
        finalPriceMinor;

      const vStockStr =
        getVariantFieldValue(vNode, mapping.variantStockPath, mapping.variantsPath) ||
        getVariantFieldValue(vNode, "@_Stock") ||
        getVariantFieldValue(vNode, "Stock") ||
        getVariantFieldValue(vNode, "stock") ||
        getVariantFieldValue(vNode, "@_Stok") ||
        getVariantFieldValue(vNode, "Stok") ||
        getVariantFieldValue(vNode, "stok") ||
        rawStock;
      const vStock = transformStockQuantity(vStockStr, transform);

      variants.push({
        sku: vSku,
        barcode: vBarcode,
        supplierCode: `${externalId}:${vSku}`,
        title: vTitle,
        priceMinor: vPriceMinor,
        compareAtPriceMinor:
          compareAtPriceMinor && compareAtPriceMinor > vPriceMinor
            ? compareAtPriceMinor
            : null,
        costPriceMinor,
        stock: vStock,
        weightGrams,
        option1Value: opt1,
        option2Value: opt2,
      });
    }
  }

  if (variants.length === 0) {
    variants.push({
      sku,
      barcode,
      supplierCode: externalId,
      title: "Standart",
      priceMinor: finalPriceMinor,
      compareAtPriceMinor,
      costPriceMinor,
      stock: finalStock,
      weightGrams,
      option1Value: "",
      option2Value: "",
    });
  }

  const totalVariantStock =
    rawVariantNodes.length > 0
      ? variants.reduce((sum, v) => sum + v.stock, 0)
      : finalStock;
  const minVariantPrice = variants.reduce(
    (min, v) => (v.priceMinor < min ? v.priceMinor : min),
    variants[0]?.priceMinor ?? finalPriceMinor
  );

  const rawAttrNodes = getObjectListByPath(rawItem, mapping.attributesPath);
  const attributes: NormalizedAttributeInput[] = [];
  for (const aNode of rawAttrNodes) {
    const aName =
      getStringByPath(aNode, mapping.attributeNameKey) ||
      getStringByPath(aNode, "@_Ad") ||
      getStringByPath(aNode, "@_name") ||
      getStringByPath(aNode, "Name");
    const aVal =
      getStringByPath(aNode, mapping.attributeValueKey) ||
      getStringByPath(aNode, "#text") ||
      getStringByPath(aNode, "Value");
    if (aName && aVal) {
      attributes.push({ name: aName, value: aVal });
    }
  }

  let matchValue = externalId;
  if (matchKey === "SKU") {
    matchValue = sku || variants[0]?.sku || externalId;
  } else if (matchKey === "BARCODE") {
    matchValue = barcode ?? variants[0]?.barcode ?? externalId;
  }

  return {
    externalId,
    matchValue,
    sku,
    barcode,
    title,
    subtitle,
    description,
    brandName,
    sourceCategory,
    sourcePriceMinor,
    finalPriceMinor: minVariantPrice,
    compareAtPriceMinor,
    costPriceMinor,
    sourceStock,
    finalStock: totalVariantStock,
    weightGrams,
    images,
    option1Name: discoveredOption1Name || mapping.variantOption1Name || "Seçenek 1",
    option2Name: discoveredOption2Name || mapping.variantOption2Name || "Seçenek 2",
    variants,
    attributes,
  };
}

function computeProductHash(
  item: NormalizedProductInput,
  targetCategoryId: string | null,
  policy: FeedUpdatePolicy
): string {
  const payload = {
    price: policy.updatePrice
      ? item.variants.map((v) => ({
          sku: v.sku,
          price: v.priceMinor,
          compare: v.compareAtPriceMinor,
          cost: v.costPriceMinor,
        }))
      : null,
    stock: policy.updateStock
      ? item.variants.map((v) => ({ sku: v.sku, stock: v.stock }))
      : null,
    title: policy.titlePolicy === "ALWAYS" ? item.title : null,
    description: policy.descriptionPolicy === "ALWAYS" ? item.description : null,
    images: policy.imagesPolicy === "ALWAYS" ? item.images : null,
    brand: policy.brandPolicy === "ALWAYS" ? item.brandName : null,
    category: policy.categoryPolicy === "ALWAYS" ? targetCategoryId : null,
    attributes: policy.attributesPolicy === "ALWAYS" ? item.attributes : null,
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

async function resolveOrCreateBrandId(
  brandName: string | null,
  cache: Map<string, string>
): Promise<string | null> {
  if (!brandName) return null;
  const clean = brandName.trim();
  if (!clean) return null;
  const key = clean.toLowerCase();
  const cached = cache.get(key);
  if (cached) return cached;

  const existing = await db.brand.findFirst({
    where: { name: { equals: clean, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) {
    cache.set(key, existing.id);
    return existing.id;
  }

  const slug = await ensureUniqueSlug(clean, async (cand) => {
    const found = await db.brand.findUnique({
      where: { slug: cand },
      select: { id: true },
    });
    return Boolean(found);
  });

  const created = await db.brand.create({
    data: { name: clean, slug },
    select: { id: true },
  });
  cache.set(key, created.id);
  return created.id;
}

const categoryCreationCache = new Map<string, { id: string; name: string }>();

async function resolveOrCreateCategoryFromXmlPath(
  sourceId: string,
  rawSourceCategory: string,
  cache: Map<string, { id: string; name: string }> = categoryCreationCache
): Promise<{ id: string; name: string }> {
  let sourceCategory = rawSourceCategory.trim();
  if (sourceCategory.startsWith("<![CDATA[") && sourceCategory.endsWith("]]>")) {
    sourceCategory = sourceCategory.slice(9, -3).trim();
  }
  if (!sourceCategory) {
    throw new Error("Kategori yolu boş.");
  }

  const cached = cache.get(sourceCategory);
  if (cached) return cached;

  const parts = sourceCategory
    .split(/>|\/|\|/)
    .map((p) => {
      let clean = p.trim();
      if (clean.startsWith("<![CDATA[")) clean = clean.slice(9);
      if (clean.endsWith("]]>")) clean = clean.slice(0, -3);
      if (clean.endsWith("]]")) clean = clean.slice(0, -2);
      return clean.trim();
    })
    .filter(Boolean);

  let parentId: string | null = null;
  let lastCategory: { id: string; name: string } | null = null;

  for (const partName of parts) {
    const existing: { id: string; name: string } | null =
      await db.category.findFirst({
        where: {
          name: { equals: partName, mode: "insensitive" },
          parentId,
        },
        select: { id: true, name: true },
      });

    if (existing) {
      parentId = existing.id;
      lastCategory = existing;
    } else {
      const slug = await ensureUniqueSlug(partName, async (cand) => {
        const found = await db.category.findUnique({
          where: { slug: cand },
          select: { id: true },
        });
        return Boolean(found);
      });
      const created: { id: string; name: string } = await db.category.create({
        data: {
          name: partName,
          slug,
          parentId,
          isActive: true,
        },
        select: { id: true, name: true },
      });
      parentId = created.id;
      lastCategory = created;
    }
  }

  if (!lastCategory) {
    throw new Error(`Kategori oluşturulamadı: ${sourceCategory}`);
  }

  await db.feedCategoryMap.upsert({
    where: {
      sourceId_sourceCategory: {
        sourceId,
        sourceCategory: rawSourceCategory,
      },
    },
    create: {
      sourceId,
      sourceCategory: rawSourceCategory,
      categoryId: lastCategory.id,
    },
    update: {
      categoryId: lastCategory.id,
    },
  });

  cache.set(sourceCategory, lastCategory);
  cache.set(rawSourceCategory, lastCategory);
  return lastCategory;
}

async function syncProductAttributes(
  productId: string,
  attributes: NormalizedAttributeInput[]
): Promise<void> {
  if (attributes.length === 0) return;

  for (let i = 0; i < attributes.length; i++) {
    const attr = attributes[i];
    if (!attr) continue;
    const key = slugify(attr.name).replace(/-/g, "_");
    if (!key) continue;

    const definition = await db.attributeDefinition.upsert({
      where: { key },
      create: {
        key,
        label: attr.name,
        kind: "TEXT",
        options: [],
        isFilterable: true,
        isVisibleOnProduct: true,
        position: i,
      },
      update: {},
      select: { id: true },
    });

    await db.productAttributeValue.upsert({
      where: {
        productId_attributeId: {
          productId,
          attributeId: definition.id,
        },
      },
      create: {
        productId,
        attributeId: definition.id,
        valueText: attr.value,
        valueList: [],
      },
      update: {
        valueText: attr.value,
      },
    });
  }
}

async function syncVariantOptionsAndStock(params: {
  productId: string;
  item: NormalizedProductInput;
  warehouseId: string;
  runId: string;
  sourceName: string;
  updatePrice: boolean;
  updateStock: boolean;
  isNewProduct: boolean;
}): Promise<void> {
  const {
    productId,
    item,
    warehouseId,
    runId,
    sourceName,
    updatePrice,
    updateStock,
    isNewProduct,
  } = params;

  if (item.variants.length === 0) return;

  const hasOption1 = item.variants.some((v) => v.option1Value.length > 0);
  const hasOption2 = item.variants.some((v) => v.option2Value.length > 0);

  // 1. Ürünün mevcut seçeneklerini tek seferde al
  const existingOptions = isNewProduct
    ? []
    : await db.productOption.findMany({
        where: { productId },
        include: { values: true },
      });

  const optionMap = new Map(existingOptions.map((o) => [o.name, o]));

  let opt1 = optionMap.get(item.option1Name);
  if (hasOption1 && !opt1) {
    const createdOpt1 = await db.productOption.create({
      data: { productId, name: item.option1Name, position: 0 },
      include: { values: true },
    });
    opt1 = createdOpt1;
    optionMap.set(item.option1Name, createdOpt1);
  }

  let opt2 = optionMap.get(item.option2Name);
  if (hasOption2 && !opt2) {
    const createdOpt2 = await db.productOption.create({
      data: { productId, name: item.option2Name, position: 1 },
      include: { values: true },
    });
    opt2 = createdOpt2;
    optionMap.set(item.option2Name, createdOpt2);
  }

  const option1ValuesMap = new Map(opt1?.values.map((v) => [v.value, v.id]));
  const option2ValuesMap = new Map(opt2?.values.map((v) => [v.value, v.id]));

  // 2. Ürünün mevcut varyantlarını TEK SORGUDAYLA bellek indeksine al
  const existingVariants = isNewProduct
    ? []
    : await db.productVariant.findMany({
        where: { productId },
        include: {
          inventoryLevels: { where: { warehouseId } },
          optionValues: true,
        },
      });

  const variantBySku = new Map(existingVariants.map((v) => [v.sku, v]));
  const variantBySupplierCode = new Map(existingVariants.map((v) => [v.supplierCode, v]));
  const variantByBarcode = new Map(
    existingVariants.filter((v) => v.barcode).map((v) => [v.barcode!, v])
  );

  for (let idx = 0; idx < item.variants.length; idx++) {
    const vInput = item.variants[idx];
    if (!vInput) continue;

    const existingVariant =
      variantBySku.get(vInput.sku) ??
      variantBySupplierCode.get(vInput.supplierCode) ??
      (vInput.barcode ? variantByBarcode.get(vInput.barcode) : undefined);

    let variantId: string;

    if (existingVariant) {
      variantId = existingVariant.id;
      const needsPriceUpdate =
        (updatePrice || isNewProduct) &&
        (existingVariant.price !== vInput.priceMinor ||
          existingVariant.compareAtPrice !== vInput.compareAtPriceMinor ||
          existingVariant.costPrice !== vInput.costPriceMinor);

      if (needsPriceUpdate || (isNewProduct && existingVariant.title !== vInput.title)) {
        await db.productVariant.update({
          where: { id: variantId },
          data: {
            title: isNewProduct ? vInput.title : existingVariant.title,
            barcode: vInput.barcode ?? existingVariant.barcode,
            supplierCode: vInput.supplierCode,
            ...(updatePrice || isNewProduct
              ? {
                  price: vInput.priceMinor,
                  compareAtPrice: vInput.compareAtPriceMinor,
                  costPrice: vInput.costPriceMinor,
                }
              : {}),
          },
        });
      }
    } else {
      const created = await db.productVariant.create({
        data: {
          productId,
          title: vInput.title,
          sku: vInput.sku,
          barcode: vInput.barcode,
          supplierCode: vInput.supplierCode,
          price: vInput.priceMinor,
          compareAtPrice: vInput.compareAtPriceMinor,
          costPrice: vInput.costPriceMinor,
          weightGrams: vInput.weightGrams,
          position: idx,
          isActive: true,
          trackInventory: true,
        },
        select: { id: true },
      });
      variantId = created.id;
    }

    // Seçenek 1 Değer Bağlantısı
    if (opt1 && vInput.option1Value) {
      let val1Id = option1ValuesMap.get(vInput.option1Value);
      if (!val1Id) {
        const createdVal1 = await db.productOptionValue.create({
          data: {
            optionId: opt1.id,
            value: vInput.option1Value,
            position: idx,
          },
          select: { id: true },
        });
        val1Id = createdVal1.id;
        option1ValuesMap.set(vInput.option1Value, val1Id);
      }

      const alreadyHasOptVal1 = existingVariant?.optionValues.some(
        (ov) => ov.optionValueId === val1Id
      );
      if (!alreadyHasOptVal1) {
        await db.variantOptionValue.upsert({
          where: {
            variantId_optionValueId: {
              variantId,
              optionValueId: val1Id,
            },
          },
          create: { variantId, optionValueId: val1Id },
          update: {},
        });
      }
    }

    // Seçenek 2 Değer Bağlantısı
    if (opt2 && vInput.option2Value) {
      let val2Id = option2ValuesMap.get(vInput.option2Value);
      if (!val2Id) {
        const createdVal2 = await db.productOptionValue.create({
          data: {
            optionId: opt2.id,
            value: vInput.option2Value,
            position: idx,
          },
          select: { id: true },
        });
        val2Id = createdVal2.id;
        option2ValuesMap.set(vInput.option2Value, val2Id);
      }

      const alreadyHasOptVal2 = existingVariant?.optionValues.some(
        (ov) => ov.optionValueId === val2Id
      );
      if (!alreadyHasOptVal2) {
        await db.variantOptionValue.upsert({
          where: {
            variantId_optionValueId: {
              variantId,
              optionValueId: val2Id,
            },
          },
          create: { variantId, optionValueId: val2Id },
          update: {},
        });
      }
    }

    // Stok ve Envanter Güncellemesi
    if (updateStock || isNewProduct) {
      const currentLevel = existingVariant?.inventoryLevels[0];
      const oldOnHand = currentLevel?.onHand ?? 0;
      const delta = vInput.stock - oldOnHand;

      if (!currentLevel || delta !== 0) {
        await db.inventoryLevel.upsert({
          where: {
            variantId_warehouseId: {
              variantId,
              warehouseId,
            },
          },
          create: {
            variantId,
            warehouseId,
            onHand: vInput.stock,
            reserved: 0,
          },
          update: {
            onHand: vInput.stock,
          },
        });

        if (delta !== 0) {
          await db.stockMovement.create({
            data: {
              variantId,
              warehouseId,
              type: "IMPORT",
              quantity: delta,
              balanceAfter: vInput.stock,
              reason: `XML Senkronizasyonu (${sourceName})`,
              referenceType: "FeedRun",
              referenceId: runId,
            },
          });
        }
      }
    }
  }

  // 3. Ürünün toplam stok ve min/max fiyat özet alanlarını bellekteki varyant verileriyle güncelle (findMany sorgusuna gerek yok!)
  const minPrice = item.finalPriceMinor;
  const maxPrice = Math.max(...item.variants.map((v) => v.priceMinor));
  const totalStock = item.finalStock;

  await db.product.update({
    where: { id: productId },
    data: {
      minPrice,
      maxPrice,
      totalStock,
    },
  });
}

/**
 * Tedarikçi XML kaynağını PREVIEW (kuru çalıştırma) veya APPLY (gerçek aktarım) modunda çalıştırır.
 */
export async function runFeedImport(
  sourceId: string,
  mode: "PREVIEW" | "APPLY",
  trigger: "manual" | "schedule" = "manual"
): Promise<RunFeedImportResult> {
  const source = await db.feedSource.findUnique({
    where: { id: sourceId },
    include: {
      categoryMaps: {
        include: { category: true },
      },
    },
  });

  if (!source) {
    throw new Error("XML kaynağı bulunamadı.");
  }

  const run = await db.feedRun.create({
    data: {
      sourceId: source.id,
      mode,
      status: "RUNNING",
      trigger,
      startedAt: new Date(),
      message: "XML içeriği indiriliyor ve çözümleniyor...",
    },
  });

  const stats: FeedRunStats = {
    total: 0,
    created: 0,
    updated: 0,
    unchanged: 0,
    skipped: 0,
    failed: 0,
    missing: 0,
  };
  const sample: FeedPreviewSampleItem[] = [];
  const errors: FeedRunErrorItem[] = [];

  try {
    const mapping = parseFeedMapping(source.mapping);
    const transform = parseFeedTransform(source.transform);
    const updatePolicy = parseFeedUpdatePolicy(source.updatePolicy);

    const xmlBuffer = await loadFeedXmlBuffer(source);
    const inspection = inspectXmlStructure(xmlBuffer, {
      preferredItemPath: source.itemPath,
      categoryPath: mapping.categoryPath,
    });

    const effectiveItemPath =
      source.itemPath?.trim() || inspection.selectedItemPath;
    if (!effectiveItemPath) {
      throw new Error("XML içerisinde ürün düğüm yolu tespit edilemedi.");
    }

    if (!source.itemPath && effectiveItemPath) {
      await db.feedSource.update({
        where: { id: source.id },
        data: { itemPath: effectiveItemPath },
      });
    }

    // Kategori eşleştirme tablosundaki ürün sayılarını güncelle
    for (const catStat of inspection.categories) {
      await db.feedCategoryMap.upsert({
        where: {
          sourceId_sourceCategory: {
            sourceId: source.id,
            sourceCategory: catStat.name,
          },
        },
        create: {
          sourceId: source.id,
          sourceCategory: catStat.name,
          itemCount: catStat.count,
        },
        update: {
          itemCount: catStat.count,
        },
      });
    }

    const refreshedMaps = await db.feedCategoryMap.findMany({
      where: { sourceId: source.id },
      include: { category: true },
    });
    const categoryMapBySource = new Map(
      refreshedMaps.map((m) => [m.sourceCategory, m])
    );

    const defaultCategory = source.defaultCategoryId
      ? await db.category.findUnique({
          where: { id: source.defaultCategoryId },
          select: { id: true, name: true },
        })
      : null;

    let warehouse = source.warehouseId
      ? await db.warehouse.findUnique({ where: { id: source.warehouseId } })
      : null;
    if (!warehouse) {
      warehouse = await db.warehouse.findFirst({
        where: { isActive: true },
        orderBy: [{ isDefault: "desc" }, { priority: "asc" }],
      });
    }
    if (!warehouse && mode === "APPLY") {
      warehouse = await db.warehouse.create({
        data: {
          name: "Ana Depo",
          code: "ANA-DEPO",
          isDefault: true,
          isActive: true,
        },
      });
    }

    const { parseXmlDocument } = await import("@/modules/xml/parser");
    const doc = parseXmlDocument(xmlBuffer);
    const rawItems = extractItemsByPath(doc, effectiveItemPath);
    stats.total = rawItems.length;
    await db.feedRun.update({
      where: { id: run.id },
      data: {
        stats: stats as unknown as Prisma.InputJsonValue,
        message: `${rawItems.length} ürün bulundu, işleniyor...`,
      },
    });

    const existingLinks = await db.productSourceLink.findMany({
      where: { sourceId: source.id },
      include: {
        product: {
          select: { id: true, deletedAt: true },
        },
      },
    });
    const linkByExternalId = new Map(
      existingLinks
        .filter((l) => l.product.deletedAt === null)
        .map((l) => [l.externalId, l])
    );

    const seenExternalIds = new Set<string>();
    const brandCache = new Map<string, string>();

    for (let i = 0; i < rawItems.length; i++) {
      const rawItem = rawItems[i];
      if (!rawItem) continue;

      let normalized: NormalizedProductInput;
      try {
        normalized = normalizeXmlItem(
          rawItem,
          mapping,
          transform,
          source.matchKey
        );
      } catch (err) {
        stats.failed++;
        errors.push({
          externalId: `Satır #${i + 1}`,
          message:
            err instanceof Error ? err.message : "Ürün verisi çözümlenemedi.",
        });
        continue;
      }

      if (!normalized.externalId || !normalized.title) {
        stats.failed++;
        errors.push({
          externalId: normalized.externalId || `Satır #${i + 1}`,
          message: "Ürün kodu (External ID) veya ürün başlığı boş.",
        });
        continue;
      }

      if (normalized.finalPriceMinor <= 0) {
        stats.skipped++;
        if (sample.length < 15) {
          sample.push({
            externalId: normalized.externalId,
            matchValue: normalized.matchValue,
            title: normalized.title,
            action: "SKIP",
            reason: "Fiyat 0 veya geçersiz olduğu için atlandı",
            sourcePriceMinor: normalized.sourcePriceMinor,
            finalPriceMinor: normalized.finalPriceMinor,
            sourceStock: normalized.sourceStock,
            finalStock: normalized.finalStock,
            sourceCategory: normalized.sourceCategory,
            targetCategoryName: null,
            variantCount: normalized.variants.length,
          });
        }
        continue;
      }

      seenExternalIds.add(normalized.externalId);

      // Kategori çözümleme
      let targetCategoryId: string | null = null;
      let targetCategoryName: string | null = null;

      if (normalized.sourceCategory) {
        const mapped = categoryMapBySource.get(normalized.sourceCategory);
        if (mapped?.categoryId && mapped.category) {
          targetCategoryId = mapped.categoryId;
          targetCategoryName = mapped.category.name;
        } else if (source.unmatchedCategoryPolicy === "SKIP") {
          stats.skipped++;
          if (sample.length < 15) {
            sample.push({
              externalId: normalized.externalId,
              matchValue: normalized.matchValue,
              title: normalized.title,
              action: "SKIP",
              reason: `Eşleşmemiş kategori (${normalized.sourceCategory}) politikası: Atla`,
              sourcePriceMinor: normalized.sourcePriceMinor,
              finalPriceMinor: normalized.finalPriceMinor,
              sourceStock: normalized.sourceStock,
              finalStock: normalized.finalStock,
              sourceCategory: normalized.sourceCategory,
              targetCategoryName: null,
              variantCount: normalized.variants.length,
            });
          }
          continue;
        } else if (source.unmatchedCategoryPolicy === "DEFAULT") {
          if (defaultCategory) {
            targetCategoryId = defaultCategory.id;
            targetCategoryName = defaultCategory.name;
          }
        } else if (source.unmatchedCategoryPolicy === "CREATE") {
          if (mode === "APPLY") {
            const createdCat = await resolveOrCreateCategoryFromXmlPath(
              source.id,
              normalized.sourceCategory
            );
            targetCategoryId = createdCat.id;
            targetCategoryName = createdCat.name;
            categoryMapBySource.set(normalized.sourceCategory, {
              id: createdCat.id,
              sourceId: source.id,
              sourceCategory: normalized.sourceCategory,
              categoryId: createdCat.id,
              itemCount: 1,
              category: {
                id: createdCat.id,
                name: createdCat.name,
                slug: "",
                description: null,
                parentId: null,
                position: 0,
                imageUrl: null,
                isActive: true,
                seoTitle: null,
                seoDescription: null,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            });
          } else {
            targetCategoryName = `${normalized.sourceCategory} (Otomatik oluşturulacak)`;
          }
        }
      } else if (
        source.unmatchedCategoryPolicy === "DEFAULT" &&
        defaultCategory
      ) {
        targetCategoryId = defaultCategory.id;
        targetCategoryName = defaultCategory.name;
      }

      // Mevcut ürün eşleştirmesi
      const existingLink = linkByExternalId.get(normalized.externalId);
      let matchedProductId: string | null = existingLink?.productId ?? null;

      if (!matchedProductId && normalized.matchValue) {
        const matchedVariant = await db.productVariant.findFirst({
          where: {
            product: { deletedAt: null },
            ...(source.matchKey === "SKU"
              ? { sku: normalized.matchValue }
              : source.matchKey === "BARCODE"
                ? { barcode: normalized.matchValue }
                : { supplierCode: normalized.matchValue }),
          },
          select: { productId: true },
        });
        matchedProductId = matchedVariant?.productId ?? null;
      }

      const currentHash = computeProductHash(
        normalized,
        targetCategoryId,
        updatePolicy
      );

      if (matchedProductId && existingLink?.lastHash === currentHash) {
        stats.unchanged++;
        if (mode === "APPLY") {
          await db.productSourceLink.update({
            where: { id: existingLink.id },
            data: { lastSeenAt: new Date() },
          });
        }
        if (sample.length < 15) {
          sample.push({
            externalId: normalized.externalId,
            matchValue: normalized.matchValue,
            title: normalized.title,
            action: "UNCHANGED",
            reason: "Son senkrondan bu yana değişiklik yok",
            sourcePriceMinor: normalized.sourcePriceMinor,
            finalPriceMinor: normalized.finalPriceMinor,
            sourceStock: normalized.sourceStock,
            finalStock: normalized.finalStock,
            sourceCategory: normalized.sourceCategory,
            targetCategoryName,
            variantCount: normalized.variants.length,
          });
        }
        continue;
      }

      const isCreate = !matchedProductId;

      if (mode === "PREVIEW") {
        if (isCreate) {
          stats.created++;
        } else {
          stats.updated++;
        }
        if (sample.length < 15) {
          sample.push({
            externalId: normalized.externalId,
            matchValue: normalized.matchValue,
            title: normalized.title,
            action: isCreate ? "CREATE" : "UPDATE",
            sourcePriceMinor: normalized.sourcePriceMinor,
            finalPriceMinor: normalized.finalPriceMinor,
            sourceStock: normalized.sourceStock,
            finalStock: normalized.finalStock,
            sourceCategory: normalized.sourceCategory,
            targetCategoryName,
            variantCount: normalized.variants.length,
          });
        }
        continue;
      }

      // APPLY modu: gerçek veritabanı yazımı
      try {
        const brandId =
          isCreate || updatePolicy.brandPolicy === "ALWAYS"
            ? await resolveOrCreateBrandId(normalized.brandName, brandCache)
            : undefined;

        const searchTokens = [
          normalized.title,
          normalized.brandName ?? "",
          normalized.sku,
          normalized.barcode ?? "",
          ...normalized.variants.map((v) => v.sku),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        let productId: string;

        if (isCreate) {
          const slug = await ensureUniqueSlug(
            normalized.title,
            async (candidate) => {
              const found = await db.product.findUnique({
                where: { slug: candidate },
                select: { id: true },
              });
              return Boolean(found);
            }
          );

          const createdProduct = await db.product.create({
            data: {
              title: normalized.title,
              slug,
              subtitle: normalized.subtitle,
              description: normalized.description,
              status: source.createAsStatus,
              publishedAt:
                source.createAsStatus === "ACTIVE" ? new Date() : null,
              brandId: brandId ?? null,
              weightGrams: normalized.weightGrams,
              minPrice: normalized.finalPriceMinor,
              maxPrice: normalized.finalPriceMinor,
              totalStock: normalized.finalStock,
              searchText: searchTokens,
            },
            select: { id: true },
          });
          productId = createdProduct.id;

          if (targetCategoryId) {
            await db.productCategory.upsert({
              where: {
                productId_categoryId: {
                  productId,
                  categoryId: targetCategoryId,
                },
              },
              create: {
                productId,
                categoryId: targetCategoryId,
                isPrimary: true,
              },
              update: { isPrimary: true },
            });
          }

          if (normalized.images.length > 0) {
            await db.productImage.createMany({
              data: normalized.images.map((url, idx) => ({
                productId,
                url,
                alt: normalized.title,
                position: idx,
              })),
            });
          }

          await syncProductAttributes(productId, normalized.attributes);
          stats.created++;
        } else {
          productId = matchedProductId!;
          await db.product.update({
            where: { id: productId },
            data: {
              ...(updatePolicy.titlePolicy === "ALWAYS"
                ? { title: normalized.title, searchText: searchTokens }
                : {}),
              ...(updatePolicy.descriptionPolicy === "ALWAYS"
                ? {
                    subtitle: normalized.subtitle,
                    description: normalized.description,
                  }
                : {}),
              ...(updatePolicy.brandPolicy === "ALWAYS" && brandId !== undefined
                ? { brandId }
                : {}),
            },
          });

          if (
            updatePolicy.categoryPolicy === "ALWAYS" &&
            targetCategoryId
          ) {
            await db.productCategory.deleteMany({ where: { productId } });
            await db.productCategory.create({
              data: {
                productId,
                categoryId: targetCategoryId,
                isPrimary: true,
              },
            });
          }

          if (
            updatePolicy.imagesPolicy === "ALWAYS" &&
            normalized.images.length > 0
          ) {
            await db.productImage.deleteMany({ where: { productId } });
            await db.productImage.createMany({
              data: normalized.images.map((url, idx) => ({
                productId,
                url,
                alt: normalized.title,
                position: idx,
              })),
            });
          }

          if (updatePolicy.attributesPolicy === "ALWAYS") {
            await syncProductAttributes(productId, normalized.attributes);
          }

          stats.updated++;
        }

        if (warehouse) {
          await syncVariantOptionsAndStock({
            productId,
            item: normalized,
            warehouseId: warehouse.id,
            runId: run.id,
            sourceName: source.name,
            updatePrice: updatePolicy.updatePrice,
            updateStock: updatePolicy.updateStock,
            isNewProduct: isCreate,
          });
        }

        await db.productSourceLink.upsert({
          where: {
            sourceId_externalId: {
              sourceId: source.id,
              externalId: normalized.externalId,
            },
          },
          create: {
            sourceId: source.id,
            productId,
            externalId: normalized.externalId,
            lastHash: currentHash,
            lastSeenAt: new Date(),
          },
          update: {
            productId,
            lastHash: currentHash,
            lastSeenAt: new Date(),
          },
        });

        if (sample.length < 15) {
          sample.push({
            externalId: normalized.externalId,
            matchValue: normalized.matchValue,
            title: normalized.title,
            action: isCreate ? "CREATE" : "UPDATE",
            sourcePriceMinor: normalized.sourcePriceMinor,
            finalPriceMinor: normalized.finalPriceMinor,
            sourceStock: normalized.sourceStock,
            finalStock: normalized.finalStock,
            sourceCategory: normalized.sourceCategory,
            targetCategoryName,
            variantCount: normalized.variants.length,
          });
        }
      } catch (err) {
        stats.failed++;
        errors.push({
          externalId: normalized.externalId,
          message:
            err instanceof Error
              ? err.message
              : "Ürün kaydedilirken beklenmeyen hata oluştu.",
        });
      }

      if ((i + 1) % 25 === 0 || i + 1 === rawItems.length) {
        await db.feedRun.update({
          where: { id: run.id },
          data: {
            stats: stats as unknown as Prisma.InputJsonValue,
            message: `İşleniyor: ${i + 1} / ${rawItems.length} (%${Math.round(
              ((i + 1) / rawItems.length) * 100
            )})`,
          },
        });
      }
    }

    // XML'den kalkan ürünleri tespit et ve missingPolicy uygula
    const missingLinks = existingLinks.filter(
      (link) =>
        link.product.deletedAt === null &&
        !seenExternalIds.has(link.externalId)
    );
    stats.missing = missingLinks.length;

    if (mode === "APPLY" && missingLinks.length > 0) {
      const missingProductIds = missingLinks.map((l) => l.productId);

      if (source.missingPolicy === "DRAFT") {
        await db.product.updateMany({
          where: { id: { in: missingProductIds } },
          data: { status: "DRAFT" },
        });
      } else if (source.missingPolicy === "ZERO_STOCK") {
        const missingVariants = await db.productVariant.findMany({
          where: { productId: { in: missingProductIds } },
          select: { id: true, productId: true },
        });
        const variantIds = missingVariants.map((v) => v.id);

        if (variantIds.length > 0) {
          await db.inventoryLevel.updateMany({
            where: {
              variantId: { in: variantIds },
              ...(warehouse ? { warehouseId: warehouse.id } : {}),
            },
            data: { onHand: 0 },
          });
        }

        await db.product.updateMany({
          where: { id: { in: missingProductIds } },
          data: { totalStock: 0 },
        });
      }
    }

    const summaryMessage =
      mode === "PREVIEW"
        ? `Önizleme tamamlandı: ${stats.total} ürün incelendi (${stats.created} yeni, ${stats.updated} güncellenecek, ${stats.unchanged} aynı, ${stats.skipped} atlandı, ${stats.missing} XML'den kalkmış).`
        : `Aktarım tamamlandı: ${stats.created} yeni ürün eklendi, ${stats.updated} ürün güncellendi, ${stats.unchanged} ürün değişmedi.`;

    await db.feedRun.update({
      where: { id: run.id },
      data: {
        status: "SUCCEEDED",
        stats: stats as unknown as Prisma.InputJsonValue,
        sample: sample as unknown as Prisma.InputJsonValue,
        errors: errors.slice(0, 50) as unknown as Prisma.InputJsonValue,
        message: summaryMessage,
        finishedAt: new Date(),
      },
    });

    const nextRunAt =
      source.scheduleMinutes && source.scheduleMinutes > 0
        ? new Date(Date.now() + source.scheduleMinutes * 60_000)
        : null;

    await db.feedSource.update({
      where: { id: source.id },
      data: {
        lastRunAt: new Date(),
        lastStatus: "SUCCEEDED",
        nextRunAt,
      },
    });

    await emitDomainEvent("feed.completed", {
      sourceId: source.id,
      sourceName: source.name,
      runId: run.id,
      mode,
      stats,
    });

    return {
      runId: run.id,
      mode,
      stats,
      sample,
      errors,
    };
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "XML aktarımı başarısız oldu.";

    await db.feedRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        stats: stats as unknown as Prisma.InputJsonValue,
        errors: [
          ...errors,
          { externalId: "GENEL", message: errorMessage },
        ] as unknown as Prisma.InputJsonValue,
        message: errorMessage,
        finishedAt: new Date(),
      },
    });

    await db.feedSource.update({
      where: { id: source.id },
      data: {
        lastRunAt: new Date(),
        lastStatus: "FAILED",
      },
    });

    await emitDomainEvent("feed.failed", {
      sourceId: source.id,
      sourceName: source.name,
      runId: run.id,
      mode,
      error: errorMessage,
    });

    throw err;
  }
}
