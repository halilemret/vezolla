import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/events", () => ({
  processPendingEvents: vi.fn(async () => 0),
}));
vi.mock("@/lib/jobs", () => ({
  runDueJobs: vi.fn(async () => 0),
}));
vi.mock("@/modules/xml/importer", () => ({
  runFeedImport: vi.fn(),
}));
vi.mock("@/modules/personalization/recommendations", () => ({
  rebuildProductAssociations: vi.fn(async () => ({ pairsUpdated: 0 })),
}));
vi.mock("@/modules/analytics/abandoned-cart", () => ({
  runAutomatedCartRecoverySweep: vi.fn(async () => ({ sent: 0, skipped: 0 })),
}));
vi.mock("@/modules/loyalty/service", () => ({
  maturePendingLoyaltyPoints: vi.fn(async () => ({ maturedCount: 0, pointsMatured: 0 })),
}));
vi.mock("@/lib/db", () => ({
  db: {
    feedSource: { findMany: vi.fn(async () => []) },
    visitorEvent: { deleteMany: vi.fn(async () => ({ count: 0 })) },
  },
}));

import { GET, POST } from "./route";

describe("CRON Rotası Güvenlik ve Yetkilendirme Denetimi", () => {
  const originalEnv = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = "test-secret-token-123";
  });

  afterEach(() => {
    process.env.CRON_SECRET = originalEnv;
  });

  it("başlıksız veya anahtarsız isteklerde 401 Unauthorized döner", async () => {
    const req = new Request("http://localhost:3000/api/cron", {
      method: "POST",
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { ok: boolean; error: string };
    expect(body.ok).toBe(false);
    expect(body.error).toContain("Yetkisiz erişim");
  });

  it("yanlış Bearer token ile 401 Unauthorized döner", async () => {
    const req = new Request("http://localhost:3000/api/cron", {
      method: "POST",
      headers: {
        Authorization: "Bearer wrong-secret",
      },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("doğru Authorization: Bearer ${CRON_SECRET} ile 200 OK döner", async () => {
    const req = new Request("http://localhost:3000/api/cron", {
      method: "POST",
      headers: {
        Authorization: "Bearer test-secret-token-123",
      },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it("boşluklu veya küçük harfli Bearer token ile 200 OK döner", async () => {
    const req = new Request("http://localhost:3000/api/cron", {
      method: "POST",
      headers: {
        Authorization: "bearer   test-secret-token-123",
      },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it("üretim (production) ortamında secret tanımlı değilse 401 döner", async () => {
    delete process.env.CRON_SECRET;
    vi.stubEnv("NODE_ENV", "production");
    try {
      const req = new Request("http://localhost:3000/api/cron", {
        method: "POST",
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
