import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { formatMoney } from "@/lib/money";
import {
  deletePriceListFormAction,
  deletePriceListPriceFormAction,
  deleteTaxClassFormAction,
  savePriceListFormAction,
  savePriceListPriceFormAction,
  saveTaxClassFormAction,
} from "@/modules/catalog/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export default async function AdminPricingAndTaxPage() {
  await requireStaff("catalog.read");

  const [taxClasses, priceLists, customerGroups, variants] = await Promise.all([
    db.taxClass.findMany({
      include: {
        _count: { select: { products: true } },
      },
      orderBy: [{ isDefault: "desc" }, { rateBps: "desc" }],
    }),
    db.priceList.findMany({
      include: {
        customerGroup: true,
        prices: {
          include: {
            variant: {
              include: {
                product: { select: { id: true, title: true } },
              },
            },
          },
        },
      },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    }),
    db.customerGroup.findMany({ orderBy: { name: "asc" } }),
    db.productVariant.findMany({
      where: { product: { deletedAt: null } },
      include: {
        product: { select: { id: true, title: true } },
      },
      orderBy: [{ product: { title: "asc" } }, { position: "asc" }],
      take: 250,
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">
          Fiyat Listeleri ve KDV Sınıfları
        </h1>
        <p className="mt-0.5 text-xs text-zinc-600">
          KDV oranlarını ve müşteri gruplarına veya kampanya tarih aralıklarına özel varyant fiyat listelerini yönetin.
        </p>
      </div>

      {/* BÖLÜM 1: KDV SINIFLARI */}
      <section className="space-y-4 rounded-md border border-zinc-200 bg-white p-5">
        <div className="border-b border-zinc-200 pb-3">
          <h2 className="text-sm font-semibold text-zinc-900">
            KDV Sınıfları ({taxClasses.length})
          </h2>
          <p className="text-xs text-zinc-600">
            Ürün fiyatları KDV dahil saklanır; sepet ve fatura dökümünde seçilen KDV oranı ayrıştırılır.
          </p>
        </div>

        <form
          action={saveTaxClassFormAction}
          className="grid gap-3 rounded border border-zinc-200 bg-zinc-50 p-4 sm:grid-cols-4 sm:items-end"
        >
          <div>
            <Label htmlFor="tc-name">KDV Sınıfı Adı *</Label>
            <Input
              id="tc-name"
              name="name"
              required
              placeholder="Örn: Genel KDV (%20) veya Tekstil (%10)"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="tc-rate">KDV Oranı (%)</Label>
            <Input
              id="tc-rate"
              name="ratePercent"
              type="number"
              step="1"
              min="0"
              max="100"
              defaultValue="20"
              required
              className="mt-1 font-mono tabular-nums"
            />
          </div>

          <div>
            <label className="flex h-10 items-center gap-2 text-xs font-medium text-zinc-800">
              <input
                type="checkbox"
                name="isDefault"
                value="true"
                className="h-4 w-4 rounded border-zinc-300"
              />
              <span>Varsayılan KDV Sınıfı Yap</span>
            </label>
          </div>

          <div>
            <Button type="submit" variant="primary" size="sm" className="w-full">
              KDV Sınıfı Ekle
            </Button>
          </div>
        </form>

        {taxClasses.length === 0 ? (
          <EmptyState
            title="Henüz KDV sınıfı tanımlanmadı"
            description="Genel (%20), Tekstil/Gıda (%10) veya Temel Gıda (%1) KDV sınıflarını ekleyebilirsiniz."
          />
        ) : (
          <div className="overflow-x-auto rounded border border-zinc-200">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                  <th className="px-3 py-2.5">Sınıf Adı</th>
                  <th className="px-3 py-2.5">KDV Oranı</th>
                  <th className="px-3 py-2.5">Baz Puan (Bps)</th>
                  <th className="px-3 py-2.5">Bağlı Ürün</th>
                  <th className="px-3 py-2.5 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {taxClasses.map((tc) => (
                  <tr key={tc.id}>
                    <td className="px-3 py-2.5 font-medium text-zinc-900">
                      {tc.name}{" "}
                      {tc.isDefault ? (
                        <Badge variant="success" className="ml-1.5">
                          Varsayılan
                        </Badge>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 font-mono tabular-nums">
                      %{(tc.rateBps / 100).toFixed(0)}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-zinc-500 tabular-nums">
                      {tc.rateBps} bps
                    </td>
                    <td className="px-3 py-2.5 font-mono tabular-nums">
                      {tc._count.products} ürün
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <form action={deleteTaxClassFormAction}>
                        <input type="hidden" name="taxClassId" value={tc.id} />
                        <Button type="submit" variant="ghost" size="sm">
                          Sil
                        </Button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* BÖLÜM 2: FİYAT LİSTELERİ */}
      <section className="space-y-5 rounded-md border border-zinc-200 bg-white p-5">
        <div className="border-b border-zinc-200 pb-3">
          <h2 className="text-sm font-semibold text-zinc-900">
            Özel Fiyat Listeleri ({priceLists.length})
          </h2>
          <p className="text-xs text-zinc-600">
            Müşteri grubuna (VIP, B2B/Toptan) veya belirli bir tarih aralığına özel varyant fiyatları tanımlayın.
          </p>
        </div>

        <form
          action={savePriceListFormAction}
          className="space-y-3 rounded border border-zinc-200 bg-zinc-50 p-4"
        >
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-800">
            Yeni Fiyat Listesi Oluştur
          </h3>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="pl-name">Liste Adı *</Label>
              <Input
                id="pl-name"
                name="name"
                required
                placeholder="Örn: Kurumsal B2B Fiyat Listesi"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="pl-group">Müşteri Grubu (İsteğe Bağlı)</Label>
              <Select
                id="pl-group"
                name="customerGroupId"
                defaultValue=""
                className="mt-1"
              >
                <option value="">Tüm Müşteriler</option>
                {customerGroups.map((cg) => (
                  <option key={cg.id} value={cg.id}>
                    {cg.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="pl-priority">Öncelik (Yüksek değer kazanır)</Label>
              <Input
                id="pl-priority"
                name="priority"
                type="number"
                defaultValue="10"
                className="mt-1 font-mono tabular-nums"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="pl-desc">Açıklama</Label>
              <Input
                id="pl-desc"
                name="description"
                placeholder="Liste notu..."
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="pl-start">Başlangıç Tarihi</Label>
              <Input
                id="pl-start"
                name="startsAt"
                type="datetime-local"
                className="mt-1 font-mono"
              />
            </div>
            <div>
              <Label htmlFor="pl-end">Bitiş Tarihi</Label>
              <Input
                id="pl-end"
                name="endsAt"
                type="datetime-local"
                className="mt-1 font-mono"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 text-xs font-medium text-zinc-800">
              <input
                type="checkbox"
                name="isActive"
                value="true"
                defaultChecked
                className="h-4 w-4 rounded border-zinc-300"
              />
              <span>Fiyat Listesi Aktif</span>
            </label>
            <Button type="submit" variant="primary" size="sm">
              Fiyat Listesi Oluştur
            </Button>
          </div>
        </form>

        {priceLists.length === 0 ? (
          <EmptyState
            title="Henüz özel fiyat listesi oluşturulmadı"
            description="Müşteri gruplarına veya tarih aralıklı kampanyalara özel varyant fiyatları tanımlamak için yukarıdan liste ekleyin."
          />
        ) : (
          <div className="space-y-4">
            {priceLists.map((pl) => (
              <div
                key={pl.id}
                className="space-y-4 rounded-md border border-zinc-200 bg-zinc-50/70 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 pb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-zinc-900">
                      {pl.name}
                    </h3>
                    <Badge variant={pl.isActive ? "success" : "neutral"}>
                      {pl.isActive ? "Aktif" : "Pasif"}
                    </Badge>
                    <Badge variant="neutral">
                      Grup: {pl.customerGroup ? pl.customerGroup.name : "Tümü"}
                    </Badge>
                    <Badge variant="neutral">Öncelik: {pl.priority}</Badge>
                  </div>

                  <form action={deletePriceListFormAction}>
                    <input type="hidden" name="priceListId" value={pl.id} />
                    <Button type="submit" variant="danger" size="sm">
                      Listeyi Sil
                    </Button>
                  </form>
                </div>

                {/* Listeye Varyant Fiyatı Ekle */}
                <form
                  action={savePriceListPriceFormAction}
                  className="grid gap-3 sm:grid-cols-4 sm:items-end"
                >
                  <input type="hidden" name="priceListId" value={pl.id} />
                  <div className="sm:col-span-2">
                    <Label>Varyant Seçin</Label>
                    <Select name="variantId" required className="mt-1">
                      <option value="">Ürün / Varyant Seçin...</option>
                      {variants.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.product.title} : {v.title}{" "}
                          {v.sku ? `(${v.sku})` : ""} [Normal:{" "}
                          {formatMoney(v.price)}]
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label>Özel Liste Fiyatı (TL)</Label>
                    <Input
                      name="price"
                      required
                      placeholder="Örn: 399,90"
                      className="mt-1 font-mono tabular-nums"
                    />
                  </div>
                  <div>
                    <Button
                      type="submit"
                      variant="secondary"
                      size="sm"
                      className="w-full"
                    >
                      Varyant Fiyatı Kaydet
                    </Button>
                  </div>
                </form>

                {/*Listedeki Varyant Fiyatları Tablosu */}
                {pl.prices.length > 0 ? (
                  <div className="overflow-x-auto rounded border border-zinc-200 bg-white">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-zinc-200 bg-zinc-50 text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                          <th className="px-3 py-2">Ürün / Varyant</th>
                          <th className="px-3 py-2">SKU</th>
                          <th className="px-3 py-2 text-right">Standart Fiyat</th>
                          <th className="px-3 py-2 text-right">Liste Fiyatı</th>
                          <th className="px-3 py-2 text-right">Sil</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200">
                        {pl.prices.map((item) => (
                          <tr key={item.id}>
                            <td className="px-3 py-2 font-medium text-zinc-900">
                              {item.variant.product.title} ({item.variant.title})
                            </td>
                            <td className="px-3 py-2 font-mono text-zinc-600 tabular-nums">
                              {item.variant.sku ?? "SKU Yok"}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-zinc-500 tabular-nums">
                              {formatMoney(item.variant.price)}
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-semibold text-[#9a3412] tabular-nums">
                              {formatMoney(item.price)}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <form action={deletePriceListPriceFormAction}>
                                <input
                                  type="hidden"
                                  name="id"
                                  value={item.id}
                                />
                                <Button type="submit" variant="ghost" size="sm">
                                  Kaldır
                                </Button>
                              </form>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-600">
                    Bu fiyat listesine henüz özel varyant fiyatı eklenmedi.
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
