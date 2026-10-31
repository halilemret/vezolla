import { describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { db } from "@/lib/db";

describe("Kargo Webhook Entegrasyonu (/api/shipping/webhook)", () => {
  it("takip numarası ve sipariş numarası eksikse 400 döner", async () => {
    const req = new Request("http://localhost:3000/api/shipping/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "IN_TRANSIT" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("zorunludur");
  });

  it("gönderi veritabanında bulunamadığında 404 döner", async () => {
    vi.spyOn(db.fulfillment, "findFirst").mockResolvedValueOnce(null);

    const req = new Request("http://localhost:3000/api/shipping/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trackingNumber: "NON_EXISTING_TRACKING_9999",
        status: "DELIVERED",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toContain("bulunamadı");
  });

  it("orderNumber string olarak gönderilse bile doğru işler", async () => {
    vi.spyOn(db.fulfillment, "findFirst").mockResolvedValueOnce(null);

    // Veritabanında olmayan string sipariş numarası testi (hata fırlatmadan 404 dönmeli)
    const req = new Request("http://localhost:3000/api/shipping/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderNumber: "999999",
        status: "DELIVERED",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
  });
});
