import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { requireStaff } from "@/lib/auth/session";
import { formatMoney } from "@/lib/money";
import { EntityAuditHistory } from "@/components/admin/audit-history";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CARRIERS, getCarrierLabel } from "@/modules/shipping/carriers";
import { getPaymentMethodLabel } from "@/modules/payments/registry";
import { getOrderDetail } from "@/modules/orders/service";
import {
  addOrderNoteAction,
  cancelOrderAction,
  createFulfillmentAction,
  markFulfillmentDeliveredAction,
  markOrderPaidAction,
  refundOrderAction,
} from "@/modules/orders/actions";
import {
  createInvoiceAction,
  cancelInvoiceAction,
} from "@/modules/invoicing/actions";

export const dynamic = "force-dynamic";

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff("orders.read");
  const { id } = await params;
  const order = await getOrderDetail(id);

  if (!order) {
    notFound();
  }

  const shippingAddr =
    order.shippingAddress && typeof order.shippingAddress === "object"
      ? (order.shippingAddress as Record<string, unknown>)
      : {};
  const billingAddr =
    order.billingAddress && typeof order.billingAddress === "object"
      ? (order.billingAddress as Record<string, unknown>)
      : {};
  const contractsObj =
    order.contracts && typeof order.contracts === "object"
      ? (order.contracts as { preInformation?: string; distanceSales?: string })
      : null;

  const unfulfilledItems = order.items.filter(
    (item) => item.fulfilledQuantity < item.quantity
  );
  const maxRefundableMinor = Math.max(0, order.total - order.refundedTotal);
  const latestInvoice =
    order.invoices?.find((i) => i.status === "ISSUED") ?? order.invoices?.[0];

  async function handleMarkPaid(formData: FormData) {
    "use server";
    await markOrderPaidAction(formData);
  }

  async function handleCreateInvoice(formData: FormData) {
    "use server";
    await createInvoiceAction(formData);
  }

  async function handleCancelInvoice(formData: FormData) {
    "use server";
    await cancelInvoiceAction(formData);
  }

  async function handleFulfill(formData: FormData) {
    "use server";
    await createFulfillmentAction(formData);
  }

  async function handleDeliver(formData: FormData) {
    "use server";
    await markFulfillmentDeliveredAction(formData);
  }

  async function handleRefund(formData: FormData) {
    "use server";
    await refundOrderAction(formData);
  }

  async function handleCancel(formData: FormData) {
    "use server";
    await cancelOrderAction(formData);
  }

  async function handleAddNote(formData: FormData) {
    "use server";
    await addOrderNoteAction(formData);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 border-b border-zinc-200 pb-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2 text-xs text-zinc-600">
            <Link href="/admin/siparisler" className="hover:underline">
              Siparişler
            </Link>
            <span>/</span>
            <span className="font-mono text-zinc-900">#{order.number}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2.5">
            <h1 className="font-mono text-xl font-bold tabular-nums text-zinc-900">
              Sipariş #{order.number}
            </h1>
            <Badge
              variant={
                order.status === "CANCELLED"
                  ? "danger"
                  : order.status === "COMPLETED"
                    ? "success"
                    : "neutral"
              }
            >
              {order.status === "CANCELLED"
                ? "İptal Edildi"
                : order.status === "COMPLETED"
                  ? "Tamamlandı"
                  : "Açık Sipariş"}
            </Badge>
            <Badge
              variant={
                order.paymentStatus === "PAID"
                  ? "success"
                  : order.paymentStatus === "AWAITING_TRANSFER"
                    ? "warning"
                    : order.paymentStatus === "FAILED" || order.paymentStatus === "CANCELLED"
                      ? "danger"
                      : "accent"
              }
            >
              Ödeme: {order.paymentStatus}
            </Badge>
            <Badge
              variant={
                order.fulfillmentStatus === "SHIPPED" ||
                order.fulfillmentStatus === "DELIVERED"
                  ? "success"
                  : order.fulfillmentStatus === "PARTIALLY_SHIPPED"
                    ? "accent"
                    : "neutral"
              }
            >
              Gönderim: {order.fulfillmentStatus}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-zinc-600 tabular-nums">
            Oluşturulma: {format(order.placedAt, "dd MMMM yyyy HH:mm", { locale: tr })} | Ödeme Yöntemi:{" "}
            {getPaymentMethodLabel(order.paymentMethod)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/admin/siparisler/${order.id}/yazdir`}>
            <Button variant="outline" size="sm">
              Sevk Fişi / Yazdır
            </Button>
          </Link>

          {latestInvoice && latestInvoice.status === "ISSUED" ? (
            <Link
              href={`/admin/faturalar/${latestInvoice.invoiceNumber}/yazdir`}
              target="_blank"
            >
              <Button
                variant="outline"
                size="sm"
                className="border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-medium"
              >
                e-Faturayı Görüntüle ({latestInvoice.invoiceNumber})
              </Button>
            </Link>
          ) : order.status !== "CANCELLED" ? (
            <form action={handleCreateInvoice}>
              <input type="hidden" name="orderId" value={order.id} />
              <Button type="submit" variant="secondary" size="sm">
                e-Fatura Kes
              </Button>
            </form>
          ) : null}

          {order.status !== "CANCELLED" && order.paymentStatus !== "PAID" ? (
            <form action={handleMarkPaid}>
              <input type="hidden" name="orderId" value={order.id} />
              <Button type="submit" variant="primary" size="sm">
                Ödemeyi Onayla (Tahsil Edildi)
              </Button>
            </form>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-md border border-zinc-200 bg-white">
            <div className="border-b border-zinc-200 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-zinc-900">Sipariş Kalemleri</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 text-[11px] font-semibold uppercase text-zinc-600">
                    <th className="px-4 py-2.5">Ürün</th>
                    <th className="px-4 py-2.5">SKU</th>
                    <th className="px-4 py-2.5 text-right">Adet</th>
                    <th className="px-4 py-2.5 text-right">Kargo / İade</th>
                    <th className="px-4 py-2.5 text-right">Birim</th>
                    <th className="px-4 py-2.5 text-right">İndirim</th>
                    <th className="px-4 py-2.5 text-right">Toplam</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {order.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-zinc-900">{item.title}</div>
                        {item.variantTitle ? (
                          <div className="text-[11px] text-zinc-600">{item.variantTitle}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-zinc-600">
                        {item.sku ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-zinc-900">
                        {item.quantity}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-[11px] tabular-nums text-zinc-600">
                        {item.fulfilledQuantity} gönderildi
                        {item.returnedQuantity > 0
                          ? `, ${item.returnedQuantity} iade`
                          : ""}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-zinc-700">
                        {formatMoney(item.unitPrice, order.currency)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-[#9a3412]">
                        {item.discountAmount > 0
                          ? `-${formatMoney(item.discountAmount, order.currency)}`
                          : "-"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-zinc-900">
                        {formatMoney(item.total, order.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t border-zinc-200 bg-zinc-50/70 px-5 py-4 text-xs">
              <div className="ml-auto max-w-xs space-y-1.5">
                <div className="flex justify-between text-zinc-700">
                  <span>Ara Toplam (KDV Dahil)</span>
                  <span className="font-mono tabular-nums">
                    {formatMoney(order.subtotal, order.currency)}
                  </span>
                </div>
                {order.discountTotal > 0 ? (
                  <div className="flex justify-between text-[#9a3412]">
                    <span>
                      Kampanya / İndirim{" "}
                      {order.promoCodes.length > 0
                        ? `(${order.promoCodes.join(", ")})`
                        : ""}
                    </span>
                    <span className="font-mono tabular-nums">
                      -{formatMoney(order.discountTotal, order.currency)}
                    </span>
                  </div>
                ) : null}
                <div className="flex justify-between text-zinc-700">
                  <span>Kargo ({order.shippingMethodName ?? "Standart"})</span>
                  <span className="font-mono tabular-nums">
                    {formatMoney(order.shippingTotal, order.currency)}
                  </span>
                </div>
                {order.paymentFee > 0 ? (
                  <div className="flex justify-between text-zinc-700">
                    <span>Kapıda Ödeme Hizmet Bedeli</span>
                    <span className="font-mono tabular-nums">
                      {formatMoney(order.paymentFee, order.currency)}
                    </span>
                  </div>
                ) : null}
                <div className="flex justify-between text-zinc-600">
                  <span>Toplam İçindeki KDV</span>
                  <span className="font-mono tabular-nums">
                    {formatMoney(order.taxTotal, order.currency)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-zinc-200 pt-2 text-sm font-bold text-zinc-900">
                  <span>Genel Toplam</span>
                  <span className="font-mono tabular-nums">
                    {formatMoney(order.total, order.currency)}
                  </span>
                </div>
                {order.refundedTotal > 0 ? (
                  <div className="flex justify-between text-red-700">
                    <span>İade Edilen Tutar</span>
                    <span className="font-mono tabular-nums">
                      -{formatMoney(order.refundedTotal, order.currency)}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <section className="rounded-md border border-zinc-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-zinc-900">
              Kargolama ve Gönderim Yönetimi
            </h2>

            {order.fulfillments.length > 0 ? (
              <div className="mt-3 space-y-3">
                {order.fulfillments.map((f) => (
                  <div
                    key={f.id}
                    className="flex flex-col justify-between gap-3 rounded border border-zinc-200 bg-zinc-50 p-3.5 text-xs sm:flex-row sm:items-center"
                  >
                    <div>
                      <div className="font-semibold text-zinc-900">
                        {getCarrierLabel(f.carrier)} - Durum: {f.status}
                      </div>
                      <div className="mt-0.5 font-mono text-[11px] text-zinc-600">
                        Takip No: {f.trackingNumber ?? "Belirtilmedi"}
                        {f.trackingUrl ? (
                          <a
                            href={f.trackingUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="ml-2 font-sans font-medium text-[#9a3412] underline"
                          >
                            Kargo Takip Bağlantısı
                          </a>
                        ) : null}
                      </div>
                      <div className="mt-1 text-[11px] text-zinc-600">
                        Kalemler:{" "}
                        {f.items
                          .map((fi) => `${fi.orderItem.title} (${fi.quantity} adet)`)
                          .join(", ")}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/siparisler/${order.id}/etiket?fulfillmentId=${f.id}`}
                        className="inline-flex min-h-9 items-center justify-center rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-900 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
                      >
                        Kargo Etiketi
                      </Link>
                      <a
                        href={`/api/admin/orders/${order.id}/label?fulfillmentId=${f.id}`}
                        download
                        className="inline-flex min-h-9 items-center justify-center rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-900 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
                      >
                        ZPL İndir
                      </a>
                      {f.status !== "DELIVERED" ? (
                        <form action={handleDeliver}>
                          <input type="hidden" name="fulfillmentId" value={f.id} />
                          <Button type="submit" variant="secondary" size="sm">
                            Teslim Edildi İşaretle
                          </Button>
                        </form>
                      ) : (
                        <Badge variant="success">Teslim Edildi</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {order.status !== "CANCELLED" && unfulfilledItems.length > 0 ? (
              <form
                action={handleFulfill}
                className="mt-4 space-y-4 rounded border border-zinc-200 p-4"
              >
                <input type="hidden" name="orderId" value={order.id} />
                <div className="text-xs font-semibold text-zinc-900">
                  Yeni Kargo Gönderimi Oluştur (Rezervasyonları Tüketir ve SALE Stok Hareketi Yazar)
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="carrier">Kargo Firması</Label>
                    <Select
                      id="carrier"
                      name="carrier"
                      defaultValue="yurtici"
                      className="mt-1"
                    >
                      {CARRIERS.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="trackingNumber">Kargo Takip Numarası</Label>
                    <Input
                      id="trackingNumber"
                      name="trackingNumber"
                      placeholder="Boş bırakılırsa etiket numarası üretilir"
                      className="mt-1 font-mono"
                    />
                    <p className="mt-1 text-[11px] text-zinc-600">
                      Firma takip numarasını girmezseniz firma önekli bir etiket barkodu otomatik
                      üretilir. Müşteri e-postasına yalnızca elle girdiğiniz takip numarası yazılır.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-[11px] font-semibold uppercase text-zinc-600">
                    Gönderilecek Kalem Miktarları
                  </div>
                  {unfulfilledItems.map((item) => {
                    const rem = item.quantity - item.fulfilledQuantity;
                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3 rounded border border-zinc-200 px-3 py-2 text-xs"
                      >
                        <div>
                          <span className="font-medium text-zinc-900">{item.title}</span>
                          {item.variantTitle ? (
                            <span className="ml-1 text-zinc-600">({item.variantTitle})</span>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-600">Kalan: {rem}</span>
                          <Input
                            type="number"
                            name={`qty_${item.id}`}
                            min={0}
                            max={rem}
                            defaultValue={rem}
                            className="min-h-8 w-20 px-2 py-1 text-right font-mono text-xs tabular-nums"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <Button type="submit" variant="primary" size="sm">
                  Kargoya Ver ve Müşteriye E-posta Gönder
                </Button>
              </form>
            ) : null}
          </section>

          {contractsObj ? (
            <section className="rounded-md border border-zinc-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-zinc-900">
                Yasal Sözleşme Kayıtları (Sipariş Anı Anlık Görüntüsü)
              </h2>
              <p className="mt-1 text-xs text-zinc-600">
                Onay zamanı:{" "}
                {order.contractsAcceptedAt
                  ? format(order.contractsAcceptedAt, "dd MMM yyyy HH:mm:ss", { locale: tr })
                  : "-"}
              </p>

              <div className="mt-3 space-y-2">
                {contractsObj.preInformation ? (
                  <details className="rounded border border-zinc-200 bg-zinc-50 p-3 text-xs">
                    <summary className="cursor-pointer font-semibold text-zinc-900">
                      Ön Bilgilendirme Formu Metnini Görüntüle
                    </summary>
                    <pre className="mt-3 whitespace-pre-wrap font-sans text-xs leading-relaxed text-zinc-800">
                      {contractsObj.preInformation}
                    </pre>
                  </details>
                ) : null}

                {contractsObj.distanceSales ? (
                  <details className="rounded border border-zinc-200 bg-zinc-50 p-3 text-xs">
                    <summary className="cursor-pointer font-semibold text-zinc-900">
                      Mesafeli Satış Sözleşmesi Metnini Görüntüle
                    </summary>
                    <pre className="mt-3 whitespace-pre-wrap font-sans text-xs leading-relaxed text-zinc-800">
                      {contractsObj.distanceSales}
                    </pre>
                  </details>
                ) : null}
              </div>
            </section>
          ) : null}

          <section className="rounded-md border border-zinc-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-zinc-900">
              Sipariş Zaman Çizelgesi ve İç Notlar
            </h2>

            <form action={handleAddNote} className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input type="hidden" name="orderId" value={order.id} />
              <input type="hidden" name="isInternal" value="true" />
              <Input
                name="message"
                required
                placeholder="Operasyon ekibi için iç not yazın..."
                className="flex-1"
              />
              <Button type="submit" variant="secondary" size="sm">
                Not Ekle
              </Button>
            </form>

            <div className="mt-4 divide-y divide-zinc-200 text-xs">
              {order.events.map((ev) => (
                <div
                  key={ev.id}
                  className="flex flex-col justify-between gap-1 py-2.5 sm:flex-row sm:items-center"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant={ev.isInternal ? "warning" : "neutral"}>
                      {ev.isInternal ? "İç Not" : ev.type}
                    </Badge>
                    <span className="text-zinc-900">{ev.message}</span>
                  </div>
                  <span className="text-zinc-600 tabular-nums">
                    {format(ev.createdAt, "dd MMM yyyy HH:mm", { locale: tr })}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <EntityAuditHistory entityType="Order" entityId={order.id} />
        </div>

        <div className="space-y-6">
          <section className="rounded-md border border-zinc-200 bg-white p-5 text-xs">
            <h2 className="text-sm font-semibold text-zinc-900">Müşteri ve Adresler</h2>
            <div className="mt-3 space-y-3">
              <div>
                <div className="text-[11px] font-semibold uppercase text-zinc-500">
                  Müşteri
                </div>
                {order.customer ? (
                  <Link
                    href={`/admin/musteriler/${order.customer.id}`}
                    className="mt-0.5 block font-semibold text-zinc-900 underline"
                  >
                    {order.customer.firstName} {order.customer.lastName}
                  </Link>
                ) : (
                  <div className="mt-0.5 font-medium text-zinc-900">Misafir Müşteri</div>
                )}
                <div className="text-zinc-700">{order.email}</div>
                {order.phone ? <div className="text-zinc-700">{order.phone}</div> : null}
              </div>

              <div className="border-t border-zinc-200 pt-3">
                <div className="text-[11px] font-semibold uppercase text-zinc-500">
                  Teslimat Adresi
                </div>
                <div className="mt-1 font-medium text-zinc-900">
                  {String(shippingAddr.firstName ?? "")} {String(shippingAddr.lastName ?? "")}
                </div>
                <div className="text-zinc-700">{String(shippingAddr.line1 ?? "-")}</div>
                <div className="text-zinc-700">
                  {String(shippingAddr.district ?? "")} / {String(shippingAddr.city ?? "")}
                </div>
                <div className="text-zinc-600">{String(shippingAddr.phone ?? "")}</div>
              </div>

              <div className="border-t border-zinc-200 pt-3">
                <div className="text-[11px] font-semibold uppercase text-zinc-500">
                  Fatura Bilgisi
                </div>
                {billingAddr.invoiceType === "CORPORATE" ? (
                  <div className="mt-1 space-y-0.5 text-zinc-800">
                    <div className="font-semibold">{String(billingAddr.companyName ?? "")}</div>
                    <div>
                      VD: {String(billingAddr.taxOffice ?? "")} | VKN:{" "}
                      {String(billingAddr.taxNumber ?? "")}
                    </div>
                  </div>
                ) : (
                  <div className="mt-1 text-zinc-800">
                    Bireysel Fatura
                    {billingAddr.tckn ? ` (TCKN: ${String(billingAddr.tckn)})` : ""}
                  </div>
                )}
              </div>

              {order.customerNote ? (
                <div className="border-t border-zinc-200 pt-3">
                  <div className="text-[11px] font-semibold uppercase text-zinc-500">
                    Müşteri Sipariş Notu
                  </div>
                  <p className="mt-1 text-zinc-800">{order.customerNote}</p>
                </div>
              ) : null}
            </div>
          </section>

          {/* e-Fatura / e-Arşiv Kartı */}
          <section className="rounded-md border border-zinc-200 bg-white p-5 text-xs">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-900">
                e-Fatura / e-Arşiv Durumu
              </h2>
              {latestInvoice ? (
                <Badge
                  variant={
                    latestInvoice.status === "ISSUED"
                      ? "success"
                      : latestInvoice.status === "CANCELLED"
                        ? "danger"
                        : "warning"
                  }
                >
                  {latestInvoice.status === "ISSUED"
                    ? "Onaylandı"
                    : latestInvoice.status === "CANCELLED"
                      ? "İptal Edildi"
                      : latestInvoice.status}
                </Badge>
              ) : (
                <Badge variant="neutral">Fatura Kesilmedi</Badge>
              )}
            </div>

            {latestInvoice ? (
              <div className="mt-3 space-y-2.5">
                <div>
                  <div className="text-[11px] font-semibold uppercase text-zinc-500">
                    Fatura Numarası
                  </div>
                  <div className="mt-0.5 font-mono text-sm font-bold text-zinc-900">
                    {latestInvoice.invoiceNumber}
                  </div>
                  <div className="text-[10px] text-zinc-500 font-mono truncate" title={latestInvoice.ettn}>
                    ETTN: {latestInvoice.ettn}
                  </div>
                </div>

                <div className="flex justify-between border-t border-zinc-100 pt-2 text-zinc-700">
                  <span>Belge Türü:</span>
                  <span className="font-semibold text-zinc-900">
                    {latestInvoice.invoiceType === "EFATURA" ? "e-Fatura" : "e-Arşiv Fatura"}
                  </span>
                </div>

                <div className="flex justify-between text-zinc-700">
                  <span>Düzenlenme Tarihi:</span>
                  <span className="tabular-nums">
                    {format(latestInvoice.issueDate, "dd.MM.yyyy HH:mm", { locale: tr })}
                  </span>
                </div>

                <div className="flex justify-between text-zinc-700">
                  <span>Fatura Tutarı:</span>
                  <span className="font-mono font-bold text-zinc-900 tabular-nums">
                    {formatMoney(latestInvoice.total, latestInvoice.currency)}
                  </span>
                </div>

                <div className="border-t border-zinc-100 pt-3 flex flex-wrap gap-2">
                  <Link
                    href={`/admin/faturalar/${latestInvoice.invoiceNumber}/yazdir`}
                    target="_blank"
                    className="flex-1"
                  >
                    <Button variant="outline" size="sm" className="w-full">
                      Faturayı Yazdır / Görüntüle
                    </Button>
                  </Link>

                  <a
                    href={`/api/admin/invoices/${latestInvoice.id}/ubl`}
                    download={`${latestInvoice.invoiceNumber}.xml`}
                    className="inline-flex h-8 items-center justify-center rounded-md border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    XML
                  </a>
                </div>

                {latestInvoice.status === "ISSUED" ? (
                  <form action={handleCancelInvoice} className="pt-1">
                    <input type="hidden" name="invoiceId" value={latestInvoice.id} />
                    <input
                      type="hidden"
                      name="reason"
                      value="Yönetici tarafından sipariş detayından iptal edildi"
                    />
                    <button
                      type="submit"
                      className="w-full text-center text-[11px] text-red-600 hover:underline"
                    >
                      Faturayı İptal Et
                    </button>
                  </form>
                ) : null}
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                <p className="text-zinc-600">
                  Sipariş ödendiğinde e-Fatura / e-Arşiv belgesi otomatik olarak kesilir.
                  Dilerseniz şimdi de manuel fatura oluşturabilirsiniz.
                </p>
                <form action={handleCreateInvoice}>
                  <input type="hidden" name="orderId" value={order.id} />
                  <Button type="submit" variant="primary" size="sm" className="w-full">
                    e-Faturayı Şimdi Kes
                  </Button>
                </form>
              </div>
            )}
          </section>

          {maxRefundableMinor > 0 ? (
            <section className="rounded-md border border-zinc-200 bg-white p-5 text-xs">
              <h2 className="text-sm font-semibold text-zinc-900">
                Ödeme İadesi (Kısmi / Tam Refund)
              </h2>
              <p className="mt-1 text-zinc-600">
                İade edilebilir üst limit:{" "}
                <strong className="font-mono tabular-nums">
                  {formatMoney(maxRefundableMinor, order.currency)}
                </strong>
              </p>

              <form action={handleRefund} className="mt-3 space-y-3">
                <input type="hidden" name="orderId" value={order.id} />
                <div>
                  <Label htmlFor="refundAmount">İade Tutarı (TL)</Label>
                  <Input
                    id="refundAmount"
                    name="amount"
                    defaultValue={(maxRefundableMinor / 100).toFixed(2).replace(".", ",")}
                    className="mt-1 font-mono tabular-nums"
                  />
                </div>
                <div>
                  <Label htmlFor="refundReason">İade Nedeni</Label>
                  <Input
                    id="refundReason"
                    name="reason"
                    placeholder="Müşteri cayma hakkı / Kısmi ürün iadesi"
                    className="mt-1"
                  />
                </div>
                <Button type="submit" variant="outline" size="sm" className="w-full">
                  Ödeme İadesini Gerçekleştir
                </Button>
              </form>
            </section>
          ) : null}

          {order.status !== "CANCELLED" ? (
            <section className="rounded-md border border-red-200 bg-white p-5 text-xs">
              <h2 className="text-sm font-semibold text-red-900">Siparişi İptal Et</h2>
              <p className="mt-1 text-zinc-600">
                İptal edildiğinde aktif stok rezervasyonları (RELEASED) otomatik serbest bırakılır.
              </p>
              <form action={handleCancel} className="mt-3 space-y-3">
                <input type="hidden" name="orderId" value={order.id} />
                <div>
                  <Label htmlFor="cancelReason">İptal Gerekçesi</Label>
                  <Textarea
                    id="cancelReason"
                    name="reason"
                    placeholder="Müşteri vazgeçti / Havale süresi doldu..."
                    className="mt-1 min-h-16"
                  />
                </div>
                <Button type="submit" variant="danger" size="sm" className="w-full">
                  Siparişi İptal Et ve Stoğu Serbest Bırak
                </Button>
              </form>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
