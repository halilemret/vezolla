import { NextResponse, type NextRequest } from "next/server";
import { generateLlmsTxtContent, recordBotCrawl } from "@/modules/seo/service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const userAgent = request.headers.get("user-agent") ?? "";
  const ip = request.headers.get("x-forwarded-for") ?? undefined;

  // AI botlarını veya tarayıcıları tespit edip loglayalım
  let detectedBot: string | null = null;
  let botCategory = "AI_AGENT";

  if (/GPTBot|ChatGPT/i.test(userAgent)) {
    detectedBot = "GPTBot (ChatGPT)";
  } else if (/PerplexityBot/i.test(userAgent)) {
    detectedBot = "PerplexityBot";
  } else if (/ClaudeBot|Anthropic/i.test(userAgent)) {
    detectedBot = "ClaudeBot";
  } else if (/Google-Extended|Googlebot/i.test(userAgent)) {
    detectedBot = "Googlebot/Extended";
    botCategory = "SEARCH_ENGINE";
  } else if (/Applebot/i.test(userAgent)) {
    detectedBot = "Applebot";
  }

  if (detectedBot) {
    try {
      await recordBotCrawl({
        botName: detectedBot,
        botCategory,
        path: "/llms.txt",
        statusCode: 200,
        ip,
        userAgent,
      });
    } catch {
      // Loglama hatası içeriği engellemesin
    }
  }

  const content = await generateLlmsTxtContent();

  return new NextResponse(content, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
