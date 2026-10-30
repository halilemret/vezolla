import Link from "next/link";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import {
  FileText,
  Printer,
  FileCode,
  CheckCircle,
  XCircle,
  MagnifyingGlass,
  Gear,
} from "@phosphor-icons/react/dist/ssr";
import { requireStaff } from "@/lib/auth/session";
import { formatMoney } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { listInvoices } from "@/modules/invoicing/service";
import { cancelInvoiceAction } from "@/modules/invoicing/actions";

export const dynamic = "force-dynamic";

export default async function AdminInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    status?: string;
    type?: string;
    page?: string;
  }>;
}) {
  await requireStaff("orders.read");
  const params = await searchParams;

  const search = params.search?.trim() || "";
  const status = params.status || "ALL";
  const type = params.type || "ALL";
  const page = parseInt(params.page || "1", 10) || 1;

  const result = await listInvoices({
    search,
    status,
    type,
    page,
    pageSize: 20,
  });

  async function handleCancelInvoice(formData: FormData) {
    "use server";
    await cancelInvoiceAction(formData);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900">
            e-Fatura ve e-Arşiv Yönetimi
          </h1>
          <p className="mt-1 text-xs text-zinc-600">
            Otomatik veya manuel kesilen resmî GİB UBL-TR uyumlu e-Fatura ve e-Arşiv belgelerini görüntüleyin, yazdırın veya indirin.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/admin/ayarlar">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <Gear className="h-4 w-4" />
              <span>Fatura Ayarları</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Arama ve Filtre Çubuğu */}
      <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <form method="get" className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1">
            <MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              name="search"
              defaultValue={search}
              placeholder="Fatura No, Alıcı, TCKN/VKN veya ETTN ile ara..."
              className="h-9 w-full rounded-md border border-zinc-300 bg-white pl-9 pr-3 text-xs text-zinc-900 focus:border-zinc-500 focus:outline-none"
            />
          </div>

          <select
            name="type"
            defaultValue={type}
            aria-label="Fatura Türü"
            className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-xs text-zinc-800 focus:outline-none"
          >
            <option value="ALL">Tüm Belge Türleri</option>
            <option value="EARSIV">e-Arşiv Fatura</option>
            <option value="EFATURA">e-Fatura (Kurumsal)</option>
          </select>

          <select
            name="status"
            defaultValue={status}
            aria-label="Fatura Durumu"
            className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-xs text-zinc-800 focus:outline-none"
          >
            <option value="ALL">Tüm Durumlar</option>
            <option value="ISSUED">Düzenlendi (Onaylı)</option>
            <option value="CANCELLED">İptal Edildi</option>
          </select>

          <Button type="submit" variant="secondary" size="sm" className="text-xs">
            Filtrele
          </Button>
        </form>
      </div>

      {/* Fatura Tablosu */}
      {result.invoices.length === 0 ? (
        <EmptyState
          title="Henüz fatura bulunamadı"
          description="Siparişler ödendiğinde otomatik e-Fatura/e-Arşiv belgeleri burada listelenir. Dilerseniz sipariş detayından manuel de fatura kesebilirsiniz."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
                  <th className="px-4 py-3">Fatura No / ETTN</th>
                  <th className="px-4 py-3">Sipariş</th>
                  <th className="px-4 py-3">Alıcı Bilgileri</th>
                  <th className="px-4 py-3">Belge Türü</th>
                  <th className="px-4 py-3">Tarih</th>
                  <th className="px-4 py-3 text-right">Tutar</th>
                  <th className="px-4 py-3">Durum</th>
                  <th className="px-4 py-3 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {result.invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-zinc-50/80">
                    <td className="px-4 py-3">
                      <div className="font-mono font-bold text-zinc-900">
                        {inv.invoiceNumber}
                      </div>
                      <div className="font-mono text-[10px] text-zinc-500 truncate max-w-[140px]" title={inv.ettn}>
                        {inv.ettn}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/siparisler/${inv.orderId}`}
                        className="font-mono font-semibold text-zinc-900 hover:underline"
                      >
                        #{inv.order.number}
                      </Link>
                    </td>

                    <td className="px-4 py-3">
                      <div className="font-medium text-zinc-900">
                        {inv.recipientTitle}
                      </div>
                      <div className="font-mono text-[11px] text-zinc-500">
                        {inv.recipientTaxNumber} {inv.recipientTaxOffice ? `(${inv.recipientTaxOffice} V.D.)` : ""}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <Badge variant={inv.invoiceType === "EFATURA" ? "accent" : "neutral"}>
                        {inv.invoiceType === "EFATURA" ? "e-Fatura" : "e-Arşiv"}
                      </Badge>
                    </td>

                    <td className="px-4 py-3 text-zinc-600 tabular-nums">
                      {format(inv.issueDate, "dd MMM yyyy HH:mm", { locale: tr })}
                    </td>

                    <td className="px-4 py-3 text-right font-mono font-bold tabular-nums text-zinc-900">
                      {formatMoney(inv.total, inv.currency)}
                    </td>

                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          inv.status === "ISSUED"
                            ? "success"
                            : inv.status === "CANCELLED"
                              ? "danger"
                              : "warning"
                        }
                      >
                        {inv.status === "ISSUED"
                          ? "Onaylandı"
                          : inv.status === "CANCELLED"
                            ? "İptal Edildi"
                            : inv.status}
                      </Badge>
                    </td>

                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/admin/faturalar/${inv.invoiceNumber}/yazdir`}
                          target="_blank"
                          title="Faturayı Görüntüle ve Yazdır"
                          className="inline-flex h-7 items-center justify-center rounded border border-zinc-300 bg-white px-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                        >
                          <Printer className="h-3.5 w-3.5 mr-1" />
                          <span>Yazdır</span>
                        </Link>

                        <a
                          href={`/api/admin/invoices/${inv.id}/ubl`}
                          download={`${inv.invoiceNumber}.xml`}
                          title="GİB UBL-TR XML İndir"
                          className="inline-flex h-7 items-center justify-center rounded border border-zinc-300 bg-white px-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                        >
                          <FileCode className="h-3.5 w-3.5 mr-1" />
                          <span>XML</span>
                        </a>

                        {inv.status === "ISSUED" ? (
                          <form action={handleCancelInvoice}>
                            <input type="hidden" name="invoiceId" value={inv.id} />
                            <input
                              type="hidden"
                              name="reason"
                              value="Müşteri talebi / sipariş iptali"
                            />
                            <button
                              type="submit"
                              title="Faturayı İptal Et"
                              className="inline-flex h-7 items-center justify-center rounded border border-red-200 bg-red-50/50 px-2 text-xs font-medium text-red-700 hover:bg-red-100"
                            >
                              İptal
                            </button>
                          </form>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {result.totalPages > 1 ? (
            <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-3 text-xs text-zinc-600">
              <div>
                Toplam {result.totalCount} faturadan {(page - 1) * 20 + 1}-
                {Math.min(page * 20, result.totalCount)} arası gösteriliyor
              </div>
              <div className="flex items-center gap-2">
                {page > 1 ? (
                  <Link
                    href={`/admin/faturalar?page=${page - 1}&search=${encodeURIComponent(search)}&status=${status}&type=${type}`}
                    className="rounded border border-zinc-300 px-2 py-1 hover:bg-zinc-100"
                  >
                    Önceki
                  </Link>
                ) : null}
                <span>Sayfa {page} / {result.totalPages}</span>
                {page < result.totalPages ? (
                  <Link
                    href={`/admin/faturalar?page=${page + 1}&search=${encodeURIComponent(search)}&status=${status}&type=${type}`}
                    className="rounded border border-zinc-300 px-2 py-1 hover:bg-zinc-100"
                  >
                    Sonraki
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
