import type { MetadataRoute } from "next";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.APP_URL ?? "http://localhost:3000";

  const [products, categories, collections, pages] = await Promise.all([
    db.product.findMany({
      where: { status: "ACTIVE", deletedAt: null },
      select: { slug: true, updatedAt: true },
    }),
    db.category.findMany({
      where: { isActive: true },
      select: { slug: true, updatedAt: true },
    }),
    db.collection.findMany({
      where: { isActive: true },
      select: { slug: true, updatedAt: true },
    }),
    db.page.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true, updatedAt: true },
    }),
  ]);

  return [
    { url: `${baseUrl}/`, lastModified: new Date() },
    { url: `${baseUrl}/katalog`, lastModified: new Date() },
    ...products.map((p) => ({
      url: `${baseUrl}/urun/${p.slug}`,
      lastModified: p.updatedAt,
    })),
    ...categories.map((c) => ({
      url: `${baseUrl}/kategori/${c.slug}`,
      lastModified: c.updatedAt,
    })),
    ...collections.map((c) => ({
      url: `${baseUrl}/koleksiyon/${c.slug}`,
      lastModified: c.updatedAt,
    })),
    ...pages.map((p) => ({
      url: `${baseUrl}/sayfa/${p.slug}`,
      lastModified: p.updatedAt,
    })),
  ];
}
