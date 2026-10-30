import "dotenv/config";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(
  /\/+$/,
  ""
);
const INTERVAL_MS = 60_000;

async function tick() {
  const started = new Date().toISOString();
  try {
    const res = await fetch(`${APP_URL}/api/cron`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
      console.warn(`[worker ${started}] Cron yanıt kodu: ${res.status}`);
      return;
    }
    const data = (await res.json()) as Record<string, unknown>;
    console.log(
      `[worker ${started}] Tamamlandı: olay=${String(data.eventsProcessed ?? 0)}, iş=${String(data.jobsProcessed ?? 0)}`
    );
  } catch (err) {
    console.warn(
      `[worker ${started}] Uygulama henüz erişilebilir değil (${
        err instanceof Error ? err.message : "bağlantı hatası"
      })`
    );
  }
}

console.log(
  `Arka plan görev işçisi başlatıldı. Hedef: ${APP_URL}/api/cron (Aralık: ${INTERVAL_MS / 1000} sn)`
);
void tick();
setInterval(() => {
  void tick();
}, INTERVAL_MS);
