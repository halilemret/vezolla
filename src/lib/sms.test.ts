import { describe, expect, it, vi } from "vitest";
import {
  normalizeTurkishPhoneNumber,
  sendSms,
  sendOrderConfirmedSms,
  sendShippingUpdateSms,
  sendReturnCodeSms,
  sendAbandonedCartRecoverySms,
} from "./sms";
import { db } from "@/lib/db";

describe("SMS Bildirim Motoru ve İYS Filtresi (sms.ts)", () => {
  it("Türkiye telefon numaralarını doğru normalize eder", () => {
    expect(normalizeTurkishPhoneNumber("05321234567")).toBe("905321234567");
    expect(normalizeTurkishPhoneNumber("5321234567")).toBe("905321234567");
    expect(normalizeTurkishPhoneNumber("+90 532 123 45 67")).toBe("905321234567");
    expect(normalizeTurkishPhoneNumber("00905321234567")).toBe("905321234567");
    expect(normalizeTurkishPhoneNumber("905321234567")).toBe("905321234567");
    expect(normalizeTurkishPhoneNumber("123")).toBeNull();
  });

  it("işlemsel (transactional) SMS'leri İYS onayı gerekmeksizin gönderir (mock)", async () => {
    const res = await sendSms({
      to: "05321234567",
      message: "Siparişiniz onaylandı",
      isCommercial: false,
    });

    expect(res.ok).toBe(true);
    expect(res.isMock).toBe(true);
  });

  it("müşteri kimliği olmayan ticari SMS'leri reddeder", async () => {
    const res = await sendSms({
      to: "05321234567",
      message: "Fırsat indirimi kaçırma!",
      isCommercial: true,
      customerId: null,
    });

    expect(res.ok).toBe(false);
    expect(res.skipped).toBe(true);
    expect(res.error).toContain("İYS_CONSENT_REQUIRED");
  });

  it("pazarlama izni (acceptsMarketing) olmayan müşteriye ticari SMS gönderimini engeller", async () => {
    // Müşteri bulmayı mockla: acceptsMarketing = false
    const findUniqueSpy = vi.spyOn(db.customer, "findUnique").mockResolvedValueOnce({
      acceptsMarketing: false,
      marketingConsentAt: null,
    } as unknown as Awaited<ReturnType<typeof db.customer.findUnique>>);

    const res = await sendAbandonedCartRecoverySms({
      phone: "05321234567",
      customerId: "cust-no-consent",
      recoveryUrl: "https://vezolla.com/sepet?token=123",
    });

    expect(findUniqueSpy).toHaveBeenCalled();
    expect(res.ok).toBe(false);
    expect(res.skipped).toBe(true);
    expect(res.error).toContain("IYS_CONSENT_REQUIRED");
  });

  it("pazarlama izni olan müşteriye ticari SMS gönderimine izin verir", async () => {
    vi.spyOn(db.customer, "findUnique").mockResolvedValueOnce({
      acceptsMarketing: true,
      marketingConsentAt: new Date(),
    } as unknown as Awaited<ReturnType<typeof db.customer.findUnique>>);

    const res = await sendAbandonedCartRecoverySms({
      phone: "05321234567",
      customerId: "cust-with-consent",
      recoveryUrl: "https://vezolla.com/sepet?token=123",
      discountCode: "DONUSUM10",
    });

    expect(res.ok).toBe(true);
  });

  it("sipariş onay ve kargo takip işlemsel SMS yardımcılarını çalıştırır", async () => {
    const orderSms = await sendOrderConfirmedSms({
      phone: "05551234567",
      number: 1042,
      total: 125000,
      currency: "TRY",
    });
    expect(orderSms.ok).toBe(true);

    const shipSms = await sendShippingUpdateSms({
      phone: "05551234567",
      number: 1042,
      carrier: "Yurtiçi Kargo",
      trackingNumber: "123456789",
    });
    expect(shipSms.ok).toBe(true);

    const returnSms = await sendReturnCodeSms({
      phone: "05551234567",
      number: 1042,
      returnCode: "VEZ-123-456",
      carrierCode: "YURTICI",
    });
    expect(returnSms.ok).toBe(true);
  });
});
