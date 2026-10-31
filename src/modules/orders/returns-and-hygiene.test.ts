import { describe, expect, it } from "vitest";
import { generateReturnShippingCode } from "./service";
import { normalizeCarrierStatus } from "@/app/api/shipping/webhook/normalize";

describe("İç Giyim Hijyen İstisnası ve RMA İade Sistemi", () => {
  it("benzersiz ve 9 haneli kargo iade kodu (VEZ-XXX-XXX) üretir", () => {
    const code1 = generateReturnShippingCode();
    const code2 = generateReturnShippingCode();

    expect(code1).toMatch(/^VEZ-\d{3}-\d{3}$/);
    expect(code2).toMatch(/^VEZ-\d{3}-\d{3}$/);
    expect(code1).not.toBe(code2);
  });

  it("kargo webhook durumlarını doğru standart durumlara dönüştürür", () => {
    // Teslim edildi
    const delivered = normalizeCarrierStatus("TESLIM_EDILDI");
    expect(delivered.shipmentStatus).toBe("DELIVERED");
    expect(delivered.fulfillmentStatus).toBe("DELIVERED");
    expect(delivered.isDelivered).toBe(true);

    // Kurye dağıtımda
    const outForDelivery = normalizeCarrierStatus("OUT_FOR_DELIVERY");
    expect(outForDelivery.shipmentStatus).toBe("SHIPPED");
    expect(outForDelivery.fulfillmentStatus).toBe("SHIPPED");
    expect(outForDelivery.label).toContain("dağıtıma çıktı");

    // İade / Geri döndü
    const returned = normalizeCarrierStatus("GONDERENE_IADE");
    expect(returned.shipmentStatus).toBe("CANCELLED");
    expect(returned.fulfillmentStatus).toBe("RETURNED");
    expect(returned.isReturned).toBe(true);

    // Yolda / Transfer
    const inTransit = normalizeCarrierStatus("IN_TRANSIT");
    expect(inTransit.shipmentStatus).toBe("SHIPPED");
    expect(inTransit.fulfillmentStatus).toBe("SHIPPED");
  });
});
