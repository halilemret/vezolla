import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import {
  DEFAULT_PAYMENT_SETTINGS,
  DEFAULT_SEO_SETTINGS,
  DEFAULT_STORE_SETTINGS,
  DEFAULT_THEME_SETTINGS,
  DEFAULT_ABANDONED_CART_SETTINGS,
  DEFAULT_CONVERSION_SETTINGS,
  DEFAULT_INVOICE_SETTINGS,
  DEFAULT_INSTALLMENT_SETTINGS,
  DEFAULT_CLUB_SETTINGS,
  abandonedCartSettingsSchema,
  conversionSettingsSchema,
  invoiceSettingsSchema,
  installmentSettingsSchema,
  clubSettingsSchema,
  paymentSettingsSchema,
  seoSettingsSchema,
  storeSettingsSchema,
  themeSettingsSchema,
  type AbandonedCartSettings,
  type ConversionSettings,
  type InvoiceSettings,
  type InstallmentCardFamily,
  type InstallmentSettings,
  type ClubSettings,
  type PaymentSettings,
  type SeoSettings,
  type StoreSettings,
  type ThemeSettings,
} from "@/lib/settings/schemas";

export type {
  AbandonedCartSettings,
  ConversionSettings,
  InvoiceSettings,
  InstallmentCardFamily,
  InstallmentSettings,
  ClubSettings,
  PaymentSettings,
  SeoSettings,
  StoreSettings,
  ThemeSettings,
};

export async function getStoreSettings(): Promise<StoreSettings> {
  const row = await db.setting.findUnique({ where: { key: "store" } });
  if (!row) return DEFAULT_STORE_SETTINGS;
  const parsed = storeSettingsSchema.safeParse(row.value);
  return parsed.success ? parsed.data : DEFAULT_STORE_SETTINGS;
}

export async function saveStoreSettings(input: StoreSettings): Promise<StoreSettings> {
  const data = storeSettingsSchema.parse(input);
  await db.setting.upsert({
    where: { key: "store" },
    create: { key: "store", value: data as unknown as Prisma.InputJsonValue },
    update: { value: data as unknown as Prisma.InputJsonValue },
  });
  return data;
}

export async function getThemeSettings(): Promise<ThemeSettings> {
  const row = await db.setting.findUnique({ where: { key: "theme" } });
  if (!row) return DEFAULT_THEME_SETTINGS;
  const parsed = themeSettingsSchema.safeParse(row.value);
  return parsed.success ? parsed.data : DEFAULT_THEME_SETTINGS;
}

export async function saveThemeSettings(input: ThemeSettings): Promise<ThemeSettings> {
  const data = themeSettingsSchema.parse(input);
  await db.setting.upsert({
    where: { key: "theme" },
    create: { key: "theme", value: data as unknown as Prisma.InputJsonValue },
    update: { value: data as unknown as Prisma.InputJsonValue },
  });
  return data;
}

export async function getPaymentSettings(): Promise<PaymentSettings> {
  const row = await db.setting.findUnique({ where: { key: "payment" } });
  if (!row) return DEFAULT_PAYMENT_SETTINGS;
  const parsed = paymentSettingsSchema.safeParse(row.value);
  return parsed.success ? parsed.data : DEFAULT_PAYMENT_SETTINGS;
}

export async function savePaymentSettings(input: PaymentSettings): Promise<PaymentSettings> {
  const data = paymentSettingsSchema.parse(input);
  await db.setting.upsert({
    where: { key: "payment" },
    create: { key: "payment", value: data as unknown as Prisma.InputJsonValue },
    update: { value: data as unknown as Prisma.InputJsonValue },
  });
  return data;
}

export async function getSeoSettings(): Promise<SeoSettings> {
  const row = await db.setting.findUnique({ where: { key: "seo" } });
  if (!row) return DEFAULT_SEO_SETTINGS;
  const parsed = seoSettingsSchema.safeParse(row.value);
  return parsed.success ? parsed.data : DEFAULT_SEO_SETTINGS;
}

