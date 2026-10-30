import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { requireStaff } from "@/lib/auth/session";
import { formatMoney } from "@/lib/money";
import { getStoreSettings } from "@/lib/settings/service";
import { getOrderDetail } from "@/modules/orders/service";
import { getPaymentMethodLabel } from "@/modules/payments/registry";

export const dynamic = "force-dynamic";

export default async function AdminOrderPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff("orders.read");
  const { id } = await params;

  const [order, store] = await Promise.all([
    getOrderDetail(id),
    getStoreSettings(),
  ]);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 rounded-md border border-zinc-200 bg-white p-4 print:hidden">
        <div className="text-xs text-zinc-700">
          <strong>Sevk ve Paketleme Fişi (#{order.number})</strong>: Yazdırmak için tarayıcınızdan{" "}
          <kbd className="rounded border border-zinc-300 bg-zinc-100 px-1.5 py-0.5 font-mono">
            Ctrl + P
          </kbd>{" "}
          komutunu kullanabilirsiniz.
        </div>
        <Link
          href={`/admin/siparisler/${order.id}`}
          className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-900 hover:bg-zinc-50"
        >
          Sipariş Detayına Dön
        </Link>
      </div>

      <div className="rounded-md border border-zinc-300 bg-white p-8 text-xs text-zinc-900 print:border-none print:p-0">
        <div className="flex flex-col justify-between gap-4 border-b-2 border-zinc-900 pb-6 sm:flex-row">
          <div>
            <div className="text-lg font-bold tracking-tight text-zinc-900">
              {store.companyLegalName || store.storeName}
            </div>
            <div className="mt-1 text-zinc-700">
              {store.address}, {store.district} / {store.city}
            </div>
            <div className="text-zinc-600">
              VD: {store.taxOffice} | VKN: {store.taxNumber} | MERSİS: {store.mersisNumber}
            </div>
            <div className="text-zinc-600">
              Tel: {store.supportPhone} | E-posta: {store.supportEmail}
            </div>
          </div>

          <div className="text-left sm:text-right">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              SEVK VE SİPARİŞ FİŞİ
            </div>
            <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-zinc-900">
              #{order.number}
            </div>
            <div className="mt-1 tabular-nums text-zinc-700">
              Tarih: {format(order.placedAt, "dd.MM.yyyy HH:mm", { locale: tr })}
            </div>
            <div className="text-zinc-700">
              Ödeme: {getPaymentMethodLabel(order.paymentMethod)} ({order.paymentStatus})
            </div>
          </div>
        </div>

        <div className="my-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="rounded border border-zinc-200 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              TESLİMAT ALICISI VE ADRESİ
            </div>
            <div className="mt-1.5 text-sm font-bold text-zinc-900">
              {String(shippingAddr.firstName ?? "")} {String(shippingAddr.lastName ?? "")}
            </div>
            <div className="mt-1 text-zinc-800">{String(shippingAddr.line1 ?? "-")}</div>
            <div className="text-zinc-800">
              {String(shippingAddr.district ?? "")} / {String(shippingAddr.city ?? "")}
            </div>
            <div className="mt-1 font-mono text-zinc-700">
              Tel: {String(shippingAddr.phone ?? order.phone ?? "-")}
            </div>
          </div>

          <div className="rounded border border-zinc-200 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              FATURA BİLGİLERİ
            </div>
            <div className="mt-1.5 font-semibold text-zinc-900">
              {billingAddr.invoiceType === "CORPORATE"
                ? String(billingAddr.companyName ?? "")
                : `${String(billingAddr.firstName ?? "")} ${String(billingAddr.lastName ?? "")}`}
            </div>
            <div className="mt-1 text-zinc-800">{String(billingAddr.line1 ?? "-")}</div>
            <div className="text-zinc-800">
              {String(billingAddr.district ?? "")} / {String(billingAddr.city ?? "")}
            </div>
            {billingAddr.invoiceType === "CORPORATE" ? (
              <div className="mt-1 font-mono text-zinc-700">
                VD: {String(billingAddr.taxOffice ?? "")} | VKN:{" "}
                {String(billingAddr.taxNumber ?? "")}
              </div>
            ) : billingAddr.tckn ? (
              <div className="mt-1 font-mono text-zinc-700">
                TCKN: {String(billingAddr.tckn)}
              </div>
            ) : null}
          </div>
        </div>

        <table className="w-full border-collapse border border-zinc-300 text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-300 bg-zinc-100 text-[11px] font-semibold uppercase text-zinc-700">
              <th className="w-10 border-r border-zinc-300 px-2 py-2 text-center">Kontrol</th>
              <th className="border-r border-zinc-300 px-3 py-2">SKU</th>
              <th className="border-r border-zinc-300 px-3 py-2">Ürün / Varyant</th>
              <th className="border-r border-zinc-300 px-3 py-2 text-right">Adet</th>
              <th className="border-r border-zinc-300 px-3 py-2 text-right">Birim Fiyat</th>
              <th className="border-r border-zinc-300 px-3 py-2 text-right">İndirim</th>
              <th className="px-3 py-2 text-right">Satır Toplamı</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-300">
            {order.items.map((item) => (
              <tr key={item.id}>
                <td className="border-r border-zinc-300 px-2 py-2.5 text-center font-mono">
                  [ ]
                </td>
                <td className="border-r border-zinc-300 px-3 py-2.5 font-mono text-zinc-700">
                  {item.sku ?? "-"}
                </td>
                <td className="border-r border-zinc-300 px-3 py-2.5">
                  <span className="font-semibold text-zinc-900">{item.title}</span>
                  {item.variantTitle ? (
                    <span className="ml-1 text-zinc-600">({item.variantTitle})</span>
                  ) : null}
                </td>
                <td className="border-r border-zinc-300 px-3 py-2.5 text-right font-mono font-bold tabular-nums">
                  {item.quantity}
                </td>
                <td className="border-r border-zinc-300 px-3 py-2.5 text-right font-mono tabular-nums">
                  {formatMoney(item.unitPrice, order.currency)}
                </td>
                <td className="border-r border-zinc-300 px-3 py-2.5 text-right font-mono tabular-nums">
                  {item.discountAmount > 0
                    ? `-${formatMoney(item.discountAmount, order.currency)}`
                    : "-"}
                </td>
                <td className="px-3 py-2.5 text-right font-mono font-semibold tabular-nums">
                  {formatMoney(item.total, order.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-6 flex flex-col justify-between gap-6 sm:flex-row">
          <div className="max-w-md space-y-1 text-zinc-600">
            <div>
              <strong>Kargo Yöntemi:</strong> {order.shippingMethodName ?? "Standart Kargo"}
            </div>
            {order.customerNote ? (
              <div>
                <strong>Müşteri Notu:</strong> {order.customerNote}
              </div>
            ) : null}
          </div>

          <div className="w-full max-w-xs space-y-1.5 border-t border-zinc-300 pt-3 sm:border-t-0 sm:pt-0">
            <div className="flex justify-between">
              <span>Ara Toplam:</span>
              <span className="font-mono tabular-nums">
                {formatMoney(order.subtotal, order.currency)}
              </span>
            </div>
            {order.discountTotal > 0 ? (
              <div className="flex justify-between">
                <span>İndirim:</span>
                <span className="font-mono tabular-nums">
                  -{formatMoney(order.discountTotal, order.currency)}
                </span>
              </div>
            ) : null}
            <div className="flex justify-between">
              <span>Kargo:</span>
              <span className="font-mono tabular-nums">
                {formatMoney(order.shippingTotal, order.currency)}
              </span>
            </div>
            {order.paymentFee > 0 ? (
              <div className="flex justify-between">
                <span>Hizmet Bedeli:</span>
                <span className="font-mono tabular-nums">
                  {formatMoney(order.paymentFee, order.currency)}
                </span>
              </div>
            ) : null}
            <div className="flex justify-between text-zinc-600">
              <span>KDV Toplamı:</span>
              <span className="font-mono tabular-nums">
                {formatMoney(order.taxTotal, order.currency)}
              </span>
            </div>
            <div className="flex justify-between border-t border-zinc-900 pt-2 text-sm font-bold">
              <span>GENEL TOPLAM:</span>
              <span className="font-mono tabular-nums">
                {formatMoney(order.total, order.currency)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
