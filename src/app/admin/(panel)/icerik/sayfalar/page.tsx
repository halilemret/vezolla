import { db } from "@/lib/db";
import { ensureDefaultMenus } from "@/modules/content/service";
import {
  addMenuItemAction,
  createRedirectAction,
  deleteMenuItemAction,
  moveMenuItemAction,
  deletePageAction,
  deleteRedirectAction,
  savePageAction,
} from "@/modules/content/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  ArrowUp,
  ArrowDown,
  Trash,
  Plus,
  Folder,
  LinkSimple,
  Sparkle,
  Flame,
  List,
} from "@phosphor-icons/react/dist/ssr";

export default async function AdminPagesAndMenusPage() {
  const [{ header, footer }, pages, redirects, allCategories] = await Promise.all([
    ensureDefaultMenus(),
    db.page.findMany({ orderBy: { title: "asc" } }),
    db.redirect.findMany({ orderBy: { createdAt: "desc" } }),
    db.category.findMany({
      where: { isActive: true },
      orderBy: [{ parentId: "asc" }, { position: "asc" }, { name: "asc" }],
      include: { parent: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">
          İçerik Sayfaları, Menüler ve 301 Yönlendirmeler
        </h1>
        <p className="mt-1 text-xs text-zinc-600">
          Kurumsal/yasal sayfaları (Hakkımızda, KVKK, İade Koşulları), üst/alt menüleri ve URL yönlendirmelerini yönetin.
        </p>
      </div>

      {/* CMS Sayfaları */}
      <section className="rounded-md border border-zinc-200 bg-white p-5 space-y-5">
        <h2 className="text-sm font-semibold text-zinc-900">Sayfalar (CMS)</h2>

        <form action={savePageAction} className="space-y-3 rounded-md border border-zinc-200 bg-zinc-50 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-700">
            Yeni Sayfa Oluştur
          </h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="title">Sayfa Başlığı</Label>
              <Input id="title" name="title" required placeholder="Örn: Teslimat ve İade" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="slug">URL Kısa Adı (İsteğe Bağlı)</Label>
              <Input id="slug" name="slug" placeholder="teslimat-ve-iade" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="status">Durum</Label>
              <Select id="status" name="status" defaultValue="PUBLISHED" className="mt-1">
                <option value="PUBLISHED">Yayında</option>
                <option value="DRAFT">Taslak</option>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="content">Sayfa İçeriği (HTML veya Metin)</Label>
            <Textarea
              id="content"
              name="content"
              required
              placeholder="<p>Sayfa metni...</p>"
              className="mt-1 min-h-28"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="seoTitle">SEO Başlığı</Label>
              <Input id="seoTitle" name="seoTitle" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="seoDescription">SEO Açıklaması</Label>
              <Input id="seoDescription" name="seoDescription" className="mt-1" />
            </div>
          </div>
          <Button type="submit" size="sm">
            Sayfayı Kaydet
          </Button>
        </form>

        <div className="divide-y divide-zinc-200">
          {pages.map((p) => (
            <details key={p.id} className="py-3">
              <summary className="flex cursor-pointer items-center justify-between gap-2 text-sm font-medium text-zinc-900">
                <span className="flex items-center gap-2">
                  <span>{p.title}</span>
                  <span className="font-mono text-xs text-zinc-600">/sayfa/{p.slug}</span>
                  <Badge variant={p.status === "PUBLISHED" ? "success" : "neutral"}>
                    {p.status === "PUBLISHED" ? "Yayında" : "Taslak"}
                  </Badge>
                  {p.isSystem ? <Badge variant="neutral">Yasal Sayfa</Badge> : null}
                </span>
                <span className="text-xs text-zinc-600">Düzenle</span>
              </summary>

              <div className="mt-3 space-y-3 rounded border border-zinc-200 bg-zinc-50 p-3">
                <form action={savePageAction} className="space-y-3">
                  <input type="hidden" name="id" value={p.id} />
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <Label>Başlık</Label>
                      <Input name="title" defaultValue={p.title} required className="mt-1" />
                    </div>
                    <div>
                      <Label>Slug</Label>
                      <Input name="slug" defaultValue={p.slug} required className="mt-1" />
                    </div>
                    <div>
                      <Label>Durum</Label>
                      <Select name="status" defaultValue={p.status} className="mt-1">
                        <option value="PUBLISHED">Yayında</option>
                        <option value="DRAFT">Taslak</option>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>İçerik</Label>
                    <Textarea name="content" defaultValue={p.content} className="mt-1 min-h-32" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Link
                      href={`/sayfa/${p.slug}`}
                      target="_blank"
                      className="text-xs font-medium text-[#9a3412] hover:underline"
                    >
                      Sayfayı Vitrinde Aç
                    </Link>
                    <Button type="submit" size="sm">
                      Güncelle
                    </Button>
                  </div>
                </form>

                {!p.isSystem ? (
                  <form action={deletePageAction} className="flex justify-end">
                    <input type="hidden" name="id" value={p.id} />
                    <Button type="submit" variant="danger" size="sm">
                      Sayfayı Sil
                    </Button>
                  </form>
                ) : null}
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* Menüler: Header & Footer Yönetimi */}
      <section className="space-y-6">
        {/* 1. VİTRİN ÜST MENÜSÜ & BAŞLIK SEKME YÖNETİCİSİ */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <List className="h-5 w-5 text-zinc-900" weight="bold" />
                <h2 className="text-base font-bold text-zinc-900">
                  Dinamik Vitrin Üst Menüsü & Başlık Sekmeleri
                </h2>
              </div>
              <p className="mt-1 text-xs text-zinc-600">
                Mağaza vitrininin en üstünde ve mobil burger menüsünde yer alacak kategorileri ve özel sekmeleri buradan dilediğiniz gibi ekleyin, sıralayın veya kaldırın.
              </p>
            </div>
            <span className="flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-semibold text-amber-900 shrink-0">
              <Sparkle className="h-3.5 w-3.5 text-amber-600" />
              <span>{header.items.length} Aktif Sekme</span>
            </span>
          </div>

          {/* Aktif Sekmeler Tablosu / Listesi */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700">
              Şu An Vitrinde Görünen Sekmeler (Sırasıyla)
            </h3>
            {header.items.length === 0 ? (
              <div className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-xs text-zinc-500">
                Özel bir menü öğesi eklenmemiş. Vitrin otomatik olarak varsayılan kök kategorileri listeliyor.
              </div>
            ) : (
              <div className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 overflow-hidden bg-zinc-50/50">
                {header.items.map((item, idx) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 text-xs bg-white hover:bg-zinc-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 font-mono text-[11px] font-bold text-zinc-600">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-zinc-950 text-sm">{item.label}</span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                              item.type === "CATEGORY"
                                ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                                : "bg-zinc-100 text-zinc-700 border border-zinc-200"
                            }`}
                          >
                            {item.type === "CATEGORY" ? "Kategori" : "Özel Sekme"}
                          </span>
                        </div>
                        <span className="font-mono text-[11px] text-zinc-500">{item.url}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Yukarı Taşı */}
                      <form action={moveMenuItemAction}>
                        <input type="hidden" name="id" value={item.id} />
                        <input type="hidden" name="direction" value="up" />
                        <button
                          type="submit"
                          disabled={idx === 0}
                          title="Yukarı Taşı"
                          className="flex h-7 w-7 items-center justify-center rounded border border-zinc-200 text-zinc-600 hover:bg-zinc-100 disabled:opacity-30 disabled:pointer-events-none"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                      </form>

                      {/* Aşağı Taşı */}
                      <form action={moveMenuItemAction}>
                        <input type="hidden" name="id" value={item.id} />
                        <input type="hidden" name="direction" value="down" />
                        <button
                          type="submit"
                          disabled={idx === header.items.length - 1}
                          title="Aşağı Taşı"
                          className="flex h-7 w-7 items-center justify-center rounded border border-zinc-200 text-zinc-600 hover:bg-zinc-100 disabled:opacity-30 disabled:pointer-events-none"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                      </form>

                      {/* Sil */}
                      <form action={deleteMenuItemAction}>
                        <input type="hidden" name="id" value={item.id} />
                        <button
                          type="submit"
                          title="Menüden Kaldır"
                          className="flex h-7 w-7 items-center justify-center rounded border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 transition-colors"
                        >
                          <Trash className="h-3.5 w-3.5" />
                        </button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Yeni Sekme Ekleme Alanı (3 Kolay Yöntem) */}
          <div className="grid gap-6 md:grid-cols-2 pt-2 border-t border-zinc-200">
            {/* Yöntem 1: Mağazadaki Bir Kategoriyi Ekle */}
            <form
              action={addMenuItemAction}
              className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-4 space-y-3"
            >
              <input type="hidden" name="menuHandle" value="header" />
              <input type="hidden" name="type" value="CATEGORY" />

              <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-900">
                <Folder className="h-4 w-4 text-indigo-600" />
                <span>Yöntem 1: Mağazadan Kategori Ekle</span>
              </div>

              <div>
                <Label htmlFor="hdr-cat">Eklenecek Kategoriyi Seçin</Label>
                <Select id="hdr-cat" name="categoryId" required className="mt-1">
                  <option value="">Kategori seçiniz...</option>
                  {allCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.parent ? `↳ ${c.parent.name} > ${c.name}` : c.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <Label htmlFor="hdr-cat-label">Görünen Başlık (İsteğe Bağlı)</Label>
                <Input
                  id="hdr-cat-label"
                  name="label"
                  placeholder="Boş bırakırsanız kategori adı kullanılır"
                  className="mt-1"
                />
              </div>

              <Button type="submit" variant="primary" size="sm" className="w-full">
                Kategoriyi Header'a Ekle
              </Button>
            </form>

            {/* Yöntem 2: Özel Bağlantı veya Sayfa Ekle */}
            <form
              action={addMenuItemAction}
              className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-4 space-y-3"
            >
              <input type="hidden" name="menuHandle" value="header" />
              <input type="hidden" name="type" value="URL" />

              <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-900">
                <LinkSimple className="h-4 w-4 text-amber-600" />
                <span>Yöntem 2: Özel Bağlantı / Sayfa Ekle</span>
              </div>

              <div>
                <Label htmlFor="hdr-custom-label">Sekme Başlığı</Label>
                <Input
                  id="hdr-custom-label"
                  name="label"
                  required
                  placeholder="Örn: Yeni Sezon veya Blog"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="hdr-custom-url">Hedef Adres (URL)</Label>
                <Input
                  id="hdr-custom-url"
                  name="url"
                  required
                  placeholder="Örn: /katalog?sort=newest veya /sayfa/iletisim"
                  className="mt-1 font-mono text-xs"
                />
              </div>

              <Button type="submit" variant="outline" size="sm" className="w-full">
                Özel Sekmeyi Ekle
              </Button>
            </form>
          </div>

          {/* Yöntem 3: Hızlı Popüler Şablon Butonları */}
          <div className="rounded-lg border border-amber-200/80 bg-amber-50/40 p-4 space-y-2">
            <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
              <Sparkle className="h-4 w-4 text-amber-600" />
              <span>Tek Tıkla Hızlı Sekme Ekle:</span>
            </span>
            <div className="flex flex-wrap gap-2">
              <form action={addMenuItemAction} className="inline">
                <input type="hidden" name="menuHandle" value="header" />
                <input type="hidden" name="type" value="URL" />
                <input type="hidden" name="label" value="Günün Fırsatları" />
                <input type="hidden" name="url" value="/katalog?filter=discount" />
                <button
                  type="submit"
                  className="rounded-md border border-amber-300 bg-white px-2.5 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100 transition-colors"
                >
                  🔥 + Günün Fırsatları
                </button>
              </form>

              <form action={addMenuItemAction} className="inline">
                <input type="hidden" name="menuHandle" value="header" />
                <input type="hidden" name="type" value="URL" />
                <input type="hidden" name="label" value="Çok Satanlar" />
                <input type="hidden" name="url" value="/katalog?sort=bestseller" />
                <button
                  type="submit"
                  className="rounded-md border border-amber-300 bg-white px-2.5 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100 transition-colors"
                >
                  ⭐ + Çok Satanlar
                </button>
              </form>

              <form action={addMenuItemAction} className="inline">
                <input type="hidden" name="menuHandle" value="header" />
                <input type="hidden" name="type" value="URL" />
                <input type="hidden" name="label" value="Yeni Gelenler" />
                <input type="hidden" name="url" value="/katalog?sort=newest" />
                <button
                  type="submit"
                  className="rounded-md border border-amber-300 bg-white px-2.5 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100 transition-colors"
                >
                  ✨ + Yeni Gelenler
                </button>
              </form>

              <form action={addMenuItemAction} className="inline">
                <input type="hidden" name="menuHandle" value="header" />
                <input type="hidden" name="type" value="URL" />
                <input type="hidden" name="label" value="İletişim & Destek" />
                <input type="hidden" name="url" value="/sayfa/iletisim" />
                <button
                  type="submit"
                  className="rounded-md border border-amber-300 bg-white px-2.5 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100 transition-colors"
                >
                  📞 + İletişim & Destek
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* 2. VİTRİN ALT MENÜSÜ (FOOTER) YÖNETİCİSİ */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
            <div>
              <h2 className="text-sm font-bold text-zinc-900">Alt Menü (Footer) Bağlantıları</h2>
              <p className="text-xs text-zinc-600">
                Vitrinin en altındaki bilgilendirme ve kurumsal bağlantılar.
              </p>
            </div>
            <span className="font-mono text-xs text-zinc-500">{footer.items.length} Bağlantı</span>
          </div>

          <div className="divide-y divide-zinc-200">
            {footer.items.length === 0 ? (
              <p className="py-2 text-xs text-zinc-600">Henüz özel footer bağlantısı eklenmemiş.</p>
            ) : (
              footer.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-2 text-xs">
                  <div>
                    <span className="font-semibold text-zinc-900">{item.label}</span>
                    <span className="ml-2 font-mono text-zinc-600">{item.url}</span>
                  </div>
                  <form action={deleteMenuItemAction}>
                    <input type="hidden" name="id" value={item.id} />
                    <button type="submit" className="text-red-700 hover:underline">
                      Kaldır
                    </button>
                  </form>
                </div>
              ))
            )}
          </div>

          <form action={addMenuItemAction} className="grid gap-2 sm:grid-cols-3 border-t border-zinc-200 pt-3">
            <input type="hidden" name="menuHandle" value="footer" />
            <input type="hidden" name="type" value="URL" />
            <div>
              <Label>Etiket</Label>
              <Input name="label" required placeholder="Örn: Sıkça Sorulan Sorular" className="mt-1" />
            </div>
            <div>
              <Label>Adres (URL)</Label>
              <Input name="url" required placeholder="/sayfa/sikca-sorulan-sorular" className="mt-1" />
            </div>
            <div className="flex items-end">
              <Button type="submit" variant="outline" size="sm" className="w-full">
                Footer'a Ekle
              </Button>
            </div>
          </form>
        </div>
      </section>

      {/* 301 Yönlendirmeler */}
      <section className="rounded-md border border-zinc-200 bg-white p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">301 URL Yönlendirmeleri</h2>
          <p className="text-xs text-zinc-600">
            Eski ürün veya kategori adreslerini SEO kaybı olmadan yeni adreslerine yönlendirin.
          </p>
        </div>

        <form action={createRedirectAction} className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label>Eski Yol (From)</Label>
            <Input name="fromPath" required placeholder="/eski-urun-adresi" className="mt-1" />
          </div>
          <div>
            <Label>Yeni Yol (To)</Label>
            <Input name="toPath" required placeholder="/urun/yeni-urun" className="mt-1" />
          </div>
          <div className="flex items-end">
            <Button type="submit" size="sm">
              301 Yönlendirme Ekle
            </Button>
          </div>
        </form>

        <div className="divide-y divide-zinc-200">
          {redirects.map((r) => (
            <div key={r.id} className="flex items-center justify-between py-2 text-xs">
              <div className="font-mono">
                <span className="text-zinc-900">{r.fromPath}</span>
                <span className="mx-2 text-zinc-500">-&gt;</span>
                <span className="text-[#9a3412]">{r.toPath}</span>
                <span className="ml-3 text-zinc-500">({r.statusCode})</span>
              </div>
              <form action={deleteRedirectAction}>
                <input type="hidden" name="id" value={r.id} />
                <button type="submit" className="text-red-700 hover:underline">
                  Sil
                </button>
              </form>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
