import Link from "next/link";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

export default async function AdminActionCenterPage() {
  const [
    awaitingTransferOrders,
    unfulfilledOrders,
    pendingReturns,
    pendingReviews,
    lowStockLevels,
    recentFeedRuns,
    recentAuditLogs,
  ] = await Promise.all([
    db.order.findMany({
      where: { status: "OPEN", paymentStatus: "AWAITING_TRANSFER" },
      orderBy: { placedAt: "asc" },
      take: 8,
    }),
    db.order.findMany({
      where: {
        status: "OPEN",
        paymentStatus: { in: ["PAID", "AWAITING_COD"] },
        fulfillmentStatus: { in: ["UNFULFILLED", "PREPARING", "PARTIALLY_SHIPPED"] },
      },
      orderBy: { placedAt: "asc" },
      take: 8,
    }),
    db.returnRequest.findMany({
      where: { status: "REQUESTED" },
      include: { order: { select: { id: true, number: true, email: true } } },
      orderBy: { createdAt: "asc" },
      take: 6,
    }),
    db.review.count({ where: { status: "PENDING" } }),
    db.inventoryLevel.findMany({
      where: {
        onHand: { lte: 5 },
      },
      include: {
        variant: {
          include: { product: { select: { id: true, title: true } } },
        },
        warehouse: { select: { name: true } },
      },
      orderBy: { onHand: "asc" },
      take: 8,
    }),
    db.feedRun.findMany({
      include: { source: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.auditLog.findMany({
      include: { staffUser: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Operasyon ve Aksiyon Merkezi</h1>
          <p className="mt-1 text-xs text-zinc-600">
            Önce onay veya işlem bekleyen kuyruklar listelenir. Tüm veriler gerçek veritabanı kayıtlarından okunur.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin/siparisler/yeni">
            <Button variant="outline" size="sm">
              + Manuel Sipariş
            </Button>
          </Link>
          <Link href="/admin/xml/kaynaklar">
            <Button variant="outline" size="sm">
              XML Kaynakları
            </Button>
          </Link>
          <Link href="/admin/kisisellestirme">
            <Button variant="outline" size="sm">
              Kişiselleştirme ve Reklam
            </Button>
          </Link>
        </div>
      </div>

      {/* 1. Birincil Aksiyon Kuyrukları: Gönderilecek Siparişler ve Havale Onayı */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-md border border-zinc-200 bg-white p-5">
          <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">
                Kargolanmayı Bekleyen Siparişler ({unfulfilledOrders.length})
              </h2>
              <p className="text-xs text-zinc-600">
                Ödemesi tamamlanmış veya kapıda ödemeli gönderime hazır siparişler
              </p>
            </div>
            <Link href="/admin/siparisler" className="text-xs font-medium text-[#9a3412] hover:underline">
              Tüm Siparişler
            </Link>
          </div>

          {unfulfilledOrders.length === 0 ? (
            <p className="py-6 text-xs text-zinc-600">
              Şu anda kargolanmayı bekleyen açık sipariş yok. Yeni sipariş geldiğinde burada listelenir.
            </p>
          ) : (
            <div className="mt-2 divide-y divide-zinc-200">
              {unfulfilledOrders.map((o) => (
                <div key={o.id} className="flex items-center justify-between py-2.5 text-xs">
                  <div>
                    <Link
                      href={`/admin/siparisler/${o.id}`}
                      className="font-mono font-semibold text-zinc-900 hover:underline"
                    >
                      #{o.number}
                    </Link>
                    <span className="ml-2 text-zinc-600">{o.email}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-semibold text-zinc-900 tabular-nums">
                      {formatMoney(o.total)}
                    </span>
                    <Link href={`/admin/siparisler/${o.id}`}>
                      <Button variant="outline" size="sm">
                        Kargola
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-md border border-zinc-200 bg-white p-5">
          <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">
                Havale / EFT Onayı Bekleyenler ({awaitingTransferOrders.length})
              </h2>
              <p className="text-xs text-zinc-600">
                Banka hesabına ödeme düştüğünde onaylayıp hazırlamaya alın
              </p>
            </div>
            <Link href="/admin/siparisler" className="text-xs font-medium text-[#9a3412] hover:underline">
              Tümünü Gör
            </Link>
          </div>

          {awaitingTransferOrders.length === 0 ? (
            <p className="py-6 text-xs text-zinc-600">
              Havale onayı bekleyen sipariş bulunmuyor.
            </p>
          ) : (
            <div className="mt-2 divide-y divide-zinc-200">
              {awaitingTransferOrders.map((o) => (
                <div key={o.id} className="flex items-center justify-between py-2.5 text-xs">
                  <div>
                    <Link
                      href={`/admin/siparisler/${o.id}`}
                      className="font-mono font-semibold text-zinc-900 hover:underline"
                    >
                      #{o.number}
                    </Link>
                    <span className="ml-2 text-zinc-600">{o.email}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-semibold text-zinc-900 tabular-nums">
                      {formatMoney(o.total)}
                    </span>
                    <Link href={`/admin/siparisler/${o.id}`}>
                      <Button variant="accent" size="sm">
                        İncele / Onayla
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* 2. Kritik Stok, İade Talepleri ve XML Senkron Durumu */}
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-md border border-zinc-200 bg-white p-5">
          <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
            <h2 className="text-sm font-semibold text-zinc-900">Kritik Stok Uyarıları</h2>
            <Link href="/admin/stok" className="text-xs font-medium text-[#9a3412] hover:underline">
              Stok Yönetimi
            </Link>
          </div>
          {lowStockLevels.length === 0 ? (
            <p className="py-5 text-xs text-zinc-600">
              Kritik eşiğin (5 adet ve altı) altında varyant bulunmuyor.
            </p>
          ) : (
            <div className="mt-2 divide-y divide-zinc-200">
              {lowStockLevels.map((lvl) => (
                <div key={lvl.id} className="flex items-center justify-between py-2 text-xs">
                  <div className="min-w-0 pr-2">
                    <Link
                      href={`/admin/katalog/urunler/${lvl.variant.product.id}`}
                      className="truncate font-medium text-zinc-900 hover:underline block"
                    >
                      {lvl.variant.product.title}
                    </Link>
                    <span className="text-zinc-600">
                      {lvl.variant.title} ({lvl.warehouse.name})
                    </span>
                  </div>
                  <Badge variant={lvl.onHand <= 0 ? "danger" : "warning"}>
                    {lvl.onHand} adet
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-md border border-zinc-200 bg-white p-5">
          <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
            <h2 className="text-sm font-semibold text-zinc-900">İade ve Yorum Kuyruğu</h2>
            <Link href="/admin/iadeler" className="text-xs font-medium text-[#9a3412] hover:underline">
              İadeler
            </Link>
          </div>
          <div className="mt-3 space-y-3 text-xs">
            <div className="flex items-center justify-between rounded border border-zinc-200 bg-zinc-50 px-3 py-2">
              <span>Onay bekleyen ürün yorumları</span>
              <Link href="/admin/yorumlar" className="font-mono font-semibold text-[#9a3412] hover:underline">
                {pendingReviews} yorum
              </Link>
            </div>
            {pendingReturns.length === 0 ? (
              <p className="py-2 text-zinc-600">Bekleyen iade (RMA) talebi yok.</p>
            ) : (
              <div className="divide-y divide-zinc-200">
                {pendingReturns.map((r) => (
                  <div key={r.id} className="flex items-center justify-between py-2">
                    <span>
                      Sipariş <strong className="font-mono">#{r.order.number}</strong> ({r.order.email})
                    </span>
                    <Link href="/admin/iadeler" className="font-medium text-[#9a3412] hover:underline">
                      Yanıtla
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-md border border-zinc-200 bg-white p-5">
          <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
            <h2 className="text-sm font-semibold text-zinc-900">Son XML Senkronları</h2>
            <Link href="/admin/xml/kaynaklar" className="text-xs font-medium text-[#9a3412] hover:underline">
              XML Sihirbazı
            </Link>
          </div>
          {recentFeedRuns.length === 0 ? (
            <p className="py-5 text-xs text-zinc-600">
              Henüz çalıştırılmış bir XML içe aktarma kaydı yok. Tedarikçi XML linki veya dosyası ekleyerek başlayabilirsiniz.
            </p>
          ) : (
            <div className="mt-2 divide-y divide-zinc-200">
              {recentFeedRuns.map((run) => (
                <div key={run.id} className="flex items-center justify-between py-2 text-xs">
                  <div>
                    <Link
                      href={`/admin/xml/kaynaklar/${run.source.id}`}
                      className="font-medium text-zinc-900 hover:underline"
                    >
                      {run.source.name}
                    </Link>
                    <p className="text-[11px] text-zinc-600">
                      {run.mode === "PREVIEW" ? "Kuru Çalıştırma" : "Gerçek Aktarım"} |{" "}
                      {format(run.createdAt, "dd MMM HH:mm", { locale: tr })}
                    </p>
                  </div>
                  <Badge
                    variant={
                      run.status === "SUCCEEDED"
                        ? "success"
                        : run.status === "FAILED"
                          ? "danger"
                          : "warning"
                    }
                  >
                    {run.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* 3. Son Denetim Kayıtları (Gerçek Sistem Hareketleri) */}
      <section className="rounded-md border border-zinc-200 bg-white p-5">
        <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Son Sistem Değişiklikleri (Denetim Kaydı)</h2>
            <p className="text-xs text-zinc-600">Panelde yapılan her işlem kimlik ve zaman bilgisiyle kaydedilir</p>
          </div>
          <Link href="/admin/ayarlar/denetim" className="text-xs font-medium text-[#9a3412] hover:underline">
            Tüm Denetim Kayıtları
          </Link>
        </div>

        {recentAuditLogs.length === 0 ? (
          <p className="py-4 text-xs text-zinc-600">Henüz kayıtlı işlem yok.</p>
        ) : (
          <div className="mt-2 divide-y divide-zinc-200">
            {recentAuditLogs.map((log) => (
              <div key={log.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
                <div>
                  <span className="font-mono font-medium text-zinc-900">{log.action}</span>
                  {log.summary ? <span className="ml-2 text-zinc-700">{log.summary}</span> : null}
                </div>
                <div className="text-zinc-600 tabular-nums">
                  {log.staffUser?.name ?? "Sistem"} |{" "}
                  {format(log.createdAt, "dd MMM HH:mm", { locale: tr })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
