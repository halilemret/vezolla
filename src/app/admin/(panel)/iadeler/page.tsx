import Link from "next/link";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { requireStaff } from "@/lib/auth/session";
import { formatMoney } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { listReturnRequestsAdmin } from "@/modules/orders/service";
import {
  approveReturnRequestAction,
  receiveReturnRequestAction,
  refundOrderAction,
  rejectReturnRequestAction,
} from "@/modules/orders/actions";

export const dynamic = "force-dynamic";

function renderReturnStatusBadge(status: string) {
  switch (status) {
    case "REQUESTED":
      return <Badge variant="warning">Onay Bekliyor</Badge>;
    case "APPROVED":
      return <Badge variant="accent">Onaylandı (Kargo Bekleniyor)</Badge>;
    case "RECEIVED":
      return <Badge variant="success">Teslim Alındı</Badge>;
    case "REFUNDED":
      return <Badge variant="success">Ücret İade Edildi</Badge>;
    case "REJECTED":
    case "CANCELLED":
      return <Badge variant="danger">Reddedildi / İptal</Badge>;
    default:
      return <Badge variant="neutral">{status}</Badge>;
  }
}

export default async function AdminReturnsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireStaff("orders.read");
  const sp = await searchParams;
  const statusFilter = typeof sp.status === "string" ? sp.status : "ALL";

  const returns = await listReturnRequestsAdmin(statusFilter);

  async function handleApprove(formData: FormData) {
    "use server";
    const id = String(formData.get("returnRequestId") ?? "");
    const staffNote = String(formData.get("staffNote") ?? "").trim() || undefined;
    await approveReturnRequestAction(id, staffNote);
  }

  async function handleReject(formData: FormData) {
    "use server";
    const id = String(formData.get("returnRequestId") ?? "");
    const staffNote = String(formData.get("staffNote") ?? "").trim() || undefined;
    await rejectReturnRequestAction(id, staffNote);
  }

  async function handleReceive(formData: FormData) {
    "use server";
    const id = String(formData.get("returnRequestId") ?? "");
    const restock = formData.get("restock") === "on";
    const staffNote = String(formData.get("staffNote") ?? "").trim() || undefined;
    await receiveReturnRequestAction(id, restock, staffNote);
  }

  async function handleRefund(formData: FormData) {
    "use server";
    await refundOrderAction(formData);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900">
            İade Talepleri (RMA)
          </h1>
          <p className="mt-1 text-xs text-zinc-600">
            Müşteri iade taleplerini onaylayın, depoya dönen ürünleri stoğa (RETURN) alın ve kuruşu kuruşuna ödeme iadesi yapın.
          </p>
        </div>

        <form method="GET" action="/admin/iadeler" className="flex items-center gap-2">
          <Select name="status" defaultValue={statusFilter} className="w-48">
            <option value="ALL">Tüm Durumlar</option>
            <option value="REQUESTED">Onay Bekleyenler</option>
            <option value="APPROVED">Onaylananlar</option>
            <option value="RECEIVED">Teslim Alınanlar</option>
            <option value="REFUNDED">İadesi Tamamlananlar</option>
            <option value="REJECTED">Reddedilenler</option>
          </Select>
          <Button type="submit" variant="secondary" size="sm">
            Filtrele
          </Button>
        </form>
      </div>

      {returns.length === 0 ? (
        <EmptyState
          title="İade talebi bulunmuyor"
          description="Seçili durumda bekleyen bir RMA iade kaydı yok. Sipariş detay sayfasından veya müşteri hesabından yeni iade talebi açılabilir."
          actionLabel="Siparişlere Git"
          actionHref="/admin/siparisler"
        />
      ) : (
        <div className="space-y-4">
          {returns.map((ret) => {
            const customerName = ret.order.customer
              ? `${ret.order.customer.firstName} ${ret.order.customer.lastName}`
              : ret.order.email;
            const suggestedRefundMinor =
              ret.refundAmount ??
              ret.items.reduce(
                (sum, ri) =>
                  sum +
                  Math.round(
                    (ri.orderItem.total * ri.quantity) /
                      Math.max(1, ri.orderItem.quantity)
                  ),
                0
              );

            return (
              <div
                key={ret.id}
                className="rounded-md border border-zinc-200 bg-white p-5 text-xs"
              >
                <div className="flex flex-col justify-between gap-3 border-b border-zinc-200 pb-3 sm:flex-row sm:items-center">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Link
                      href={`/admin/siparisler/${ret.orderId}`}
                      className="font-mono text-sm font-bold text-zinc-900 underline"
                    >
                      Sipariş #{ret.order.number}
                    </Link>
                    {renderReturnStatusBadge(ret.status)}
                    {ret.returnCode && (
                      <Badge variant="accent" className="font-mono font-bold">
                        İade Kodu: {ret.returnCode} ({ret.carrierCode || "YURTICI"})
                      </Badge>
                    )}
                    <Badge variant={ret.hygieneAccepted ? "success" : "warning"}>
                      {ret.hygieneAccepted ? "Hijyen İstisnası Onaylı (m.15/ç)" : "Hijyen Onayı Alınmamış"}
                    </Badge>
                    <span className="text-zinc-600">
                      Müşteri: <strong className="text-zinc-900">{customerName}</strong>
                    </span>
                  </div>
                  <div className="font-mono text-zinc-600 tabular-nums">
                    Talep Tarihi: {format(ret.createdAt, "dd MMM yyyy HH:mm", { locale: tr })}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-3">
                  <div className="space-y-2 lg:col-span-2">
                    <div className="text-[11px] font-semibold uppercase text-zinc-500">
                      İade Edilen Ürünler
                    </div>
                    <div className="divide-y divide-zinc-200 rounded border border-zinc-200">
                      {ret.items.map((item) => {
                        const lineRefundable = Math.round(
                          (item.orderItem.total * item.quantity) /
                            Math.max(1, item.orderItem.quantity)
                        );
                        return (
                          <div
                            key={item.id}
                            className="flex items-center justify-between px-3 py-2"
                          >
                            <div>
                              <span className="font-medium text-zinc-900">
                                {item.orderItem.title}
                              </span>
                              {item.orderItem.variantTitle ? (
                                <span className="ml-1 text-zinc-600">
                                  ({item.orderItem.variantTitle})
                                </span>
                              ) : null}
                              {item.reason ? (
                                <div className="text-[11px] text-zinc-600">
                                  Neden: {item.reason}
                                </div>
                              ) : null}
                            </div>
                            <div className="text-right font-mono tabular-nums">
                              <div className="font-semibold text-zinc-900">
                                {item.quantity} adet
                              </div>
                              <div className="text-[11px] text-zinc-600">
                                İndirim sonrası net pay:{" "}
                                {formatMoney(lineRefundable, ret.order.currency)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {ret.reason || ret.customerNote ? (
                      <div className="rounded bg-zinc-50 p-3 text-zinc-700">
                        {ret.reason ? (
                          <div>
                            <strong>İade Nedeni:</strong> {ret.reason}
                          </div>
                        ) : null}
                        {ret.customerNote ? (
                          <div>
                            <strong>Müşteri Notu:</strong> {ret.customerNote}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-3 rounded border border-zinc-200 bg-zinc-50/70 p-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-600">Hesaplanan İade Tutarı:</span>
                      <span className="font-mono text-sm font-bold tabular-nums text-zinc-900">
                        {formatMoney(suggestedRefundMinor, ret.order.currency)}
                      </span>
                    </div>

                    {ret.status === "REQUESTED" ? (
                      <div className="flex items-center gap-2">
                        <form action={handleApprove} className="flex-1">
                          <input type="hidden" name="returnRequestId" value={ret.id} />
                          <Button
                            type="submit"
                            variant="primary"
                            size="sm"
                            className="w-full"
                          >
                            Onayla
                          </Button>
                        </form>
                        <form action={handleReject} className="flex-1">
                          <input type="hidden" name="returnRequestId" value={ret.id} />
                          <Button
                            type="submit"
                            variant="outline"
                            size="sm"
                            className="w-full"
                          >
                            Reddet
                          </Button>
                        </form>
                      </div>
                    ) : null}

                    {(ret.status === "REQUESTED" || ret.status === "APPROVED") &&
                    !ret.receivedAt ? (
                      <form
                        action={handleReceive}
                        className="space-y-2 border-t border-zinc-200 pt-2.5"
                      >
                        <input type="hidden" name="returnRequestId" value={ret.id} />
                        <label className="flex items-center gap-2 font-medium text-zinc-800">
                          <input
                            type="checkbox"
                            name="restock"
                            defaultChecked={ret.restock}
                            className="h-4 w-4 rounded border-zinc-300"
                          />
                          <span>Ürünleri depoya (RETURN) geri ekle</span>
                        </label>
                        <Button
                          type="submit"
                          variant="secondary"
                          size="sm"
                          className="w-full"
                        >
                          Paketi Teslim Al
                        </Button>
                      </form>
                    ) : null}

                    {ret.status !== "REFUNDED" &&
                    ret.status !== "REJECTED" &&
                    ret.status !== "CANCELLED" ? (
                      <form
                        action={handleRefund}
                        className="space-y-2 border-t border-zinc-200 pt-2.5"
                      >
                        <input type="hidden" name="orderId" value={ret.orderId} />
                        <input type="hidden" name="returnRequestId" value={ret.id} />
                        <input
                          type="hidden"
                          name="reason"
                          value={ret.reason ?? "RMA İade Talebi"}
                        />
                        <div className="flex items-center gap-2">
                          <Input
                            name="amount"
                            defaultValue={(suggestedRefundMinor / 100)
                              .toFixed(2)
                              .replace(".", ",")}
                            className="min-h-9 font-mono text-xs tabular-nums"
                          />
                          <Button type="submit" variant="accent" size="sm">
                            Ücreti İade Et
                          </Button>
                        </div>
                      </form>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
