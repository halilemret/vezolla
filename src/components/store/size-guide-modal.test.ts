import { describe, expect, it } from "vitest";
import { resolveSizeGuideKind } from "./size-guide-modal";

describe("SizeGuideModal: resolveSizeGuideKind", () => {
  it("sizeGuideType NONE olduğunda NONE döner", () => {
    expect(resolveSizeGuideKind("NONE", "İç Giyim", "Ürün")).toBe("NONE");
  });

  it("sizeGuideType BRA olduğunda BRA döner", () => {
    expect(resolveSizeGuideKind("BRA", "Elbise", "Ürün")).toBe("BRA");
  });

  it("sizeGuideType CLOTHING olduğunda CLOTHING döner", () => {
    expect(resolveSizeGuideKind("CLOTHING", "Sütyen", "Sütyen Modeli")).toBe("CLOTHING");
  });

  it("sizeGuideType CUSTOM veya sizeGuideData varsa CUSTOM döner", () => {
    expect(resolveSizeGuideKind("CUSTOM", "Elbise", "Ürün")).toBe("CUSTOM");
    expect(resolveSizeGuideKind(null, "Elbise", "Ürün", "<table>...</table>")).toBe("CUSTOM");
  });

  it("kategori veya başlıkta sütyen/bra geçtiğinde otomatik BRA döner", () => {
    expect(resolveSizeGuideKind(null, "Sütyen Takımları", "Dantelli Model")).toBe("BRA");
    expect(resolveSizeGuideKind(null, "İç Giyim", "Destekli Bralet")).toBe("BRA");
    expect(resolveSizeGuideKind(null, "Genel", "Balenli Push-up Bra")).toBe("BRA");
  });

  it("kategori giyim/külot olduğunda varsayılan olarak CLOTHING döner", () => {
    expect(resolveSizeGuideKind(null, "Külot & Şort", "Dikişsiz Külot")).toBe("CLOTHING");
    expect(resolveSizeGuideKind(null, "Pijama & Sabahlık", "Saten Gecelik")).toBe("CLOTHING");
    expect(resolveSizeGuideKind(null, null, "Saten Elbise")).toBe("CLOTHING");
  });
});
