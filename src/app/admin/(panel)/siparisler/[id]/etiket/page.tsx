import Link from "next/link";
import { notFound } from "next/navigation";
import { toSVG } from "bwip-js/node";
import { requireStaff } from "@/lib/auth/session";
import { getCarrierLabel } from "@/modules/shipping/carriers";
import { loadShippingLabel } from "@/modules/orders/label";
import { PrintLabelButton } from "./print-label-button";

export const dynamic = "force-dynamic";

function formatTl(minor: number): string {
  return `${Math.floor(minor / 100).toLocaleString("tr-TR")},${String(minor % 100).padStart(2, "0")} TL`;
}

export default async function AdminShippingLabelPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ fulfillmentId?: string }>;
}) {
  await requireStaff("orders.read");
  const { id } = await params;
  const { fulfillmentId } = await searchParams;

  const label = await loadShippingLabel(id, fulfillmentId);
  if (!label) {
    notFound();
  }

  const { data } = label;
  const barcodeSvg = toSVG({
    bcid: "code128",
    text: data.barcode,
    scale: 3,
    height: 18,
    includetext: false,
  });
  const zplHref = `/api/admin/orders/${label.orderId}/label?fulfillmentId=${label.fulfillmentId}`;

  return (
    <div className="space-y-6">
      <style>{"@media print { @page { size: 100mm 150mm; margin: 0; } }"}</style>

      <div className="flex flex-col justify-between gap-3 rounded-md border border-zinc-200 bg-white p-4 sm:flex-row sm:items-center print:hidden">
        <div className="text-xs text-zinc-700">
          <strong>Kargo Etiketi (#{data.orderNumber})</strong>: 100x150 mm termal yazıcı için
          hazırlandı. Yazıcı ayarlarında kenar boşluğunu kapatın. Zebra uyumlu yazıcıya doğrudan
          göndermek için ZPL dosyasını indirin.
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PrintLabelButton />
          <a
            href={zplHref}
            download
            className="inline-flex min-h-9 items-center justify-center rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-900 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
          >
            ZPL İndir (.zpl)
          </a>
          <Link
            href={`/admin/siparisler/${label.orderId}`}
            className="inline-flex min-h-9 items-center justify-center rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-900 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
          >
            Sipariş Detayına Dön
          </Link>
        </div>
      </div>

      <div
        className="mx-auto border-2 border-black bg-white p-[4mm] text-black print:mx-0 print:border-0"
        style={{ width: "100mm", minHeight: "150mm" }}
      >
        <div className="border-b-2 border-black pb-[2mm]">
          <div className="text-[13px] font-bold leading-tight">{data.sender.name}</div>
          <div className="text-[9px] leading-snug">
            {data.sender.line1}, {data.sender.district} / {data.sender.city}
          </div>
        </div>

        <div className="border-b-2 border-black py-[3mm]">
          <div className="text-[9px] font-semibold uppercase tracking-wider">Alıcı</div>
          <div className="text-[18px] font-bold leading-tight">{data.recipient.name}</div>
          <div className="mt-1 text-[12px] leading-snug">{data.recipient.line1}</div>
          <div className="mt-1 text-[16px] font-bold">
            {data.recipient.district} / {data.recipient.city}
          </div>
          <div className="mt-1 font-mono text-[12px]">Tel: {data.recipient.phone}</div>
        </div>

        <div className="py-[3mm]">
          <div className="text-[10px] font-semibold">{getCarrierLabel(data.carrierCode)}</div>
          <div className="text-[13px] font-bold">
            Sipariş No: #{data.orderNumber}
            {data.parcelLabel ? <span className="ml-3">{data.parcelLabel}</span> : null}
          </div>

          {data.codAmountMinor !== null && data.codAmountMinor > 0 ? (
            <div className="mt-2 bg-black px-3 py-2 text-[16px] font-bold text-white">
              KAPIDA ÖDEME: {formatTl(data.codAmountMinor)}
            </div>
          ) : null}

          <div className="mt-2 text-[9px] leading-snug">{data.itemSummary}</div>
        </div>

        <div className="border-t-2 border-black pt-[4mm] text-center">
          <div
            className="mx-auto w-full"
            role="img"
            aria-label={`Kargo barkodu ${data.barcode}`}
            dangerouslySetInnerHTML={{ __html: barcodeSvg }}
          />
          <div className="mt-1 font-mono text-[14px] font-bold tracking-widest">
            {data.barcode}
          </div>
        </div>
      </div>
    </div>
  );
}
