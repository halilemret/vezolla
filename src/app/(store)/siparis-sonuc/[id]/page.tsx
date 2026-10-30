import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CheckCircle as CheckCircle2,
  Clock,
  Buildings as Building2,
  Truck,
  FileText,
  ArrowRight,
  Package,
} from "@phosphor-icons/react/dist/ssr";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { getPaymentSettings } from "@/lib/settings/service";
import { getPaymentMethodLabel } from "@/modules/payments/registry";
import { Badge } from "@/components/ui/badge";
import type { CheckoutAddress } from "@/modules/checkout/schemas";
import type { GeneratedContracts } from "@/modules/checkout/contracts";

export const metadata: Metadata = {
  title: "Sipariş Onayı",
};

interface OrderSuccessPageProps {
  params: Promise<{ id: string }>;
}

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  PAID: "Ödendi",
  AWAITING_TRANSFER: "Havale / EFT Bekleniyor",
  AWAITING_COD: "Kapıda Ödeme",
  PENDING: "Ödeme Bekleniyor",
  FAILED: "Ödeme Başarısız",
  REFUNDED: "İade Edildi",
};

export default async function OrderSuccessPage({
  params,
}: OrderSuccessPageProps) {
  const { id } = await params;

  const [order, paymentSettings] = await Promise.all([
    db.order.findUnique({
      where: { id },
      include: {
        items: true,
        payments: { orderBy: { createdAt: "desc" } },
        invoices: {
          where: { status: "ISSUED" },
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    getPaymentSettings(),
  ]);

  if (!order) {
    notFound();
  }

  const shippingAddr =
    order.shippingAddress && typeof order.shippingAddress === "object"
      ? (order.shippingAddress as unknown as CheckoutAddress)
      : null;

  const contracts =
    order.contracts && typeof order.contracts === "object"
      ? (order.contracts as unknown as GeneratedContracts)
      : null;

  const isBankTransfer = order.paymentMethod === "bank_transfer";
  const latestInvoice = order.invoices?.[0];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 space-y-8">
      {/* Üst Onay Kutusu */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Siparişiniz Alındı
              </p>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                Sipariş #{order.number}
              </h1>
              <p className="text-xs text-muted-foreground">
                Sipariş bilgilendirmesi{" "}
                <strong className="text-foreground">{order.email}</strong>{" "}
                adresine gönderilmiştir.
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <Badge
              variant={
                order.paymentStatus === "PAID"
                  ? "success"
                  : order.paymentStatus === "FAILED"
                  ? "danger"
                  : "warning"
              }
            >
              {PAYMENT_STATUS_LABEL[order.paymentStatus] ?? order.paymentStatus}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {new Date(order.placedAt).toLocaleString("tr-TR")}
            </span>
          </div>
        </div>
      </div>

      {/* Havale / EFT Banka Hesap Bilgileri */}
      {isBankTransfer && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Building2 className="h-4 w-4 text-warning" />
            <span>Havale / EFT Ödeme Bilgileri</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Lütfen{" "}
            <strong className="text-foreground">
              {formatMoney(order.total, order.currency)}
            </strong>{" "}
            tutarındaki ödemenizi aşağıdaki banka hesaplarından birine yaparken
            açıklama kısmına{" "}
            <strong className="font-mono text-foreground">
              #{order.number}
            </strong>{" "}
            sipariş numaranızı yazınız.
          </p>

          {paymentSettings.bankAccounts.length > 0 ? (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {paymentSettings.bankAccounts.map((acc, idx) => (
                <div
                  key={idx}
                  className="rounded-md border border-border bg-card p-3 text-xs space-y-1"
                >
                  <p className="font-semibold text-foreground">{acc.bankName}</p>
                  <p className="text-muted-foreground">
                    Alıcı: {acc.accountHolder}
                  </p>
                  <p className="font-mono font-medium text-foreground">
                    {acc.iban}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Banka hesap bilgileri sipariş onay e-postanızda yer almaktadır.
            </p>
          )}
        </div>
      )}

      {/* Sipariş Kalemleri ve Özet */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7 rounded-lg border border-border bg-card p-5 space-y-4">
          <h2 className="text-base font-semibold text-foreground">
            Sipariş Kalemleri ({order.items.length})
          </h2>

          <div className="divide-y divide-border">
            {order.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 py-3 text-sm"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-12 w-10 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-muted">
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Package className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">
                      {item.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.variantTitle ? `${item.variantTitle} • ` : ""}
                      {item.quantity} adet x{" "}
                      {formatMoney(item.unitPrice, order.currency)}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 font-semibold tabular-nums text-foreground">
                  {formatMoney(item.total, order.currency)}
                </span>
              </div>
            ))}
          </div>

          <dl className="space-y-1.5 border-t border-border pt-4 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <dt>Ara Toplam</dt>
              <dd className="tabular-nums text-foreground">
                {formatMoney(order.subtotal, order.currency)}
              </dd>
            </div>
            {order.discountTotal > 0 && (
              <div className="flex justify-between text-success">
                <dt>İndirim Toplamı</dt>
                <dd className="tabular-nums">
                  -{formatMoney(order.discountTotal, order.currency)}
                </dd>
              </div>
            )}
            <div className="flex justify-between text-muted-foreground">
              <dt>Kargo ({order.shippingMethodName ?? "Standart Kargo"})</dt>
              <dd className="tabular-nums text-foreground">
                {order.shippingTotal === 0
                  ? "Ücretsiz"
                  : formatMoney(order.shippingTotal, order.currency)}
              </dd>
            </div>
            {order.paymentFee > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <dt>Ödeme Hizmet Bedeli</dt>
                <dd className="tabular-nums text-foreground">
                  {formatMoney(order.paymentFee, order.currency)}
                </dd>
              </div>
            )}
            <div className="flex justify-between text-xs text-muted-foreground">
              <dt>Dahil KDV</dt>
              <dd className="tabular-nums">
                {formatMoney(order.taxTotal, order.currency)}
              </dd>
            </div>
            <div className="flex justify-between border-t border-border pt-2.5 text-base font-semibold text-foreground">
              <dt>Genel Toplam</dt>
              <dd className="tabular-nums">
                {formatMoney(order.total, order.currency)}
              </dd>
            </div>
          </dl>
        </div>

        {/* Sağ Kolon: Teslimat ve Ödeme Bilgileri */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-lg border border-border bg-card p-5 space-y-3 text-xs">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Truck className="h-4 w-4 text-primary" />
              <span>Teslimat ve Ödeme Özeti</span>
            </div>

            {shippingAddr && (
              <div className="space-y-1 text-muted-foreground">
                <p className="font-medium text-foreground">
                  {shippingAddr.firstName} {shippingAddr.lastName}
                </p>
                <p>{shippingAddr.line1}</p>
                <p>
                  {shippingAddr.neighborhood
                    ? `${shippingAddr.neighborhood}, `
                    : ""}
                  {shippingAddr.district} / {shippingAddr.city}
                </p>
                <p>Tel: {order.phone}</p>
              </div>
            )}

            <div className="border-t border-border pt-2.5 space-y-1 text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">
                  Ödeme Yöntemi:
                </span>{" "}
                {getPaymentMethodLabel(order.paymentMethod ?? "iyzico")}
              </p>
              <p>
                <span className="font-medium text-foreground">
                  Kargo Yöntemi:
                </span>{" "}
                {order.shippingMethodName ?? "Standart Kargo"}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <Link
              href={`/siparis-takip?orderNumber=${order.number}&email=${encodeURIComponent(order.email)}`}
              className="flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-xs font-medium text-primary-foreground hover:opacity-90"
            >
              <Clock className="h-4 w-4" />
              Sipariş Durumunu Takip Et
            </Link>
            <Link
              href="/hesabim"
              className="flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-card px-4 text-xs font-medium text-foreground hover:bg-muted"
            >
              Hesabım ve Siparişlerim
            </Link>
            <Link
              href="/katalog"
              className="flex h-10 items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              Alışverişe Devam Et
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* e-Fatura / e-Arşiv Belgesi */}
      {latestInvoice ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 text-xs">
          <div>
            <div className="font-semibold text-emerald-950">
              Resmî {latestInvoice.invoiceType === "EFATURA" ? "e-Fatura" : "e-Arşiv Fatura"} Belgeniz Hazır
            </div>
            <div className="mt-0.5 font-mono text-emerald-800">
              Fatura No: {latestInvoice.invoiceNumber}
            </div>
          </div>
          <a
            href={`/admin/faturalar/${latestInvoice.invoiceNumber}/yazdir`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center justify-center rounded-md border border-emerald-300 bg-white px-3 font-medium text-emerald-800 hover:bg-emerald-50"
          >
            Faturayı Görüntüle / İndir
          </a>
        </div>
      ) : null}

      {/* Sözleşme Kopyası */}
      {contracts && (
        <details className="rounded-lg border border-border bg-card p-5">
          <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-foreground">
            <FileText className="h-4 w-4 text-primary" />
            <span>
              Onaylanan Ön Bilgilendirme Formu ve Mesafeli Satış Sözleşmesi
            </span>
          </summary>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
            <div>
              <h3 className="font-semibold text-foreground mb-1">
                Ön Bilgilendirme Formu
              </h3>
              <pre className="max-h-60 overflow-y-auto rounded border border-border bg-muted/30 p-3 whitespace-pre-wrap font-sans text-muted-foreground">
                {contracts.preInformation}
              </pre>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-1">
                Mesafeli Satış Sözleşmesi
              </h3>
              <pre className="max-h-60 overflow-y-auto rounded border border-border bg-muted/30 p-3 whitespace-pre-wrap font-sans text-muted-foreground">
                {contracts.distanceSales}
              </pre>
            </div>
          </div>
        </details>
      )}
    </div>
  );
}
