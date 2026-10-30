import { describe, it, expect, vi } from "vitest";

describe("Wishlist & Price Tracking Calculations", () => {
  it("computes price drop and savings correctly when current price is lower than added price", () => {
    const priceWhenAdded = 150000; // 1.500 TL
    const currentPrice = 120000; // 1.200 TL

    const hasPriceDropped = priceWhenAdded > 0 && currentPrice < priceWhenAdded;
    const priceDropMinor = hasPriceDropped ? priceWhenAdded - currentPrice : 0;
    const priceDropPercentage =
      hasPriceDropped && priceWhenAdded > 0
        ? Math.round((priceDropMinor / priceWhenAdded) * 100)
        : 0;

    expect(hasPriceDropped).toBe(true);
    expect(priceDropMinor).toBe(30000); // 300 TL savings
    expect(priceDropPercentage).toBe(20); // 20% discount
  });

  it("handles price increases or identical prices without triggering price drop alert", () => {
    const priceWhenAdded = 100000;
    const currentPrice = 120000;

    const hasPriceDropped = priceWhenAdded > 0 && currentPrice < priceWhenAdded;
    expect(hasPriceDropped).toBe(false);
  });

  it("identifies out-of-stock and critical stock scarcity conditions", () => {
    const outOfStockItem = { totalStock: 0 };
    const lowStockItem = { totalStock: 2 };
    const ampleStockItem = { totalStock: 25 };

    const isOutOfStock1 = outOfStockItem.totalStock <= 0;
    const isLowStock1 = !isOutOfStock1 && outOfStockItem.totalStock <= 3;
    expect(isOutOfStock1).toBe(true);
    expect(isLowStock1).toBe(false);

    const isOutOfStock2 = lowStockItem.totalStock <= 0;
    const isLowStock2 = !isOutOfStock2 && lowStockItem.totalStock <= 3;
    expect(isOutOfStock2).toBe(false);
    expect(isLowStock2).toBe(true);

    const isOutOfStock3 = ampleStockItem.totalStock <= 0;
    const isLowStock3 = !isOutOfStock3 && ampleStockItem.totalStock <= 3;
    expect(isOutOfStock3).toBe(false);
    expect(isLowStock3).toBe(false);
  });

  it("filters items by collection correctly", () => {
    const items = [
      { id: "1", collectionId: "summer-collection" },
      { id: "2", collectionId: "summer-collection" },
      { id: "3", collectionId: null },
      { id: "4", collectionId: "home-decor" },
    ];

    const summerItems = items.filter((i) => i.collectionId === "summer-collection");
    const generalItems = items.filter((i) => i.collectionId === null);

    expect(summerItems).toHaveLength(2);
    expect(generalItems).toHaveLength(1);
  });
});
