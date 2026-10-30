import { z } from "zod";

export const productStatusEnum = z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]);
export type ProductStatusInput = z.infer<typeof productStatusEnum>;

export const productOptionValueInputSchema = z.object({
  id: z.string().optional(),
  value: z.string().trim().min(1, "Seçenek değeri boş olamaz"),
  swatch: z.string().trim().nullable().optional(),
  position: z.number().int().min(0).default(0),
});

export type ProductOptionValueInput = z.infer<typeof productOptionValueInputSchema>;

export const productOptionInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Seçenek adı boş olamaz"),
  position: z.number().int().min(0).default(0),
  values: z.array(productOptionValueInputSchema).min(1, "En az bir seçenek değeri girilmelidir"),
});

export type ProductOptionInput = z.infer<typeof productOptionInputSchema>;

export const variantOptionSelectionSchema = z.object({
  optionName: z.string().trim().min(1),
  value: z.string().trim().min(1),
});

export type VariantOptionSelection = z.infer<typeof variantOptionSelectionSchema>;

export const productVariantInputSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1, "Varyant başlığı zorunludur"),
  sku: z.string().trim().nullable().optional(),
  barcode: z.string().trim().nullable().optional(),
  supplierCode: z.string().trim().nullable().optional(),
  price: z.number().int().min(0, "Fiyat negatif olamaz"),
  compareAtPrice: z.number().int().min(0).nullable().optional(),
  costPrice: z.number().int().min(0).nullable().optional(),
  weightGrams: z.number().int().min(0).nullable().optional(),
  position: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
  trackInventory: z.boolean().default(true),
  allowBackorder: z.boolean().default(false),
  stock: z.number().int().min(0).optional(),
  optionValues: z.array(variantOptionSelectionSchema).default([]),
});

export type ProductVariantInput = z.infer<typeof productVariantInputSchema>;

export const productImageInputSchema = z.object({
  id: z.string().optional(),
  url: z.string().trim().min(1, "Görsel adresi zorunludur"),
  alt: z.string().trim().nullable().optional(),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  position: z.number().int().min(0).default(0),
});

export type ProductImageInput = z.infer<typeof productImageInputSchema>;

export const productAttributeValueInputSchema = z.object({
  attributeId: z.string().min(1),
  valueText: z.string().nullable().optional(),
  valueNumber: z.number().nullable().optional(),
  valueBool: z.boolean().nullable().optional(),
  valueList: z.array(z.string()).default([]),
});

export type ProductAttributeValueInput = z.infer<typeof productAttributeValueInputSchema>;

export const productUpsertSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1, "Ürün başlığı zorunludur"),
  slug: z.string().trim().optional(),
  subtitle: z.string().trim().nullable().optional(),
  description: z.string().nullable().optional(),
  status: productStatusEnum.default("DRAFT"),
  publishedAt: z.string().nullable().optional(),
  brandId: z.string().nullable().optional(),
  productTypeId: z.string().nullable().optional(),
  taxClassId: z.string().nullable().optional(),
  seoTitle: z.string().trim().nullable().optional(),
  seoDescription: z.string().trim().nullable().optional(),
  weightGrams: z.number().int().min(0).nullable().optional(),
  categoryIds: z.array(z.string()).default([]),
  primaryCategoryId: z.string().nullable().optional(),
  collectionIds: z.array(z.string()).default([]),
  tagNames: z.array(z.string()).default([]),
  options: z.array(productOptionInputSchema).default([]),
  variants: z.array(productVariantInputSchema).min(1, "En az bir varyant bulunmalıdır"),
  images: z.array(productImageInputSchema).default([]),
  attributes: z.array(productAttributeValueInputSchema).default([]),
});

export type ProductUpsertInput = z.infer<typeof productUpsertSchema>;

export const bulkStatusUpdateSchema = z.object({
  productIds: z.array(z.string().min(1)).min(1, "En az bir ürün seçilmelidir"),
  status: productStatusEnum,
});

export type BulkStatusUpdateInput = z.infer<typeof bulkStatusUpdateSchema>;

export const bulkPriceUpdateSchema = z.object({
  productIds: z.array(z.string().min(1)).min(1, "En az bir ürün seçilmelidir"),
  mode: z.enum(["increase_pct", "decrease_pct"]),
  percentage: z.number().min(0.01, "Yüzde oranı 0'dan büyük olmalıdır").max(990),
  rounding: z.enum(["none", "90", "99", "whole"]).default("none"),
});

export type BulkPriceUpdateInput = z.infer<typeof bulkPriceUpdateSchema>;

export const categoryInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Kategori adı zorunludur"),
  slug: z.string().trim().optional(),
  description: z.string().trim().nullable().optional(),
  parentId: z.string().nullable().optional(),
  position: z.number().int().min(0).default(0),
  imageUrl: z.string().trim().nullable().optional(),
  isActive: z.boolean().default(true),
  seoTitle: z.string().trim().nullable().optional(),
  seoDescription: z.string().trim().nullable().optional(),
});

export type CategoryInput = z.infer<typeof categoryInputSchema>;

export const collectionRuleFieldEnum = z.enum(["price", "tag", "brand", "stock", "title"]);
export type CollectionRuleField = z.infer<typeof collectionRuleFieldEnum>;

