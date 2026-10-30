import { describe, expect, it } from "vitest";
import { calculateStockMovement } from "@/modules/inventory/service";

describe("Stok Servisi: Stok Hareketi Hesaplamaları", () => {
  it("RECEIVE, RETURN ve TRANSFER_IN hareketlerinde stoğu artırır", () => {
    const rec = calculateStockMovement(10, "RECEIVE", 15);
    expect(rec).toEqual({
      delta: 15,
      balanceAfter: 25,
      restockedFromZero: false,
    });

    const ret = calculateStockMovement(4, "RETURN", 2);
    expect(ret).toEqual({
      delta: 2,
      balanceAfter: 6,
      restockedFromZero: false,
    });

    const trIn = calculateStockMovement(0, "TRANSFER_IN", 8);
    expect(trIn).toEqual({
      delta: 8,
      balanceAfter: 8,
      restockedFromZero: true,
    });
  });

  it("SALE ve TRANSFER_OUT hareketlerinde stoğu düşürür ve 0'ın altına indirmez", () => {
    const sale = calculateStockMovement(12, "SALE", 5);
    expect(sale).toEqual({
      delta: -5,
      balanceAfter: 7,
      restockedFromZero: false,
    });

    const clamped = calculateStockMovement(3, "TRANSFER_OUT", 10);
    expect(clamped).toEqual({
      delta: -3,
      balanceAfter: 0,
      restockedFromZero: false,
    });
  });

  it("COUNT hareketinde fiziksel sayım değerine eşitler ve farkı delta olarak hesaplar", () => {
    const countUp = calculateStockMovement(10, "COUNT", 16);
    expect(countUp).toEqual({
      delta: 6,
      balanceAfter: 16,
      restockedFromZero: false,
    });

    const countDown = calculateStockMovement(16, "COUNT", 9);
    expect(countDown).toEqual({
      delta: -7,
      balanceAfter: 9,
      restockedFromZero: false,
    });
  });

  it("ADJUST ve IMPORT hareketlerinde işaretli değişimi uygular ve 0'dan pozitife geçişi tespit eder", () => {
    const adjNeg = calculateStockMovement(10, "ADJUST", -4);
    expect(adjNeg).toEqual({
      delta: -4,
      balanceAfter: 6,
      restockedFromZero: false,
    });

    const restock = calculateStockMovement(0, "IMPORT", 20);
    expect(restock).toEqual({
      delta: 20,
      balanceAfter: 20,
      restockedFromZero: true,
    });
  });
});
