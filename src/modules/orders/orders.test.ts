import { describe, expect, it } from "vitest";

describe("Sipariş, İade (RMA) ve Kargo İş Mantığı (orders)", () => {
  it("iade talebinde satır bazlı orantılı iade tutarını (net indirim sonrası) doğru hesaplar", () => {
    // 2 adet ürün, birim fiyat 1.000 TL, toplam 2.000 TL, 400 TL indirim uygulanmış -> satır neti: 1.600 TL
    const orderItem = {
      id: "item-1",
      quantity: 2,
      returnedQuantity: 0,
      unitPrice: 100000,
      discountAmount: 40000,
      total: 160000, // net ödenecek
    };

    // 1 adet iade talep edildiğinde orantılı iade tutarı 800 TL (80.000 kuruş) olmalıdır
    const qtyToReturn = 1;
    const maxReturnable = Math.max(0, orderItem.quantity - orderItem.returnedQuantity);
    const validQty = Math.min(qtyToReturn, maxReturnable);
    const lineRefundMinor = Math.round((orderItem.total * validQty) / orderItem.quantity);

    expect(validQty).toBe(1);
    expect(lineRefundMinor).toBe(80000);
  });

  it("önceden iade edilmiş miktar varsa aşırı iadeyi engeller", () => {
    const orderItem = {
      id: "item-2",
      quantity: 3,
      returnedQuantity: 2, // 2 adedi zaten iade edilmiş, sadece 1 adet iade edilebilir
      total: 300000,
    };

    const requestedQty = 2; // Müşteri 2 adet daha iade etmek istiyor
    const maxReturnable = Math.max(0, orderItem.quantity - orderItem.returnedQuantity);
    const validQty = Math.min(requestedQty, maxReturnable);

    expect(maxReturnable).toBe(1);
    expect(validQty).toBe(1);
  });

  it("maksimum iade edilebilir tutar, sipariş toplamından önceki iadeler düşülerek hesaplanır", () => {
    const orderTotal = 250000; // 2.500 TL
    const refundedTotal = 100000; // 1.000 TL daha önce iade edilmiş

    const maxRefundable = Math.max(0, orderTotal - refundedTotal);
    expect(maxRefundable).toBe(150000); // Kalan en fazla 1.500 TL iade edilebilir

    // Siparişin tamamı iade edildiğinde 0 kalmalıdır
    const fullyRefunded = Math.max(0, orderTotal - 250000);
    expect(fullyRefunded).toBe(0);
  });

  it("kalan kargolanacak adetleri fulfillment durumuna göre hesaplar", () => {
    const orderItems = [
      { id: "i-1", quantity: 5, fulfilledQuantity: 2 },
      { id: "i-2", quantity: 1, fulfilledQuantity: 1 },
      { id: "i-3", quantity: 3, fulfilledQuantity: 0 },
    ];

    const unfulfilledItems = orderItems
      .map((item) => ({
        id: item.id,
        remaining: item.quantity - item.fulfilledQuantity,
      }))
      .filter((i) => i.remaining > 0);

    expect(unfulfilledItems).toEqual([
      { id: "i-1", remaining: 3 },
      { id: "i-3", remaining: 3 },
    ]);
  });
});
