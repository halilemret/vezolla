import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { formatMoneyCompact } from "@/lib/money";
import {
  createTagFormAction,
  deleteBrandFormAction,
  deleteCollectionFormAction,
  deleteTagFormAction,
  saveBrandFormAction,
  saveCollectionFormAction,
  syncAutomaticCollectionFormAction,
} from "@/modules/catalog/actions";
import { parseCollectionRulesJson } from "@/modules/catalog/service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const FIELD_LABELS: Record<string, string> = {
  price: "Fiyat (TL)",
  tag: "Etiket",
  brand: "Marka",
  stock: "Stok Adedi",
  title: "Ürün Başlığı",
};

const OPERATOR_LABELS: Record<string, string> = {
  eq: "Eşittir (=)",
  neq: "Eşit Değildir (!=)",
  gt: "Büyüktür (>)",
  gte: "Büyük veya Eşittir (>=)",
  lt: "Küçüktür (<)",
  lte: "Küçük veya Eşittir (<=)",
  contains: "İçerir",
};

export default async function AdminCollectionsBrandsTagsPage() {
  await requireStaff("catalog.read");

  const [collections, brands, tags, products] = await Promise.all([
    db.collection.findMany({
      include: {
        products: {
          include: {
            product: {
              select: { id: true, title: true, slug: true },
            },
          },
          orderBy: { position: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.brand.findMany({
      include: {
        _count: { select: { products: true } },
      },
      orderBy: { name: "asc" },
    }),
    db.tag.findMany({
      include: {
        _count: { select: { products: true } },
      },
      orderBy: { name: "asc" },
    }),
    db.product.findMany({
      where: { deletedAt: null },
      select: { id: true, title: true, minPrice: true, totalStock: true },
      orderBy: { title: "asc" },
      take: 200,
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">
          Koleksiyonlar, Markalar ve Etiketler
        </h1>
        <p className="mt-0.5 text-xs text-zinc-600">
          Manuel ürün seçkilerini, kural tabanlı otomatik koleksiyonları, marka tanımlarını ve etiketleri yönetin.
        </p>
      </div>

      {/* BÖLÜM 1: KOLEKSİYONLAR */}
      <section className="space-y-5 rounded-md border border-zinc-200 bg-white p-5">
        <div className="border-b border-zinc-200 pb-3">
          <h2 className="text-sm font-semibold text-zinc-900">
            Koleksiyon Yönetimi (Manuel ve Kural Tabanlı Otomatik)
          </h2>
          <p className="text-xs text-zinc-600">
            Otomatik koleksiyonlar fiyat, etiket, marka ve stok kurallarına göre ürünleri otomatik eşleştirir.
          </p>
        </div>

        <form
          action={saveCollectionFormAction}
          className="space-y-4 rounded-md border border-zinc-200 bg-zinc-50 p-4"
        >
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-800">
            Yeni Koleksiyon Oluştur
          </h3>

          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <Label htmlFor="col-title">Koleksiyon Başlığı *</Label>
              <Input
                id="col-title"
                name="title"
                required
                placeholder="Örn: Kış Seçkisi"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="col-slug">URL Kısa Adı (İsteğe Bağlı)</Label>
              <Input
                id="col-slug"
                name="slug"
                placeholder="kis-seckisi"
                className="mt-1 font-mono"
              />
            </div>
            <div>
              <Label htmlFor="col-type">Koleksiyon Türü</Label>
              <Select
                id="col-type"
                name="type"
                defaultValue="AUTOMATIC"
                className="mt-1"
              >
                <option value="AUTOMATIC">Otomatik (Kural Tabanlı)</option>
                <option value="MANUAL">Manuel (Elle Seçim)</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="col-sort">Varsayılan Sıralama</Label>
              <Select
                id="col-sort"
                name="sortOrder"
                defaultValue="newest"
                className="mt-1"
              >
                <option value="newest">En Yeniler</option>
                <option value="best_selling">Çok Satanlar</option>
                <option value="price_asc">Fiyat Artan</option>
                <option value="price_desc">Fiyat Azalan</option>
                <option value="title">Alfabetik (A-Z)</option>
                <option value="manual">Manuel Sıra</option>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="col-desc">Açıklama</Label>
              <Input
                id="col-desc"
                name="description"
                placeholder="Vitrin koleksiyon açıklaması..."
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="col-match">Otomatik Kural Eşleşme Koşulu</Label>
              <Select
                id="col-match"
                name="matchAll"
                defaultValue="true"
                className="mt-1"
              >
                <option value="true">Tüm kurallar sağlansın (VE / AND)</option>
                <option value="false">En az bir kural sağlansın (VEYA / OR)</option>
              </Select>
            </div>
          </div>

          {/* Otomatik Koleksiyon Kuralları (3 Kural Satırı) */}
          <div className="space-y-2 rounded border border-zinc-200 bg-white p-3">
            <span className="block text-xs font-semibold text-zinc-800">
              Otomatik Koleksiyon Kuralları (Fiyat TL, Etiket, Marka, Stok)
            </span>
            {[0, 1, 2].map((idx) => (
              <div key={idx} className="grid gap-2 sm:grid-cols-3">
                <Select
                  name="ruleField"
                  defaultValue={idx === 0 ? "stock" : ""}
                >
                  <option value="">Kural Alanı Seçin...</option>
                  <option value="price">Fiyat (TL)</option>
                  <option value="stock">Stok Adedi</option>
                  <option value="tag">Etiket</option>
                  <option value="brand">Marka</option>
                  <option value="title">Ürün Başlığı</option>
                </Select>

                <Select
                  name="ruleOperator"
                  defaultValue={idx === 0 ? "gt" : "eq"}
                >
                  <option value="eq">Eşittir (=)</option>
                  <option value="neq">Eşit Değildir (!=)</option>
                  <option value="gt">Büyüktür (&gt;)</option>
                  <option value="gte">Büyük veya Eşittir (&gt;=)</option>
                  <option value="lt">Küçüktür (&lt;)</option>
                  <option value="lte">Küçük veya Eşittir (&lt;=)</option>
                  <option value="contains">İçerir</option>
                </Select>

                <Input
                  name="ruleValue"
                  placeholder={
                    idx === 0
                      ? "Örn: 0 (Stok > 0 olanlar)"
                      : "Değer (Örn: 500 veya İndirim)"
                  }
                />
              </div>
            ))}
          </div>

          {/* Manuel Koleksiyon İçin Ürün Seçimi */}
          {products.length > 0 ? (
            <details className="rounded border border-zinc-200 bg-white p-3">
              <summary className="cursor-pointer text-xs font-semibold text-zinc-800">
                Manuel Koleksiyon İçin Ürün Seç ({products.length} ürün mevcut)
              </summary>
              <div className="mt-2 grid max-h-44 gap-1.5 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
                {products.map((p) => (
                  <label
                    key={p.id}
                    className="flex items-center gap-2 text-xs text-zinc-800"
                  >
                    <input
                      type="checkbox"
                      name="productIds"
                      value={p.id}
                      className="h-3.5 w-3.5 rounded border-zinc-300"
                    />
                    <span className="truncate">{p.title}</span>
                  </label>
                ))}
              </div>
            </details>
          ) : null}

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs font-medium text-zinc-800">
              <input
                type="checkbox"
                name="isActive"
                value="true"
                defaultChecked
                className="h-4 w-4 rounded border-zinc-300"
              />
              <span>Vitrinde Aktif</span>
            </label>
            <Button type="submit" variant="primary" size="sm">
              Koleksiyonu Kaydet
            </Button>
          </div>
        </form>

        {/* Mevcut Koleksiyonlar Listesi */}
        <div className="divide-y divide-zinc-200">
          {collections.map((col) => {
            const rules = parseCollectionRulesJson(col.rules);
            const selectedProductIds = new Set(
              col.products.map((cp) => cp.productId)
            );

            return (
              <details key={col.id} className="py-3">
                <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-zinc-900">
                      {col.title}
                    </span>
                    <span className="font-mono text-zinc-500">/{col.slug}</span>
                    <Badge
                      variant={col.type === "AUTOMATIC" ? "accent" : "neutral"}
                    >
                      {col.type === "AUTOMATIC" ? "Otomatik Kural" : "Manuel"}
                    </Badge>
                    <Badge variant={col.isActive ? "success" : "neutral"}>
                      {col.isActive ? "Aktif" : "Pasif"}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-3 font-mono text-zinc-600 tabular-nums">
                    <span>{col.products.length} ürün</span>
                    <span className="font-sans font-medium text-zinc-900 underline">
                      Detay / Düzenle
                    </span>
                  </div>
                </summary>

                <div className="mt-3 space-y-3 rounded border border-zinc-200 bg-zinc-50 p-4">
                  {col.type === "AUTOMATIC" && rules.length > 0 ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-zinc-200 bg-white p-2.5 text-xs">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold text-zinc-700">
                          Aktif Kurallar ({col.matchAll ? "VE" : "VEYA"}):
                        </span>
                        {rules.map((r, rIdx) => (
                          <Badge key={rIdx} variant="neutral">
                            {FIELD_LABELS[r.field] ?? r.field}{" "}
                            {OPERATOR_LABELS[r.operator] ?? r.operator}{" "}
                            {r.field === "price"
                              ? `${formatMoneyCompact(Number(r.value))} TL`
                              : String(r.value)}
                          </Badge>
                        ))}
                      </div>
                      <form action={syncAutomaticCollectionFormAction}>
                        <input
                          type="hidden"
                          name="collectionId"
                          value={col.id}
                        />
                        <Button type="submit" variant="secondary" size="sm">
                          Kuralları Yeniden Çalıştır
                        </Button>
                      </form>
                    </div>
                  ) : null}

                  <form action={saveCollectionFormAction} className="space-y-3">
                    <input type="hidden" name="id" value={col.id} />
                    <div className="grid gap-3 sm:grid-cols-4">
                      <div>
                        <Label>Başlık</Label>
                        <Input
                          name="title"
                          defaultValue={col.title}
                          required
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>Slug</Label>
                        <Input
                          name="slug"
                          defaultValue={col.slug}
                          required
                          className="mt-1 font-mono"
                        />
                      </div>
                      <div>
                        <Label>Tür</Label>
                        <Select
                          name="type"
                          defaultValue={col.type}
                          className="mt-1"
                        >
                          <option value="AUTOMATIC">Otomatik</option>
                          <option value="MANUAL">Manuel</option>
                        </Select>
                      </div>
                      <div>
                        <Label>Sıralama</Label>
                        <Select
                          name="sortOrder"
                          defaultValue={col.sortOrder}
                          className="mt-1"
                        >
                          <option value="newest">En Yeniler</option>
                          <option value="best_selling">Çok Satanlar</option>
                          <option value="price_asc">Fiyat Artan</option>
                          <option value="price_desc">Fiyat Azalan</option>
                          <option value="title">Alfabetik</option>
                          <option value="manual">Manuel</option>
                        </Select>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label>Açıklama</Label>
                        <Input
                          name="description"
                          defaultValue={col.description ?? ""}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>Kural Eşleşmesi</Label>
                        <Select
                          name="matchAll"
                          defaultValue={col.matchAll ? "true" : "false"}
                          className="mt-1"
                        >
                          <option value="true">Tüm kurallar (VE)</option>
                          <option value="false">Herhangi bir kural (VEYA)</option>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2 rounded border border-zinc-200 bg-white p-3">
                      <span className="block text-xs font-semibold text-zinc-700">
                        Kurallar
                      </span>
                      {[0, 1, 2].map((idx) => {
                        const existingRule = rules[idx];
                        const defaultVal = existingRule
                          ? existingRule.field === "price"
                            ? formatMoneyCompact(Number(existingRule.value))
                            : String(existingRule.value)
                          : "";
                        return (
                          <div key={idx} className="grid gap-2 sm:grid-cols-3">
                            <Select
                              name="ruleField"
                              defaultValue={existingRule?.field ?? ""}
                            >
                              <option value="">Kural Alanı Seçin...</option>
                              <option value="price">Fiyat (TL)</option>
                              <option value="stock">Stok Adedi</option>
                              <option value="tag">Etiket</option>
                              <option value="brand">Marka</option>
                              <option value="title">Ürün Başlığı</option>
                            </Select>
                            <Select
                              name="ruleOperator"
                              defaultValue={existingRule?.operator ?? "eq"}
                            >
                              <option value="eq">Eşittir (=)</option>
                              <option value="neq">Eşit Değildir (!=)</option>
                              <option value="gt">Büyüktür (&gt;)</option>
                              <option value="gte">Büyük veya Eşittir (&gt;=)</option>
                              <option value="lt">Küçüktür (&lt;)</option>
                              <option value="lte">Küçük veya Eşittir (&lt;=)</option>
                              <option value="contains">İçerir</option>
                            </Select>
                            <Input
                              name="ruleValue"
                              defaultValue={defaultVal}
                              placeholder="Değer"
                            />
                          </div>
                        );
                      })}
                    </div>

                    {col.type === "MANUAL" && products.length > 0 ? (
                      <div className="rounded border border-zinc-200 bg-white p-3">
                        <span className="mb-2 block text-xs font-semibold text-zinc-700">
                          Koleksiyondaki Ürünler
                        </span>
                        <div className="grid max-h-40 gap-1.5 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
                          {products.map((p) => (
                            <label
                              key={p.id}
                              className="flex items-center gap-2 text-xs text-zinc-800"
                            >
                              <input
                                type="checkbox"
                                name="productIds"
                                value={p.id}
                                defaultChecked={selectedProductIds.has(p.id)}
                                className="h-3.5 w-3.5 rounded border-zinc-300"
                              />
                              <span className="truncate">{p.title}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-xs font-medium text-zinc-800">
                        <input
                          type="checkbox"
                          name="isActive"
                          value="true"
                          defaultChecked={col.isActive}
                          className="h-4 w-4 rounded border-zinc-300"
                        />
                        <span>Aktif</span>
                      </label>
                      <Button type="submit" variant="primary" size="sm">
                        Koleksiyonu Güncelle
                      </Button>
                    </div>
                  </form>

                  <form
                    action={deleteCollectionFormAction}
                    className="flex justify-end border-t border-zinc-200 pt-2"
                  >
                    <input type="hidden" name="collectionId" value={col.id} />
                    <Button type="submit" variant="danger" size="sm">
                      Koleksiyonu Sil
                    </Button>
                  </form>
                </div>
              </details>
            );
          })}
        </div>
      </section>

      {/* BÖLÜM 2: MARKALAR VE ETİKETLER */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Markalar */}
        <section className="space-y-4 rounded-md border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-zinc-900">
            Markalar ({brands.length})
          </h2>

          <form
            action={saveBrandFormAction}
            className="space-y-3 rounded border border-zinc-200 bg-zinc-50 p-3.5"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="brand-name">Marka Adı *</Label>
                <Input
                  id="brand-name"
                  name="name"
                  required
                  placeholder="Örn: Kuzey Atölye"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="brand-logo">Logo URL (İsteğe Bağlı)</Label>
                <Input
                  id="brand-logo"
                  name="logoUrl"
                  placeholder="/uploads/markalar/..."
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="brand-desc">Marka Açıklaması</Label>
              <Textarea
                id="brand-desc"
                name="description"
                className="mt-1 min-h-16"
                placeholder="Kısa marka hikayesi veya tanıtım..."
              />
            </div>
            <Button type="submit" variant="primary" size="sm">
              Marka Ekle
            </Button>
          </form>

          <div className="divide-y divide-zinc-200">
            {brands.map((brand) => (
              <div
                key={brand.id}
                className="flex items-center justify-between gap-2 py-2.5 text-xs"
              >
                <div>
                  <span className="font-semibold text-zinc-900">
                    {brand.name}
                  </span>
                  <span className="ml-2 font-mono text-zinc-500">
                    /{brand.slug}
                  </span>
                  <span className="ml-2 text-zinc-600 tabular-nums">
                    ({brand._count.products} ürün)
                  </span>
                </div>
                <form action={deleteBrandFormAction}>
                  <input type="hidden" name="brandId" value={brand.id} />
                  <Button type="submit" variant="ghost" size="sm">
                    Sil
                  </Button>
                </form>
              </div>
            ))}
          </div>
        </section>

        {/* Etiketler */}
        <section className="space-y-4 rounded-md border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-zinc-900">
            Ürün Etiketleri ({tags.length})
          </h2>

          <form
            action={createTagFormAction}
            className="flex items-end gap-2 rounded border border-zinc-200 bg-zinc-50 p-3.5"
          >
            <div className="flex-1">
              <Label htmlFor="tag-name">Yeni Etiket Adı *</Label>
              <Input
                id="tag-name"
                name="name"
                required
                placeholder="Örn: Organik, Yeni Sezon, İndirim"
                className="mt-1"
              />
            </div>
            <Button type="submit" variant="primary" size="sm">
              Etiket Ekle
            </Button>
          </form>

          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <form
                key={tag.id}
                action={deleteTagFormAction}
                className="inline-flex items-center gap-2 rounded border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs"
              >
                <input type="hidden" name="tagId" value={tag.id} />
                <span className="font-medium text-zinc-900">{tag.name}</span>
                <span className="font-mono text-[11px] text-zinc-500 tabular-nums">
                  ({tag._count.products})
                </span>
                <button
                  type="submit"
                  className="font-bold text-zinc-500 hover:text-red-700"
                  title="Etiketi sil"
                >
                  ×
                </button>
              </form>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
