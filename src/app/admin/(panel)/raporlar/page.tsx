import Link from "next/link";
import { getSalesReport } from "@/modules/reports/service";
import { formatMoney } from "@/lib/money";
import { EmptyState } from "@/components/ui/empty-state";

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ gun?: string }>;
}) {
  const params = await searchParams;
  const days = [7, 30, 90, 365].includes(Number(params.gun)) ? Number(params.gun) : 30;
  const report = await getSalesReport(days);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">
            Satış, Kârlılık ve Dönüşüm Raporları (Son {days} Gün)
          </h1>
          <p className="mt-1 text-xs text-zinc-600">
            Tüm tutarlar veritabanındaki gerçek sipariş, maliyet, iade ve kupon kayıtlarından hesaplanır.
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          {[7, 30, 90, 365].map((d) => (
            <Link
              key={d}
              href={`/admin/raporlar?gun=${d}`}
              className={`rounded border px-3 py-1.5 text-xs font-medium tabular-nums ${
                days === d
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100"
              }`}
            >
              Son {d} Gün
            </Link>
          ))}
        </div>
      </div>

      {/* Gerçek Veriye Dayalı Özet Tablosu */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-md border border-zinc-200 bg-white p-4">
          <div className="text-xs text-zinc-600">Sipariş Sayısı (İptaller Hariç)</div>
          <div className="mt-1 font-mono text-xl font-semibold text-zinc-900 tabular-nums">
            {report.orderCount}
          </div>
        </div>
        <div className="rounded-md border border-zinc-200 bg-white p-4">
          <div className="text-xs text-zinc-600">Brüt Satış Tutarı</div>
          <div className="mt-1 font-mono text-xl font-semibold text-zinc-900 tabular-nums">
            {formatMoney(report.grossRevenueMinor)}
          </div>
        </div>
        <div className="rounded-md border border-zinc-200 bg-white p-4">
          <div className="text-xs text-zinc-600">İade Edilen Tutar</div>
          <div className="mt-1 font-mono text-xl font-semibold text-zinc-900 tabular-nums">
            {formatMoney(report.refundedMinor)}
          </div>
        </div>
        <div className="rounded-md border border-zinc-200 bg-white p-4">
          <div className="text-xs text-zinc-600">Net Ciro ve Tahmini Kâr</div>
          <div className="mt-1 font-mono text-lg font-semibold text-zinc-900 tabular-nums">
            {formatMoney(report.netRevenueMinor)}
          </div>
          <div className="text-[11px] text-zinc-600 tabular-nums">
            Tahmini Brüt Kâr: {formatMoney(report.estimatedProfitMinor)}
          </div>
        </div>
        <div className="rounded-md border border-zinc-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs text-zinc-600">
            <span>Terk Edilmiş Sepetler</span>
            <Link
              href="/admin/terkedilmis-sepetler"
              className="text-primary hover:underline font-medium"
            >
              İncele →
            </Link>
          </div>
          <div className="mt-1 font-mono text-xl font-semibold text-zinc-900 tabular-nums">
            {report.abandonedCartCount}
          </div>
        </div>
      </section>

      {report.orderCount === 0 ? (
        <EmptyState
          title={`Son ${days} günde tamamlanmış sipariş kaydı bulunmuyor`}
          description="Vitrinden veya panelden yeni sipariş oluşturulduğunda günlük ciro serisi, en çok satan ürünler ve kupon performansı burada listelenir."
          actionLabel="Manuel Sipariş Oluştur"
          actionHref="/admin/siparisler/yeni"
        />
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            {/* En Çok Satan Ürünler */}
            <section className="rounded-md border border-zinc-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-zinc-900">
                En Çok Ciro Getiren Ürünler (Son {days} Gün)
              </h2>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-zinc-200 text-zinc-600">
                    <tr>
                      <th className="py-2">Ürün</th>
                      <th className="py-2 text-right">Satılan Adet</th>
                      <th className="py-2 text-right">Satır Cirosu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {report.topProducts.map((p) => (
                      <tr key={p.productId}>
                        <td className="py-2 font-medium text-zinc-900">{p.title}</td>
                        <td className="py-2 text-right font-mono tabular-nums">{p.unitsSold}</td>
                        <td className="py-2 text-right font-mono font-semibold tabular-nums">
                          {formatMoney(p.revenueMinor)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Kupon ve İndirim Performansı */}
            <section className="rounded-md border border-zinc-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-zinc-900">
                Kupon ve Promosyon Kullanımı (Son {days} Gün)
              </h2>
              {report.couponPerformance.length === 0 ? (
                <p className="mt-3 text-xs text-zinc-600">
                  Bu dönemde kupon veya otomatik indirim kullanılmış sipariş bulunmuyor.
                </p>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-zinc-200 text-zinc-600">
                      <tr>
                        <th className="py-2">Kod</th>
                        <th className="py-2">Kampanya</th>
                        <th className="py-2 text-right">Kullanım</th>
                        <th className="py-2 text-right">Toplam İndirim</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {report.couponPerformance.map((c) => (
                        <tr key={c.code}>
                          <td className="py-2 font-mono font-semibold text-zinc-900">{c.code}</td>
                          <td className="py-2 text-zinc-700">{c.name}</td>
                          <td className="py-2 text-right font-mono tabular-nums">{c.usageCount}</td>
                          <td className="py-2 text-right font-mono tabular-nums">
                            {formatMoney(c.totalDiscountMinor)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          {/* Günlük Satış Serisi */}
          <section className="rounded-md border border-zinc-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-zinc-900">
              Günlere Göre Net Sipariş Cirosu (Son {days} Gün)
            </h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-zinc-200 text-zinc-600">
                  <tr>
                    <th className="py-2">Tarih</th>
                    <th className="py-2 text-right">Sipariş Adedi</th>
                    <th className="py-2 text-right">Net Ciro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {report.dailySeries.map((d) => (
                    <tr key={d.date}>
                      <td className="py-2 font-mono text-zinc-900">{d.date}</td>
                      <td className="py-2 text-right font-mono tabular-nums">{d.orders}</td>
                      <td className="py-2 text-right font-mono font-semibold tabular-nums">
                        {formatMoney(d.revenueMinor)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
