import { NextResponse, type NextRequest } from "next/server";
import { buildSampleSupplierXml } from "@/modules/xml/parser";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const xml = buildSampleSupplierXml();
  const shouldDownload = request.nextUrl.searchParams.get("indir") === "1";

  const headers: Record<string, string> = {
    "Content-Type": "application/xml; charset=utf-8",
    "Cache-Control": "no-store, max-age=0",
  };

  if (shouldDownload) {
    headers["Content-Disposition"] =
      'attachment; filename="ornek-tedarikci-urunler.xml"';
  }

  return new NextResponse(xml, {
    status: 200,
    headers,
  });
}
