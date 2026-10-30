import { db } from "@/lib/db";
import { getStoreSettings } from "@/lib/settings/service";
import {
  DEFAULT_CUSTOM_EXPORT_TEMPLATE,
  parseCustomExportTemplate,
  parseExportFeedFilters,
  type CustomExportTemplate,
} from "@/modules/xml/schemas";

export interface ExportableProductItem {
  id: string;
  sku: string;
  barcode: string | null;
  title: string;
  slug: string;
  description: string | null;
  brandName: string | null;
  categoryName: string | null;
  priceMinor: number;
  compareAtPriceMinor: number | null;
  stock: number;
  imageUrl: string | null;
  currency: string;
}

export interface ExportXmlOptions {
  storeName?: string;
  storeDescription?: string;
  baseUrl?: string;
  template?: Partial<CustomExportTemplate> | null;
}

export function escapeXml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function stripCdataClosing(input: string): string {
  return input.replace(/\]\]>/g, "]]]]><![CDATA[>");
}

function sanitizeXmlTagName(tag: string, fallback: string): string {
  const cleaned = tag.trim().replace(/[^a-zA-Z0-9_:-]/g, "");
  if (!cleaned || /^[0-9-]/.test(cleaned)) {
    return fallback;
  }
  return cleaned;
}

function formatMajorDot(amountMinor: number): string {
  const major = Math.max(0, amountMinor) / 100;
  return major.toFixed(2);
}

function resolveFullUrl(urlOrPath: string | null, baseUrl: string): string {
  if (!urlOrPath) return "";
  if (urlOrPath.startsWith("http://") || urlOrPath.startsWith("https://")) {
    return urlOrPath;
  }
  const cleanBase = baseUrl.replace(/\/+$/, "");
  const cleanPath = urlOrPath.startsWith("/") ? urlOrPath : `/${urlOrPath}`;
  return `${cleanBase}${cleanPath}`;
}

/**
 * Google Merchant Center (RSS 2.0 g:* ad alanı) XML çıktısı üretir.
 */
export function renderGoogleMerchantXml(
  items: ExportableProductItem[],
  options?: ExportXmlOptions
): string {
  const storeName = options?.storeName ?? "Atölye Mağaza";
  const storeDescription =
    options?.storeDescription ?? "Google Merchant Center Ürün Beslemesi";
  const baseUrl = (options?.baseUrl ?? "http://localhost:3000").replace(
    /\/+$/,
    ""
  );

  const lines: string[] = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">`,
    `  <channel>`,
    `    <title>${escapeXml(storeName)}</title>`,
    `    <link>${escapeXml(baseUrl)}</link>`,
    `    <description>${escapeXml(storeDescription)}</description>`,
  ];

  for (const item of items) {
    const productLink = `${baseUrl}/urun/${item.slug}`;
    const imageLink = resolveFullUrl(item.imageUrl, baseUrl);
    const hasSale =
      item.compareAtPriceMinor !== null &&
      item.compareAtPriceMinor > item.priceMinor;
    const basePriceMinor = hasSale
      ? (item.compareAtPriceMinor ?? item.priceMinor)
      : item.priceMinor;

    lines.push(`    <item>`);
    lines.push(`      <g:id>${escapeXml(item.sku || item.id)}</g:id>`);
    lines.push(`      <g:title>${escapeXml(item.title)}</g:title>`);
    lines.push(
      `      <g:description><![CDATA[${stripCdataClosing(
        item.description || item.title
      )}]]></g:description>`
    );
    lines.push(`      <g:link>${escapeXml(productLink)}</g:link>`);
    if (imageLink) {
      lines.push(`      <g:image_link>${escapeXml(imageLink)}</g:image_link>`);
    }
    lines.push(
      `      <g:brand>${escapeXml(item.brandName || storeName)}</g:brand>`
    );
    lines.push(`      <g:condition>new</g:condition>`);
    lines.push(
      `      <g:availability>${
        item.stock > 0 ? "in_stock" : "out_of_stock"
      }</g:availability>`
    );
    lines.push(
      `      <g:price>${formatMajorDot(basePriceMinor)} ${escapeXml(
        item.currency
      )}</g:price>`
    );
    if (hasSale) {
      lines.push(
        `      <g:sale_price>${formatMajorDot(item.priceMinor)} ${escapeXml(
          item.currency
        )}</g:sale_price>`
      );
    }
    if (item.barcode) {
      lines.push(`      <g:gtin>${escapeXml(item.barcode)}</g:gtin>`);
    }
    if (item.categoryName) {
      lines.push(
        `      <g:product_type>${escapeXml(item.categoryName)}</g:product_type>`
      );
    }
    lines.push(`    </item>`);
  }

  lines.push(`  </channel>`);
  lines.push(`</rss>`);
  return lines.join("\n");
}

