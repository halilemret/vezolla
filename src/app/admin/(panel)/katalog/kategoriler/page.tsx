import { requireStaff } from "@/lib/auth/session";
import {
  deleteCategoryFormAction,
  saveCategoryFormAction,
} from "@/modules/catalog/actions";
import { getCategoryTree } from "@/modules/catalog/service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export default async function AdminCategoriesPage() {
  await requireStaff("catalog.read");
  const { flat } = await getCategoryTree();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">
          Kategoriler ve Ağaç Hiyerarşisi
        </h1>
        <p className="mt-0.5 text-xs text-zinc-600">
          Sınırsız derinlikte üst ve alt kategori yapısını, sıralamayı ve kategori SEO ayarlarını yönetin.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Yeni Kategori Ekleme Formu */}
        <section className="rounded-md border border-zinc-200 bg-white p-5 lg:col-span-1">
          <h2 className="text-sm font-semibold text-zinc-900">
            Yeni Kategori Oluştur
          </h2>
          <form action={saveCategoryFormAction} className="mt-4 space-y-3.5">
            <div>
              <Label htmlFor="cat-name">Kategori Adı *</Label>
              <Input
                id="cat-name"
                name="name"
                required
                placeholder="Örn: Dış Giyim"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="cat-slug">URL Kısa Adı (İsteğe Bağlı)</Label>
              <Input
                id="cat-slug"
                name="slug"
                placeholder="dis-giyim"
                className="mt-1 font-mono"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="cat-parent">Üst Kategori</Label>
                <Select
                  id="cat-parent"
                  name="parentId"
                  defaultValue=""
                  className="mt-1"
                >
                  <option value="">Ana Kategori (Kök)</option>
                  {flat.map((node) => (
                    <option key={node.id} value={node.id}>
                      {node.pathNames.join(" / ")}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <Label htmlFor="cat-position">Sıralama No</Label>
                <Input
                  id="cat-position"
                  name="position"
                  type="number"
                  min="0"
                  defaultValue="0"
                  className="mt-1 font-mono tabular-nums"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="cat-image">Görsel URL (İsteğe Bağlı)</Label>
              <Input
                id="cat-image"
                name="imageUrl"
                placeholder="/uploads/kategoriler/..."
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="cat-desc">Açıklama</Label>
              <Textarea
                id="cat-desc"
                name="description"
                placeholder="Kategori vitrin açıklaması..."
                className="mt-1 min-h-20"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="cat-seo-title">SEO Başlığı</Label>
                <Input id="cat-seo-title" name="seoTitle" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="cat-seo-desc">SEO Açıklaması</Label>
                <Input
                  id="cat-seo-desc"
                  name="seoDescription"
                  className="mt-1"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs font-medium text-zinc-800">
              <input
                type="checkbox"
                name="isActive"
                value="true"
                defaultChecked
                className="h-4 w-4 rounded border-zinc-300"
              />
              <span>Vitrinde Aktif Göster</span>
            </label>

            <Button type="submit" variant="primary" size="sm" className="w-full">
              Kategoriyi Kaydet
            </Button>
          </form>
        </section>

        {/* Kategori Ağaç Görünümü */}
        <section className="rounded-md border border-zinc-200 bg-white p-5 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
            <h2 className="text-sm font-semibold text-zinc-900">
              Kategori Ağacı ({flat.length})
            </h2>
            <span className="text-xs text-zinc-500">
              Satıra tıklayarak düzenleyebilirsiniz
            </span>
          </div>

          {flat.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                title="Henüz kategori oluşturulmadı"
                description="Sol taraftaki formu kullanarak ana ve alt kategorilerinizi oluşturabilirsiniz."
              />
            </div>
          ) : (
            <div className="mt-3 divide-y divide-zinc-200">
              {flat.map((node) => (
                <details key={node.id} className="group py-2.5">
                  <summary className="flex cursor-pointer items-center justify-between gap-3 text-xs">
                    <div
                      className="flex items-center gap-2"
                      style={{ paddingLeft: `${node.depth * 20}px` }}
                    >
                      {node.depth > 0 ? (
                        <span className="font-mono text-zinc-400">└</span>
                      ) : null}
                      <span className="font-semibold text-zinc-900">
                        {node.name}
                      </span>
                      <span className="font-mono text-[11px] text-zinc-500">
                        /{node.slug}
                      </span>
                      <Badge variant={node.isActive ? "success" : "neutral"}>
                        {node.isActive ? "Aktif" : "Pasif"}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-3 font-mono text-[11px] text-zinc-600 tabular-nums">
                      <span>{node.productCount} ürün</span>
                      <span>Sıra: {node.position}</span>
                      <span className="font-sans font-medium text-zinc-900 underline">
                        Düzenle
                      </span>
                    </div>
                  </summary>

                  <div className="mt-3 rounded border border-zinc-200 bg-zinc-50 p-4">
                    <form action={saveCategoryFormAction} className="space-y-3">
                      <input type="hidden" name="id" value={node.id} />

                      <div className="grid gap-3 sm:grid-cols-4">
                        <div>
                          <Label>Kategori Adı</Label>
                          <Input
                            name="name"
                            defaultValue={node.name}
                            required
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label>URL Kısa Adı (Slug)</Label>
                          <Input
                            name="slug"
                            defaultValue={node.slug}
                            required
                            className="mt-1 font-mono"
                          />
                        </div>
                        <div>
                          <Label>Üst Kategori</Label>
                          <Select
                            name="parentId"
                            defaultValue={node.parentId ?? ""}
                            className="mt-1"
                          >
                            <option value="">Ana Kategori (Kök)</option>
                            {flat
                              .filter((item) => item.id !== node.id)
                              .map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.pathNames.join(" / ")}
                                </option>
                              ))}
                          </Select>
                        </div>
                        <div>
                          <Label>Sıra No</Label>
                          <Input
                            name="position"
                            type="number"
                            min="0"
                            defaultValue={node.position}
                            className="mt-1 font-mono tabular-nums"
                          />
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <Label>Görsel URL</Label>
                          <Input
                            name="imageUrl"
                            defaultValue={node.imageUrl ?? ""}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label>Açıklama</Label>
                          <Input
                            name="description"
                            defaultValue={node.description ?? ""}
                            className="mt-1"
                          />
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <Label>SEO Başlığı</Label>
                          <Input
                            name="seoTitle"
                            defaultValue={node.seoTitle ?? ""}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label>SEO Açıklaması</Label>
                          <Input
                            name="seoDescription"
                            defaultValue={node.seoDescription ?? ""}
                            className="mt-1"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <label className="flex items-center gap-2 text-xs font-medium text-zinc-800">
                          <input
                            type="checkbox"
                            name="isActive"
                            value="true"
                            defaultChecked={node.isActive}
                            className="h-4 w-4 rounded border-zinc-300"
                          />
                          <span>Vitrinde Aktif</span>
                        </label>

                        <Button type="submit" variant="primary" size="sm">
                          Güncelle
                        </Button>
                      </div>
                    </form>

                    <form
                      action={deleteCategoryFormAction}
                      className="mt-2 flex justify-end border-t border-zinc-200 pt-2"
                    >
                      <input type="hidden" name="categoryId" value={node.id} />
                      <Button type="submit" variant="danger" size="sm">
                        Kategoriyi Sil
                      </Button>
                    </form>
                  </div>
                </details>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
