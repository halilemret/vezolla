import { db } from "@/lib/db";
import { HOME_BLOCK_TYPES, PRODUCT_RAIL_SOURCES } from "@/modules/content/blocks";
import {
  createHomeBlockAction,
  deleteHomeBlockAction,
  deleteHomeBlockVariantAction,
  moveHomeBlockAction,
  saveHomeBlockVariantAction,
  toggleHomeBlockAction,
} from "@/modules/content/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import Link from "next/link";

export default async function AdminHomeBlocksPage() {
  const [blocks, segments, categories, collections] = await Promise.all([
    db.homeBlock.findMany({
      where: { page: "home" },
      include: {
        variants: {
          include: { segment: true },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { position: "asc" },
    }),
    db.segment.findMany({ where: { isActive: true }, orderBy: { priority: "desc" } }),
    db.category.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    db.collection.findMany({ where: { isActive: true }, orderBy: { title: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Ana Sayfa Blok Düzenleyici</h1>
          <p className="mt-1 text-xs text-zinc-600">
            Ana sayfadaki bölümleri sıralayın ve her blok için ziyaretçi segmentine veya geldiği reklama özel varyant tanımlayın.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/kisisellestirme">
            <Button variant="outline" size="sm">
              Segment ve Reklam Eşleştirme
            </Button>
          </Link>
          <Link href="/" target="_blank">
            <Button variant="secondary" size="sm">
              Vitrini Görüntüle
            </Button>
          </Link>
        </div>
      </div>

      {/* Yeni Blok Ekleme */}
      <section className="rounded-md border border-zinc-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-zinc-900">Yeni Ana Sayfa Bloğu Ekle</h2>
        <form action={createHomeBlockAction} className="mt-3 grid gap-3 sm:grid-cols-4">
          <div>
            <Label htmlFor="name">Blok Adı (Panel İçin)</Label>
            <Input
              id="name"
              name="name"
              required
              placeholder="Örn: Üst Karşılama veya Sana Özel Şeridi"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="type">Blok Tipi</Label>
            <Select id="type" name="type" className="mt-1" defaultValue="product_rail">
              {HOME_BLOCK_TYPES.map((t) => (
                <option key={t.type} value={t.type}>
                  {t.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="source">Ürün Şeridi Kaynağı (Şerit ise)</Label>
            <Select id="source" name="source" className="mt-1" defaultValue="for_you">
              {PRODUCT_RAIL_SOURCES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-end">
            <Button type="submit" className="w-full">
              Bloğu Ekle
            </Button>
          </div>
        </form>
      </section>

      {blocks.length === 0 ? (
        <EmptyState
          title="Ana sayfada henüz blok tanımlı değil"
          description="Yukarıdaki formdan bir karşılama bloğu veya kişiselleştirilmiş ürün şeridi ekleyerek vitrini oluşturun."
        />
      ) : (
        <div className="space-y-5">
          {blocks.map((block, index) => {
            const typeMeta = HOME_BLOCK_TYPES.find((t) => t.type === block.type);

            return (
              <section
                key={block.id}
                className="rounded-md border border-zinc-200 bg-white p-5 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-zinc-900 font-mono text-xs font-semibold text-white tabular-nums">
                      {index + 1}
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-900">{block.name}</h3>
                      <p className="text-xs text-zinc-600">{typeMeta?.label ?? block.type}</p>
                    </div>
                    <Badge variant={block.isActive ? "success" : "neutral"}>
                      {block.isActive ? "Yayında" : "Pasif"}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <form action={moveHomeBlockAction}>
                      <input type="hidden" name="id" value={block.id} />
                      <input type="hidden" name="direction" value="up" />
                      <Button
                        type="submit"
                        variant="outline"
                        size="sm"
                        disabled={index === 0}
                      >
                        Yukarı
                      </Button>
                    </form>
                    <form action={moveHomeBlockAction}>
                      <input type="hidden" name="id" value={block.id} />
                      <input type="hidden" name="direction" value="down" />
                      <Button
                        type="submit"
                        variant="outline"
                        size="sm"
                        disabled={index === blocks.length - 1}
                      >
                        Aşağı
                      </Button>
                    </form>
                    <form action={toggleHomeBlockAction}>
                      <input type="hidden" name="id" value={block.id} />
                      <input
                        type="hidden"
                        name="isActive"
                        value={block.isActive ? "false" : "true"}
                      />
                      <Button type="submit" variant="secondary" size="sm">
                        {block.isActive ? "Pasife Al" : "Aktifleştir"}
                      </Button>
                    </form>
                    <form action={deleteHomeBlockAction}>
                      <input type="hidden" name="id" value={block.id} />
                      <Button type="submit" variant="danger" size="sm">
                        Sil
                      </Button>
                    </form>
                  </div>
                </div>

                {/* Mevcut Varyantlar */}
                <div className="space-y-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                    Blok Varyantları (Varsayılan ve Segmente Özel Görünümler)
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    {block.variants.map((variant) => {
                      const cfg =
                        variant.config &&
                        typeof variant.config === "object" &&
                        !Array.isArray(variant.config)
                          ? (variant.config as Record<string, unknown>)
                          : {};

                      return (
                        <div
                          key={variant.id}
                          className="rounded-md border border-zinc-200 bg-zinc-50/70 p-4 space-y-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-zinc-900">
                                {variant.name}
                              </span>
                              {variant.segment ? (
                                <Badge variant="accent">Segment: {variant.segment.name}</Badge>
                              ) : (
                                <Badge variant="neutral">Varsayılan</Badge>
                              )}
                              {variant.isHidden ? (
                                <Badge variant="warning">Bu segmentte gizli</Badge>
                              ) : null}
                            </div>

                            {block.variants.length > 1 ? (
                              <form action={deleteHomeBlockVariantAction}>
                                <input type="hidden" name="id" value={variant.id} />
                                <button
                                  type="submit"
                                  className="text-xs font-medium text-red-700 hover:underline"
                                >
                                  Varyantı Kaldır
                                </button>
                              </form>
                            ) : null}
                          </div>

                          <form action={saveHomeBlockVariantAction} className="space-y-2.5">
                            <input type="hidden" name="id" value={variant.id} />
                            <input type="hidden" name="blockId" value={block.id} />
                            <input type="hidden" name="blockType" value={block.type} />

                            <div className="grid gap-2 sm:grid-cols-2">
                              <div>
                                <Label>Varyant Adı</Label>
                                <Input
                                  name="name"
                                  defaultValue={variant.name}
                                  required
                                  className="mt-1"
                                />
                              </div>
                              <div>
                                <Label>Hedef Segment</Label>
                                <Select
                                  name="segmentId"
                                  defaultValue={variant.segmentId ?? ""}
                                  className="mt-1"
                                >
                                  <option value="">Varsayılan (Tüm Ziyaretçiler)</option>
                                  {segments.map((seg) => (
                                    <option key={seg.id} value={seg.id}>
                                      {seg.name}
                                    </option>
                                  ))}
                                </Select>
                              </div>
                            </div>

                            {block.type === "hero_banner" ? (
                              <div className="space-y-2">
                                <div>
                                  <Label>Ana Başlık</Label>
                                  <Input
                                    name="headline"
                                    defaultValue={String(cfg.headline ?? "")}
                                    className="mt-1"
                                  />
                                </div>
                                <div>
                                  <Label>Alt Açıklama</Label>
                                  <Input
                                    name="subheadline"
                                    defaultValue={String(cfg.subheadline ?? "")}
                                    className="mt-1"
                                  />
                                </div>
                                <div className="grid gap-2 sm:grid-cols-3">
                                  <div>
                                    <Label>Buton Metni</Label>
                                    <Input
                                      name="ctaLabel"
                                      defaultValue={String(cfg.ctaLabel ?? "Kataloğu İncele")}
                                      className="mt-1"
                                    />
                                  </div>
                                  <div>
                                    <Label>Buton Bağlantısı</Label>
                                    <Input
                                      name="ctaHref"
                                      defaultValue={String(cfg.ctaHref ?? "/katalog")}
                                      className="mt-1"
                                    />
                                  </div>
                                  <div>
                                    <Label>Görsel URL (İsteğe Bağlı)</Label>
                                    <Input
                                      name="imageUrl"
                                      defaultValue={String(cfg.imageUrl ?? "")}
                                      placeholder="/uploads/..."
                                      className="mt-1"
                                    />
                                  </div>
                                </div>
                              </div>
                            ) : null}

                            {block.type === "product_rail" ? (
                              <div className="space-y-2">
                                <div className="grid gap-2 sm:grid-cols-2">
                                  <div>
                                    <Label>Bölüm Başlığı</Label>
                                    <Input
                                      name="title"
                                      defaultValue={String(cfg.title ?? block.name)}
                                      className="mt-1"
                                    />
                                  </div>
                                  <div>
                                    <Label>Alt Başlık</Label>
                                    <Input
                                      name="subtitle"
                                      defaultValue={String(cfg.subtitle ?? "")}
                                      className="mt-1"
                                    />
                                  </div>
                                </div>
                                <div className="grid gap-2 sm:grid-cols-3">
                                  <div>
                                    <Label>Veri Kaynağı</Label>
                                    <Select
                                      name="source"
                                      defaultValue={String(cfg.source ?? "cold_start")}
                                      className="mt-1"
                                    >
                                      {PRODUCT_RAIL_SOURCES.map((s) => (
                                        <option key={s.value} value={s.value}>
                                          {s.label}
                                        </option>
                                      ))}
                                    </Select>
                                  </div>
                                  <div>
                                    <Label>Kategori (Seçiliyse)</Label>
                                    <Select
                                      name="categoryId"
                                      defaultValue={String(cfg.categoryId ?? "")}
                                      className="mt-1"
                                    >
                                      <option value="">Tümü</option>
                                      {categories.map((c) => (
                                        <option key={c.id} value={c.id}>
                                          {c.name}
                                        </option>
                                      ))}
                                    </Select>
                                  </div>
                                  <div>
                                    <Label>Koleksiyon (Seçiliyse)</Label>
                                    <Select
                                      name="collectionId"
                                      defaultValue={String(cfg.collectionId ?? "")}
                                      className="mt-1"
                                    >
                                      <option value="">Tümü</option>
                                      {collections.map((c) => (
                                        <option key={c.id} value={c.id}>
                                          {c.title}
                                        </option>
                                      ))}
                                    </Select>
                                  </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-4 pt-1">
                                  <div className="w-28">
                                    <Label>Ürün Sayısı</Label>
                                    <Input
                                      name="limit"
                                      type="number"
                                      min={2}
                                      max={24}
                                      defaultValue={Number(cfg.limit ?? 8)}
                                      className="mt-1"
                                    />
                                  </div>
                                  <label className="mt-4 flex items-center gap-2 text-xs text-zinc-700">
                                    <input
                                      type="checkbox"
                                      name="hideIfEmpty"
                                      defaultChecked={cfg.hideIfEmpty !== false}
                                    />
                                    Ürün yoksa bu şeridi gizle
                                  </label>
                                </div>
                              </div>
                            ) : null}

                            {block.type === "category_grid" ? (
                              <div className="grid gap-2 sm:grid-cols-3">
                                <div>
                                  <Label>Başlık</Label>
                                  <Input
                                    name="title"
                                    defaultValue={String(cfg.title ?? "Kategoriler")}
                                    className="mt-1"
                                  />
                                </div>
                                <div>
                                  <Label>Alt Başlık</Label>
                                  <Input
                                    name="subtitle"
                                    defaultValue={String(cfg.subtitle ?? "")}
                                    className="mt-1"
                                  />
                                </div>
                                <div>
                                  <Label>Gösterilecek Adet</Label>
                                  <Input
                                    name="limit"
                                    type="number"
                                    min={2}
                                    max={12}
                                    defaultValue={Number(cfg.limit ?? 6)}
                                    className="mt-1"
                                  />
                                </div>
                              </div>
                            ) : null}

                            {block.type === "split_callout" ? (
                              <div className="space-y-2">
                                <div className="grid gap-2 sm:grid-cols-2">
                                  <div>
                                    <Label>Başlık</Label>
                                    <Input
                                      name="title"
                                      defaultValue={String(cfg.title ?? "")}
                                      className="mt-1"
                                    />
                                  </div>
                                  <div>
                                    <Label>Buton Bağlantısı</Label>
                                    <Input
                                      name="ctaHref"
                                      defaultValue={String(cfg.ctaHref ?? "/katalog")}
                                      className="mt-1"
                                    />
                                  </div>
                                </div>
                                <div>
                                  <Label>Metin</Label>
                                  <Textarea
                                    name="body"
                                    defaultValue={String(cfg.body ?? "")}
                                    className="mt-1 min-h-16"
                                  />
                                </div>
                              </div>
                            ) : null}

                            {block.type === "rich_text" ? (
                              <div className="space-y-2">
                                <div>
                                  <Label>Başlık</Label>
                                  <Input
                                    name="title"
                                    defaultValue={String(cfg.title ?? "")}
                                    className="mt-1"
                                  />
                                </div>
                                <div>
                                  <Label>İçerik (HTML veya Metin)</Label>
                                  <Textarea
                                    name="html"
                                    defaultValue={String(cfg.html ?? "")}
                                    className="mt-1 min-h-20"
                                  />
                                </div>
                              </div>
                            ) : null}

                            <div className="flex items-center justify-between pt-2">
                              <label className="flex items-center gap-2 text-xs text-zinc-700">
                                <input
                                  type="checkbox"
                                  name="isHidden"
                                  defaultChecked={variant.isHidden}
                                />
                                Bu segmentteki ziyaretçilere bloğu gizle
                              </label>
                              <Button type="submit" size="sm">
                                Varyantı Kaydet
                              </Button>
                            </div>
                          </form>
                        </div>
                      );
                    })}

                    {/* Yeni Segment Varyantı Ekleme Kartı */}
                    <div className="rounded-md border border-dashed border-zinc-300 bg-white p-4">
                      <h4 className="text-xs font-semibold text-zinc-900">
                        + Bu Bloğa Segmente Özel Varyant Ekle
                      </h4>
                      <p className="mt-0.5 text-[11px] text-zinc-600">
                        Belirli bir reklamdan gelen veya belirli bir davranış segmentindeki ziyaretçilere farklı başlık/ürün kaynağı gösterin.
                      </p>
                      <form action={saveHomeBlockVariantAction} className="mt-3 space-y-2.5">
                        <input type="hidden" name="blockId" value={block.id} />
                        <input type="hidden" name="blockType" value={block.type} />
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div>
                            <Label>Varyant Adı</Label>
                            <Input
                              name="name"
                              required
                              placeholder="Örn: Meta Reklam Karşılama"
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label>Hedef Segment</Label>
                            <Select name="segmentId" required className="mt-1" defaultValue="">
                              <option value="" disabled>
                                Segment seçin...
                              </option>
                              {segments.map((seg) => (
                                <option key={seg.id} value={seg.id}>
                                  {seg.name}
                                </option>
                              ))}
                            </Select>
                          </div>
                        </div>

                        {block.type === "hero_banner" ? (
                          <div className="grid gap-2 sm:grid-cols-2">
                            <div>
                              <Label>Segmente Özel Başlık</Label>
                              <Input
                                name="headline"
                                placeholder="Kampanyaya Özel Seçki"
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label>Buton Bağlantısı</Label>
                              <Input name="ctaHref" defaultValue="/katalog" className="mt-1" />
                            </div>
                          </div>
                        ) : null}

                        {block.type === "product_rail" ? (
                          <div className="grid gap-2 sm:grid-cols-2">
                            <div>
                              <Label>Bölüm Başlığı</Label>
                              <Input
                                name="title"
                                placeholder="İlgilendiğiniz Ürünler"
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label>Ürün Kaynağı</Label>
                              <Select name="source" defaultValue="ad_campaign" className="mt-1">
                                {PRODUCT_RAIL_SOURCES.map((s) => (
                                  <option key={s.value} value={s.value}>
                                    {s.label}
                                  </option>
                                ))}
                              </Select>
                            </div>
                          </div>
                        ) : null}

                        <Button type="submit" variant="outline" size="sm">
                          Segment Varyantı Ekle
                        </Button>
                      </form>
                    </div>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