/**
 * Meta (Facebook / Instagram) Katalog XML çıktısı üretir.
 */
export function renderMetaCatalogXml(
  items: ExportableProductItem[],
  options?: ExportXmlOptions
): string {
  const storeName = options?.storeName ?? "Atölye Mağaza";
  const storeDescription =
    options?.storeDescription ?? "Meta Katalog Ürün Beslemesi";
  const baseUrl = (options?.baseUrl ?? "http://localhost:3000").replace(
    /\/+$/,
    ""
  );

  const lines: string[] = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">`,
    `  <channel>`,
    `    <title>${escapeXml(storeName)}</title>`,
    `    <link>${escapeXml(baseUrl)}</link>`,
    `    <description>${escapeXml(storeDescription)}</description>`,
  ];

  for (const item of items) {
    const productLink = `${baseUrl}/urun/${item.slug}`;
    const imageLink = resolveFullUrl(item.imageUrl, baseUrl);

    lines.push(`    <item>`);
    lines.push(`      <g:id>${escapeXml(item.sku || item.id)}</g:id>`);
    lines.push(`      <g:item_group_id>${escapeXml(item.id)}</g:item_group_id>`);
    lines.push(`      <g:title>${escapeXml(item.title)}</g:title>`);
    lines.push(
      `      <g:description><![CDATA[${stripCdataClosing(
        item.description || item.title
      )}]]></g:description>`
    );
    lines.push(`      <g:link>${escapeXml(productLink)}</g:link>`);
    if (imageLink) {
      lines.push(`      <g:image_link>${escapeXml(imageLink)}</g:image_link>`);
    }
    lines.push(
      `      <g:brand>${escapeXml(item.brandName || storeName)}</g:brand>`
    );
    lines.push(`      <g:condition>new</g:condition>`);
    lines.push(
      `      <g:availability>${
        item.stock > 0 ? "in stock" : "out of stock"
      }</g:availability>`
    );
    lines.push(`      <g:inventory>${Math.max(0, item.stock)}</g:inventory>`);
    lines.push(
      `      <g:price>${formatMajorDot(item.priceMinor)} ${escapeXml(
        item.currency
      )}</g:price>`
    );
    if (item.categoryName) {
      lines.push(
        `      <g:google_product_category>${escapeXml(
          item.categoryName
        )}</g:google_product_category>`
      );
    }
    lines.push(`    </item>`);
  }

  lines.push(`  </channel>`);
  lines.push(`</rss>`);
  return lines.join("\n");
}

/**
 * Özel şablonlu (Akakçe, Cimri, Bayi XML vb.) XML çıktısı üretir.
 */
