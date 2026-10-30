import Link from "next/link";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { requireStaff } from "@/lib/auth/session";
import {
  createBackInStockRequestFormAction,
  notifyBackInStockFormAction,
  quickInlineStockAdjustFormAction,
  recordStockMovementFormAction,
  saveWarehouseFormAction,
  setDefaultWarehouseFormAction,
  transferStockFormAction,
  updateThresholdFormAction,
} from "@/modules/inventory/actions";
import { listInventoryOverview } from "@/modules/inventory/service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { StockMovementType } from "@/generated/prisma/client";

function pickParam(raw: string | string[] | undefined): string {
  if (typeof raw === "string") return raw.trim();
  if (Array.isArray(raw) && typeof raw[0] === "string") return raw[0].trim();
  return "";
}

const MOVEMENT_LABELS: Record<
  StockMovementType,
  { label: string; variant: "success" | "danger" | "warning" | "neutral" | "accent" }
> = {
  RECEIVE: { label: "Mal Kabul (+)", variant: "success" },
  SALE: { label: "Satış Çıkışı (-)", variant: "danger" },
  RETURN: { label: "İade Girişi (+)", variant: "success" },
  ADJUST: { label: "Manuel Düzeltme", variant: "warning" },
  COUNT: { label: "Sayım Eşitleme", variant: "accent" },
  TRANSFER_IN: { label: "Transfer Girişi (+)", variant: "success" },
  TRANSFER_OUT: { label: "Transfer Çıkışı (-)", variant: "danger" },
  IMPORT: { label: "İçe Aktarım", variant: "neutral" },
};

