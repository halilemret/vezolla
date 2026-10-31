import { describe, expect, it, vi } from "vitest";
import {
  earnLoyaltyPoints,
  redeemLoyaltyPoints,
  POINT_VALUE_KURUS,
  PHOTO_REVIEW_POINTS,
  TEXT_REVIEW_POINTS,
} from "./service";
import { db } from "@/lib/db";

describe("Vezolla Club: Puan ve Sadakat Altyapısı (loyalty/service.ts)", () => {
  it("puan sabitlerini doğru tanımlar", () => {
    expect(POINT_VALUE_KURUS).toBe(50); // 10 Puan = 5.00 TL (1 Puan = 50 Kuruş; 100 Puan = 50 TL)
    expect(PHOTO_REVIEW_POINTS).toBe(25); // Fotoğraflı yorum: 25 Puan
    expect(TEXT_REVIEW_POINTS).toBe(10); // Metinli yorum: 10 Puan
  });

  it("tamamlanan alışveriş ve fotoğraflı yorumlar için puan kazandırır", async () => {
    vi.spyOn(db.customer, "findUnique").mockResolvedValueOnce({
      id: "cust-1",
      loyaltyPoints: 50,
    } as unknown as Awaited<ReturnType<typeof db.customer.findUnique>>);

    const txSpy = vi.spyOn(db, "$transaction").mockResolvedValueOnce([{}, {}] as never);

    const res = await earnLoyaltyPoints({
      customerId: "cust-1",
      points: PHOTO_REVIEW_POINTS,
      reason: "PHOTO_REVIEW",
      reviewId: "rev-123",
    });

    expect(res.ok).toBe(true);
    expect(res.newBalance).toBe(75);
    expect(txSpy).toHaveBeenCalled();
  });

  it("yetersiz bakiye durumunda puan kullanımını engeller", async () => {
    vi.spyOn(db.customer, "findUnique").mockResolvedValueOnce({
      id: "cust-1",
      loyaltyPoints: 20,
    } as unknown as Awaited<ReturnType<typeof db.customer.findUnique>>);

    const res = await redeemLoyaltyPoints({
      customerId: "cust-1",
      points: 50,
    });

    expect(res.ok).toBe(false);
    expect(res.error).toContain("Yetersiz puan bakiyesi");
    expect(res.discountMinor).toBe(0);
  });

  it("yeterli bakiye durumunda puanı indirime çevirir ve bakiyeyi düşer", async () => {
    vi.spyOn(db.customer, "findUnique").mockResolvedValueOnce({
      id: "cust-1",
      loyaltyPoints: 100,
    } as unknown as Awaited<ReturnType<typeof db.customer.findUnique>>);

    vi.spyOn(db, "$transaction").mockResolvedValueOnce([{}, {}] as never);

    const res = await redeemLoyaltyPoints({
      customerId: "cust-1",
      points: 40,
      orderId: "ord-1",
    });

    expect(res.ok).toBe(true);
    expect(res.newBalance).toBe(60);
    // 40 puan * 50 kuruş = 2000 kuruş (20.00 TL)
    expect(res.discountMinor).toBe(2000);
  });

  it("sepete puan indirimi uygularken %20 tavan kuralını zorunlu kılar", async () => {
    // Müşterinin 500 puanı var (250 TL). Sepet ara toplamı 1000 TL (100.000 kuruş).
    // %20 tavan: Maksimum 200 TL (20.000 kuruş = 400 puan).
    vi.spyOn(db.customer, "findUnique").mockResolvedValueOnce({
      id: "cust-1",
      loyaltyPoints: 500,
    } as unknown as Awaited<ReturnType<typeof db.customer.findUnique>>);

    vi.spyOn(db.cart, "update").mockResolvedValueOnce({} as never);

    const { applyLoyaltyDiscountToCart } = await import("./service");
    const res = await applyLoyaltyDiscountToCart({
      cartId: "cart-1",
      customerId: "cust-1",
      pointsToUse: 400, // 400 puan * 0.50 TL = 200 TL
      subtotalMinor: 100000, // 1000 TL
    });

    expect(res.ok).toBe(true);
    expect(res.pointsApplied).toBe(400); // 400 puana tavanlandı (200 TL = %20)
    expect(res.discountMinor).toBe(20000); // 200.00 TL (20.000 kuruş)
  });
});