export function renderCustomFeedXml(
  items: ExportableProductItem[],
  options?: ExportXmlOptions
): string {
  const baseUrl = (options?.baseUrl ?? "http://localhost:3000").replace(
    /\/+$/,
    ""
  );
  const tpl = parseCustomExportTemplate({
    ...DEFAULT_CUSTOM_EXPORT_TEMPLATE,
    ...(options?.template ?? {}),
    fields: {
      ...DEFAULT_CUSTOM_EXPORT_TEMPLATE.fields,
      ...(options?.template?.fields ?? {}),
    },
  });

  const rootTag = sanitizeXmlTagName(tpl.rootNode, "Urunler");
  const itemTag = sanitizeXmlTagName(tpl.itemNode, "Urun");
  const f = {
    idTag: sanitizeXmlTagName(tpl.fields.idTag, "UrunKodu"),
    skuTag: sanitizeXmlTagName(tpl.fields.skuTag, "StokKodu"),
    barcodeTag: sanitizeXmlTagName(tpl.fields.barcodeTag, "Barkod"),
    titleTag: sanitizeXmlTagName(tpl.fields.titleTag, "Baslik"),
    descriptionTag: sanitizeXmlTagName(tpl.fields.descriptionTag, "Aciklama"),
    brandTag: sanitizeXmlTagName(tpl.fields.brandTag, "Marka"),
    categoryTag: sanitizeXmlTagName(tpl.fields.categoryTag, "Kategori"),
    priceTag: sanitizeXmlTagName(tpl.fields.priceTag, "Fiyat"),
    compareAtPriceTag: sanitizeXmlTagName(
      tpl.fields.compareAtPriceTag,
      "PiyasaFiyati"
    ),
    stockTag: sanitizeXmlTagName(tpl.fields.stockTag, "Stok"),
    urlTag: sanitizeXmlTagName(tpl.fields.urlTag, "UrunUrl"),
    imageTag: sanitizeXmlTagName(tpl.fields.imageTag, "ResimUrl"),
    currencyTag: sanitizeXmlTagName(tpl.fields.currencyTag, "ParaBirimi"),
  };

  const lines: string[] = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<${rootTag}>`,
  ];

  for (const item of items) {
    const productLink = `${baseUrl}/urun/${item.slug}`;
    const imageLink = resolveFullUrl(item.imageUrl, baseUrl);
    const descContent = tpl.useCdataForDescription
      ? `<![CDATA[${stripCdataClosing(item.description ?? "")}]]>`
      : escapeXml(item.description ?? "");

    lines.push(`  <${itemTag}>`);
    lines.push(`    <${f.idTag}>${escapeXml(item.id)}</${f.idTag}>`);
    lines.push(`    <${f.skuTag}>${escapeXml(item.sku)}</${f.skuTag}>`);
    lines.push(
      `    <${f.barcodeTag}>${escapeXml(item.barcode ?? "")}</${f.barcodeTag}>`
    );
    lines.push(`    <${f.titleTag}>${escapeXml(item.title)}</${f.titleTag}>`);
    lines.push(
      `    <${f.descriptionTag}>${descContent}</${f.descriptionTag}>`
    );
    lines.push(
      `    <${f.brandTag}>${escapeXml(item.brandName ?? "")}</${f.brandTag}>`
    );
    lines.push(
      `    <${f.categoryTag}>${escapeXml(
        item.categoryName ?? ""
      )}</${f.categoryTag}>`
    );
    lines.push(
      `    <${f.priceTag}>${formatMajorDot(item.priceMinor)}</${f.priceTag}>`
    );
    lines.push(
      `    <${f.compareAtPriceTag}>${
        item.compareAtPriceMinor
          ? formatMajorDot(item.compareAtPriceMinor)
          : ""
      }</${f.compareAtPriceTag}>`
    );
    lines.push(
      `    <${f.stockTag}>${Math.max(0, item.stock)}</${f.stockTag}>`
    );
    lines.push(`    <${f.urlTag}>${escapeXml(productLink)}</${f.urlTag}>`);
    lines.push(`    <${f.imageTag}>${escapeXml(imageLink)}</${f.imageTag}>`);
    lines.push(
      `    <${f.currencyTag}>${escapeXml(item.currency)}</${f.currencyTag}>`
    );
    lines.push(`  </${itemTag}>`);
  }

  lines.push(`</${rootTag}>`);
  return lines.join("\n");
}

export function renderExportFeedXml(
  format: "GOOGLE" | "META" | "CUSTOM",
  items: ExportableProductItem[],
  options?: ExportXmlOptions
): string {
  if (format === "GOOGLE") {
    return renderGoogleMerchantXml(items, options);
  }
  if (format === "META") {
    return renderMetaCatalogXml(items, options);
  }
  return renderCustomFeedXml(items, options);
}

/**
 * Veritabanındaki ExportFeed kaydını token ile bulur, filtreleri uygular ve canlı XML döner.
 */
export async function generateExportFeedXmlByToken(
  rawToken: string,
  baseUrl = "http://localhost:3000"
): Promise<{ xml: string; feedName: string } | null> {
  const cleanToken = rawToken.replace(/\.xml$/i, "").trim();
  if (!cleanToken) return null;

  const feed = await db.exportFeed.findUnique({
    where: { token: cleanToken },
  });

  if (!feed || !feed.isActive) {
    return null;
  }

  const filters = parseExportFeedFilters(feed.filters);
  const template = parseCustomExportTemplate(feed.template);
  const storeSettings = await getStoreSettings();

  const products = await db.product.findMany({
    where: {
      status: "ACTIVE",
      deletedAt: null,
      ...(filters.inStockOnly ? { totalStock: { gt: 0 } } : {}),
      ...(filters.brandIds.length > 0
        ? { brandId: { in: filters.brandIds } }
        : {}),
      ...(filters.categoryIds.length > 0
        ? {
            categories: {
              some: { categoryId: { in: filters.categoryIds } },
            },
          }
        : {}),
      ...(filters.collectionIds.length > 0
        ? {
            collections: {
              some: { collectionId: { in: filters.collectionIds } },
            },
          }
        : {}),
    },
    include: {
      brand: true,
      images: {
        orderBy: { position: "asc" },
        take: 1,
      },
      categories: {
        include: { category: true },
        orderBy: [{ isPrimary: "desc" }, { position: "asc" }],
      },
      variants: {
        where: { isActive: true },
        orderBy: { position: "asc" },
        include: {
          inventoryLevels: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const exportItems: ExportableProductItem[] = [];

  for (const product of products) {
    const primaryCat = product.categories[0]?.category.name ?? null;
    const primaryImage = product.images[0]?.url ?? null;

    if (
      feed.format === "CUSTOM" &&
      template.includeVariantsAsItems &&
      product.variants.length > 0
    ) {
      for (const variant of product.variants) {
        const variantStock = variant.inventoryLevels.reduce(
          (sum, lvl) => sum + Math.max(0, lvl.onHand - lvl.reserved),
          0
        );
        if (filters.inStockOnly && variantStock <= 0) continue;

        const fullTitle =
          variant.title && variant.title !== "Standart"
            ? `${product.title} (${variant.title})`
            : product.title;

        exportItems.push({
          id: variant.id,
          sku: variant.sku ?? product.slug,
          barcode: variant.barcode,
          title: fullTitle,
          slug: product.slug,
          description: product.description,
          brandName: product.brand?.name ?? null,
          categoryName: primaryCat,
          priceMinor: variant.price,
          compareAtPriceMinor: variant.compareAtPrice,
          stock: variantStock,
          imageUrl: primaryImage,
          currency: storeSettings.currency || "TRY",
        });
      }
    } else {
      const firstVariant = product.variants[0];
      const priceMinor = firstVariant?.price ?? product.minPrice ?? 0;
      const compareAtPriceMinor = firstVariant?.compareAtPrice ?? null;

      exportItems.push({
        id: product.id,
        sku: firstVariant?.sku ?? product.slug,
        barcode: firstVariant?.barcode ?? null,
        title: product.title,
        slug: product.slug,
        description: product.description,
        brandName: product.brand?.name ?? null,
        categoryName: primaryCat,
        priceMinor,
        compareAtPriceMinor,
        stock: product.totalStock,
        imageUrl: primaryImage,
        currency: storeSettings.currency || "TRY",
      });
    }
  }

  await db.exportFeed.update({
    where: { id: feed.id },
    data: { lastGeneratedAt: new Date() },
  });

  const xml = renderExportFeedXml(feed.format, exportItems, {
    storeName: storeSettings.storeName,
    storeDescription: feed.name,
    baseUrl,
    template,
  });

  return { xml, feedName: feed.name };
}
