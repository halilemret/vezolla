import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/session";
import { getInvoiceDetail } from "@/modules/invoicing/service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireStaff("orders.read");
  } catch {
    return new NextResponse("Yetkisiz erişim", { status: 401 });
  }

  const { id } = await params;
  const invoice = await getInvoiceDetail(id);

  if (!invoice || !invoice.ublXml) {
    return new NextResponse("Fatura veya UBL XML içeriği bulunamadı.", { status: 404 });
  }

  return new NextResponse(invoice.ublXml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${invoice.invoiceNumber}.xml"`,
    },
  });
}
