import Link from "next/link";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { listOrders } from "@/modules/orders/service";
import { getPaymentMethodLabel } from "@/modules/payments/registry";

export const dynamic = "force-dynamic";

function renderPaymentBadge(status: string) {
  switch (status) {
    case "PAID":
      return <Badge variant="success">Ödendi</Badge>;
    case "AWAITING_TRANSFER":
      return <Badge variant="warning">Havale Bekliyor</Badge>;
    case "AWAITING_COD":
      return <Badge variant="accent">Kapıda Ödeme</Badge>;
    case "PARTIALLY_REFUNDED":
      return <Badge variant="warning">Kısmi İade</Badge>;
    case "REFUNDED":
      return <Badge variant="neutral">İade Edildi</Badge>;
    case "FAILED":
    case "CANCELLED":
      return <Badge variant="danger">İptal / Başarısız</Badge>;
    default:
      return <Badge variant="neutral">Ödeme Bekliyor</Badge>;
  }
}

function renderFulfillmentBadge(status: string) {
  switch (status) {
    case "SHIPPED":
      return <Badge variant="success">Kargoda</Badge>;
    case "DELIVERED":
      return <Badge variant="success">Teslim Edildi</Badge>;
    case "PARTIALLY_SHIPPED":
      return <Badge variant="accent">Kısmi Kargo</Badge>;
    case "PREPARING":
      return <Badge variant="warning">Hazırlanıyor</Badge>;
    case "PARTIALLY_RETURNED":
    case "RETURNED":
      return <Badge variant="danger">İade Döndü</Badge>;
    default:
      return <Badge variant="neutral">Gönderilmedi</Badge>;
  }
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireStaff("orders.read");
  const sp = await searchParams;

  const q = typeof sp.q === "string" ? sp.q : "";
  const status = typeof sp.status === "string" ? sp.status : "ALL";
  const paymentStatus = typeof sp.paymentStatus === "string" ? sp.paymentStatus : "ALL";
  const fulfillmentStatus =
    typeof sp.fulfillmentStatus === "string" ? sp.fulfillmentStatus : "ALL";
  const page = typeof sp.page === "string" ? Number.parseInt(sp.page, 10) || 1 : 1;

  const [result, awaitingTransferCount, unfulfilledCount, codCount] = await Promise.all([
    listOrders({
      q,
      status,
      paymentStatus,
      fulfillmentStatus,
      page,
      pageSize: 25,
    }),
    db.order.count({
      where: { status: "OPEN", paymentStatus: "AWAITING_TRANSFER" },
    }),
    db.order.count({
      where: {
        status: "OPEN",
        fulfillmentStatus: { in: ["UNFULFILLED", "PREPARING"] },
      },
    }),
    db.order.count({
      where: { status: "OPEN", paymentStatus: "AWAITING_COD" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900">Siparişler</h1>
          <p className="mt-1 text-xs text-zinc-600">
            Gelen siparişleri, havale onaylarını, kargo çıkışlarını ve sözleşme kayıtlarını yönetin.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/iadeler">
            <Button variant="outline" size="sm">
              İade Talepleri (RMA)
            </Button>
          </Link>
          <Link href="/admin/siparisler/yeni">
            <Button variant="primary" size="sm">
              + Manuel Sipariş Oluştur
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Link
          href="/admin/siparisler"
          className="rounded-md border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-400"
        >
          <div className="text-xs font-medium text-zinc-600">Filtrelenen Sipariş</div>
          <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-zinc-900">
            {result.totalCount}
          </div>
        </Link>
        <Link
          href="/admin/siparisler?paymentStatus=AWAITING_TRANSFER&status=OPEN"
          className="rounded-md border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-400"
        >
          <div className="text-xs font-medium text-zinc-600">Havale Onayı Bekleyen</div>
          <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-[#92400e]">
            {awaitingTransferCount}
          </div>
        </Link>
        <Link
          href="/admin/siparisler?fulfillmentStatus=UNFULFILLED&status=OPEN"
          className="rounded-md border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-400"
        >
          <div className="text-xs font-medium text-zinc-600">Kargolanmayı Bekleyen</div>
          <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-[#9a3412]">
            {unfulfilledCount}
          </div>
        </Link>
        <Link
          href="/admin/siparisler?paymentStatus=AWAITING_COD&status=OPEN"
          className="rounded-md border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-400"
        >
          <div className="text-xs font-medium text-zinc-600">Kapıda Ödeme Açık</div>
          <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-zinc-900">
            {codCount}
          </div>
        </Link>
      </div>

      <form
        method="GET"
        action="/admin/siparisler"
        className="grid grid-cols-1 gap-3 rounded-md border border-zinc-200 bg-white p-4 sm:grid-cols-5"
      >
        <div className="sm:col-span-2">
          <Input
            name="q"
            defaultValue={q}
            placeholder="Sipariş #No, müşteri adı, e-posta veya telefon ara..."
          />
        </div>
        <div>
          <Select name="paymentStatus" defaultValue={paymentStatus}>
            <option value="ALL">Tüm Ödeme Durumları</option>
            <option value="PAID">Ödendi</option>
            <option value="AWAITING_TRANSFER">Havale Bekliyor</option>
            <option value="AWAITING_COD">Kapıda Ödeme</option>
            <option value="PENDING">Ödeme Bekliyor</option>
            <option value="PARTIALLY_REFUNDED">Kısmi İade</option>
            <option value="REFUNDED">İade Edildi</option>
          </Select>
        </div>
        <div>
          <Select name="fulfillmentStatus" defaultValue={fulfillmentStatus}>
            <option value="ALL">Tüm Gönderim Durumları</option>
            <option value="UNFULFILLED">Gönderilmedi</option>
            <option value="PREPARING">Hazırlanıyor</option>
            <option value="PARTIALLY_SHIPPED">Kısmi Kargo</option>
            <option value="SHIPPED">Kargoda</option>
            <option value="DELIVERED">Teslim Edildi</option>
            <option value="RETURNED">İade Döndü</option>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Select name="status" defaultValue={status}>
            <option value="ALL">Tüm Siparişler</option>
            <option value="OPEN">Açık</option>
            <option value="COMPLETED">Tamamlandı</option>
            <option value="CANCELLED">İptal</option>
          </Select>
          <Button type="submit" variant="secondary" size="sm">
            Filtrele
          </Button>
        </div>
      </form>

      {result.orders.length === 0 ? (
        <EmptyState
          title="Sipariş kaydı bulunamadı"
          description="Seçtiğiniz filtrelere uygun sipariş yok veya henüz mağazanıza sipariş düşmedi."
          actionLabel="Manuel Sipariş Oluştur"
          actionHref="/admin/siparisler/yeni"
        />
      ) : (
        <div className="overflow-x-auto rounded-md border border-zinc-200 bg-white">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
                <th className="px-4 py-3">Sipariş</th>
                <th className="px-4 py-3">Tarih</th>
                <th className="px-4 py-3">Müşteri</th>
                <th className="px-4 py-3">Ödeme</th>
                <th className="px-4 py-3">Gönderim</th>
                <th className="px-4 py-3">Kalem</th>
                <th className="px-4 py-3 text-right">Toplam</th>
                <th className="px-4 py-3 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {result.orders.map((order) => {
                const totalItems = order.items.reduce((sum, i) => sum + i.quantity, 0);
                const customerName = order.customer
                  ? `${order.customer.firstName} ${order.customer.lastName}`
                  : order.email;

                return (
                  <tr key={order.id} className="hover:bg-zinc-50/80">
                    <td className="px-4 py-3 font-mono font-semibold tabular-nums text-zinc-900">
                      <Link
                        href={`/admin/siparisler/${order.id}`}
                        className="underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-900"
                      >
                        #{order.number}
                      </Link>
                      {order.status === "CANCELLED" ? (
                        <span className="ml-2 text-[10px] font-normal text-red-700">(İptal)</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 tabular-nums">
                      {format(order.placedAt, "dd MMM yyyy HH:mm", { locale: tr })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-zinc-900">{customerName}</div>
                      <div className="text-[11px] text-zinc-600">{order.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1">
                        {renderPaymentBadge(order.paymentStatus)}
                        <span className="text-[11px] text-zinc-600">
                          {getPaymentMethodLabel(order.paymentMethod)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {renderFulfillmentBadge(order.fulfillmentStatus)}
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums text-zinc-700">
                      {totalItems} adet
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-zinc-900">
                      {formatMoney(order.total, order.currency)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <Link
                          href={`/admin/siparisler/${order.id}`}
                          className="rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-900 hover:bg-zinc-100"
                        >
                          Yönet
                        </Link>
                        <Link
                          href={`/admin/siparisler/${order.id}/yazdir`}
                          className="rounded border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100"
                        >
                          Fiş
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {result.totalPages > 1 ? (
        <div className="flex items-center justify-between text-xs text-zinc-600">
          <span>
            Toplam {result.totalCount} sipariş, Sayfa {result.page} / {result.totalPages}
          </span>
          <div className="flex items-center gap-2">
            {result.page > 1 ? (
              <Link
                href={`/admin/siparisler?page=${result.page - 1}&q=${encodeURIComponent(q)}&status=${status}&paymentStatus=${paymentStatus}&fulfillmentStatus=${fulfillmentStatus}`}
                className="rounded border border-zinc-300 bg-white px-3 py-1.5 font-medium text-zinc-900 hover:bg-zinc-50"
              >
                Önceki
              </Link>
            ) : null}
            {result.page < result.totalPages ? (
              <Link
                href={`/admin/siparisler?page=${result.page + 1}&q=${encodeURIComponent(q)}&status=${status}&paymentStatus=${paymentStatus}&fulfillmentStatus=${fulfillmentStatus}`}
                className="rounded border border-zinc-300 bg-white px-3 py-1.5 font-medium text-zinc-900 hover:bg-zinc-50"
              >
                Sonraki
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
