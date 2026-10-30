import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { requireStaff } from "@/lib/auth/session";
import { formatMoney } from "@/lib/money";
import { getInvoiceDetail } from "@/modules/invoicing/service";
import { getStoreSettings } from "@/lib/settings/service";
import { Button } from "@/components/ui/button";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

function numberToTurkishWords(amountMinor: number): string {
  const units = ["", "Bir", "İki", "Üç", "Dört", "Beş", "Altı", "Yedi", "Sekiz", "Dokuz"];
  const tens = ["", "On", "Yirmi", "Otuz", "Kırk", "Elli", "Altmış", "Yetmiş", "Seksen", "Doksan"];

  function convertTriple(n: number): string {
    let str = "";
    const h = Math.floor(n / 100);
    const t = Math.floor((n % 100) / 10);
    const u = n % 10;
    if (h > 0) {
      str += h === 1 ? "Yüz" : (units[h] ?? "") + "Yüz";
    }
    if (t > 0) {
      str += tens[t] ?? "";
    }
    if (u > 0) {
      str += units[u] ?? "";
    }
    return str;
  }

  const liras = Math.floor(amountMinor / 100);
  const kurus = amountMinor % 100;

  if (liras === 0 && kurus === 0) return "Sıfır Türk Lirası";

  let lirasText = "";
  const thousands = Math.floor(liras / 1000);
  const remainder = liras % 1000;

  if (thousands > 0) {
    lirasText += thousands === 1 ? "Bin" : convertTriple(thousands) + "Bin";
  }
  if (remainder > 0) {
    lirasText += convertTriple(remainder);
  }

  let result = (lirasText || "Sıfır") + " TL";
  if (kurus > 0) {
    result += " " + convertTriple(kurus) + " Krş";
  }
  return result;
}

