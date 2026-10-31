import { describe, expect, it } from "vitest";
import { calculateBraSize } from "./fit-finder-modal";

describe("Akıllı Sütyen & Beden Bulucu (calculateBraSize)", () => {
  it("75 cm göğüs altı ve 88 cm göğüs çevresi için 75B hesaplar", () => {
    // 75 cm alt -> 75 bandı
    // 88 - 75 = 13 cm fark -> B Cup (12-14 cm)
    const result = calculateBraSize(75, 88);
    expect(result.band).toBe(75);
    expect(result.cup).toBe("B");
    expect(result.fullSize).toBe("75B");
    expect(result.differenceCm).toBe(13);
  });

  it("80 cm göğüs altı ve 95 cm göğüs çevresi için 80C hesaplar", () => {
    // 80 cm alt -> 80 bandı
    // 95 - 80 = 15 cm fark -> C Cup (14-16 cm)
    const result = calculateBraSize(80, 95);
    expect(result.band).toBe(80);
    expect(result.cup).toBe("C");
    expect(result.fullSize).toBe("80C");
  });

  it("küçük farklarda AA ve A cup sonuçlarını verir", () => {
    const resAA = calculateBraSize(70, 78); // 8 cm fark
    expect(resAA.band).toBe(70);
    expect(resAA.cup).toBe("AA");
    expect(resAA.fullSize).toBe("70AA");

    const resA = calculateBraSize(70, 81); // 11 cm fark
    expect(resA.band).toBe(70);
    expect(resA.cup).toBe("A");
    expect(resA.fullSize).toBe("70A");
  });

  it("büyük farklarda D, E, F cup sonuçlarını doğru verir", () => {
    const resD = calculateBraSize(85, 102); // 17 cm fark -> D Cup
    expect(resD.cup).toBe("D");
    expect(resD.fullSize).toBe("85D");

    const resE = calculateBraSize(85, 104); // 19 cm fark -> E Cup
    expect(resE.cup).toBe("E");
    expect(resE.fullSize).toBe("85E");

    const resF = calculateBraSize(85, 106); // 21 cm fark -> F Cup
    expect(resF.cup).toBe("F");
    expect(resF.fullSize).toBe("85F");
  });

  it("kardeş bedenleri (sister sizes) doğru türetir", () => {
    // 80B için:
    // Daha sıkı sırt: 75C
    // Daha rahat sırt: 85A
    const result = calculateBraSize(80, 93); // 13 cm fark -> 80B
    expect(result.fullSize).toBe("80B");
    expect(result.sisterSizeLo).toBe("75C");
    expect(result.sisterSizeHi).toBe("85A");
  });

  it("aşırı uç bedenlerde (dar sırt <63cm ve geniş sırt >103cm) sınırları güvenle hesaplar", () => {
    const petite = calculateBraSize(60, 74); // 60 bandı, 14 cm fark -> B Cup
    expect(petite.band).toBe(60);
    expect(petite.fullSize).toBe("60B");
    expect(petite.sisterSizeLo).toBe("60C"); // 60'ın altına düşmez

    const plus = calculateBraSize(110, 130); // 110 bandı, 20 cm fark -> E Cup
    expect(plus.band).toBe(110);
    expect(plus.fullSize).toBe("110E");
    expect(plus.sisterSizeHi).toBe("110D"); // 110'un üstüne çıkmaz
  });
});
