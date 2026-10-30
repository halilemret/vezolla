import { NextResponse, type NextRequest } from "next/server";
import { generateExportFeedXmlByToken } from "@/modules/xml/exporter";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
): Promise<NextResponse> {
  const { token } = await context.params;
  const origin =
    request.nextUrl.origin ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000";

  const result = await generateExportFeedXmlByToken(token, origin);
  if (!result) {
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Hata>Dışa aktarma beslemesi bulunamadı veya pasif durumda.</Hata>`,
      {
        status: 404,
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
        },
      }
    );
  }

  return new NextResponse(result.xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
