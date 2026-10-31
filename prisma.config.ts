import "dotenv/config";
import { config as loadDotenv } from "dotenv";
import { defineConfig, env } from "prisma/config";

// Next.js .env.local önceliğini yükle
if (process.env.FORCE_LOCAL_DB !== "1") {
  loadDotenv({ path: ".env.local", override: true });
}

const activeDbUrl =
  process.env.FORCE_LOCAL_DB === "1"
    ? "postgresql://postgres:postgres@localhost:5433/eticaret"
    : (process.env.DATABASE_URL &&
      !process.env.DATABASE_URL.includes("localhost:5433")
        ? process.env.DATABASE_URL
        : process.env.STORAGE_DATABASE_URL ||
          process.env.STORAGE_POSTGRES_URL ||
          process.env.DATABASE_URL) ??
      "postgresql://postgres:postgres@localhost:5433/eticaret";

export default defineConfig({
  schema: "prisma/schema",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx --conditions=react-server prisma/seed.ts",
  },
  datasource: {
    url: activeDbUrl,
  },
});
