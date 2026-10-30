import * as React from "react";
import { requireStaff } from "@/lib/auth/session";
import {
  ensureDefaultSeoData,
  getSeoGeoSettings,
  runSeoGeoAudit,
  getAuditHistory,
  getKeywordsWithHistory,
  getBotCrawlLogs,
  getPerformanceMetrics,
} from "@/modules/seo/service";
import { SeoGeoClient } from "./seo-geo-client";

export const dynamic = "force-dynamic";

export default async function AdminSeoGeoPage() {
  await requireStaff();

  // Varsayılan izleme verileri yoksa tohumla
  await ensureDefaultSeoData();

  const [settings, audit, auditHistory, keywords, botLogs, metrics] = await Promise.all([
    getSeoGeoSettings(),
    runSeoGeoAudit(),
    getAuditHistory(15),
    getKeywordsWithHistory(),
    getBotCrawlLogs(50),
    getPerformanceMetrics(30),
  ]);

  return (
    <SeoGeoClient
      settings={settings}
      audit={audit}
      auditHistory={auditHistory}
      keywords={keywords}
      botLogs={botLogs}
      metrics={metrics}
    />
  );
}
