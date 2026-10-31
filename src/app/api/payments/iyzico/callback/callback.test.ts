import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockCancelOrder,
  mockSendTransactionalEmail,
  mockEmitDomainEvent,
  mockVerifyToken,
  mockDb,
} = vi.hoisted(() => {
  return {
    mockCancelOrder: vi.fn(async () => ({ ok: true })),
    mockSendTransactionalEmail: vi.fn(async () => {}),
    mockEmitDomainEvent: vi.fn(async () => {}),
    mockVerifyToken: vi.fn(),
    mockDb: {
      payment: {
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      order: {
        update: vi.fn(),
      },
      orderEvent: {
        create: vi.fn(),
      },
      cart: {
        updateMany: vi.fn(),
      },
      $transaction: vi.fn(async (ops: unknown[]) => ops),
    },
  };
});

vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/modules/orders/service", () => ({ cancelOrder: mockCancelOrder }));
vi.mock("@/lib/mail", () => ({ sendTransactionalEmail: mockSendTransactionalEmail }));
vi.mock("@/lib/events", () => ({ emitDomainEvent: mockEmitDomainEvent }));
vi.mock("@/modules/payments/iyzico", () => ({ verifyIyzicoCheckoutToken: mockVerifyToken }));
vi.mock("@/lib/settings/service", () => ({ getPaymentSettings: vi.fn(async () => ({})) }));
vi.mock("@/modules/invoicing/auto-invoicing", () => ({}));

import { GET, POST } from "./route";

describe("iyzico Callback Rotası ve Yaşam Döngüsü", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("token eksikse /odeme sayfasına hata mesajıyla yönlendirir", async () => {
    const req = new Request("http://localhost:3000/api/payments/iyzico/callback?token=", {
      method: "GET",
    });
    const res = await GET(req);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/odeme?error=Odeme+anahtari+bulunamadi");
  });

  it("ödeme kaydı bulunamadığında /odeme sayfasına hata mesajıyla yönlendirir", async () => {
    mockVerifyToken.mockResolvedValueOnce({ ok: false, errorMessage: "Geçersiz token" });
    mockDb.payment.findFirst.mockResolvedValueOnce(null);

    const req = new Request("http://localhost:3000/api/payments/iyzico/callback?token=unknown-token", {
      method: "GET",
    });
    const res = await GET(req);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/odeme?error=Odeme+kaydi+bulunamadi");
  });

  it("idempotency: sipariş zaten PAID durumundaysa mükerrer e-posta atmadan doğrudan sonuca yönlendirir", async () => {
    mockVerifyToken.mockResolvedValueOnce({ ok: true, paymentId: "pay-123" });
    mockDb.payment.findFirst.mockResolvedValueOnce({
      id: "pay-rec-1",
      orderId: "ord-100",
      amount: 50000,
      order: {
        id: "ord-100",
        number: 1042,
        paymentStatus: "PAID",
        currency: "TRY",
        total: 50000,
        email: "test@example.com",
      },
    });

    const req = new Request("http://localhost:3000/api/payments/iyzico/callback?token=token-paid", {
      method: "GET",
    });
    const res = await GET(req);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("http://localhost:3000/siparis-sonuc/ord-100");
    // Mükerrer e-posta veya domain eventi tetiklenmemeli
    expect(mockSendTransactionalEmail).not.toHaveBeenCalled();
    expect(mockEmitDomainEvent).not.toHaveBeenCalled();
  });

  it("ödeme başarısız olduğunda stok rezervasyonunu serbest bırakır (cancelOrder) ve sepeti korur", async () => {
    mockVerifyToken.mockResolvedValueOnce({
      ok: false,
      errorMessage: "Yetersiz kart limiti",
      conversationId: "ord-200",
    });
    mockDb.payment.findFirst.mockResolvedValueOnce({
      id: "pay-rec-2",
      orderId: "ord-200",
      amount: 30000,
      order: {
        id: "ord-200",
        number: 1043,
        paymentStatus: "PENDING",
        status: "OPEN",
        currency: "TRY",
        total: 30000,
        email: "fail@example.com",
      },
    });

    const req = new Request("http://localhost:3000/api/payments/iyzico/callback?token=token-fail", {
      method: "GET",
    });
    const res = await GET(req);
    expect(res.status).toBe(303);
    const location = decodeURIComponent(res.headers.get("location") ?? "");
    expect(location).toContain("/odeme?error=Yetersiz kart limiti");

    // Zombi rezervasyonu engellemek için cancelOrder çağrılmalı
    expect(mockCancelOrder).toHaveBeenCalledWith({
      orderId: "ord-200",
      reason: expect.stringContaining("Yetersiz kart limiti"),
    });

    // Müşteri sepeti korunmalı (completedAt: null)
    expect(mockDb.cart.updateMany).toHaveBeenCalledWith({
      where: { orderId: "ord-200" },
      data: { completedAt: null },
    });
  });

  it("ödeme başarılı olduğunda sepeti tamamlar, e-posta gönderir ve çerezi siler", async () => {
    mockVerifyToken.mockResolvedValueOnce({
      ok: true,
      paymentId: "iyz-pay-999",
      conversationId: "ord-300",
      raw: { test: true },
    });
    mockDb.payment.findFirst.mockResolvedValueOnce({
      id: "pay-rec-3",
      orderId: "ord-300",
      amount: 45000,
      order: {
        id: "ord-300",
        number: 1044,
        paymentStatus: "PENDING",
        status: "OPEN",
        currency: "TRY",
        total: 45000,
        email: "success@example.com",
        shippingAddress: { firstName: "Ayşe", lastName: "Yılmaz" },
      },
    });

    const req = new Request("http://localhost:3000/api/payments/iyzico/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "token-success", orderId: "ord-300" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("http://localhost:3000/siparis-sonuc/ord-300");

    // E-posta ve domain event tetiklenmeli
    expect(mockSendTransactionalEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "success@example.com",
        templateKey: "order_placed",
      })
    );
    expect(mockEmitDomainEvent).toHaveBeenCalledWith(
      "order.paid",
      expect.objectContaining({ orderId: "ord-300" })
    );
  });
});
