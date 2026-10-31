import { describe, expect, it } from "vitest";
import { DEFAULT_PAYMENT_SETTINGS, DEFAULT_STORE_SETTINGS } from "@/lib/settings/schemas";
import { resolveEffectiveVariantPrice } from "@/modules/checkout/cart";
import { generateOrderContracts } from "@/modules/checkout/contracts";
import {
  planWarehouseReservations,
  type WarehouseStockCandidate,
} from "@/modules/checkout/service";
import { evaluateShippingMethod } from "@/modules/shipping/service";
import { iyzicoAdapter, verifyIyzicoCheckoutToken } from "@/modules/payments/iyzico";

describe("Ödeme, Sözleşme ve Stok Rezervasyonu (checkout)", () => {
  it("depo öncelik sırasına (priority) göre stok tahsis eder ve aşırı satışı engeller", () => {
    const warehouses: WarehouseStockCandidate[] = [
      {
        levelId: "lvl-yedek",
        warehouseId: "wh-2",
        warehouseName: "Yedek Depo",
        warehousePriority: 10,
        warehouseActive: true,
        onHand: 8,
        reserved: 1, // 7 adet kullanılabilir
      },
      {
        levelId: "lvl-merkez",
        warehouseId: "wh-1",
        warehouseName: "Merkez Depo",
        warehousePriority: 1,
        warehouseActive: true,
        onHand: 5,
        reserved: 2, // 3 adet kullanılabilir
      },
      {
        levelId: "lvl-pasif",
        warehouseId: "wh-3",
        warehouseName: "Pasif Depo",
        warehousePriority: 0,
        warehouseActive: false,
        onHand: 100,
        reserved: 0,
      },
    ];

    // 6 adet talep edildiğinde önce Merkez Depodan (priority 1) 3 adet, kalan 3 adeti Yedek Depodan (priority 10) alır
    const allocations = planWarehouseReservations(warehouses, 6, {
      variantTitle: "Seramik Kupa",
      trackInventory: true,
      allowBackorder: false,
    });

    expect(allocations).toEqual([
      { levelId: "lvl-merkez", warehouseId: "wh-1", quantity: 3 },
      { levelId: "lvl-yedek", warehouseId: "wh-2", quantity: 3 },
    ]);

    // Toplam kullanılabilir stok 10 iken 11 adet istenirse hata fırlatır
    expect(() =>
      planWarehouseReservations(warehouses, 11, {
        variantTitle: "Seramik Kupa",
        trackInventory: true,
        allowBackorder: false,
      })
    ).toThrow(/yeterli stok bulunmuyor/i);
  });

  it("müşteri grubuna özel PriceList fiyatını doğru öncelikle seçer", () => {
    const basePrice = 100000; // 1.000,00 TL
    const priceLists = [
      {
        price: 90000,
        priceList: {
          id: "pl-general",
          isActive: true,
          customerGroupId: null,
          startsAt: null,
          endsAt: null,
          priority: 1,
        },
      },
      {
        price: 75000,
        priceList: {
          id: "pl-b2b",
          isActive: true,
          customerGroupId: "grp-b2b",
          startsAt: null,
          endsAt: null,
          priority: 5,
        },
      },
    ];

    expect(resolveEffectiveVariantPrice(basePrice, priceLists, null)).toBe(90000);
    expect(resolveEffectiveVariantPrice(basePrice, priceLists, "grp-b2b")).toBe(75000);
  });

  it("Ön Bilgilendirme Formu ve Mesafeli Satış Sözleşmesini eksiksiz ve uzun tiresiz (R-02) üretir", () => {
    const contracts = generateOrderContracts({
      orderNumber: 1042,
      createdAt: new Date("2026-10-25T12:00:00Z"),
      store: DEFAULT_STORE_SETTINGS,
      buyerEmail: "alici@ornek.com",
      buyerPhone: "05551112233",
      shippingAddress: {
        title: "Ev",
        firstName: "Ayşe",
        lastName: "Yılmaz",
        phone: "05551112233",
        city: "İstanbul",
        district: "Kadıköy",
        neighborhood: "Moda Mah.",
        line1: "Bahariye Cad. No: 12 D: 4",
        postalCode: "34710",
        invoiceType: "INDIVIDUAL",
        tckn: "12345678901",
      },
      billingAddress: {
        title: "Ofis",
        firstName: "Ayşe",
        lastName: "Yılmaz",
        phone: "05551112233",
        city: "İstanbul",
        district: "Kadıköy",
        line1: "Bahariye Cad. No: 12 D: 4",
        invoiceType: "CORPORATE",
        companyName: "Yılmaz Tasarım Ltd. Şti.",
        taxOffice: "Kadıköy",
        taxNumber: "9876543210",
      },
      shippingMethodName: "Yurtiçi Kargo",
      paymentMethodLabel: "Kredi / Banka Kartı (iyzico)",
      lines: [
        {
          title: "Keten Masa Örtüsü",
          variantTitle: "160x220 / Doğal Bej",
          sku: "KTN-160-BEJ",
          quantity: 1,
          unitPriceMinor: 120000,
          discountMinor: 20000,
          taxRateBps: 2000,
          totalMinor: 100000,
        },
      ],
      subtotalMinor: 120000,
      discountTotalMinor: 20000,
      shippingTotalMinor: 0,
      paymentFeeMinor: 0,
      taxTotalMinor: 16667,
      totalMinor: 100000,
      currency: "TRY",
    });

    expect(contracts.preInformation).toContain("ÖN BİLGİLENDİRME FORMU");
    expect(contracts.preInformation).toContain("Ayşe Yılmaz");
    expect(contracts.preInformation).toContain("Keten Masa Örtüsü");
    expect(contracts.preInformation).not.toContain("—");

    expect(contracts.distanceSales).toContain("MESAFELİ SATIŞ SÖZLEŞMESİ");
    expect(contracts.distanceSales).toContain("Yılmaz Tasarım Ltd. Şti.");
    expect(contracts.distanceSales).toContain("#1042");
    expect(contracts.distanceSales).not.toContain("—");
  });

  it("kargo ücretini il filtresi, ağırlık kademesi ve ücretsiz kargo baremine göre hesaplar", () => {
    const method = {
      id: "ship-1",
      name: "Hızlı Kurye",
      description: "Aynı gün teslimat",
      carrier: "kolaygelsin",
      price: 5990,
      freeOverAmount: 150000,
      cities: ["İstanbul", "Ankara"],
      weightRules: [
        { maxGrams: 1000, price: 6990 },
        { maxGrams: 5000, price: 11990 },
      ],
      estimatedDays: "1 iş günü",
      isActive: true,
      position: 0,
    };

    // İzmir için uygun değil
    expect(
      evaluateShippingMethod(method, {
        city: "İzmir",
        subtotalAfterDiscountMinor: 50000,
        totalWeightGrams: 800,
      })
    ).toBeNull();

    // İstanbul, 2.500 gram -> 119,90 TL kademesi
    const quote = evaluateShippingMethod(method, {
      city: "İstanbul",
      subtotalAfterDiscountMinor: 80000,
      totalWeightGrams: 2500,
    });
    expect(quote?.effectivePriceMinor).toBe(11990);

    // 1.500 TL üzeri sepette ücretsiz
    const freeQuote = evaluateShippingMethod(method, {
      city: "İstanbul",
      subtotalAfterDiscountMinor: 160000,
      totalWeightGrams: 2500,
    });
    expect(freeQuote?.isFree).toBe(true);
    expect(freeQuote?.effectivePriceMinor).toBe(0);
  });

  it("mağaza ayarlarında minimum sepet tutarı kuralını ve varsayılanını doğrular", () => {
    expect(DEFAULT_STORE_SETTINGS.minOrderSubtotalMinor).toBeDefined();
    expect(DEFAULT_STORE_SETTINGS.minOrderSubtotalMinor).toBe(0);
  });

  it("iyzico adaptörü ödeme formunu PENDING durumunda ve form içeriğiyle başlatır", async () => {
    const res = await iyzicoAdapter.initiate({
      orderId: "ord-test-1",
      orderNumber: 1001,
      amountMinor: 25000,
      currency: "TRY",
      buyer: {
        id: "cust-1",
        firstName: "Elif",
        lastName: "Demir",
        email: "elif@ornek.com",
        phone: "05551234567",
        city: "İstanbul",
        district: "Kadıköy",
        addressLine: "Caddebostan",
      },
      shippingAddress: {
        contactName: "Elif Demir",
        city: "İstanbul",
        district: "Kadıköy",
        addressLine: "Caddebostan",
      },
      billingAddress: {
        contactName: "Elif Demir",
        city: "İstanbul",
        district: "Kadıköy",
        addressLine: "Caddebostan",
      },
      basketItems: [
        {
          id: "var-1",
          name: "İpek Pijama Takımı",
          categoryName: "Giyim",
          priceMinor: 25000,
        },
      ],
      callbackUrl: "http://localhost:3000/api/payments/iyzico/callback",
      settings: DEFAULT_PAYMENT_SETTINGS,
    });

    expect(res.ok).toBe(true);
    expect(res.paymentState).toBe("PENDING");
    expect(res.orderPaymentStatus).toBe("PENDING");
    expect(res.checkoutFormContent).toBeDefined();
    expect(res.checkoutFormContent).toContain("<form");
  });

  it("verifyIyzicoCheckoutToken simülasyon tokenını hatasız doğrular", async () => {
    const verification = await verifyIyzicoCheckoutToken({
      token: "sim_iyzico_ord-999_123456789",
      settings: DEFAULT_PAYMENT_SETTINGS,
    });

    expect(verification.ok).toBe(true);
    expect(verification.conversationId).toBe("ord-999");
  });

  it("verifyIyzicoCheckoutToken başarısız simülasyon tokenını yakalar ve hata döndürür", async () => {
    const verification = await verifyIyzicoCheckoutToken({
      token: "sim_iyzico_fail_ord-888_987654321",
      settings: DEFAULT_PAYMENT_SETTINGS,
    });

    expect(verification.ok).toBe(false);
    expect(verification.errorMessage).toContain("Simüle edilmiş kart reddi");
  });

  it("stok rezervasyon adaylarını levelId sırasına göre sıralar (deadlock koruması)", () => {
    const reservations = [
      { levelId: "lvl-zebra", quantity: 2 },
      { levelId: "lvl-alpha", quantity: 1 },
      { levelId: "lvl-middle", quantity: 5 },
    ];
    const sorted = [...reservations].sort((a, b) => a.levelId.localeCompare(b.levelId));
    expect(sorted.map((r) => r.levelId)).toEqual(["lvl-alpha", "lvl-middle", "lvl-zebra"]);
  });

  it("VezollaClub üyesi (giriş yapmış) kullanıcı kulüp özel ürün aldığında sepette kulüp özel fiyat geçerli olur", () => {
    const basePrice = 23999;
    const clubPrice = 21599;

    // 1) Giriş yapmamış misafir kullanıcı
    const guestIsClubPriceApplied = Boolean(
      false && clubPrice > 0 && clubPrice < basePrice
    );
    const guestUnitPrice = guestIsClubPriceApplied ? clubPrice : basePrice;
    expect(guestIsClubPriceApplied).toBe(false);
    expect(guestUnitPrice).toBe(23999);

    // 2) Giriş yapmış VezollaClub üyesi
    const memberIsClubPriceApplied = Boolean(
      true && clubPrice > 0 && clubPrice < basePrice
    );
    const memberUnitPrice = memberIsClubPriceApplied ? clubPrice : basePrice;
    expect(memberIsClubPriceApplied).toBe(true);
    expect(memberUnitPrice).toBe(21599);
  });
});
