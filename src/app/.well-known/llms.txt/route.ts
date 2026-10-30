import { NextResponse } from "next/server";
import { generateLlmsTxtContent } from "@/modules/seo/service";

export const dynamic = "force-dynamic";

export async function GET() {
  const content = await generateLlmsTxtContent();
  return new NextResponse(content, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
