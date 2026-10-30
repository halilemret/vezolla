import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import {
  deleteAttributeDefinitionFormAction,
  deleteProductTypeFormAction,
  saveAttributeDefinitionFormAction,
  saveProductTypeFormAction,
} from "@/modules/catalog/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { AttributeKind } from "@/generated/prisma/client";

const KIND_LABELS: Record<AttributeKind, string> = {
  TEXT: "Metin (TEXT)",
  NUMBER: "Sayısal (NUMBER)",
  BOOLEAN: "Evet / Hayır (BOOLEAN)",
  SELECT: "Tekli Seçim (SELECT)",
  MULTISELECT: "Çoklu Seçim (MULTISELECT)",
  COLOR: "Renk (COLOR)",
};

export default async function AdminCustomAttributesPage() {
  await requireStaff("catalog.read");

  const [attributes, productTypes] = await Promise.all([
    db.attributeDefinition.findMany({
      include: {
        _count: {
          select: { values: true, productTypes: true },
        },
      },
      orderBy: [{ position: "asc" }, { label: "asc" }],
    }),
    db.productType.findMany({
      include: {
        attributes: {
          orderBy: { position: "asc" },
          include: { attribute: true },
        },
        _count: {
          select: { products: true },
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">
          Ürün Tipleri ve Özel Alan Tanımları
        </h1>
        <p className="mt-0.5 text-xs text-zinc-600">
          Teknik özellik şablonlarını (ProductType), filtrelenebilir özel alanları (AttributeDefinition), birimleri ve seçenekleri yönetin.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* BÖLÜM 1: ÖZEL ALAN TANIMLARI */}
        <section className="space-y-4 rounded-md border border-zinc-200 bg-white p-5">
          <div className="border-b border-zinc-200 pb-3">
            <h2 className="text-sm font-semibold text-zinc-900">
              Özel Alan Tanımları ({attributes.length})
            </h2>
            <p className="text-xs text-zinc-600">
              Ürün detayında gösterilecek ve vitrinde filtrelenebilecek teknik alanlar.
            </p>
          </div>

          <form
            action={saveAttributeDefinitionFormAction}
            className="space-y-3 rounded border border-zinc-200 bg-zinc-50 p-4"
          >
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-800">
              Yeni Özel Alan Ekle
            </h3>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="attr-label">Alan Etiketi *</Label>
                <Input
                  id="attr-label"
                  name="label"
                  required
                  placeholder="Örn: Kumaş Gramajı, Materyal, Kalıp"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="attr-key">Teknik Anahtar (İsteğe Bağlı)</Label>
                <Input
                  id="attr-key"
                  name="key"
                  placeholder="kumas_gramaji"
                  className="mt-1 font-mono"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label htmlFor="attr-kind">Veri Türü</Label>
                <Select
                  id="attr-kind"
                  name="kind"
                  defaultValue="SELECT"
                  className="mt-1"
                >
                  <option value="TEXT">Metin (TEXT)</option>
                  <option value="NUMBER">Sayısal (NUMBER)</option>
                  <option value="BOOLEAN">Evet / Hayır (BOOLEAN)</option>
                  <option value="SELECT">Tekli Seçim (SELECT)</option>
                  <option value="MULTISELECT">Çoklu Seçim (MULTISELECT)</option>
                  <option value="COLOR">Renk (COLOR)</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="attr-unit">Birim (İsteğe Bağlı)</Label>
                <Input
                  id="attr-unit"
                  name="unit"
                  placeholder="Örn: gsm, cm, gr, % "
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="attr-pos">Sıra No</Label>
                <Input
                  id="attr-pos"
                  name="position"
                  type="number"
                  min="0"
                  defaultValue="0"
                  className="mt-1 font-mono tabular-nums"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="attr-options">
                Seçenekler (SELECT ve MULTISELECT için virgülle ayırın)
              </Label>
              <Input
                id="attr-options"
                name="options"
                placeholder="Örn: %100 Pamuk, %80 Yün, Keten, Kaşmir"
                className="mt-1"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-xs font-medium text-zinc-800">
                  <input
                    type="checkbox"
                    name="isFilterable"
                    value="true"
                    defaultChecked
                    className="h-4 w-4 rounded border-zinc-300"
                  />
                  <span>Vitrinde Filtrelenebilir</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-medium text-zinc-800">
                  <input
                    type="checkbox"
                    name="isVisibleOnProduct"
                    value="true"
                    defaultChecked
                    className="h-4 w-4 rounded border-zinc-300"
                  />
                  <span>Ürün Sayfasında Göster</span>
                </label>
              </div>

              <Button type="submit" variant="primary" size="sm">
                Özel Alanı Kaydet
              </Button>
            </div>
          </form>

          {attributes.length === 0 ? (
            <EmptyState
              title="Henüz özel alan tanımlanmadı"
              description="Yukarıdaki formu kullanarak materyal, kalıp, ölçü veya teknik özellik alanları ekleyebilirsiniz."
            />
          ) : (
            <div className="divide-y divide-zinc-200">
              {attributes.map((attr) => (
                <details key={attr.id} className="py-2.5">
                  <summary className="flex cursor-pointer items-center justify-between gap-2 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-zinc-900">
                        {attr.label}
                      </span>
                      <span className="font-mono text-zinc-500">
                        ({attr.key})
                      </span>
                      <Badge variant="neutral">{KIND_LABELS[attr.kind]}</Badge>
                      {attr.unit ? (
                        <Badge variant="neutral">Birim: {attr.unit}</Badge>
                      ) : null}
                      {attr.isFilterable ? (
                        <Badge variant="accent">Filtrelenebilir</Badge>
                      ) : null}
                    </div>
                    <span className="font-medium text-zinc-900 underline">
                      Düzenle
                    </span>
                  </summary>

                  <div className="mt-3 space-y-3 rounded border border-zinc-200 bg-zinc-50 p-3.5">
                    <form
                      action={saveAttributeDefinitionFormAction}
                      className="space-y-3"
                    >
                      <input type="hidden" name="id" value={attr.id} />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <Label>Etiket</Label>
                          <Input
                            name="label"
                            defaultValue={attr.label}
                            required
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label>Anahtar</Label>
                          <Input
                            name="key"
                            defaultValue={attr.key}
                            required
                            className="mt-1 font-mono"
                          />
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-3">
                        <div>
                          <Label>Tür</Label>
                          <Select
                            name="kind"
                            defaultValue={attr.kind}
                            className="mt-1"
                          >
                            <option value="TEXT">TEXT</option>
                            <option value="NUMBER">NUMBER</option>
                            <option value="BOOLEAN">BOOLEAN</option>
                            <option value="SELECT">SELECT</option>
                            <option value="MULTISELECT">MULTISELECT</option>
                            <option value="COLOR">COLOR</option>
                          </Select>
                        </div>
                        <div>
                          <Label>Birim</Label>
                          <Input
                            name="unit"
                            defaultValue={attr.unit ?? ""}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label>Sıra</Label>
                          <Input
                            name="position"
                            type="number"
                            defaultValue={attr.position}
                            className="mt-1 font-mono tabular-nums"
                          />
                        </div>
                      </div>

                      <div>
                        <Label>Seçenekler (Virgülle Ayırın)</Label>
                        <Input
                          name="options"
                          defaultValue={attr.options.join(", ")}
                          className="mt-1"
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-2 text-xs text-zinc-800">
                            <input
                              type="checkbox"
                              name="isFilterable"
                              value="true"
                              defaultChecked={attr.isFilterable}
                              className="h-4 w-4 rounded border-zinc-300"
                            />
                            <span>Filtrelenebilir</span>
                          </label>
                          <label className="flex items-center gap-2 text-xs text-zinc-800">
                            <input
                              type="checkbox"
                              name="isVisibleOnProduct"
                              value="true"
                              defaultChecked={attr.isVisibleOnProduct}
                              className="h-4 w-4 rounded border-zinc-300"
                            />
                            <span>Üründe Göster</span>
                          </label>
                        </div>
                        <Button type="submit" variant="primary" size="sm">
                          Güncelle
                        </Button>
                      </div>
                    </form>

                    <form
                      action={deleteAttributeDefinitionFormAction}
                      className="flex justify-end border-t border-zinc-200 pt-2"
                    >
                      <input type="hidden" name="attributeId" value={attr.id} />
                      <Button type="submit" variant="danger" size="sm">
                        Alanı Sil
                      </Button>
                    </form>
                  </div>
                </details>
              ))}
            </div>
          )}
        </section>

        {/* BÖLÜM 2: ÜRÜN TİPLERİ */}
        <section className="space-y-4 rounded-md border border-zinc-200 bg-white p-5">
          <div className="border-b border-zinc-200 pb-3">
            <h2 className="text-sm font-semibold text-zinc-900">
              Ürün Tipleri ({productTypes.length})
            </h2>
            <p className="text-xs text-zinc-600">
              Ürün tiplerini oluşturup hangi özel alanların o ürün tipinde yer alacağını belirleyin.
            </p>
          </div>

          <form
            action={saveProductTypeFormAction}
            className="space-y-3 rounded border border-zinc-200 bg-zinc-50 p-4"
          >
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-800">
              Yeni Ürün Tipi Oluştur
            </h3>

            <div>
              <Label htmlFor="pt-name">Ürün Tipi Adı *</Label>
              <Input
                id="pt-name"
                name="name"
                required
                placeholder="Örn: Üst Giyim, Ayakkabı, Ev Tekstili"
                className="mt-1"
              />
            </div>

            {attributes.length > 0 ? (
              <div className="space-y-2 rounded border border-zinc-200 bg-white p-3">
                <span className="block text-xs font-semibold text-zinc-700">
                  Bu Ürün Tipine Bağlanacak Özel Alanlar
                </span>
                <div className="divide-y divide-zinc-100">
                  {attributes.map((attr) => (
                    <div
                      key={attr.id}
                      className="flex items-center justify-between py-1.5 text-xs"
                    >
                      <label className="flex items-center gap-2 text-zinc-900">
                        <input
                          type="checkbox"
                          name="attributeIds"
                          value={attr.id}
                          className="h-3.5 w-3.5 rounded border-zinc-300"
                        />
                        <span className="font-medium">{attr.label}</span>
                        <span className="text-zinc-500">({attr.kind})</span>
                      </label>

                      <label className="flex items-center gap-1.5 text-[11px] text-zinc-600">
                        <input
                          type="checkbox"
                          name="requiredAttributeIds"
                          value={attr.id}
                          className="h-3.5 w-3.5 rounded border-zinc-300"
                        />
                        <span>Zorunlu</span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <Button type="submit" variant="primary" size="sm">
              Ürün Tipini Kaydet
            </Button>
          </form>

          {productTypes.length === 0 ? (
            <EmptyState
              title="Henüz ürün tipi tanımlanmadı"
              description="Benzer özelliklere sahip ürünleri gruplamak için ürün tipi oluşturabilirsiniz."
            />
          ) : (
            <div className="divide-y divide-zinc-200">
              {productTypes.map((pt) => {
                const assignedIds = new Set(
                  pt.attributes.map((a) => a.attributeId)
                );
                const requiredIds = new Set(
                  pt.attributes
                    .filter((a) => a.isRequired)
                    .map((a) => a.attributeId)
                );

                return (
                  <details key={pt.id} className="py-2.5">
                    <summary className="flex cursor-pointer items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-zinc-900">
                          {pt.name}
                        </span>
                        <Badge variant="neutral">
                          {pt.attributes.length} özel alan
                        </Badge>
                        <span className="font-mono text-zinc-500 tabular-nums">
                          ({pt._count.products} ürün)
                        </span>
                      </div>
                      <span className="font-medium text-zinc-900 underline">
                        Düzenle
                      </span>
                    </summary>

                    <div className="mt-3 space-y-3 rounded border border-zinc-200 bg-zinc-50 p-3.5">
                      <form
                        action={saveProductTypeFormAction}
                        className="space-y-3"
                      >
                        <input type="hidden" name="id" value={pt.id} />
                        <div>
                          <Label>Ürün Tipi Adı</Label>
                          <Input
                            name="name"
                            defaultValue={pt.name}
                            required
                            className="mt-1"
                          />
                        </div>

                        <div className="space-y-1.5 rounded border border-zinc-200 bg-white p-3">
                          {attributes.map((attr) => (
                            <div
                              key={attr.id}
                              className="flex items-center justify-between py-1 text-xs"
                            >
                              <label className="flex items-center gap-2 text-zinc-900">
                                <input
                                  type="checkbox"
                                  name="attributeIds"
                                  value={attr.id}
                                  defaultChecked={assignedIds.has(attr.id)}
                                  className="h-3.5 w-3.5 rounded border-zinc-300"
                                />
                                <span>{attr.label}</span>
                              </label>
                              <label className="flex items-center gap-1.5 text-[11px] text-zinc-600">
                                <input
                                  type="checkbox"
                                  name="requiredAttributeIds"
                                  value={attr.id}
                                  defaultChecked={requiredIds.has(attr.id)}
                                  className="h-3.5 w-3.5 rounded border-zinc-300"
                                />
                                <span>Zorunlu</span>
                              </label>
                            </div>
                          ))}
                        </div>

                        <div className="flex justify-end">
                          <Button type="submit" variant="primary" size="sm">
                            Güncelle
                          </Button>
                        </div>
                      </form>

                      <form
                        action={deleteProductTypeFormAction}
                        className="flex justify-end border-t border-zinc-200 pt-2"
                      >
                        <input
                          type="hidden"
                          name="productTypeId"
                          value={pt.id}
                        />
                        <Button type="submit" variant="danger" size="sm">
                          Ürün Tipini Sil
                        </Button>
                      </form>
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