export default async function AdminInventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireStaff("inventory.read");
  const sp = await searchParams;

  const warehouseFilter = pickParam(sp.warehouseId);
  const searchFilter = pickParam(sp.q);

  const overview = await listInventoryOverview({
    warehouseId: warehouseFilter || undefined,
    search: searchFilter || undefined,
  });

  const activeWarehouseId =
    warehouseFilter || overview.defaultWarehouse?.id || "";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">
          Depolar, Stok Seviyeleri ve Hareket Geçmişi
        </h1>
        <p className="mt-0.5 text-xs text-zinc-600">
          Çoklu depo yapılandırmasını, kritik stok uyarılarını, satır içi hızlı stok düzeltmelerini ve gelince haber ver taleplerini yönetin.
        </p>
      </div>

      {/* BÖLÜM 1: DEPOLAR */}
      <section className="space-y-4 rounded-md border border-zinc-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 pb-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">
              Depolar ({overview.warehouses.length})
            </h2>
            <p className="text-xs text-zinc-600">
              Varsayılan depo yeni ürün girişlerinde ve sipariş stok düşümlerinde öncelikli kullanılır.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {overview.warehouses.map((wh) => (
            <div
              key={wh.id}
              className="flex flex-col justify-between rounded-md border border-zinc-200 bg-zinc-50 p-4"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-zinc-900">{wh.name}</span>
                  <span className="rounded border border-zinc-300 bg-white px-2 py-0.5 font-mono text-xs font-medium text-zinc-800">
                    {wh.code}
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-600">
                  {wh.address ?? "Adres belirtilmedi"}
                </p>
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  {wh.isDefault ? (
                    <Badge variant="success">Varsayılan Depo</Badge>
                  ) : null}
                  <Badge variant={wh.isActive ? "neutral" : "warning"}>
                    {wh.isActive ? "Aktif" : "Pasif"}
                  </Badge>
                  <Badge variant="neutral">Öncelik: {wh.priority}</Badge>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-zinc-200 pt-3 text-xs">
                <span className="font-mono text-zinc-600 tabular-nums">
                  {wh._count.levels} varyant / {wh._count.movements} hareket
                </span>
                {!wh.isDefault ? (
                  <form action={setDefaultWarehouseFormAction}>
                    <input type="hidden" name="warehouseId" value={wh.id} />
                    <Button type="submit" variant="outline" size="sm">
                      Varsayılan Yap
                    </Button>
                  </form>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        <details className="rounded border border-zinc-200 bg-zinc-50 p-3.5">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-zinc-800">
            + Yeni Depo Ekle veya Mevcut Depoyu Güncelle
          </summary>
          <form
            action={saveWarehouseFormAction}
            className="mt-3 grid gap-3 sm:grid-cols-5 sm:items-end"
          >
            <div>
              <Label htmlFor="wh-name">Depo Adı *</Label>
              <Input
                id="wh-name"
                name="name"
                required
                placeholder="Örn: Ankara Bölge Deposu"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="wh-code">Depo Kodu *</Label>
              <Input
                id="wh-code"
                name="code"
                required
                placeholder="ANK-01"
                className="mt-1 font-mono uppercase"
              />
            </div>
            <div>
              <Label htmlFor="wh-address">Adres</Label>
              <Input
                id="wh-address"
                name="address"
                placeholder="Şehir / Organize Sanayi"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="wh-priority">Öncelik Sırası</Label>
              <Input
                id="wh-priority"
                name="priority"
                type="number"
                defaultValue="1"
                className="mt-1 font-mono tabular-nums"
              />
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs text-zinc-800">
                <input
                  type="checkbox"
                  name="isDefault"
                  value="true"
                  className="h-3.5 w-3.5 rounded border-zinc-300"
                />
                <span>Varsayılan Depo</span>
              </label>
              <Button type="submit" variant="primary" size="sm" className="w-full">
                Depoyu Kaydet
              </Button>
            </div>
          </form>
        </details>
      </section>

      {/* BÖLÜM 2: KRİTİK STOK UYARI LİSTESİ */}
      <section className="space-y-4 rounded-md border border-zinc-200 bg-white p-5">
        <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">
              Kritik Stok Uyarı Listesi ({overview.lowStockItems.length})
            </h2>
            <p className="text-xs text-zinc-600">
              Stok seviyesi belirlenen kritik eşiğin altına düşen veya tükenen varyantlar.
            </p>
          </div>
          {overview.lowStockItems.length > 0 ? (
            <Badge variant="warning">
              {overview.lowStockItems.length} kritik varyant
            </Badge>
          ) : (
            <Badge variant="success">Kritik stok uyarısı yok</Badge>
          )}
        </div>

        {overview.lowStockItems.length === 0 ? (
          <p className="text-xs text-zinc-600">
            Tüm varyantların stok miktarı kritik eşiğin üzerinde.
          </p>
        ) : (
          <div className="overflow-x-auto rounded border border-zinc-200">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                  <th className="px-3 py-2">Ürün / Varyant</th>
                  <th className="px-3 py-2">SKU</th>
                  <th className="px-3 py-2">Depo</th>
                  <th className="px-3 py-2 text-right">Mevcut Stok</th>
                  <th className="px-3 py-2 text-right">Kritik Eşik</th>
                  <th className="px-3 py-2 text-right">Hızlı Stok Tamamla</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {overview.lowStockItems.slice(0, 30).map((item) => (
                  <tr
                    key={`${item.variantId}-${item.warehouseId}`}
                    className="hover:bg-zinc-50/70"
                  >
                    <td className="px-3 py-2">
                      <Link
                        href={`/admin/katalog/urunler/${item.productId}`}
                        className="font-semibold text-zinc-900 hover:underline"
                      >
                        {item.productTitle}
                      </Link>
                      <span className="ml-1.5 text-zinc-600">
                        ({item.variantTitle})
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-zinc-600 tabular-nums">
                      {item.sku ?? "SKU Yok"}
                    </td>
                    <td className="px-3 py-2 text-zinc-700">
                      {item.warehouseName} ({item.warehouseCode})
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      <Badge
                        variant={item.onHand <= 0 ? "danger" : "warning"}
                      >
                        {item.onHand} adet
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-zinc-600 tabular-nums">
                      {item.threshold} adet
                    </td>
                    <td className="px-3 py-2 text-right">
                      <form
                        action={quickInlineStockAdjustFormAction}
                        className="inline-flex items-center justify-end gap-1.5"
                      >
                        <input
                          type="hidden"
                          name="variantId"
                          value={item.variantId}
                        />
                        <input
                          type="hidden"
                          name="warehouseId"
                          value={item.warehouseId}
                        />
                        <input
                          type="hidden"
                          name="reason"
                          value="Kritik stok hızlı tamamlama"
                        />
                        <Input
                          name="newOnHand"
                          type="number"
                          min="0"
                          defaultValue={Math.max(item.threshold * 3, 15)}
                          className="h-8 w-20 font-mono text-xs tabular-nums"
                        />
                        <Button type="submit" variant="secondary" size="sm">
                          Eşitle
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

      {/* BÖLÜM 3: SATIR İÇİ HIZLI STOK DÜZELTME VE DETAYLI HAREKET GİRİŞİ */}
      <section className="space-y-4 rounded-md border border-zinc-200 bg-white p-5">
        <div className="flex flex-col gap-3 border-b border-zinc-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">
              Satır İçi Hızlı Stok Düzeltme ve Varyant Seviyeleri
            </h2>
            <p className="text-xs text-zinc-600">
              Stok sıfırdan pozitif değere çıktığında bekleyen &quot;Gelince Haber Ver&quot; taleplerine otomatik e-posta gönderilir.
            </p>
          </div>

          <form
            method="GET"
            action="/admin/stok"
            className="flex flex-wrap items-center gap-2"
          >
            <Input
              name="q"
              defaultValue={searchFilter}
              placeholder="Ürün, SKU veya barkod ara..."
              className="w-52"
            />
            <Select
              name="warehouseId"
              defaultValue={warehouseFilter}
              className="w-44"
            >
              <option value="">Varsayılan / Tüm Depolar</option>
              {overview.warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.code})
                </option>
              ))}
            </Select>
            <Button type="submit" variant="secondary" size="sm">
              Filtrele
            </Button>
          </form>
        </div>

        {/* Detaylı Stok Hareketi ve Depolar Arası Transfer Panelleri */}
        <div className="grid gap-4 lg:grid-cols-2">
          <form
            action={recordStockMovementFormAction}
            className="space-y-3 rounded border border-zinc-200 bg-zinc-50 p-4"
          >
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-800">
              Detaylı Stok Hareketi Kaydet (Giriş / Çıkış / Sayım)
            </h3>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <div>
                <Label>Varyant *</Label>
                <Select name="variantId" required className="mt-1">
                  <option value="">Varyant Seçin...</option>
                  {overview.variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.product.title} ({v.title}) {v.sku ? `[${v.sku}]` : ""}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Depo</Label>
                <Select
                  name="warehouseId"
                  defaultValue={activeWarehouseId}
                  className="mt-1"
                >
                  {overview.warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-3">
              <div>
                <Label>Hareket Tipi</Label>
                <Select name="type" defaultValue="RECEIVE" className="mt-1">
                  <option value="RECEIVE">RECEIVE (Mal Kabul +)</option>
                  <option value="COUNT">COUNT (Sayım Eşitleme)</option>
                  <option value="ADJUST">ADJUST (Fark +/-)</option>
                  <option value="RETURN">RETURN (İade Girişi +)</option>
                  <option value="SALE">SALE (Satış Çıkışı -)</option>
                  <option value="IMPORT">IMPORT (Toplu Aktarım)</option>
                </Select>
              </div>
              <div>
                <Label>Miktar *</Label>
                <Input
                  name="quantity"
                  type="number"
                  required
                  defaultValue="10"
                  className="mt-1 font-mono tabular-nums"
                />
              </div>
              <div>
                <Label>Açıklama / Neden</Label>
                <Input
                  name="reason"
                  placeholder="İrsaliye No veya Sayım Notu"
                  className="mt-1"
                />
              </div>
            </div>

            <Button type="submit" variant="primary" size="sm">
              Stok Hareketini Uygula
            </Button>
          </form>

          <form
            action={transferStockFormAction}
            className="space-y-3 rounded border border-zinc-200 bg-zinc-50 p-4"
          >
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-800">
              Depolar Arası Stok Transferi (TRANSFER_OUT / TRANSFER_IN)
            </h3>
            <div>
              <Label>Transfer Edilecek Varyant *</Label>
              <Select name="variantId" required className="mt-1">
                <option value="">Varyant Seçin...</option>
                {overview.variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.product.title} ({v.title}) {v.sku ? `[${v.sku}]` : ""}
                  </option>
                ))}
              </Select>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-3">
              <div>
                <Label>Kaynak Depo</Label>
                <Select
                  name="fromWarehouseId"
                  defaultValue={overview.warehouses[0]?.id ?? ""}
                  className="mt-1"
                >
                  {overview.warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Hedef Depo</Label>
                <Select
                  name="toWarehouseId"
                  defaultValue={
                    overview.warehouses[1]?.id ??
                    overview.warehouses[0]?.id ??
                    ""
                  }
                  className="mt-1"
                >
                  {overview.warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Transfer Miktarı *</Label>
                <Input
                  name="quantity"
                  type="number"
                  min="1"
                  defaultValue="5"
                  required
                  className="mt-1 font-mono tabular-nums"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <Input
                name="reason"
                placeholder="Transfer nedeni (İsteğe bağlı)"
                className="max-w-xs"
              />
              <Button type="submit" variant="secondary" size="sm">
                Depolar Arası Transfer Yap
              </Button>
            </div>
          </form>
        </div>

        {/* Satır İçi Hızlı Stok Düzeltme Tablosu */}
        {overview.variants.length === 0 ? (
          <EmptyState
            title="Varyant bulunamadı"
            description="Stok yönetimi için önce ürün kataloğuna ürün ekleyin."
            actionLabel="Ürün Ekle"
            actionHref="/admin/katalog/urunler/yeni"
          />
        ) : (
          <div className="overflow-x-auto rounded border border-zinc-200">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                  <th className="px-3 py-2.5">Ürün ve Varyant</th>
                  <th className="px-3 py-2.5">SKU</th>
                  <th className="px-3 py-2.5">Depo</th>
                  <th className="px-3 py-2.5 text-right">Eldeki (onHand)</th>
                  <th className="px-3 py-2.5 text-right">Rezerve</th>
                  <th className="px-3 py-2.5 text-right">Kritik Eşik</th>
                  <th className="px-3 py-2.5 text-right">
                    Satır İçi Hızlı Stok Düzeltme
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {overview.variants.map((v) => {
                  const targetWh =
                    overview.warehouses.find(
                      (w) => w.id === activeWarehouseId
                    ) ?? overview.defaultWarehouse;
                  const level = v.inventoryLevels.find(
                    (l) => l.warehouseId === targetWh?.id
                  );
                  const onHand = level?.onHand ?? 0;
                  const reserved = level?.reserved ?? 0;
                  const threshold = level?.lowStockThreshold ?? 5;

                  return (
                    <tr key={v.id} className="hover:bg-zinc-50/70">
                      <td className="px-3 py-2.5">
                        <Link
                          href={`/admin/katalog/urunler/${v.product.id}`}
                          className="font-semibold text-zinc-900 hover:underline"
                        >
                          {v.product.title}
                        </Link>
                        <span className="ml-1.5 text-zinc-600">
                          ({v.title})
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-zinc-600 tabular-nums">
                        {v.sku ?? "SKU Yok"}
                      </td>
                      <td className="px-3 py-2.5 text-zinc-700">
                        {targetWh
                          ? `${targetWh.name} (${targetWh.code})`
                          : "Merkez"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                        <Badge
                          variant={
                            onHand <= 0
                              ? "danger"
                              : onHand <= threshold
                                ? "warning"
                                : "success"
                          }
                        >
                          {onHand}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-zinc-600 tabular-nums">
                        {reserved}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {targetWh ? (
                          <form
                            action={updateThresholdFormAction}
                            className="inline-flex items-center justify-end gap-1"
                          >
                            <input
                              type="hidden"
                              name="variantId"
                              value={v.id}
                            />
                            <input
                              type="hidden"
                              name="warehouseId"
                              value={targetWh.id}
                            />
                            <Input
                              name="lowStockThreshold"
                              type="number"
                              min="0"
                              defaultValue={threshold}
                              className="h-8 w-16 font-mono text-xs tabular-nums"
                            />
                            <Button type="submit" variant="ghost" size="sm">
                              Kaydet
                            </Button>
                          </form>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {targetWh ? (
                          <form
                            action={quickInlineStockAdjustFormAction}
                            className="inline-flex items-center justify-end gap-1.5"
                          >
                            <input
                              type="hidden"
                              name="variantId"
                              value={v.id}
                            />
                            <input
                              type="hidden"
                              name="warehouseId"
                              value={targetWh.id}
                            />
                            <Input
                              name="newOnHand"
                              type="number"
                              min="0"
                              defaultValue={onHand}
                              aria-label="Yeni stok adedi"
                              className="h-8 w-20 font-mono text-xs tabular-nums"
                            />
                            <Button type="submit" variant="primary" size="sm">
                              Güncelle
                            </Button>
                          </form>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* BÖLÜM 4: STOK HAREKET GEÇMİŞİ VE GELİNCE HABER VER TALEPLERİ */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Stok Hareket Geçmişi (2/3) */}
        <section className="space-y-4 rounded-md border border-zinc-200 bg-white p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-zinc-900">
            Stok Hareket Geçmişi (Son {overview.movements.length} Kayıt)
          </h2>

          {overview.movements.length === 0 ? (
            <p className="text-xs text-zinc-600">
              Henüz kaydedilmiş bir stok hareketi bulunmuyor.
            </p>
          ) : (
            <div className="overflow-x-auto rounded border border-zinc-200">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                    <th className="px-3 py-2">Tarih</th>
                    <th className="px-3 py-2">Ürün / Varyant</th>
                    <th className="px-3 py-2">Depo</th>
                    <th className="px-3 py-2">Hareket</th>
                    <th className="px-3 py-2 text-right">Değişim</th>
                    <th className="px-3 py-2 text-right">Bakiye</th>
                    <th className="px-3 py-2">Neden</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {overview.movements.map((mov) => {
                    const meta = MOVEMENT_LABELS[mov.type];
                    return (
                      <tr key={mov.id}>
                        <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-zinc-600 tabular-nums">
                          {format(mov.createdAt, "dd MMM HH:mm", {
                            locale: tr,
                          })}
                        </td>
                        <td className="px-3 py-2">
                          <span className="font-medium text-zinc-900">
                            {mov.variant.product.title}
                          </span>{" "}
                          <span className="text-zinc-600">
                            ({mov.variant.title})
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-zinc-600">
                          {mov.warehouse.code}
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant={meta.variant}>{meta.label}</Badge>
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-semibold tabular-nums">
                          <span
                            className={
                              mov.quantity > 0
                                ? "text-green-800"
                                : mov.quantity < 0
                                  ? "text-red-800"
                                  : "text-zinc-600"
                            }
                          >
                            {mov.quantity > 0
                              ? `+${mov.quantity}`
                              : mov.quantity}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-zinc-900 tabular-nums">
                          {mov.balanceAfter}
                        </td>
                        <td className="px-3 py-2 text-zinc-600">
                          {mov.reason ?? ""}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Gelince Haber Ver Talepleri (1/3) */}
        <section className="space-y-4 rounded-md border border-zinc-200 bg-white p-5">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">
              &quot;Gelince Haber Ver&quot; Talepleri (
              {overview.backInStockRequests.length})
            </h2>
            <p className="mt-0.5 text-xs text-zinc-600">
              Stok 0&apos;dan pozitife çıktığında otomatik bildirim gönderilir.
            </p>
          </div>

          <form
            action={createBackInStockRequestFormAction}
            className="space-y-2.5 rounded border border-zinc-200 bg-zinc-50 p-3"
          >
            <span className="block text-xs font-semibold text-zinc-800">
              Manuel Talep Kaydı Ekle
            </span>
            <Select name="variantId" required>
              <option value="">Varyant Seçin...</option>
              {overview.variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.product.title} ({v.title})
                </option>
              ))}
            </Select>
            <div className="flex gap-2">
              <Input
                name="email"
                type="email"
                required
                placeholder="musteri@ornek.com"
              />
              <Button type="submit" variant="secondary" size="sm">
                Ekle
              </Button>
            </div>
          </form>

          {overview.backInStockRequests.length === 0 ? (
            <p className="text-xs text-zinc-600">
              Bekleyen ürün stok bildirimi talebi bulunmuyor.
            </p>
          ) : (
            <div className="divide-y divide-zinc-200">
              {overview.backInStockRequests.map((req) => {
                const varStock = req.variant.inventoryLevels.reduce(
                  (s, l) => s + Math.max(0, l.onHand),
                  0
                );
                return (
                  <div key={req.id} className="space-y-1.5 py-2.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-zinc-900">
                        {req.email}
                      </span>
                      <Badge
                        variant={req.notifiedAt ? "success" : "warning"}
                      >
                        {req.notifiedAt ? "Bildirildi" : "Bekliyor"}
                      </Badge>
                    </div>
                    <div className="text-zinc-600">
                      {req.variant.product.title} ({req.variant.title}) : Stok:{" "}
                      <span className="font-mono font-semibold text-zinc-900 tabular-nums">
                        {varStock}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-zinc-500">
                      <span>
                        Talep:{" "}
                        {format(req.createdAt, "dd MMM yyyy HH:mm", {
                          locale: tr,
                        })}
                      </span>
                      {!req.notifiedAt ? (
                        <form action={notifyBackInStockFormAction}>
                          <input
                            type="hidden"
                            name="variantId"
                            value={req.variantId}
                          />
                          <button
                            type="submit"
                            className="font-semibold text-[#9a3412] hover:underline"
                          >
                            Şimdi Bildir
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