export default async function InvoicePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff("orders.read");
  const { id } = await params;

  const invoice = await getInvoiceDetail(id);
  if (!invoice) {
    notFound();
  }

  const store = await getStoreSettings();

  const recipientAddr =
    invoice.recipientAddress && typeof invoice.recipientAddress === "object"
      ? (invoice.recipientAddress as Record<string, string>)
      : {};

  const taxBreakdown = Array.isArray(invoice.taxBreakdown)
    ? (invoice.taxBreakdown as Array<{
        rateBps: number;
        taxableAmountMinor: number;
        taxAmountMinor: number;
      }>)
    : [];

  const items = invoice.order.items || [];
  const wordsTotal = numberToTurkishWords(invoice.total);

  return (
    <div className="min-h-screen bg-zinc-100 p-4 sm:p-6 print:bg-white print:p-0">
      {/* Yazdırma ve İndirme Çubuğu (Baskıda gizlenir) */}
      <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white p-3 shadow-sm print:hidden">
        <div className="flex items-center gap-2">
          <Link href={`/admin/siparisler/${invoice.orderId}`}>
            <Button variant="outline" size="sm">
              &larr; Siparişe Dön (#{invoice.order.number})
            </Button>
          </Link>
          <span className="font-mono text-xs font-semibold text-zinc-900">
            {invoice.invoiceNumber}
          </span>
          <span className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
            {invoice.invoiceType === "EFATURA" ? "e-Fatura" : "e-Arşiv Fatura"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/api/admin/invoices/${invoice.id}/ubl`}
            download={`${invoice.invoiceNumber}.xml`}
            className="inline-flex h-8 items-center justify-center rounded-md border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
          >
            UBL-TR XML İndir
          </a>
          <PrintButton />
        </div>
      </div>

      {/* A4 Ebatında Resmî e-Fatura / e-Arşiv Belgesi */}
      <div className="relative mx-auto max-w-[210mm] border border-zinc-300 bg-white p-8 text-zinc-900 shadow-md print:max-w-none print:border-none print:p-0 print:shadow-none">
        {/* Başlık ve e-Belge Logosu */}
        <div className="flex items-start justify-between border-b-2 border-zinc-900 pb-4">
          <div>
            <div className="text-xl font-black tracking-widest text-zinc-950">
              {store.storeName || "VEZOLLA"}
            </div>
            <div className="mt-0.5 text-xs font-semibold text-zinc-800">
              {store.companyLegalName || "Vezolla Tekstil ve Mağazacılık A.Ş."}
            </div>
            <div className="mt-1 text-[11px] text-zinc-600 space-y-0.5 max-w-sm">
              <div>{store.address}, {store.district} / {store.city}</div>
              <div>
                Vergi Dairesi: {store.taxOffice} | Vergi No: {store.taxNumber}
              </div>
              <div>
                Tic. Sicil / Mersis: {store.mersisNumber} | KEP: {store.kepAddress}
              </div>
              <div>Tel: {store.supportPhone} | E-posta: {store.supportEmail}</div>
            </div>
          </div>

          <div className="text-right">
            <div className="inline-block border-2 border-red-700 bg-red-50/60 px-3 py-1 font-mono text-sm font-bold uppercase tracking-wider text-red-700">
              {invoice.invoiceType === "EFATURA" ? "e-FATURA" : "e-ARŞİV FATURA"}
            </div>
            <div className="mt-2 text-xs font-mono space-y-0.5">
              <div>
                <span className="text-zinc-500">Fatura No: </span>
                <strong className="text-zinc-950">{invoice.invoiceNumber}</strong>
              </div>
              <div>
                <span className="text-zinc-500">Tarih: </span>
                <span>{format(invoice.issueDate, "dd.MM.yyyy HH:mm:ss", { locale: tr })}</span>
              </div>
              <div className="text-[10px] text-zinc-500">
                <span>ETTN: </span>
                <span className="font-mono">{invoice.ettn}</span>
              </div>
              <div className="text-[11px]">
                <span className="text-zinc-500">Senaryo: </span>
                <strong className="text-zinc-800">
                  {invoice.profile === "TICARI_FATURA"
                    ? "Ticari Fatura"
                    : invoice.profile === "TEMEL_FATURA"
                      ? "Temel Fatura"
                      : "e-Arşiv Fatura"}
                </strong>
              </div>
              <div className="text-[11px]">
                <span className="text-zinc-500">Fatura Tipi: </span>
                <strong className="text-zinc-800">SATIŞ</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Alıcı ve Sipariş Bilgileri */}
        <div className="mt-4 grid grid-cols-2 gap-6 border-b border-zinc-200 pb-4 text-xs">
          <div className="rounded border border-zinc-200 bg-zinc-50/50 p-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
              SAYIN (ALICI)
            </div>
            <div className="mt-1 font-bold text-zinc-900 text-sm">
              {invoice.recipientTitle}
            </div>
            <div className="mt-1 text-zinc-700 space-y-0.5 text-[11px]">
              <div>
                <span className="text-zinc-500">TCKN / VKN: </span>
                <span className="font-mono font-medium text-zinc-900">
                  {invoice.recipientTaxNumber}
                </span>
                {invoice.recipientTaxOffice ? ` (${invoice.recipientTaxOffice} V.D.)` : ""}
              </div>
              <div>{recipientAddr.line1 || "-"}</div>
              <div>
                {recipientAddr.district || ""}{recipientAddr.district ? " / " : ""}
                {recipientAddr.city || ""} {recipientAddr.postalCode || ""}
              </div>
              {invoice.recipientEmail ? <div>E-posta: {invoice.recipientEmail}</div> : null}
              {invoice.recipientPhone ? <div>Tel: {invoice.recipientPhone}</div> : null}
            </div>
          </div>

          <div className="rounded border border-zinc-200 bg-zinc-50/50 p-3 text-[11px] space-y-1.5">
            <div className="font-bold uppercase tracking-wider text-zinc-500">
              SİPARİŞ VE TESLİMAT BİLGİLERİ
            </div>
            <div>
              <span className="text-zinc-500">Sipariş No: </span>
              <strong className="font-mono text-zinc-900">#{invoice.order.number}</strong>
            </div>
            <div>
              <span className="text-zinc-500">Düzenleme Tarihi: </span>
              <span>{format(invoice.issueDate, "dd MMMM yyyy", { locale: tr })}</span>
            </div>
            <div>
              <span className="text-zinc-500">Ödeme Şekli: </span>
              <span className="font-medium text-zinc-800">{invoice.provider} / Peşin</span>
            </div>
            <div>
              <span className="text-zinc-500">Para Birimi: </span>
              <span className="font-mono font-bold text-zinc-900">{invoice.currency}</span>
            </div>
          </div>
        </div>

        {/* Kalemler Tablosu */}
        <div className="mt-4 overflow-hidden border border-zinc-200 text-xs">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-100 text-[11px] font-bold text-zinc-700">
                <th className="p-2 text-center w-8">#</th>
                <th className="p-2 text-left">Mal / Hizmet Açıklaması</th>
                <th className="p-2 text-center w-16">Miktar</th>
                <th className="p-2 text-right w-24">Birim Fiyat</th>
                <th className="p-2 text-right w-20">İskonto</th>
                <th className="p-2 text-center w-14">KDV %</th>
                <th className="p-2 text-right w-20">KDV Tutarı</th>
                <th className="p-2 text-right w-24">Mal Hizmet Tutarı</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-[11px]">
              {items.map((it, idx) => {
                const lineNet = Math.max(0, it.quantity * it.unitPrice - it.discountAmount);
                const baseBeforeTax = lineNet - it.taxAmount;
                const vatPct = (it.taxRateBps / 100).toFixed(0);

                return (
                  <tr key={it.id}>
                    <td className="p-2 text-center font-mono text-zinc-500">{idx + 1}</td>
                    <td className="p-2">
                      <div className="font-medium text-zinc-900">{it.title}</div>
                      {it.variantTitle ? (
                        <div className="text-[10px] text-zinc-500">Varyant: {it.variantTitle}</div>
                      ) : null}
                      {it.sku ? (
                        <div className="font-mono text-[10px] text-zinc-400">SKU: {it.sku}</div>
                      ) : null}
                    </td>
                    <td className="p-2 text-center font-mono">{it.quantity} Adet</td>
                    <td className="p-2 text-right font-mono tabular-nums">
                      {formatMoney(it.unitPrice)}
                    </td>
                    <td className="p-2 text-right font-mono tabular-nums text-zinc-600">
                      {it.discountAmount > 0 ? formatMoney(it.discountAmount) : "-"}
                    </td>
                    <td className="p-2 text-center font-mono font-medium">%{vatPct}</td>
                    <td className="p-2 text-right font-mono tabular-nums">
                      {formatMoney(it.taxAmount)}
                    </td>
                    <td className="p-2 text-right font-mono font-semibold tabular-nums text-zinc-900">
                      {formatMoney(baseBeforeTax)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Alt KDV ve Dip Toplamlar Bölümü */}
        <div className="mt-4 grid grid-cols-2 gap-6 text-xs">
          {/* Sol: KDV Kırılımları ve Notlar */}
          <div className="space-y-3">
            <div className="rounded border border-zinc-200 bg-zinc-50/50 p-2.5">
              <div className="text-[11px] font-bold text-zinc-700">KDV Matrah Dağılımı</div>
              <table className="mt-1 w-full text-[11px]">
                <thead>
                  <tr className="border-b border-zinc-200 text-zinc-500 text-[10px]">
                    <th className="text-left pb-1">Oran</th>
                    <th className="text-right pb-1">KDV Matrahı</th>
                    <th className="text-right pb-1">Hesaplanan KDV</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200/60 font-mono text-[11px]">
                  {taxBreakdown.map((tb, idx) => (
                    <tr key={idx}>
                      <td className="py-1">%{ (tb.rateBps / 100).toFixed(0) }</td>
                      <td className="py-1 text-right tabular-nums">{formatMoney(tb.taxableAmountMinor)}</td>
                      <td className="py-1 text-right tabular-nums font-semibold">{formatMoney(tb.taxAmountMinor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded border border-zinc-200 bg-zinc-50 p-2.5 text-[10px] text-zinc-600 space-y-1">
              <div>
                <strong>Not:</strong> İşbu e-Arşiv/e-Fatura 213 sayılı Vergi Usul Kanunu uyarınca elektronik ortamda düzenlenmiş ve imzalanmıştır.
              </div>
              <div>
                <strong>Yalnız:</strong> {wordsTotal}
              </div>
            </div>
          </div>

          {/* Sağ: Dip Toplamlar */}
          <div className="rounded border border-zinc-200 bg-zinc-50/40 p-3 space-y-1.5 font-mono text-xs">
            <div className="flex justify-between text-zinc-600">
              <span>Mal/Hizmet Toplamı:</span>
              <span className="tabular-nums">{formatMoney(invoice.subtotal)}</span>
            </div>
            {invoice.discountTotal > 0 ? (
              <div className="flex justify-between text-emerald-700">
                <span>Toplam İskonto:</span>
                <span className="tabular-nums">-{formatMoney(invoice.discountTotal)}</span>
              </div>
            ) : null}
            <div className="flex justify-between text-zinc-600">
              <span>KDV Matrahı (Net):</span>
              <span className="tabular-nums">
                {formatMoney(invoice.subtotal - invoice.taxTotal - invoice.discountTotal)}
              </span>
            </div>
            <div className="flex justify-between text-zinc-600">
              <span>Hesaplanan Toplam KDV:</span>
              <span className="tabular-nums font-semibold">{formatMoney(invoice.taxTotal)}</span>
            </div>
            <div className="border-t-2 border-zinc-900 pt-1.5 text-sm font-bold text-zinc-950 flex justify-between">
              <span>Ödenecek Toplam Tutar:</span>
              <span className="tabular-nums">{formatMoney(invoice.total)}</span>
            </div>
          </div>
        </div>

        {/* İmzacı / Onay Alanı */}
        <div className="mt-8 flex justify-between items-end border-t border-zinc-200 pt-4 text-[11px] text-zinc-500">
          <div>
            <div>e-İmza ile Onaylanmıştır</div>
            <div className="font-mono text-[10px] text-zinc-400">Doğrulama Kodu: {invoice.ettn.slice(0, 18)}</div>
          </div>
          <div className="text-right">
            <div className="font-bold text-zinc-800">{store.companyLegalName || "Vezolla Tekstil ve Mağazacılık A.Ş."}</div>
            <div className="text-[10px]">Kaşe ve Elektronik Mühür</div>
          </div>
        </div>
      </div>
    </div>
  );
}