export const collectionRuleOperatorEnum = z.enum([
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "contains",
]);
export type CollectionRuleOperator = z.infer<typeof collectionRuleOperatorEnum>;

export const collectionRuleSchema = z.object({
  field: collectionRuleFieldEnum,
  operator: collectionRuleOperatorEnum,
  value: z.union([z.string(), z.number()]),
});

export type CollectionRule = z.infer<typeof collectionRuleSchema>;

export const collectionInputSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1, "Koleksiyon başlığı zorunludur"),
  slug: z.string().trim().optional(),
  description: z.string().trim().nullable().optional(),
  imageUrl: z.string().trim().nullable().optional(),
  type: z.enum(["MANUAL", "AUTOMATIC"]).default("MANUAL"),
  rules: z.array(collectionRuleSchema).default([]),
  matchAll: z.boolean().default(true),
  sortOrder: z
    .enum(["manual", "newest", "price_asc", "price_desc", "best_selling", "title"])
    .default("manual"),
  isActive: z.boolean().default(true),
  seoTitle: z.string().trim().nullable().optional(),
  seoDescription: z.string().trim().nullable().optional(),
  productIds: z.array(z.string()).default([]),
});

export type CollectionInput = z.infer<typeof collectionInputSchema>;

export const brandInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Marka adı zorunludur"),
  slug: z.string().trim().optional(),
  logoUrl: z.string().trim().nullable().optional(),
  description: z.string().trim().nullable().optional(),
});

export type BrandInput = z.infer<typeof brandInputSchema>;

export const tagInputSchema = z.object({
  name: z.string().trim().min(1, "Etiket adı zorunludur"),
  slug: z.string().trim().optional(),
});

export type TagInput = z.infer<typeof tagInputSchema>;

export const attributeKindEnum = z.enum([
  "TEXT",
  "NUMBER",
  "BOOLEAN",
  "SELECT",
  "MULTISELECT",
  "COLOR",
]);
export type AttributeKindInput = z.infer<typeof attributeKindEnum>;

export const attributeDefinitionInputSchema = z.object({
  id: z.string().optional(),
  key: z.string().trim().optional(),
  label: z.string().trim().min(1, "Özel alan etiketi zorunludur"),
  kind: attributeKindEnum.default("TEXT"),
  options: z.array(z.string().trim().min(1)).default([]),
  unit: z.string().trim().nullable().optional(),
  isFilterable: z.boolean().default(false),
  isVisibleOnProduct: z.boolean().default(true),
  position: z.number().int().min(0).default(0),
});

export type AttributeDefinitionInput = z.infer<typeof attributeDefinitionInputSchema>;

export const productTypeInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Ürün tipi adı zorunludur"),
  attributes: z
    .array(
      z.object({
        attributeId: z.string().min(1),
        position: z.number().int().min(0).default(0),
        isRequired: z.boolean().default(false),
      })
    )
    .default([]),
});

export type ProductTypeInput = z.infer<typeof productTypeInputSchema>;

export const taxClassInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Vergi sınıfı adı zorunludur"),
  rateBps: z.number().int().min(0, "Oran negatif olamaz").max(10000),
  isDefault: z.boolean().default(false),
});

export type TaxClassInput = z.infer<typeof taxClassInputSchema>;

export const priceListInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Fiyat listesi adı zorunludur"),
  description: z.string().trim().nullable().optional(),
  customerGroupId: z.string().nullable().optional(),
  startsAt: z.string().nullable().optional(),
  endsAt: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
  priority: z.number().int().default(0),
});

export type PriceListInput = z.infer<typeof priceListInputSchema>;

export const priceListPriceInputSchema = z.object({
  priceListId: z.string().min(1),
  variantId: z.string().min(1),
  price: z.number().int().min(0, "Fiyat negatif olamaz"),
});

export type PriceListPriceInput = z.infer<typeof priceListPriceInputSchema>;

export interface ProductEditorData {
  product: {
    id: string;
    title: string;
    slug: string;
    subtitle: string;
    description: string;
    status: ProductStatusInput;
    publishedAt: string;
    brandId: string;
    productTypeId: string;
    taxClassId: string;
    seoTitle: string;
    seoDescription: string;
    weightGrams: number | null;
    categoryIds: string[];
    primaryCategoryId: string | null;
    collectionIds: string[];
    tagNames: string[];
    options: ProductOptionInput[];
    variants: ProductVariantInput[];
    images: ProductImageInput[];
    attributes: ProductAttributeValueInput[];
  } | null;
  categoriesFlat: Array<{
    id: string;
    name: string;
    depth: number;
    pathNames: string[];
  }>;
  brands: Array<{ id: string; name: string }>;
  collections: Array<{ id: string; title: string }>;
  productTypes: Array<{
    id: string;
    name: string;
    attributes: Array<{
      attributeId: string;
      position: number;
      isRequired: boolean;
      attribute: {
        id: string;
        key: string;
        label: string;
        kind: AttributeKindInput;
        options: string[];
        unit: string | null;
      };
    }>;
  }>;
  attributes: Array<{
    id: string;
    key: string;
    label: string;
    kind: AttributeKindInput;
    options: string[];
    unit: string | null;
  }>;
  taxClasses: Array<{
    id: string;
    name: string;
    rateBps: number;
    isDefault: boolean;
  }>;
  tags: Array<{ id: string; name: string }>;
}

