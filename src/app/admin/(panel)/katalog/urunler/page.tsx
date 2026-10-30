import Link from "next/link";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { formatMoney } from "@/lib/money";
import {
  bulkCatalogFormAction,
  deleteProductFormAction,
  importCsvFormAction,
} from "@/modules/catalog/actions";
import { getCategoryTree } from "@/modules/catalog/service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { Prisma, ProductStatus } from "@/generated/prisma/client";

function pickParam(
  raw: string | string[] | undefined
): string {
  if (typeof raw === "string") return raw.trim();
  if (Array.isArray(raw) && typeof raw[0] === "string") return raw[0].trim();
  return "";
}

const STATUS_LABELS: Record<
  ProductStatus,
  { label: string; variant: "success" | "neutral" | "warning" }
> = {
  ACTIVE: { label: "Yayında", variant: "success" },
  DRAFT: { label: "Taslak", variant: "warning" },
  ARCHIVED: { label: "Arşiv", variant: "neutral" },
};

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireStaff("catalog.read");
  const sp = await searchParams;

  const q = pickParam(sp.q);
  const statusFilter = pickParam(sp.status);
  const categoryIdFilter = pickParam(sp.categoryId);
  const brandIdFilter = pickParam(sp.brandId);

  const where: Prisma.ProductWhereInput = {
    deletedAt: null,
  };

  if (
    statusFilter === "ACTIVE" ||
    statusFilter === "DRAFT" ||
    statusFilter === "ARCHIVED"
  ) {
    where.status = statusFilter;
  }

  if (brandIdFilter) {
    where.brandId = brandIdFilter;
  }

  if (categoryIdFilter) {
    where.categories = {
      some: { categoryId: categoryIdFilter },
    };
  }

  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { slug: { contains: q, mode: "insensitive" } },
      { searchText: { contains: q.toLowerCase(), mode: "insensitive" } },
      {
        variants: {
          some: {
            OR: [
              { sku: { contains: q, mode: "insensitive" } },
              { barcode: { contains: q, mode: "insensitive" } },
              { supplierCode: { contains: q, mode: "insensitive" } },
            ],
          },
        },
      },
    ];
  }

  const [products, categoriesData, brands, totalCount] = await Promise.all([
    db.product.findMany({
      where,
      include: {
        brand: { select: { id: true, name: true } },
        images: { orderBy: { position: "asc" }, take: 1 },
        categories: {
          include: { category: { select: { id: true, name: true } } },
          orderBy: { position: "asc" },
        },
        variants: {
          select: {
            id: true,
            sku: true,
            price: true,
            isActive: true,
          },
          orderBy: { position: "asc" },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 150,
    }),
    getCategoryTree(),
    db.brand.findMany({ orderBy: { name: "asc" } }),
    db.product.count({ where: { deletedAt: null } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Ürün Kataloğu</h1>
          <p className="mt-0.5 text-xs text-zinc-600">
            Toplam {totalCount} kayıtlı ürün, {products.length} listelenen sonuç.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/api/admin/catalog/csv"
            className="inline-flex min-h-9 items-center justify-center rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-900 hover:bg-zinc-50"
          >
            CSV Dışa Aktar
          </a>
          <Link href="/admin/katalog/urunler/yeni">
            <Button variant="primary" size="sm">
              + Yeni Ürün Oluştur
            </Button>
          </Link>
        </div>
      </div>

      {/* Arama ve Filtre Çubuğu */}
      <form
        method="GET"
        action="/admin/katalog/urunler"
        className="grid gap-3 rounded-md border border-zinc-200 bg-white p-4 sm:grid-cols-5"
      >
        <div className="sm:col-span-2">
          <Label htmlFor="q">Arama (Başlık, SKU, Barkod)</Label>
          <Input
            id="q"
            name="q"
            defaultValue={q}
            placeholder="Ürün adı, SKU veya barkod ara..."
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="status">Yayın Durumu</Label>
          <Select id="status" name="status" defaultValue={statusFilter} className="mt-1">
            <option value="">Tüm Durumlar</option>
            <option value="ACTIVE">Yayında</option>
            <option value="DRAFT">Taslak</option>
            <option value="ARCHIVED">Arşiv</option>
          </Select>
        </div>

        <div>
          <Label htmlFor="categoryId">Kategori</Label>
          <Select
            id="categoryId"
            name="categoryId"
            defaultValue={categoryIdFilter}
            className="mt-1"
          >
            <option value="">Tüm Kategoriler</option>
            {categoriesData.flat.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.pathNames.join(" / ")}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="brandId">Marka</Label>
          <div className="mt-1 flex items-center gap-2">
            <Select id="brandId" name="brandId" defaultValue={brandIdFilter}>
              <option value="">Tüm Markalar</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
            <Button type="submit" variant="secondary" size="sm">
              Filtrele
            </Button>
          </div>
        </div>
      </form>

      {/* CSV İçe Aktarma Kutusu */}
      <details className="rounded-md border border-zinc-200 bg-white p-4">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-zinc-800">
          CSV ile Toplu Ürün ve Varyant İçe Aktar
        </summary>
        <form
          action={importCsvFormAction}
          className="mt-3 grid gap-3 border-t border-zinc-200 pt-3 sm:grid-cols-3 sm:items-end"
        >
          <div className="sm:col-span-2">
            <Label htmlFor="csvFile">
              CSV Dosyası Seçin (Başlıklar: productSlug, productTitle, status, brand, categories, variantTitle, sku, price, stock)
            </Label>
            <Input
              id="csvFile"
              name="csvFile"
              type="file"
              accept=".csv,text/csv"
              required
              className="mt-1"
            />
          </div>
          <div>
            <Button type="submit" variant="primary" size="sm">
              CSV Dosyasını İçe Aktar
            </Button>
          </div>
        </form>
      </details>

      {products.length === 0 ? (
        <EmptyState
          title="Eşleşen ürün bulunamadı"
          description="Arama kriterlerinize uygun ürün kaydı yok veya henüz kataloğa ürün eklenmedi."
          actionLabel="İlk Ürünü Oluştur"
          actionHref="/admin/katalog/urunler/yeni"
        />
      ) : (
        <div className="space-y-4">
          {/* Toplu İşlem + Ürün Tablosu Formu */}
          <form
            id="bulk-catalog-form"
            action={bulkCatalogFormAction}
            className="space-y-4"
          >
            <div className="grid gap-4 rounded-md border border-zinc-200 bg-white p-4 lg:grid-cols-2">
              <div className="space-y-2">
                <span className="block text-xs font-semibold uppercase tracking-wide text-zinc-700">
                  Seçili Ürünlerde Toplu Durum Güncelle
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <Select name="status" defaultValue="ACTIVE" className="w-44">
                    <option value="ACTIVE">Yayında Yap</option>
                    <option value="DRAFT">Taslağa Çek</option>
                    <option value="ARCHIVED">Arşivle</option>
                  </Select>
                  <Button
                    type="submit"
                    name="operation"
                    value="status"
                    variant="secondary"
                    size="sm"
                  >
                    Durumu Uygula
                  </Button>
                </div>
              </div>

              <div className="space-y-2 border-t border-zinc-200 pt-3 lg:border-t-0 lg:border-l lg:pl-4 lg:pt-0">
                <span className="block text-xs font-semibold uppercase tracking-wide text-zinc-700">
                  Seçili Ürünlerde Toplu Yüzde (%) Fiyat Güncelle
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <Select name="mode" defaultValue="increase_pct" className="w-36">
                    <option value="increase_pct">% Artır (Zam)</option>
                    <option value="decrease_pct">% Düşür (İndirim)</option>
                  </Select>
                  <Input
                    name="percentage"
                    type="number"
                    step="0.5"
                    min="0.1"
                    max="500"
                    placeholder="Örn: 10"
                    className="w-24 font-mono tabular-nums"
                  />
                  <Select name="rounding" defaultValue="none" className="w-40">
                    <option value="none">Yuvarlama Yok</option>
                    <option value="90">Sonunu ,90 Yap</option>
                    <option value="99">Sonunu ,99 Yap</option>
                    <option value="whole">Tam Liraya Yuvarla</option>
                  </Select>
                  <Button
                    type="submit"
                    name="operation"
                    value="price"
                    variant="secondary"
                    size="sm"
                  >
                    Fiyatları Güncelle
                  </Button>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto rounded-md border border-zinc-200 bg-white">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                    <th className="w-10 px-3 py-2.5">Seç</th>
                    <th className="px-3 py-2.5">Ürün</th>
                    <th className="px-3 py-2.5">Durum</th>
                    <th className="px-3 py-2.5">Kategori / Marka</th>
                    <th className="px-3 py-2.5">Varyant / SKU</th>
                    <th className="px-3 py-2.5 text-right">Fiyat Aralığı</th>
                    <th className="px-3 py-2.5 text-right">Toplam Stok</th>
                    <th className="px-3 py-2.5 text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {products.map((product) => {
                    const thumb = product.images[0]?.url;
                    const statusMeta = STATUS_LABELS[product.status];
                    const firstSku =
                      product.variants.find((v) => v.sku)?.sku ?? "SKU Yok";
                    const minPrice = product.minPrice ?? 0;
                    const maxPrice = product.maxPrice ?? minPrice;

                    return (
                      <tr
                        key={product.id}
                        className="hover:bg-zinc-50/80 transition-colors"
                      >
                        <td className="px-3 py-2.5 align-middle">
                          <input
                            type="checkbox"
                            name="productIds"
                            value={product.id}
                            aria-label={`${product.title} seç`}
                            className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                          />
                        </td>
                        <td className="px-3 py-2.5 align-middle">
                          <div className="flex items-center gap-3">
                            {thumb ? (
                              <img
                                src={thumb}
                                alt={product.title}
                                className="h-10 w-10 shrink-0 rounded border border-zinc-200 object-cover"
                              />
                            ) : (
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-zinc-200 bg-zinc-100 text-[10px] font-medium text-zinc-500">
                                Görsel
                              </div>
                            )}
                            <div className="min-w-0">
                              <Link
                                href={`/admin/katalog/urunler/${product.id}`}
                                className="block truncate font-semibold text-zinc-900 hover:underline"
                              >
                                {product.title}
                              </Link>
                              <span className="block truncate font-mono text-[11px] text-zinc-500">
                                /{product.slug}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 align-middle">
                          <Badge variant={statusMeta.variant}>
                            {statusMeta.label}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 align-middle">
                          <div className="text-zinc-900">
                            {product.categories.length > 0
                              ? product.categories
                                  .map((c) => c.category.name)
                                  .join(", ")
                              : "Kategorisiz"}
                          </div>
                          {product.brand ? (
                            <div className="text-[11px] text-zinc-500">
                              {product.brand.name}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-3 py-2.5 align-middle">
                          <div className="font-medium text-zinc-900 tabular-nums">
                            {product.variants.length} varyant
                          </div>
                          <div className="font-mono text-[11px] text-zinc-600 tabular-nums">
                            {firstSku}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right align-middle font-mono text-zinc-900 tabular-nums">
                          {minPrice === maxPrice
                            ? formatMoney(minPrice)
                            : `${formatMoney(minPrice)} : ${formatMoney(maxPrice)}`}
                        </td>
                        <td className="px-3 py-2.5 text-right align-middle font-mono tabular-nums">
                          <Badge
                            variant={
                              product.totalStock <= 0
                                ? "danger"
                                : product.totalStock <= 5
                                  ? "warning"
                                  : "success"
                            }
                          >
                            {product.totalStock} adet
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 text-right align-middle">
                          <div className="inline-flex items-center gap-1.5">
                            <Link
                              href={`/admin/katalog/urunler/${product.id}`}
                              className="rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-900 hover:bg-zinc-100"
                            >
                              Düzenle
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </form>

          {/* Hızlı Tekil Silme Satırı */}
          <details className="rounded-md border border-zinc-200 bg-white p-4">
            <summary className="cursor-pointer text-xs font-medium text-zinc-700">
              Ürün Arşivleme / Silme İşlemleri
            </summary>
            <div className="mt-3 flex flex-wrap gap-2">
              {products.map((p) => (
                <form
                  key={p.id}
                  action={deleteProductFormAction}
                  className="inline-flex items-center gap-1.5 rounded border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs"
                >
                  <input type="hidden" name="productId" value={p.id} />
                  <span className="max-w-44 truncate text-zinc-800">
                    {p.title}
                  </span>
                  <button
                    type="submit"
                    className="font-semibold text-red-700 hover:underline"
                  >
                    Sil
                  </button>
                </form>
              ))}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
