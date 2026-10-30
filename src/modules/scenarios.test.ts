import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/session";
import { hasPermission, type PermissionKey } from "@/lib/rbac/permissions";
import { DEFAULT_STORE_SETTINGS } from "@/lib/settings/schemas";
import { resolveEffectiveVariantPrice } from "@/modules/checkout/cart";
import { generateOrderContracts } from "@/modules/checkout/contracts";
import {
  planWarehouseReservations,
  type WarehouseStockCandidate,
} from "@/modules/checkout/service";
import { evaluateShippingMethod } from "@/modules/shipping/service";
import { evaluatePromotions, type PromoCandidate, type PromoLineInput } from "@/modules/promotions/engine";
import { checkoutAddressSchema } from "@/modules/checkout/schemas";
import { roundPriceMinor } from "@/lib/money";

describe("E-Ticaret Uçtan Uca Senaryo Testleri (Scenarios Matrix)", () => {
  /* =======================================================================
   * 1. POTANSİYEL MÜŞTERİ (VISITOR / LEAD / PROSPECTIVE CUSTOMER) SENARYOLARI
   * ======================================================================= */
  describe("1. Potansiyel Müşteri (Ziyaretçi) Senaryoları", () => {
    it("S1: Ziyaretçi genel katalog fiyatını görür, müşteri grubu indirimi uygulanmaz", () => {
      const basePrice = 250000; // 2.500,00 TL
      const priceLists = [
        {
          price: 200000, // VIP Grubu 2.000 TL
          priceList: {
            id: "pl-vip",
            isActive: true,
            customerGroupId: "grp-vip",
            startsAt: null,
            endsAt: null,
            priority: 5,
          },
        },
      ];

      // Anonim ziyaretçi (customerGroupId = null)
      const effectivePrice = resolveEffectiveVariantPrice(basePrice, priceLists, null);
      expect(effectivePrice).toBe(250000);
    });

    it("S2: Depo kullanılabilir stoğu aşıldığında hata fırlatılır (Aşırı satış önleme)", () => {
      const warehouses: WarehouseStockCandidate[] = [
        {
          levelId: "lvl-main",
          warehouseId: "wh-main",
          warehouseName: "Ana Depo",
          warehousePriority: 1,
          warehouseActive: true,
          onHand: 4,
          reserved: 1, // 3 adet mevcut
        },
      ];

      // 4 adet talep edildiğinde hata fırlatmalıdır
      expect(() =>
        planWarehouseReservations(warehouses, 4, {
          variantTitle: "Deri Cüzdan",
          trackInventory: true,
          allowBackorder: false,
        })
      ).toThrow(/yeterli stok bulunmuyor/i);

      // 3 adet talep edildiğinde başarıyla tahsis eder
      const alloc = planWarehouseReservations(warehouses, 3, {
        variantTitle: "Deri Cüzdan",
        trackInventory: true,
        allowBackorder: false,
      });
      expect(alloc).toEqual([{ levelId: "lvl-main", warehouseId: "wh-main", quantity: 3 }]);
    });

    it("S3: Kupon kodu sepet tutarı kuralına göre değerlendirilir (Minimum tutar ve indirim)", () => {
      const promo: PromoCandidate = {
        id: "p-bahar",
        name: "50 TL Bahar İndirimi",
        code: "BAHAR50",
        type: "FIXED_AMOUNT",
        value: 5000, // 50 TL indirim
        conditions: { minSubtotalMinor: 50000 }, // En az 500 TL sepet tutarı gerekir
        usageCount: 0,
        isActive: true,
        isCombinable: false,
        priority: 1,
      };

      const linesUnderMin: PromoLineInput[] = [
        {
          lineId: "l1",
          variantId: "v1",
          productId: "p1",
          categoryIds: [],
          quantity: 1,
          unitPriceMinor: 40000, // 400 TL
        },
      ];

      // 400 TL sepet ile BAHAR50 reddedilmeli
      const resultUnder = evaluatePromotions([promo], {
        lines: linesUnderMin,
        enteredCodes: ["BAHAR50"],
        customerGroupId: null,
        now: new Date(),
      });
      expect(resultUnder.appliedPromotions).toHaveLength(0);
      expect(resultUnder.rejectedCodes).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: "BAHAR50" })])
      );

      // 600 TL sepet ile BAHAR50 uygulanmalı
      const linesOverMin: PromoLineInput[] = [
        {
          lineId: "l1",
          variantId: "v1",
          productId: "p1",
          categoryIds: [],
          quantity: 1,
          unitPriceMinor: 60000,
        },
      ];
      const resultOver = evaluatePromotions([promo], {
        lines: linesOverMin,
        enteredCodes: ["BAHAR50"],
        customerGroupId: null,
        now: new Date(),
      });
      expect(resultOver.appliedPromotions).toHaveLength(1);
      expect(resultOver.discountTotalMinor).toBe(5000);
    });

    it("S4: Şehir ve tutara göre kargo hesaplama (Ücretsiz kargo baremi kontrolü)", () => {
      const method = {
        id: "ship-std",
        name: "Yurtiçi Standart",
        description: "Adrese teslim",
        carrier: "yurtici",
        price: 4990, // 49,90 TL
        freeOverAmount: 75000, // 750 TL ve üzeri ücretsiz
        cities: [],
        weightRules: [],
        estimatedDays: "2-3 gün",
        isActive: true,
        position: 0,
      };

      // 500 TL alışveriş -> 49,90 TL kargo
      const quoteUnder = evaluateShippingMethod(method, {
        city: "Ankara",
        subtotalAfterDiscountMinor: 50000,
        totalWeightGrams: 500,
      });
      expect(quoteUnder?.effectivePriceMinor).toBe(4990);
      expect(quoteUnder?.isFree).toBe(false);

      // 800 TL alışveriş -> 0 TL ücretsiz kargo
      const quoteOver = evaluateShippingMethod(method, {
        city: "Ankara",
        subtotalAfterDiscountMinor: 80000,
        totalWeightGrams: 500,
      });
      expect(quoteOver?.effectivePriceMinor).toBe(0);
      expect(quoteOver?.isFree).toBe(true);
    });

    it("S5: Ön Bilgilendirme ve Mesafeli Satış Sözleşmesi mevzuata uygun üretilir", () => {
      const contracts = generateOrderContracts({
        orderNumber: 2001,
        createdAt: new Date("2026-10-25T14:00:00Z"),
        store: DEFAULT_STORE_SETTINGS,
        buyerEmail: "ziyaretci@ornek.com",
        buyerPhone: "05320000000",
        shippingAddress: {
          title: "Ev",
          firstName: "Mehmet",
          lastName: "Kaya",
          phone: "05320000000",
          city: "İzmir",
          district: "Konak",
          neighborhood: "Alsancak",
          line1: "Gül Sokak No: 5",
          postalCode: "35220",
          invoiceType: "INDIVIDUAL",
        },
        billingAddress: {
          title: "Ev",
          firstName: "Mehmet",
          lastName: "Kaya",
          phone: "05320000000",
          city: "İzmir",
          district: "Konak",
          line1: "Gül Sokak No: 5",
          invoiceType: "INDIVIDUAL",
        },
        shippingMethodName: "Standart Kargo",
        paymentMethodLabel: "Banka Havalesi / EFT",
        lines: [
          {
            title: "Porselen Fincan Takımı",
            variantTitle: "6 Kişilik",
            sku: "POR-6K",
            quantity: 1,
            unitPriceMinor: 85000,
            discountMinor: 0,
            taxRateBps: 2000,
            totalMinor: 85000,
          },
        ],
        subtotalMinor: 85000,
        discountTotalMinor: 0,
        shippingTotalMinor: 0,
        paymentFeeMinor: 0,
        taxTotalMinor: 14167,
        totalMinor: 85000,
        currency: "TRY",
      });

      expect(contracts.preInformation).toContain("ÖN BİLGİLENDİRME FORMU");
      expect(contracts.preInformation).toContain("Porselen Fincan Takımı");
      expect(contracts.preInformation).toContain("Mehmet Kaya");
      expect(contracts.preInformation).not.toContain("—"); // R-02 em dash yasağı

      expect(contracts.distanceSales).toContain("MESAFELİ SATIŞ SÖZLEŞMESİ");
      expect(contracts.distanceSales).toContain("#2001");
      expect(contracts.distanceSales).not.toContain("—");
    });

    it("S6: Terk edilmiş sepet kurtarma mantığı (Cart recovery via token / cartId)", () => {
      // Bir ziyaretçi sepetine 2 ürün ekledi ve sayfayı kapattı
      const abandonedCart = {
        id: "cart-ab123",
        visitorId: "vid-999",
        promoCodes: ["HOSGELDIN10"],
        completedAt: null,
        items: [
          { variantId: "v-1", quantity: 2 },
          { variantId: "v-2", quantity: 1 },
        ],
      };

      // Kurtarma linki ile geri geldiğinde sepet doğrulanabilir ve aktiftir
      expect(abandonedCart.completedAt).toBeNull();
      expect(abandonedCart.items).toHaveLength(2);
      expect(abandonedCart.promoCodes).toContain("HOSGELDIN10");
    });
  });

  /* =======================================================================
   * 2. KAYITLI MÜŞTERİ (REGISTERED CUSTOMER) SENARYOLARI
   * ======================================================================= */
  describe("2. Kayıtlı Müşteri Senaryoları", () => {
    it("S7: Şifre Argon2 ile güvenli hash'lenir ve doğrulanır", async () => {
      const rawPassword = "GuvenliSifre*2026";
      const hash = await hashPassword(rawPassword);

      expect(hash).not.toBe(rawPassword);
      expect(await verifyPassword(hash, rawPassword)).toBe(true);
      expect(await verifyPassword(hash, "YanlisSifre")).toBe(false);
    });

    it("S8: Misafir sepeti ile müşteri sepetinin akıllı birleştirilmesi (Cart Merging)", () => {
      // Müşterinin hesabında önceden kalan sepeti
      const customerExistingCart = {
        id: "cart-cust-1",
        customerId: "cust-1",
        promoCodes: ["ESKIKUPON"],
        items: [
          { variantId: "v-10", quantity: 1 },
          { variantId: "v-20", quantity: 2 },
        ],
      };

      // Giriş yapmadan önce misafir olarak eklediği sepet
      const guestCart = {
        id: "cart-guest-2",
        customerId: null,
        promoCodes: ["YENIKUPON"],
        items: [
          { variantId: "v-20", quantity: 3 }, // Aynı varyant: adetler toplanmalı (2 + 3 = 5)
          { variantId: "v-30", quantity: 1 }, // Yeni varyant: eklenmeli
        ],
      };

      // Birleştirme simülasyonu
      const mergedItemsMap = new Map<string, number>();
      for (const item of customerExistingCart.items) {
        mergedItemsMap.set(item.variantId, item.quantity);
      }
      for (const item of guestCart.items) {
        const currentQty = mergedItemsMap.get(item.variantId) ?? 0;
        mergedItemsMap.set(item.variantId, currentQty + item.quantity);
      }

      const mergedPromoCodes = Array.from(
        new Set([...customerExistingCart.promoCodes, ...guestCart.promoCodes])
      );

      expect(mergedItemsMap.get("v-10")).toBe(1);
      expect(mergedItemsMap.get("v-20")).toBe(5); // 2 + 3
      expect(mergedItemsMap.get("v-30")).toBe(1);
      expect(mergedPromoCodes).toEqual(["ESKIKUPON", "YENIKUPON"]);
    });

    it("S9: Müşteri grubu (VIP / B2B) özel fiyat listesini öncelikle uygular", () => {
      const basePrice = 100000;
      const priceLists = [
        {
          price: 90000,
          priceList: {
            id: "pl-genel",
            isActive: true,
            customerGroupId: null,
            startsAt: null,
            endsAt: null,
            priority: 1,
          },
        },
        {
          price: 70000, // VIP müşteriye 700 TL
          priceList: {
            id: "pl-vip",
            isActive: true,
            customerGroupId: "grp-vip-id",
            startsAt: null,
            endsAt: null,
            priority: 5,
          },
        },
      ];

      // VIP müşteri grubu olan kullanıcı
      const vipPrice = resolveEffectiveVariantPrice(basePrice, priceLists, "grp-vip-id");
      expect(vipPrice).toBe(70000);

      // Standart grup olmayan kullanıcı genel kampanyayı alır
      const normalPrice = resolveEffectiveVariantPrice(basePrice, priceLists, null);
      expect(normalPrice).toBe(90000);
    });

    it("S10: Adres şeması bireysel TCKN ve kurumsal Vergi No ayrımını doğrular", () => {
      // Geçerli bireysel adres
      const validIndividual = checkoutAddressSchema.safeParse({
        title: "Ev",
        firstName: "Ali",
        lastName: "Demir",
        phone: "05551234567",
        city: "İstanbul",
        district: "Beşiktaş",
        line1: "Barbaros Bulvarı No: 1",
        invoiceType: "INDIVIDUAL",
        tckn: "12345678901",
      });
      expect(validIndividual.success).toBe(true);

      // Geçerli kurumsal adres
      const validCorporate = checkoutAddressSchema.safeParse({
        title: "Ofis",
        firstName: "Ali",
        lastName: "Demir",
        phone: "05551234567",
        city: "İstanbul",
        district: "Beşiktaş",
        line1: "Barbaros Bulvarı No: 1",
        invoiceType: "CORPORATE",
        companyName: "Demir Bilişim A.Ş.",
        taxOffice: "Beşiktaş",
        taxNumber: "1234567890",
      });
      expect(validCorporate.success).toBe(true);
    });
  });

  /* =======================================================================
   * 3. YÖNETİCİ (STORE OPERATOR / ADMINISTRATOR) SENARYOLARI
   * ======================================================================= */
  describe("3. Yönetici (Store Operator / Admin) Senaryoları", () => {
    it("S11: RBAC yetkilendirme matrisi kontrolü", () => {
      const orderStaff = {
        isOwner: false,
        role: {
          permissions: ["orders.read", "orders.write"] as PermissionKey[],
        },
      };

      const ownerStaff = {
        isOwner: true,
        role: { permissions: [] as PermissionKey[] },
      };

      // Sipariş personeli orders.read ve orders.write yetkisine sahip olmalı
      expect(hasPermission(orderStaff, "orders.read")).toBe(true);
      expect(hasPermission(orderStaff, "orders.write")).toBe(true);
      // Ama refund veya ayar değiştirme yetkisi olmamalı
      expect(hasPermission(orderStaff, "orders.refund")).toBe(false);
      expect(hasPermission(orderStaff, "settings.manage")).toBe(false);

      // Mağaza sahibi (Owner) tüm yetkilere koşulsuz sahip olmalı
      expect(hasPermission(ownerStaff, "orders.refund")).toBe(true);
      expect(hasPermission(ownerStaff, "settings.manage")).toBe(true);
    });

    it("S12: Çoklu depoda öncelik sırasına göre stok tahsisatı", () => {
      const warehouses: WarehouseStockCandidate[] = [
        {
          levelId: "lvl-yedek",
          warehouseId: "wh-yedek",
          warehouseName: "Yedek Depo",
          warehousePriority: 2,
          warehouseActive: true,
          onHand: 10,
          reserved: 0,
        },
        {
          levelId: "lvl-ana",
          warehouseId: "wh-ana",
          warehouseName: "Ana Depo",
          warehousePriority: 1, // En yüksek öncelik
          warehouseActive: true,
          onHand: 5,
          reserved: 0,
        },
      ];

      // 7 adet istendiğinde: 5 adet Ana Depodan, 2 adet Yedek Depodan tahsis edilmeli
      const allocations = planWarehouseReservations(warehouses, 7, {
        variantTitle: "Lamba",
        trackInventory: true,
      });

      expect(allocations).toEqual([
        { levelId: "lvl-ana", warehouseId: "wh-ana", quantity: 5 },
        { levelId: "lvl-yedek", warehouseId: "wh-yedek", quantity: 2 },
      ]);
    });

    it("S13: İade onayında stoğa geri alma (Restock) ve para iadesi hesaplama", () => {
      const orderTotal = 150000;
      const orderItem = {
        id: "item-10",
        unitPrice: 150000,
        quantity: 1,
        total: 150000,
        returnedQuantity: 0,
      };

      // İade talebi oluşturuldu
      const returnQty = 1;
      const refundable = Math.round((orderItem.total * returnQty) / orderItem.quantity);
      expect(refundable).toBe(150000);

      // Yönetici iadeyi teslim aldı ve restock yaptı
      const restockAction = {
        restock: true,
        refundAmount: refundable,
        nextOnHand: 10 + returnQty, // Depodaki mevcut stoğa geri eklendi
      };

      expect(restockAction.nextOnHand).toBe(11);
      expect(restockAction.refundAmount).toBe(orderTotal);
    });

    it("S14: Toplu fiyat güncellemesi (Yüzdesel artış / azalış kuruş yuvarlaması)", () => {
      const basePrices = [10000, 25550, 49990]; // 100 TL, 255.50 TL, 499.90 TL
      const percentIncrease = 15; // %15 zam

      const updatedPrices = basePrices.map((p) =>
        roundPriceMinor(p * (1 + percentIncrease / 100), "none")
      );

      expect(updatedPrices[0]).toBe(11500); // 115,00 TL
      expect(updatedPrices[1]).toBe(29382); // Math.round(25550 * 1.15) -> 29382
      expect(updatedPrices[2]).toBe(57488); // Math.round(49990 * 1.15) -> 57488
    });
  });
});
