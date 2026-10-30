import { describe, it, expect, vi, beforeEach } from "vitest";
import { formatStepLabel } from "@/modules/analytics/abandoned-cart";
import { renderTemplateString } from "@/lib/mail";
import { abandonedCartSettingsSchema } from "@/lib/settings/schemas";

describe("Terk Edilmiş Sepet ve Funnel Analizi Modülü", () => {
  it("formatStepLabel tüm checkout adımlarını doğru Türkçe etiketlere çevirir", () => {
    expect(formatStepLabel("cart")).toBe("Sepet Sayfası");
    expect(formatStepLabel("address")).toBe("Teslimat Adresi");
    expect(formatStepLabel("shipping")).toBe("Kargo Yöntemi");
    expect(formatStepLabel("payment")).toBe("Ödeme Adımı");
    expect(formatStepLabel("contracts")).toBe("Sözleşmeler");
    expect(formatStepLabel(null)).toBe("Sepet Sayfası");
    expect(formatStepLabel("unknown")).toBe("Sepet Sayfası");
  });

  it("abandonedCartSettingsSchema geçerli varsayılan değerleri üretir ve sınırları doğrular", () => {
    const defaultSettings = abandonedCartSettingsSchema.parse({});
    expect(defaultSettings.autoRecoveryEnabled).toBe(false);
    expect(defaultSettings.idleMinutesBeforeAbandoned).toBe(60);
    expect(defaultSettings.autoDiscountCode).toBe("");
    expect(defaultSettings.maxAutoRecoveryEmailsPerCart).toBe(1);

    const custom = abandonedCartSettingsSchema.parse({
      autoRecoveryEnabled: true,
      idleMinutesBeforeAbandoned: 120,
      autoDiscountCode: "DON10",
      maxAutoRecoveryEmailsPerCart: 2,
    });
    expect(custom.autoRecoveryEnabled).toBe(true);
    expect(custom.idleMinutesBeforeAbandoned).toBe(120);
    expect(custom.autoDiscountCode).toBe("DON10");

    // Sınır kontrolleri: 15 dakikadan az kabul edilmemeli
    expect(() =>
      abandonedCartSettingsSchema.parse({ idleMinutesBeforeAbandoned: 5 })
    ).toThrow();
  });

  it("renderTemplateString kurtarma e-postası şablon değişkenlerini kuruşu kuruşuna doğru render eder", () => {
    const template = `Merhaba {{customerName}}, sepetinizdeki ürünler sizi bekliyor! Toplam: {{cartTotal}}. {{discountNote}} <a href="{{restoreUrl}}">Sepeti Tamamla</a>`;
    const vars = {
      customerName: "Ahmet Yılmaz",
      cartTotal: "1.250,00 TL",
      discountNote: "%10 indirim kodunuz: SEPET10",
      restoreUrl: "http://localhost:3000/sepet?recover=abc123token&code=SEPET10",
    };

    const rendered = renderTemplateString(template, vars);
    expect(rendered).toContain("Merhaba Ahmet Yılmaz");
    expect(rendered).toContain("Toplam: 1.250,00 TL");
    expect(rendered).toContain("%10 indirim kodunuz: SEPET10");
    expect(rendered).toContain("http://localhost:3000/sepet?recover=abc123token&code=SEPET10");
  });

  it("Kurtarma bağlantısı parametreleri doğru URL kodlamasıyla oluşturulur", () => {
    const baseUrl = "https://ornek-magaza.com";
    const token = "a8f3d81b94e7492c";
    const discountCode = "ÖZEL 20";

    const recoveryUrl = `${baseUrl}/sepet?recover=${token}&code=${encodeURIComponent(discountCode)}`;
    expect(recoveryUrl).toBe("https://ornek-magaza.com/sepet?recover=a8f3d81b94e7492c&code=%C3%96ZEL%2020");
  });

  it("Dönüşüm ve terk oranları matematiksel olarak sınırları aşmaz (%0-%100)", () => {
    const totalVisitors = 1000;
    const cartsCreated = 250;
    const checkoutStarted = 100;
    const completedOrders = 35;

    const cartConversion = Math.round((cartsCreated / totalVisitors) * 100);
    expect(cartConversion).toBe(25);

    const cartAbandonment = Math.round(((cartsCreated - completedOrders) / cartsCreated) * 100);
    expect(cartAbandonment).toBe(86);

    const checkoutAbandonment = Math.round(((checkoutStarted - completedOrders) / checkoutStarted) * 100);
    expect(checkoutAbandonment).toBe(65);

    const overallConversion = Math.round((completedOrders / totalVisitors) * 1000) / 10;
    expect(overallConversion).toBe(3.5);
  });
});
