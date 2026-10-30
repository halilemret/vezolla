import { XMLParser } from "fast-xml-parser";
import { gunzipSync, unzipSync } from "fflate";
import { readPrivateFile } from "@/lib/storage";
import {
  DEFAULT_FEED_MAPPING,
  type FeedMapping,
} from "@/modules/xml/schemas";

export interface XmlCandidatePath {
  path: string;
  count: number;
}

export interface XmlCategoryCount {
  name: string;
  count: number;
}

export interface XmlStructureInspection {
  candidateItemPaths: XmlCandidatePath[];
  selectedItemPath: string;
  itemCount: number;
  fieldPaths: string[];
  sampleItem: Record<string, unknown> | null;
  categories: XmlCategoryCount[];
  suggestedMapping: FeedMapping;
}

export interface FeedSourceConnectionInput {
  kind: "URL" | "FILE";
  url?: string | null;
  authType?: string | null;
  authUser?: string | null;
  authPassword?: string | null;
  headers?: unknown;
  fileKey?: string | null;
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
  parseTagValue: false,
  parseAttributeValue: false,
  processEntities: true,
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * .xml, .xml.gz veya .zip içerisinden ham XML Buffer verisini çıkarır.
 */
export function decompressXmlBuffer(buffer: Buffer, filenameOrUrl = ""): Buffer {
  const lower = filenameOrUrl.toLowerCase();
  const b0 = buffer[0];
  const b1 = buffer[1];
  const b2 = buffer[2];
  const b3 = buffer[3];

  const isGzip = (b0 === 0x1f && b1 === 0x8b) || lower.endsWith(".gz");
  if (isGzip) {
    const decompressed = gunzipSync(new Uint8Array(buffer));
    return Buffer.from(decompressed);
  }

  const isZip =
    (b0 === 0x50 && b1 === 0x4b && b2 === 0x03 && b3 === 0x04) ||
    lower.endsWith(".zip");
  if (isZip) {
    const entries = unzipSync(new Uint8Array(buffer));
    const fileNames = Object.keys(entries);
    const xmlEntryName =
      fileNames.find((name) => name.toLowerCase().endsWith(".xml")) ??
      fileNames[0];
    if (!xmlEntryName) {
      throw new Error("ZIP arşivi içerisinde okunabilir XML dosyası bulunamadı.");
    }
    const content = entries[xmlEntryName];
    if (!content) {
      throw new Error("ZIP arşivi içerisindeki XML dosyası boş.");
    }
    return Buffer.from(content);
  }

  return buffer;
}

/**
 * Ham XML metnini veya Buffer verisini JSON ağacına dönüştürür.
 */
export function parseXmlDocument(xmlInput: Buffer | string): Record<string, unknown> {
  const rawBuffer =
    typeof xmlInput === "string"
      ? Buffer.from(xmlInput, "utf-8")
      : decompressXmlBuffer(xmlInput);
  const xmlText = rawBuffer.toString("utf-8").replace(/^\uFEFF/, "").trim();
  if (!xmlText) {
    throw new Error("XML içeriği boş.");
  }
  const parsed: unknown = xmlParser.parse(xmlText);
  if (!isRecord(parsed)) {
    throw new Error("Geçerli bir XML kök düğümü çözümlenemedi.");
  }
  return parsed;
}

/**
 * Tedarikçi kaynağından (URL veya Yüklenen Dosya) XML Buffer verisini okur.
 */
export async function loadFeedXmlBuffer(
  source: FeedSourceConnectionInput
): Promise<Buffer> {
  if (source.kind === "FILE") {
    if (!source.fileKey) {
      throw new Error("Bu kaynak için yüklenmiş bir XML dosyası bulunamadı.");
    }
    const fileBuffer = await readPrivateFile(source.fileKey);
    return decompressXmlBuffer(fileBuffer, source.fileKey);
  }

  const rawUrl = source.url?.trim() ?? "";
  if (!rawUrl) {
    throw new Error("XML kaynak URL adresi belirtilmemiş.");
  }

  if (
    rawUrl === "/api/admin/xml/sample" ||
    rawUrl.endsWith("/api/admin/xml/sample")
  ) {
    if (rawUrl.startsWith("/")) {
      return Buffer.from(buildSampleSupplierXml(), "utf-8");
    }
  }

  const reqHeaders: Record<string, string> = {
    "User-Agent": "AtolyeMagaza-XML-Entegrasyon/1.0",
    Accept: "application/xml, text/xml, application/octet-stream, */*",
  };

  if (source.authType === "basic" && source.authUser) {
    const token = Buffer.from(
      `${source.authUser}:${source.authPassword ?? ""}`,
      "utf-8"
    ).toString("base64");
    reqHeaders.Authorization = `Basic ${token}`;
  }

  if (isRecord(source.headers)) {
    for (const [key, val] of Object.entries(source.headers)) {
      const cleanKey = key.trim();
      if (cleanKey && (typeof val === "string" || typeof val === "number")) {
        reqHeaders[cleanKey] = String(val);
      }
    }
  }

  try {
    const response = await fetch(rawUrl, {
      method: "GET",
      headers: reqHeaders,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(
        `XML kaynağı HTTP ${response.status} (${response.statusText}) hatası döndürdü.`
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    return decompressXmlBuffer(Buffer.from(arrayBuffer), rawUrl);
  } catch (error) {
    if (rawUrl.endsWith("/api/admin/xml/sample")) {
      return Buffer.from(buildSampleSupplierXml(), "utf-8");
    }
    throw error;
  }
}

/**
 * Nokta ayrılmış yol ile nesne içerisinden değer okur.
 */
export function getValueByPath(obj: unknown, path: string): unknown {
  if (!path || !obj) return undefined;
  const parts = path.split(".").filter(Boolean);
  let current: unknown = obj;

  for (const part of parts) {
    if (Array.isArray(current)) {
      const firstItem: unknown = current[0];
      if (isRecord(firstItem)) {
        current = firstItem[part];
      } else {
        return undefined;
      }
    } else if (isRecord(current)) {
      current = current[part];
    } else {
      return undefined;
    }
  }

  return current;
}

function scalarToString(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val.trim();
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (isRecord(val)) {
    const textVal = val["#text"] ?? val["#cdata"] ?? val["value"];
    if (typeof textVal === "string" || typeof textVal === "number") {
      return String(textVal).trim();
    }
  }
  return "";
}

export function getStringByPath(obj: unknown, path: string): string {
  if (!path) return "";
  const raw = getValueByPath(obj, path);
  if (Array.isArray(raw)) {
    return scalarToString(raw[0]);
  }
  return scalarToString(raw);
}

export function getStringListByPath(obj: unknown, path: string): string[] {
  if (!path) return [];
  const raw = getValueByPath(obj, path);
  const results: string[] = [];

  const pushClean = (input: string) => {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (trimmed.includes(",") && trimmed.startsWith("http")) {
      for (const piece of trimmed.split(",")) {
        const p = piece.trim();
        if (p) results.push(p);
      }
    } else {
      results.push(trimmed);
    }
  };

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (isRecord(item)) {
        const candidate =
          scalarToString(item) ||
          scalarToString(item.Url) ||
          scalarToString(item.url) ||
          scalarToString(item.Path) ||
          scalarToString(item["@_url"]) ||
          scalarToString(item["@_src"]);
        if (candidate) pushClean(candidate);
      } else {
        const s = scalarToString(item);
        if (s) pushClean(s);
      }
    }
  } else if (isRecord(raw)) {
    for (const val of Object.values(raw)) {
      if (Array.isArray(val)) {
        for (const sub of val) {
          const s = scalarToString(sub);
          if (s) pushClean(s);
        }
      } else {
        const s = scalarToString(val);
        if (s) pushClean(s);
      }
    }
  } else {
    const s = scalarToString(raw);
    if (s) pushClean(s);
  }

  return Array.from(new Set(results));
}

export function getObjectListByPath(
  obj: unknown,
  path: string
): Array<Record<string, unknown>> {
  if (!path) return [];
  const raw = getValueByPath(obj, path);
  if (Array.isArray(raw)) {
    return raw.filter(isRecord);
  }
  if (isRecord(raw)) {
    return [raw];
  }
  return [];
}

/**
 * Belirli bir düğüm yolundaki tüm ürün nesnelerini dizi olarak döndürür.
 */
export function extractItemsByPath(
  doc: Record<string, unknown>,
  itemPath: string
): Array<Record<string, unknown>> {
  if (!itemPath) return [];
  const raw = getValueByPath(doc, itemPath);
  if (Array.isArray(raw)) {
    return raw.filter(isRecord);
  }
  if (isRecord(raw)) {
    return [raw];
  }
  return [];
}

const PRODUCT_NODE_HINTS = [
  "urun",
  "product",
  "item",
  "stok",
  "entry",
  "malzeme",
  "kayit",
];

function scoreCandidatePath(path: string, count: number): number {
  const parts = path.split(".");
  const lastPart = (parts[parts.length - 1] ?? "").toLowerCase();
  const depthPenalty = parts.length > 3 ? (parts.length - 3) * 50 : 0;
  const hintBonus = PRODUCT_NODE_HINTS.some((h) => lastPart.includes(h))
    ? 200
    : 0;
  return count * 10 + hintBonus - depthPenalty;
}

function findCandidateItemPaths(doc: Record<string, unknown>): XmlCandidatePath[] {
  const candidates: XmlCandidatePath[] = [];

  function walk(node: unknown, currentPath: string, depth: number): void {
    if (!isRecord(node) || depth > 4) return;

    for (const [key, value] of Object.entries(node)) {
      if (key.startsWith("?") || key.startsWith("@_")) continue;
      const nextPath = currentPath ? `${currentPath}.${key}` : key;

      if (Array.isArray(value)) {
        const recordItems = value.filter(isRecord);
        if (recordItems.length > 0) {
          candidates.push({ path: nextPath, count: recordItems.length });
        }
      } else if (isRecord(value)) {
        walk(value, nextPath, depth + 1);
      }
    }
  }

  walk(doc, "", 0);

  if (candidates.length === 0) {
    // Tek ürün içeren XML dosyaları için yedek tespit
    for (const [rootKey, rootVal] of Object.entries(doc)) {
      if (rootKey.startsWith("?") || !isRecord(rootVal)) continue;
      for (const [childKey, childVal] of Object.entries(rootVal)) {
        if (childKey.startsWith("@_") || !isRecord(childVal)) continue;
        candidates.push({ path: `${rootKey}.${childKey}`, count: 1 });
      }
    }
  }

  return candidates.sort(
    (a, b) =>
      scoreCandidatePath(b.path, b.count) - scoreCandidatePath(a.path, a.count)
  );
}

function collectFieldPathsFromItems(
  items: Array<Record<string, unknown>>
): string[] {
  const pathSet = new Set<string>();
  const sampleSlice = items.slice(0, 50);

  function walkItem(node: unknown, prefix: string, depth: number): void {
    if (depth > 5 || node === null || node === undefined) return;

    if (Array.isArray(node)) {
      if (prefix) {
        pathSet.add(prefix);
      }
      for (const el of node.slice(0, 10)) {
        if (isRecord(el)) {
          walkItem(el, prefix, depth + 1);
        }
      }
      return;
    }

    if (isRecord(node)) {
      const entries = Object.entries(node);
      if (prefix && entries.length > 0) {
        pathSet.add(prefix);
      }
      for (const [k, v] of entries) {
        if (k === "#text" || k === "#cdata") continue;
        const nextPath = prefix ? `${prefix}.${k}` : k;
        if (Array.isArray(v)) {
          pathSet.add(nextPath);
          const firstRecords = v.filter(isRecord).slice(0, 5);
          for (const rec of firstRecords) {
            walkItem(rec, nextPath, depth + 1);
          }
        } else if (isRecord(v)) {
          pathSet.add(nextPath);
          walkItem(v, nextPath, depth + 1);
        } else {
          pathSet.add(nextPath);
        }
      }
    } else if (prefix) {
      pathSet.add(prefix);
    }
  }

  for (const item of sampleSlice) {
    walkItem(item, "", 0);
  }

  return Array.from(pathSet);
}

function findMatchingField(
  fieldPaths: string[],
  candidates: string[],
  fallback: string
): string {
  const lowerMap = new Map<string, string>();
  for (const fp of fieldPaths) {
    lowerMap.set(fp.toLowerCase(), fp);
  }
  for (const cand of candidates) {
    const exact = lowerMap.get(cand.toLowerCase());
    if (exact) return exact;
  }
  for (const cand of candidates) {
    const found = fieldPaths.find((fp) =>
      fp.toLowerCase().endsWith(`.${cand.toLowerCase()}`)
    );
    if (found) return found;
  }
  return fallback;
}

function buildSuggestedMapping(fieldPaths: string[]): FeedMapping {
  return {
    ...DEFAULT_FEED_MAPPING,
    externalIdPath: findMatchingField(
      fieldPaths,
      ["UrunKodu", "UrunID", "ProductId", "id", "g:id", "Kod", "TedarikciKodu"],
      DEFAULT_FEED_MAPPING.externalIdPath
    ),
    skuPath: findMatchingField(
      fieldPaths,
      ["StokKodu", "SKU", "Sku", "UrunKodu", "ModelKodu"],
      DEFAULT_FEED_MAPPING.skuPath
    ),
    barcodePath: findMatchingField(
      fieldPaths,
      ["Barkod", "Barcode", "Ean", "EAN", "gtin", "g:gtin"],
      DEFAULT_FEED_MAPPING.barcodePath
    ),
    titlePath: findMatchingField(
      fieldPaths,
      ["Baslik", "UrunAdi", "Ad", "Title", "Name", "title", "g:title"],
      DEFAULT_FEED_MAPPING.titlePath
    ),
    subtitlePath: findMatchingField(
      fieldPaths,
      ["AltBaslik", "KisaAciklama", "Subtitle"],
      ""
    ),
    descriptionPath: findMatchingField(
      fieldPaths,
      ["Aciklama", "Detay", "Description", "description", "g:description"],
      DEFAULT_FEED_MAPPING.descriptionPath
    ),
    brandPath: findMatchingField(
      fieldPaths,
      ["Marka", "Brand", "brand", "g:brand"],
      DEFAULT_FEED_MAPPING.brandPath
    ),
    categoryPath: findMatchingField(
      fieldPaths,
      [
        "Kategori",
        "KategoriYolu",
        "Category",
        "CategoryPath",
        "category",
        "g:product_type",
      ],
      DEFAULT_FEED_MAPPING.categoryPath
    ),
    pricePath: findMatchingField(
      fieldPaths,
      [
        "SatisFiyati",
        "Fiyat",
        "Price",
        "IndirimliFiyat",
        "price",
        "g:price",
      ],
      DEFAULT_FEED_MAPPING.pricePath
    ),
    compareAtPricePath: findMatchingField(
      fieldPaths,
      ["PiyasaFiyati", "ListeFiyati", "EskiFiyat", "CompareAtPrice", "MarketPrice"],
      DEFAULT_FEED_MAPPING.compareAtPricePath
    ),
    costPricePath: findMatchingField(
      fieldPaths,
      ["AlisFiyati", "BayiFiyati", "Maliyet", "CostPrice"],
      DEFAULT_FEED_MAPPING.costPricePath
    ),
    currencyPath: findMatchingField(
      fieldPaths,
      ["ParaBirimi", "Doviz", "Currency"],
      DEFAULT_FEED_MAPPING.currencyPath
    ),
    taxRatePath: findMatchingField(
      fieldPaths,
      ["KdvOrani", "KDV", "TaxRate", "Vat"],
      DEFAULT_FEED_MAPPING.taxRatePath
    ),
    stockPath: findMatchingField(
      fieldPaths,
      ["Stok", "StokAdedi", "Miktar", "Stock", "Quantity"],
      DEFAULT_FEED_MAPPING.stockPath
    ),
    weightGramsPath: findMatchingField(
      fieldPaths,
      ["AgirlikGram", "Agirlik", "Desi", "Weight"],
      DEFAULT_FEED_MAPPING.weightGramsPath
    ),
    imagesPath: findMatchingField(
      fieldPaths,
      [
        "Gorseller.Gorsel",
        "Resimler.Resim",
        "Images.Image",
        "ResimUrl",
        "Gorsel",
        "ImageUrl",
        "g:image_link",
      ],
      DEFAULT_FEED_MAPPING.imagesPath
    ),
    variantsPath: findMatchingField(
      fieldPaths,
      ["Varyantlar.Varyant", "Secenekler.Secenek", "Variants.Variant"],
      DEFAULT_FEED_MAPPING.variantsPath
    ),
    attributesPath: findMatchingField(
      fieldPaths,
      ["Ozellikler.Ozellik", "TeknikOzellikler.Ozellik", "Attributes.Attribute"],
      DEFAULT_FEED_MAPPING.attributesPath
    ),
  };
}

/**
 * XML yapısını analiz eder:
 * - Tekrarlayan ürün düğüm yollarını tespit eder
 * - Tüm alt alan yollarını çıkarır
 * - İlk ürünü örnek olarak döner
 * - Benzersiz kategorileri ürün sayılarıyla listeler
 */
export function inspectXmlStructure(
  xmlInput: Buffer | string,
  options?: {
    preferredItemPath?: string | null;
    categoryPath?: string | null;
  }
): XmlStructureInspection {
  const doc = parseXmlDocument(xmlInput);
  const candidateItemPaths = findCandidateItemPaths(doc);

  const preferred = options?.preferredItemPath?.trim();
  const selectedItemPath =
    preferred && extractItemsByPath(doc, preferred).length > 0
      ? preferred
      : (candidateItemPaths[0]?.path ?? "");

  const items = selectedItemPath ? extractItemsByPath(doc, selectedItemPath) : [];
  const fieldPaths = collectFieldPathsFromItems(items);
  const suggestedMapping = buildSuggestedMapping(fieldPaths);

  const effectiveCategoryPath =
    options?.categoryPath?.trim() || suggestedMapping.categoryPath;

  const categoryCounts = new Map<string, number>();
  for (const item of items) {
    const catName = getStringByPath(item, effectiveCategoryPath);
    if (catName) {
      categoryCounts.set(catName, (categoryCounts.get(catName) ?? 0) + 1);
    }
  }

  const categories: XmlCategoryCount[] = Array.from(categoryCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "tr"));

  return {
    candidateItemPaths,
    selectedItemPath,
    itemCount: items.length,
    fieldPaths,
    sampleItem: items[0] ?? null,
    categories,
    suggestedMapping,
  };
}

/**
 * Hem URL ile hem dosya indirerek hemen denenebilecek gerçekçi tedarikçi XML içeriği üretir.
 */
export function buildSampleSupplierXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Urunler Kaynak="Anadolu Tekstil ve Ev Gereçleri Tedarik A.Ş." Tarih="2026-10-25">
  <Urun>
    <UrunKodu>AT-KTN-001</UrunKodu>
    <StokKodu>AT-KTN-001</StokKodu>
    <Barkod>8690001000011</Barkod>
    <Baslik>Doğal Taş Yıkama Keten Masa Örtüsü</Baslik>
    <AltBaslik>El işçiliği kenar dikişli, %100 Anadolu keteni</AltBaslik>
    <Aciklama><![CDATA[<p>Günlük sofralar ve uzun akşam yemekleri için tasarlanan <strong>taş yıkama keten masa örtüsü</strong>, yıkandıkça yumuşayan dokusuyla uzun ömürlü kullanım sunar.</p><ul><li>30 derecede hassas yıkama</li><li>Doğal kurutma önerilir</li></ul>]]></Aciklama>
    <Marka>Anadolu Dokuma</Marka>
    <Kategori>Ev Tekstili &gt; Sofra &gt; Masa Örtüsü</Kategori>
    <SatisFiyati>1450.00</SatisFiyati>
    <PiyasaFiyati>1790.00</PiyasaFiyati>
    <AlisFiyati>920.00</AlisFiyati>
    <ParaBirimi>TRY</ParaBirimi>
    <KdvOrani>20</KdvOrani>
    <Stok>26</Stok>
    <AgirlikGram>680</AgirlikGram>
    <Gorseller>
      <Gorsel>https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?auto=format&amp;fit=crop&amp;w=1000&amp;q=80</Gorsel>
      <Gorsel>https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&amp;fit=crop&amp;w=1000&amp;q=80</Gorsel>
    </Gorseller>
    <Varyantlar>
      <Varyant>
        <StokKodu>AT-KTN-001-EKRU-160</StokKodu>
        <Barkod>8690001000012</Barkod>
        <Baslik>Ekru / 160x220 cm</Baslik>
        <Renk>Ekru</Renk>
        <Beden>160x220 cm</Beden>
        <Fiyat>1450.00</Fiyat>
        <Stok>14</Stok>
      </Varyant>
      <Varyant>
        <StokKodu>AT-KTN-001-KIL-200</StokKodu>
        <Barkod>8690001000013</Barkod>
        <Baslik>Kiremit Kil / 160x260 cm</Baslik>
        <Renk>Kiremit Kil</Renk>
        <Beden>160x260 cm</Beden>
        <Fiyat>1650.00</Fiyat>
        <Stok>12</Stok>
      </Varyant>
    </Varyantlar>
    <Ozellikler>
      <Ozellik>
        <Ad>Kumaş İçeriği</Ad>
        <Deger>%100 Saf Keten</Deger>
      </Ozellik>
      <Ozellik>
        <Ad>Üretim Yeri</Ad>
        <Deger>Denizli, Türkiye</Deger>
      </Ozellik>
    </Ozellikler>
  </Urun>
  <Urun>
    <UrunKodu>AT-SRM-002</UrunKodu>
    <StokKodu>AT-SRM-002</StokKodu>
    <Barkod>8690001000021</Barkod>
    <Baslik>El Tornası Mat Sırlı Seramik Sürahi</Baslik>
    <AltBaslik>1.4 litre hacimli, gıdaya uygun kurşunsuz sır</AltBaslik>
    <Aciklama><![CDATA[<p>Çömlekçi çarkında tek tek şekillendirilen <strong>mat sırlı seramik sürahi</strong>, su ve soğuk içecek servisleri için dengeli ağırlık merkezine sahiptir.</p>]]></Aciklama>
    <Marka>Toprak Atölyesi</Marka>
    <Kategori>Mutfak &gt; Sofra Servis &gt; Sürahi ve Karaf</Kategori>
    <SatisFiyati>890.00</SatisFiyati>
    <PiyasaFiyati>1050.00</PiyasaFiyati>
    <AlisFiyati>540.00</AlisFiyati>
    <ParaBirimi>TRY</ParaBirimi>
    <KdvOrani>20</KdvOrani>
    <Stok>9</Stok>
    <AgirlikGram>950</AgirlikGram>
    <Gorseller>
      <Gorsel>https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&amp;fit=crop&amp;w=1000&amp;q=80</Gorsel>
    </Gorseller>
    <Varyantlar>
      <Varyant>
        <StokKodu>AT-SRM-002-KUM</StokKodu>
        <Barkod>8690001000022</Barkod>
        <Baslik>Kum Beji / Standart</Baslik>
        <Renk>Kum Beji</Renk>
        <Beden>1.4 L</Beden>
        <Fiyat>890.00</Fiyat>
        <Stok>9</Stok>
      </Varyant>
    </Varyantlar>
    <Ozellikler>
      <Ozellik>
        <Ad>Malzeme</Ad>
        <Deger>Stoneware Seramik</Deger>
      </Ozellik>
      <Ozellik>
        <Ad>Bulaşık Makinesi</Ad>
        <Deger>Uygun</Deger>
      </Ozellik>
    </Ozellikler>
  </Urun>
  <Urun>
    <UrunKodu>AT-AHS-003</UrunKodu>
    <StokKodu>AT-AHS-003</StokKodu>
    <Barkod>8690001000031</Barkod>
    <Baslik>Masif Ceviz Kesme ve Sunum Tahtası</Baslik>
    <AltBaslik>Soğuk sıkım keten tohumu yağı ile koruma uygulanmıştır</AltBaslik>
    <Aciklama><![CDATA[<p>Tek parça fırınlanmış Anadolu cevizinden üretilen sunum ve kesme tahtası, bıçak ağzını köreltmeyen lif yapısına sahiptir.</p>]]></Aciklama>
    <Marka>Orman İşliği</Marka>
    <Kategori>Mutfak &gt; Hazırlık &gt; Kesme Tahtası</Kategori>
    <SatisFiyati>1120.00</SatisFiyati>
    <PiyasaFiyati>1350.00</PiyasaFiyati>
    <AlisFiyati>690.00</AlisFiyati>
    <ParaBirimi>TRY</ParaBirimi>
    <KdvOrani>20</KdvOrani>
    <Stok>2</Stok>
    <AgirlikGram>1450</AgirlikGram>
    <Gorseller>
      <Gorsel>https://images.unsplash.com/photo-1546548970-71785318a17b?auto=format&amp;fit=crop&amp;w=1000&amp;q=80</Gorsel>
    </Gorseller>
    <Varyantlar>
      <Varyant>
        <StokKodu>AT-AHS-003-ORTA</StokKodu>
        <Barkod>8690001000032</Barkod>
        <Baslik>Ceviz / 38x24 cm</Baslik>
        <Renk>Doğal Ceviz</Renk>
        <Beden>38x24 cm</Beden>
        <Fiyat>1120.00</Fiyat>
        <Stok>2</Stok>
      </Varyant>
    </Varyantlar>
    <Ozellikler>
      <Ozellik>
        <Ad>Ağaç Türü</Ad>
        <Deger>Masif Ceviz</Deger>
      </Ozellik>
      <Ozellik>
        <Ad>Kalınlık</Ad>
        <Deger>28 mm</Deger>
      </Ozellik>
    </Ozellikler>
  </Urun>
  <Urun>
    <UrunKodu>AT-AYD-004</UrunKodu>
    <StokKodu>AT-AYD-004</StokKodu>
    <Barkod>8690001000041</Barkod>
    <Baslik>Pirinç Gövdeli Keten Başlıklı Masa Lambası</Baslik>
    <AltBaslik>Sıcak günışığı E27 duy uyumlu</AltBaslik>
    <Aciklama><![CDATA[<p>Fırçalanmış masif pirinç gövde ve ham keten abajur başlığı ile çalışma masası veya komodin üzerinde dengeli aydınlatma sağlar.</p>]]></Aciklama>
    <Marka>Işık Atölyesi</Marka>
    <Kategori>Aydınlatma &gt; Masa Lambası</Kategori>
    <SatisFiyati>2750.00</SatisFiyati>
    <PiyasaFiyati>3200.00</PiyasaFiyati>
    <AlisFiyati>1850.00</AlisFiyati>
    <ParaBirimi>TRY</ParaBirimi>
    <KdvOrani>20</KdvOrani>
    <Stok>11</Stok>
    <AgirlikGram>1820</AgirlikGram>
    <Gorseller>
      <Gorsel>https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&amp;fit=crop&amp;w=1000&amp;q=80</Gorsel>
    </Gorseller>
    <Varyantlar>
      <Varyant>
        <StokKodu>AT-AYD-004-STD</StokKodu>
        <Barkod>8690001000042</Barkod>
        <Baslik>Mat Pirinç / 42 cm</Baslik>
        <Renk>Mat Pirinç</Renk>
        <Beden>42 cm</Beden>
        <Fiyat>2750.00</Fiyat>
        <Stok>11</Stok>
      </Varyant>
    </Varyantlar>
    <Ozellikler>
      <Ozellik>
        <Ad>Duy Tipi</Ad>
        <Deger>E27 Maks 40W</Deger>
      </Ozellik>
      <Ozellik>
        <Ad>Kablo Uzunluğu</Ad>
        <Deger>180 cm Kumaş Kablo</Deger>
      </Ozellik>
    </Ozellikler>
  </Urun>
</Urunler>`;
}
