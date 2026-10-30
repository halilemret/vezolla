import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { processPendingEvents } from "@/lib/events";
import { runDueJobs } from "@/lib/jobs";
import { runFeedImport } from "@/modules/xml/importer";
import { rebuildProductAssociations } from "@/modules/personalization/recommendations";
import { runAutomatedCartRecoverySweep } from "@/modules/analytics/abandoned-cart";

export async function POST() {
  return executeScheduledTasks();
}

export async function GET() {
  return executeScheduledTasks();
}

async function executeScheduledTasks() {
  const now = new Date();
  const syncedFeeds: Array<{ id: string; name: string; status: string }> = [];

  try {
    // 1. Bekleyen domain olaylarını ve kuyruk işlerini çalıştır
    const [eventsProcessed, jobsProcessed] = await Promise.all([
      processPendingEvents(25),
      runDueJobs(15),
    ]);

    // 2. Zamanı gelen aktif XML kaynaklarını senkronla
    const dueSources = await db.feedSource.findMany({
      where: {
        isActive: true,
        scheduleMinutes: { gt: 0 },
        OR: [{ nextRunAt: { lte: now } }, { nextRunAt: null }],
      },
      take: 5,
    });

    for (const source of dueSources) {
      try {
        await runFeedImport(source.id, "APPLY", "schedule");
        syncedFeeds.push({ id: source.id, name: source.name, status: "SUCCESS" });
      } catch (err) {
        syncedFeeds.push({
          id: source.id,
          name: source.name,
          status: err instanceof Error ? err.message : "FAILED",
        });
      }
    }

    // 3. Birlikte görüntüleme ve satın alma ürün ilişkilerini güncelle
    const associations = await rebuildProductAssociations();

    // 4. Otomatik terk edilmiş sepet hatırlatması (ayar aktifse)
    const cartRecovery = await runAutomatedCartRecoverySweep();

    // 5. KVKK veri saklama politikası: 180 günü aşan anonim ziyaretçi olaylarını temizle
    const retentionCutoff = new Date(now.getTime() - 180 * 86_400_000);
    const purgedEvents = await db.visitorEvent.deleteMany({
      where: {
        createdAt: { lt: retentionCutoff },
      },
    });

    return NextResponse.json({
      ok: true,
      timestamp: now.toISOString(),
      eventsProcessed,
      jobsProcessed,
      syncedFeeds,
      associations,
      cartRecovery,
      purgedVisitorEvents: purgedEvents.count,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Zamanlanmış görev çalıştırılırken hata oluştu.",
      },
      { status: 500 }
    );
  }
}