export async function saveSeoSettings(input: SeoSettings): Promise<SeoSettings> {
  const data = seoSettingsSchema.parse(input);
  await db.setting.upsert({
    where: { key: "seo" },
    create: { key: "seo", value: data as unknown as Prisma.InputJsonValue },
    update: { value: data as unknown as Prisma.InputJsonValue },
  });
  return data;
}

export async function getAbandonedCartSettings(): Promise<AbandonedCartSettings> {
  const row = await db.setting.findUnique({ where: { key: "abandoned_cart" } });
  if (!row) return DEFAULT_ABANDONED_CART_SETTINGS;
  const parsed = abandonedCartSettingsSchema.safeParse(row.value);
  return parsed.success ? parsed.data : DEFAULT_ABANDONED_CART_SETTINGS;
}

export async function saveAbandonedCartSettings(
  input: AbandonedCartSettings
): Promise<AbandonedCartSettings> {
  const data = abandonedCartSettingsSchema.parse(input);
  await db.setting.upsert({
    where: { key: "abandoned_cart" },
    create: { key: "abandoned_cart", value: data as unknown as Prisma.InputJsonValue },
    update: { value: data as unknown as Prisma.InputJsonValue },
  });
  return data;
}

export async function getConversionSettings(): Promise<ConversionSettings> {
  const row = await db.setting.findUnique({ where: { key: "conversion" } });
  if (!row) return DEFAULT_CONVERSION_SETTINGS;
  const parsed = conversionSettingsSchema.safeParse(row.value);
  return parsed.success ? parsed.data : DEFAULT_CONVERSION_SETTINGS;
}

export async function saveConversionSettings(
  input: ConversionSettings
): Promise<ConversionSettings> {
  const data = conversionSettingsSchema.parse(input);
  await db.setting.upsert({
    where: { key: "conversion" },
    create: { key: "conversion", value: data as unknown as Prisma.InputJsonValue },
    update: { value: data as unknown as Prisma.InputJsonValue },
  });
  return data;
}

export async function getInvoiceSettings(): Promise<InvoiceSettings> {
  const row = await db.setting.findUnique({ where: { key: "invoice" } });
  if (!row) return DEFAULT_INVOICE_SETTINGS;
  const parsed = invoiceSettingsSchema.safeParse(row.value);
  return parsed.success ? parsed.data : DEFAULT_INVOICE_SETTINGS;
}

export async function saveInvoiceSettings(
  input: InvoiceSettings
): Promise<InvoiceSettings> {
  const data = invoiceSettingsSchema.parse(input);
  await db.setting.upsert({
    where: { key: "invoice" },
    create: { key: "invoice", value: data as unknown as Prisma.InputJsonValue },
    update: { value: data as unknown as Prisma.InputJsonValue },
  });
  return data;
}

export async function getInstallmentSettings(): Promise<InstallmentSettings> {
  const row = await db.setting.findUnique({ where: { key: "installment" } });
  if (!row) return DEFAULT_INSTALLMENT_SETTINGS;
  const parsed = installmentSettingsSchema.safeParse(row.value);
  return parsed.success ? parsed.data : DEFAULT_INSTALLMENT_SETTINGS;
}

export async function saveInstallmentSettings(
  input: InstallmentSettings
): Promise<InstallmentSettings> {
  const data = installmentSettingsSchema.parse(input);
  await db.setting.upsert({
    where: { key: "installment" },
    create: { key: "installment", value: data as unknown as Prisma.InputJsonValue },
    update: { value: data as unknown as Prisma.InputJsonValue },
  });
  return data;
}

export async function getClubSettings(): Promise<ClubSettings> {
  const row = await db.setting.findUnique({ where: { key: "vezollaclub" } });
  if (!row) return DEFAULT_CLUB_SETTINGS;
  const parsed = clubSettingsSchema.safeParse(row.value);
  return parsed.success ? parsed.data : DEFAULT_CLUB_SETTINGS;
}

export async function saveClubSettings(
  input: ClubSettings
): Promise<ClubSettings> {
  const data = clubSettingsSchema.parse(input);
  await db.setting.upsert({
    where: { key: "vezollaclub" },
    create: { key: "vezollaclub", value: data as unknown as Prisma.InputJsonValue },
    update: { value: data as unknown as Prisma.InputJsonValue },
  });
  return data;
}

