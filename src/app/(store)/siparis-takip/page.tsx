import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

export default async function StoreOrderTrackingPage({
  searchParams,
}: {
  searchParams: Promise<{ no?: string; email?: string }>;
}) {
  const params = await searchParams;
  const rawNo = (params.no ?? "").trim().replace(/^#/, "");
  const email = (params.email ?? "").trim().toLowerCase();
  const orderNumber = Number.parseInt(rawNo, 10);

  const order =
    Number.isFinite(orderNumber) && email
      ? await db.order.findFirst({
          where: {
            number: orderNumber,
            email: { equals: email, mode: "insensitive" },
          },
          include: {
            items: true,
            fulfillments: true,
            events: {
              where: { isInternal: false },
              orderBy: { createdAt: "desc" },
            },
          },
        })
      : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-serif)] text-3xl text-zinc-900">
          Sipariş Takibi
        </h1>
        <p className="mt-1 text-xs text-zinc-600">
          Üye olmadan veya üye olarak verdiğiniz siparişin durumunu sipariş numaranız ve e-posta adresinizle sorgulayın.
        </p>
      </div>

      <form
        action="/siparis-takip"
        method="get"
        className="grid gap-3 rounded-md border border-zinc-200 bg-white p-5 sm:grid-cols-3"
      >
        <div>
          <Label htmlFor="no">Sipariş Numarası</Label>
          <Input
            id="no"
            name="no"
            required
            defaultValue={rawNo}
            placeholder="Örn: 1001"
            className="mt-1 font-mono"
          />
        </div>
        <div>
          <Label htmlFor="email">E-posta Adresi</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            defaultValue={email}
            placeholder="ornek@eposta.com"
            className="mt-1"
          />
        </div>
        <div className="flex items-end">
          <Button type="submit" className="w-full">
            Siparişi Sorgula
          </Button>
        </div>
      </form>

      {rawNo && email && !order ? (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-4 text-xs text-red-900"
        >
          Girilen sipariş numarası ve e-posta adresiyle eşleşen bir sipariş bulunamadı. Lütfen bilgileri kontrol edin.
        </div>
      ) : null}

      {order ? (
        <section className="rounded-md border border-zinc-200 bg-white p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 pb-4">
            <div>
              <h2 className="font-mono text-lg font-semibold text-zinc-900">
                Sipariş #{order.number}
              </h2>
              <p className="text-xs text-zinc-600">
                Tarih: {format(order.placedAt, "dd MMMM yyyy HH:mm", { locale: tr })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="neutral">Ödeme: {order.paymentStatus}</Badge>
              <Badge variant="accent">Gönderim: {order.fulfillmentStatus}</Badge>
            </div>
          </div>

          <div className="divide-y divide-zinc-200">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between py-2.5 text-sm">
                <div>
                  <p className="font-medium text-zinc-900">{item.title}</p>
                  {item.variantTitle ? (
                    <p className="text-xs text-zinc-600">{item.variantTitle}</p>
                  ) : null}
                  <p className="text-xs text-zinc-600">Adet: {item.quantity}</p>
                </div>
                <span className="font-mono font-semibold text-zinc-900 tabular-nums">
                  {formatMoney(item.total)}
                </span>
              </div>
            ))}
          </div>

          {order.fulfillments.length > 0 ? (
            <div className="rounded border border-zinc-200 bg-zinc-50 p-3 text-xs space-y-1.5">
              <div className="font-semibold text-zinc-900">Kargo Gönderim Bilgileri</div>
              {order.fulfillments.map((f) => (
                <div key={f.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    Firma: <strong>{f.carrier || "Kargo"}</strong> | Takip No:{" "}
                    <span className="font-mono">{f.trackingNumber || "Hazırlanıyor"}</span>
                  </span>
                  {f.trackingUrl ? (
                    <a
                      href={f.trackingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-[#9a3412] underline"
                    >
                      Kargo Takip Bağlantısı
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          <div className="border-t border-zinc-200 pt-3 text-right font-mono text-base font-semibold text-zinc-900 tabular-nums">
            Toplam: {formatMoney(order.total)}
          </div>
        </section>
      ) : null}
    </div>
  );
}
