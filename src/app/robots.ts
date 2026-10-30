import type { MetadataRoute } from "next";
import { getSeoGeoSettings } from "@/modules/seo/service";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const settings = await getSeoGeoSettings();
  const baseUrl = settings.canonicalBaseUrl || process.env.APP_URL || "http://localhost:3000";

  const rules: MetadataRoute.Robots["rules"] = [
    {
      userAgent: "*",
      allow: "/",
      disallow: settings.robotsDisallowPaths,
    },
  ];

  // AI Bot İzinleri
  const botMap = [
    { key: "gptBot", agent: "GPTBot" },
    { key: "perplexityBot", agent: "PerplexityBot" },
    { key: "claudeBot", agent: "ClaudeBot" },
    { key: "googleExtended", agent: "Google-Extended" },
    { key: "applebot", agent: "Applebot-Extended" },
  ] as const;

  for (const item of botMap) {
    const perm = settings.aiBotPermissions[item.key];
    if (perm === "DISALLOW") {
      rules.push({
        userAgent: item.agent,
        disallow: ["/"],
      });
    } else {
      rules.push({
        userAgent: item.agent,
        allow: ["/"],
      });
    }
  }

  return {
    rules,
    sitemap: `${baseUrl.replace(/\/$/, "")}/sitemap.xml`,
  };
}
