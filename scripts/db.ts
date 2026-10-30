/**
 * Lokal geliştirme veritabanı. Kurulum gerektirmeyen gerçek PostgreSQL'i
 * `.data/postgres` altında başlatır. Canlıda kullanılmaz; orada DATABASE_URL
 * yönetilen bir Postgres'i (Neon, Supabase vb.) gösterir.
 */
import "dotenv/config";
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import path from "node:path";

const url = new URL(process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5433/eticaret");
const databaseDir = path.resolve(".data/postgres");
const dbName = url.pathname.replace(/^\//, "") || "eticaret";

const pg = new EmbeddedPostgres({
  databaseDir,
  user: decodeURIComponent(url.username || "postgres"),
  password: decodeURIComponent(url.password || "postgres"),
  port: Number(url.port || 5433),
  persistent: true,
  // Windows'ta "Turkish_Türkiye.1254" gibi ASCII dışı yerel ayar adları initdb'yi bozuyor.
  // libc için C, sıralama için ICU tr-TR kullanılıyor (İ/ı, Ş, Ç doğru sıralanır).
  initdbFlags: ["--encoding=UTF8", "--locale=C", "--locale-provider=icu", "--icu-locale=tr-TR"],
  onLog: () => {},
  onError: (message) => console.error("[postgres]", message),
});

async function main() {
  const firstRun = !existsSync(path.join(databaseDir, "PG_VERSION"));
  if (firstRun) {
    console.log("İlk çalıştırma: veritabanı klasörü oluşturuluyor...");
    await pg.initialise();
  }
  await pg.start();
  try {
    await pg.createDatabase(dbName);
    console.log(`"${dbName}" veritabanı oluşturuldu.`);
  } catch {
    // Veritabanı zaten var
  }
  console.log(`PostgreSQL hazır: ${url.host}/${dbName}  (durdurmak için Ctrl+C)`);

  const shutdown = async () => {
    console.log("\nPostgreSQL durduruluyor...");
    await pg.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch(async (error: unknown) => {
  console.error(error);
  await pg.stop().catch(() => {});
  process.exit(1);
});
