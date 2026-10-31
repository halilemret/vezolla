import { describe, it, expect } from "vitest";
import { maskCustomerName, formatTimeAgo } from "./helpers";

describe("Social Proof & Recent Sales Masking", () => {
  describe("maskCustomerName", () => {
    it("isim ve soyismin ilk harfini koruyup geri kalanını yıldızlar ve ilçe ekler", () => {
      const res = maskCustomerName("Emre", "Yılmaz", "Kadıköy", "İstanbul");
      expect(res.customerName).toBe("E*** Y.");
      expect(res.location).toBe("Kadıköy");
    });

    it("ilçe boş olduğunda ili konuma koyar", () => {
      const res = maskCustomerName("Deniz", "Kaya", null, "İzmir");
      expect(res.customerName).toBe("D*** K.");
      expect(res.location).toBe("İzmir");
    });

    it("soyisim olmadığında yalnızca adı maskeler", () => {
      const res = maskCustomerName("Burak", null, "Beşiktaş", "İstanbul");
      expect(res.customerName).toBe("B***");
      expect(res.location).toBe("Beşiktaş");
    });

    it("küçük harfli veya Türkçe karakterli isim ve konumları düzgün biçimlendirir", () => {
      const res = maskCustomerName("ömer", "şahin", "kadıköy", "istanbul");
      expect(res.customerName).toBe("Ö*** Ş.");
      expect(res.location).toBe("Kadıköy");
    });

    it("isim ve soyisim tamamen boş olduğunda güvenli anonim değer üretir", () => {
      const res = maskCustomerName(null, null, null, null);
      expect(res.customerName).toBe("M***");
      expect(res.location).toBe("Türkiye");
    });
  });

  describe("formatTimeAgo", () => {
    const baseNow = new Date("2026-10-31T12:00:00Z");

    it("1 dakikadan az süre için 'Az önce' döner", () => {
      const d = new Date(baseNow.getTime() - 25 * 1000);
      expect(formatTimeAgo(d, baseNow)).toBe("Az önce");
    });

    it("dakika bazında 'X dakika önce' döner", () => {
      const d = new Date(baseNow.getTime() - 15 * 60 * 1000);
      expect(formatTimeAgo(d, baseNow)).toBe("15 dakika önce");
    });

    it("saat bazında 'X saat önce' döner", () => {
      const d = new Date(baseNow.getTime() - 4 * 60 * 60 * 1000);
      expect(formatTimeAgo(d, baseNow)).toBe("4 saat önce");
    });

    it("24 saatten eski için 'Dün' döner", () => {
      const d = new Date(baseNow.getTime() - 30 * 60 * 60 * 1000);
      expect(formatTimeAgo(d, baseNow)).toBe("Dün");
    });
  });
});
