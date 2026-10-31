import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "@node-rs/argon2";
import { PrismaClient } from "../src/generated/prisma/client";
import { ALL_PERMISSION_KEYS } from "../src/lib/rbac/permissions";
import {
  DEFAULT_STORE_SETTINGS,
  DEFAULT_THEME_SETTINGS,
  DEFAULT_PAYMENT_SETTINGS,
  DEFAULT_CONVERSION_SETTINGS,
  DEFAULT_ABANDONED_CART_SETTINGS,
} from "../src/lib/settings/schemas";

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5433/eticaret";

async function hashPass(plain: string): Promise<string> {
  return hash(plain, {
    memoryCost: 19456,
    timeCost: 2,
    outputLen: 32,
    parallelism: 1,
  });
}

async function main() {
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const db = new PrismaClient({ adapter });

  console.log("=== VEZOLLA SIFIR KURULUM BAŞLATILIYOR ===");
  console.log("Tüm eski mock veriler, test siparişleri ve ürünler temizleniyor...");

  // 1. İstek Listesi, İade, Sevkiyat, Ödeme ve Sipariş Verileri
  await db.wishlistItem.deleteMany();
  await db.wishlistCollection.deleteMany();
  await db.returnItem.deleteMany();
  await db.returnRequest.deleteMany();
  await db.fulfillmentItem.deleteMany();
  await db.fulfillment.deleteMany();
  await db.refund.deleteMany();
  await db.payment.deleteMany();
  await db.orderEvent.deleteMany();
  await db.orderItem.deleteMany();
  await db.order.deleteMany();
  await db.shippingMethod.deleteMany();

  // 2. Sepet ve Promosyon Verileri
  await db.cartItem.deleteMany();
  await db.cart.deleteMany();
  await db.promotionUsage.deleteMany();
  await db.promotion.deleteMany();

  // 3. Stok, Rezervasyon ve Ürün İlişkileri
  await db.review.deleteMany();
  await db.backInStockRequest.deleteMany();
  await db.stockMovement.deleteMany();
  await db.stockReservation.deleteMany();
  await db.inventoryLevel.deleteMany();
  await db.priceListPrice.deleteMany();
  await db.priceList.deleteMany();
  await db.productSourceLink.deleteMany();
  await db.collectionProduct.deleteMany();
  await db.productCategory.deleteMany();
  await db.productTag.deleteMany();
  await db.productAttributeValue.deleteMany();
  await db.variantOptionValue.deleteMany();
  await db.productOptionValue.deleteMany();
  await db.productOption.deleteMany();
  await db.productImage.deleteMany();
  await db.productVariant.deleteMany();
  await db.product.deleteMany();

  // 4. Kategori, Koleksiyon ve Nitelikler
  await db.category.deleteMany();
  await db.collection.deleteMany();
  await db.tag.deleteMany();
  await db.productTypeAttribute.deleteMany();
  await db.productType.deleteMany();
  await db.attributeDefinition.deleteMany();
  await db.brand.deleteMany();
  await db.taxClass.deleteMany();

  // 5. XML & Feed Entegrasyon Verileri
  await db.feedCategoryMap.deleteMany();
  await db.feedRun.deleteMany();
  await db.feedSource.deleteMany();
  await db.exportFeed.deleteMany();

  // 6. Ziyaretçi ve Kişiselleştirme Verileri
  await db.experimentAssignment.deleteMany();
  await db.experiment.deleteMany();
  await db.visitorEvent.deleteMany();
  await db.visitorAffinity.deleteMany();
  await db.visitor.deleteMany();
  await db.productAssociation.deleteMany();
  await db.merchRule.deleteMany();
  await db.adMapping.deleteMany();
  await db.segment.deleteMany();

  // 7. Müşteri Verileri
  await db.address.deleteMany();
  await db.customerSession.deleteMany();
  await db.customer.deleteMany();

  // 8. İçerik, Sayfa, Blok ve Menüleri Temizle
  await db.homeBlockVariant.deleteMany();
  await db.homeBlock.deleteMany();
  await db.menuItem.deleteMany();
  await db.menu.deleteMany();
  await db.page.deleteMany();
  await db.redirect.deleteMany();
  await db.mediaAsset.deleteMany();

  // 9. Sistem Logları ve Eski Ayarları Temizle
  await db.auditLog.deleteMany();
  await db.adminNotification.deleteMany();
  await db.emailMessage.deleteMany();
  await db.job.deleteMany();
  await db.domainEvent.deleteMany();
  await db.setting.deleteMany();

  console.log("Veriler başarıyla temizlendi. Vezolla temiz resmi başlangıç verileri yükleniyor...");

  // 10. Roller ve Yetkiler
  const ownerRole = await db.role.upsert({
    where: { name: "Mağaza Sahibi (Tam Yetki)" },
    create: {
      name: "Mağaza Sahibi (Tam Yetki)",
      description: "Tüm sistem modüllerine tam erişim yetkisi",
      permissions: ["*", ...ALL_PERMISSION_KEYS],
      isSystem: true,
    },
    update: {
      permissions: ["*", ...ALL_PERMISSION_KEYS],
    },
  });

  await db.role.upsert({
    where: { name: "Katalog ve XML Yöneticisi" },
    create: {
      name: "Katalog ve XML Yöneticisi",
      description: "Ürün, kategori, stok ve tedarikçi XML yönetimi",
      permissions: [
        "catalog.read",
        "catalog.write",
        "inventory.read",
        "inventory.write",
        "xml.manage",
        "content.manage",
      ],
      isSystem: true,
    },
    update: {},
  });

  await db.role.upsert({
    where: { name: "Sipariş ve Operasyon Uzmanı" },
    create: {
      name: "Sipariş ve Operasyon Uzmanı",
      description: "Sipariş, kargo, iade ve müşteri yönetimi",
      permissions: [
        "orders.read",
        "orders.write",
        "orders.refund",
        "customers.read",
        "customers.write",
        "inventory.read",
      ],
      isSystem: true,
    },
    update: {},
  });

  // 11. Yönetici Kullanıcıları (Admin123!)
  const adminPasswordHash = await hashPass("Admin123!");

  await db.staffUser.upsert({
    where: { email: "admin@vezolla.com" },
    create: {
      email: "admin@vezolla.com",
      name: "Vezolla Yöneticisi",
      passwordHash: adminPasswordHash,
      roleId: ownerRole.id,
      isOwner: true,
      isActive: true,
    },
    update: {
      passwordHash: adminPasswordHash,
      roleId: ownerRole.id,
      isOwner: true,
      isActive: true,
    },
  });

  await db.staffUser.upsert({
    where: { email: "admin@ornek-magaza.local" },
    create: {
      email: "admin@ornek-magaza.local",
      name: "Sistem Yöneticisi",
      passwordHash: adminPasswordHash,
      roleId: ownerRole.id,
      isOwner: true,
      isActive: true,
    },
    update: {
      passwordHash: adminPasswordHash,
      roleId: ownerRole.id,
      isOwner: true,
      isActive: true,
    },
  });

  // 12. Müşteri Grupları
  await db.customerGroup.upsert({
    where: { name: "Standart Üye" },
    create: {
      name: "Standart Üye",
      description: "Bireysel perakende müşterileri",
    },
    update: {},
  });

  await db.customerGroup.upsert({
    where: { name: "VIP / Özel Kulüp" },
    create: {
      name: "VIP / Özel Kulüp",
      description: "Vezolla özel sadakat kulübü üyeleri",
    },
    update: {},
  });

  // 13. Ana Depo
  await db.warehouse.upsert({
    where: { code: "WH-MAIN" },
    create: {
      code: "WH-MAIN",
      name: "Vezolla Merkez Depo (Nişantaşı / İstanbul)",
      address: "Abdi İpekçi Cad. No: 42, Nişantaşı, Şişli / İstanbul",
      isDefault: true,
      isActive: true,
    },
    update: {
      name: "Vezolla Merkez Depo (Nişantaşı / İstanbul)",
      address: "Abdi İpekçi Cad. No: 42, Nişantaşı, Şişli / İstanbul",
      isDefault: true,
      isActive: true,
    },
  });

  // 14. Vezolla Temiz Kategoriler (0 Ürünlü Sıfır Başlangıç)
  const rootCat1 = await db.category.create({
    data: {
      name: "İç Giyim & Fantazi",
      slug: "ic-giyim-fantazi",
      description: "Vezolla zarafetini içten başlatan dantel, saten, büstiyer ve özel gecelik seçkisi.",
      position: 0,
      isActive: true,
    },
  });

  const subcategories = [
    { name: "Dantelli Babydoll", slug: "dantelli-babydoll" },
    { name: "Jartiyer & Takımlar", slug: "jartiyer-ve-takimlar" },
    { name: "Büstiyer & Korse", slug: "bustiyer-ve-korse" },
    { name: "Saten Gecelik & Sabahlık", slug: "saten-gecelik-ve-sabahlik" },
    { name: "Özel Koleksiyonlar", slug: "ozel-koleksiyonlar" },
  ];

  let pos = 0;
  for (const sub of subcategories) {
    await db.category.create({
      data: {
        name: sub.name,
        slug: sub.slug,
        parentId: rootCat1.id,
        position: pos++,
        isActive: true,
      },
    });
  }

  await db.category.create({
    data: {
      name: "Elbise & Hazır Giyim",
      slug: "elbise-hazir-giyim",
      description: "Zamansız şıklık ve zarif kumaş kalıplarıyla tasarlanmış editoryal hazır giyim koleksiyonu.",
      position: 1,
      isActive: true,
    },
  });

  await db.category.create({
    data: {
      name: "Saten & İpek Koleksiyonu",
      slug: "saten-ipek-koleksiyonu",
      description: "Cildinizde hafif ve akıcı bir dokunuş bırakan birinci sınıf saf saten ve ipek seçkisi.",
      position: 2,
      isActive: true,
    },
  });

  await db.category.create({
    data: {
      name: "Ev & Loungewear",
      slug: "ev-loungewear",
      description: "Evinizde hem zahmetsizce konforlu hem de göz alıcı görünmenizi sağlayan şık ev giyimi.",
      position: 3,
      isActive: true,
    },
  });

  await db.category.create({
    data: {
      name: "Aksesuar & Tamamlayıcılar",
      slug: "aksesuar-tamamlayicilar",
      description: "Zarafeti tamamlayan ince düşünülmüş aksesuarlar ve özel tasarım detaylar.",
      position: 4,
      isActive: true,
    },
  });

  // 15. Resmi Vezolla Kurumsal Sayfaları
  const pages = [
    {
      slug: "hakkimizda",
      title: "Hakkımızda",
      isSystem: false,
      content: `<h2>Zarafet İçten Başlar</h2>
<p>Vezolla, zarafeti gösterişte değil incelikte arayan bir giyim markasıdır. Akışkan bir kumaş kıvrımını andıran amblemi ve sade, yüksek kontrastlı tipografisiyle kalıcı, rafine ve zahmetsiz bir şıklığı temsil eder.</p>
<h3>Temel Değerlerimiz</h3>
<ul>
  <li><strong>Zarafet:</strong> Abartıdan uzak, ölçülü ve zamansız bir duruş.</li>
  <li><strong>Sadelik:</strong> Az ama doğru detay; temiz çizgi ve geniş boşluk.</li>
  <li><strong>Kalite:</strong> Kumaştan dikişe, her ayrıntıda özen.</li>
</ul>
<p>Vezolla seçkisi, lüksü sadece özel anlara değil hayatın her anına taşıyan zamansız formlar sunar.</p>`,
    },
    {
      slug: "iletisim",
      title: "İletişim ve Müşteri Destek",
      isSystem: true,
      content: `<h2>Vezolla Müşteri İlişkileri</h2>
<p>Siparişleriniz, ürün detayları, teslimat süreçleri veya özel danışmanlık talepleriniz için müşteri deneyimi ekibimiz haftanın 7 günü hizmetinizdedir.</p>
<h3>İletişim Kanallarımız</h3>
<ul>
  <li><strong>E-posta Destek:</strong> destek@vezolla.com</li>
  <li><strong>Müşteri Danışma Hattı:</strong> 0850 840 42 42</li>
  <li><strong>Çalışma Saatleri:</strong> Hafta içi 09:00 - 18:00, Cumartesi 10:00 - 15:00</li>
  <li><strong>Genel Merkez:</strong> Abdi İpekçi Cad. No: 42, Nişantaşı, Şişli / İstanbul</li>
</ul>
<p>Siparişlerinizin kargo durumunu <a href="/siparis-takip">Sipariş Takip</a> sayfamız üzerinden takip edebilirsiniz.</p>`,
    },
    {
      slug: "teslimat-ve-kargo",
      title: "Teslimat ve Kargo Bilgileri",
      isSystem: true,
      content: `<h2>%100 Gizli Paketleme & Hızlı Sevkiyat</h2>
<p>Vezolla olarak gizliliğinize ve alışveriş deneyiminize en üst düzeyde saygı duyuyoruz.</p>
<h3>Gizli Paketleme Güvencesi</h3>
<ul>
  <li>Tüm siparişler dışarıdan içeriği kesinlikle belli olmayan, nötr ve zarif ambalajlarda gönderilir.</li>
  <li>Kargo paketinin üzerinde veya kargo fişinde ürünün adı, modeli veya kategorisi kesinlikle yer almaz.</li>
  <li>Gönderici adı olarak yalnızca yasal şirket unvanımız belirtilir.</li>
</ul>
<h3>Teslimat Süresi</h3>
<p>Saat 16:00'a kadar verilen siparişler aynı gün anlaşmalı kargo firmalarına teslim edilir. 1.500 TL üzeri tüm siparişlerinizde hızlı kargo tamamen ücretsizdir.</p>`,
    },
    {
      slug: "kvkk",
      title: "KVKK Aydınlatma Metni",
      isSystem: true,
      content: `<h2>Kişisel Verilerin Korunması Aydınlatma Metni</h2>
<p>Vezolla Tekstil ve Mağazacılık A.Ş. olarak, 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") kapsamında kişisel verilerinizin güvenliğini en üst seviyede sağlamaktayız.</p>
<p>Toplanan kişisel verileriniz yalnızca siparişinizin güvenle işlenmesi, faturalandırma ve kapınıza kadar teslimatın gerçekleştirilmesi amacıyla işlenmektedir.</p>`,
    },
    {
      slug: "sikca-sorulan-sorular",
      title: "Sıkça Sorulan Sorular",
      isSystem: false,
      content: `<h2>Sıkça Sorulan Sorular</h2>
<h3>Siparişim ne zaman kargolanır?</h3>
<p>Hafta içi saat 16:00'ya kadar verilen siparişler aynı gün özenle hazırlanarak kargoya verilir.</p>
<h3>Kargo paketinde ne yazacak?</h3>
<p>Tüm siparişlerimiz %100 gizli paketleme standardındadır. Paketin üzerinde iç çamaşırı veya ürün detayı asla yazmaz.</p>
<h3>Hangi ödeme yöntemlerini kullanabilirim?</h3>
<p>Tüm kredi kartlarına peşin fiyatına taksit imkanı sunan 256-bit SSL korumalı iyzico altyapısı ve güvenli banka havalesi ile ödeme yapabilirsiniz.</p>`,
    },
  ];

  for (const p of pages) {
    await db.page.create({
      data: {
        slug: p.slug,
        title: p.title,
        content: p.content,
        status: "PUBLISHED",
        isSystem: p.isSystem,
      },
    });
  }

  // 16. Vezolla Vitrin Karşılama Alanı (Hero Banner)
  const homeBlock = await db.homeBlock.create({
    data: {
      page: "home",
      type: "hero_banner",
      name: "Vezolla Ana Karşılama Alanı (Hero)",
      position: 0,
      isActive: true,
    },
  });

  await db.homeBlockVariant.create({
    data: {
      blockId: homeBlock.id,
      name: "Varsayılan Vezolla Karşılama Alanı",
      config: {
        headline: "Zarafet İçten Başlar",
        subheadline:
          "Vezolla, zarafeti gösterişte değil incelikte arayan bir giyim markasıdır. Akışkan kumaş kıvrımı amblemi ve yüksek kontrastlı tipografisiyle kalıcı, rafine ve zahmetsiz bir şıklığı temsil eder.",
        ctaLabel: "Koleksiyonu Keşfet",
        ctaHref: "/katalog",
        imageUrl: "/brand/transparan-logo.png",
      },
    },
  });

  // 17. Dinamik Menüler (Header ve Footer)
  const headerMenu = await db.menu.create({
    data: {
      handle: "header",
      name: "Üst Menü (Header)",
    },
  });

  await db.menuItem.create({
    data: {
      menuId: headerMenu.id,
      label: "İç Giyim & Fantazi",
      type: "CATEGORY",
      url: "/kategori/ic-giyim-fantazi",
      targetId: rootCat1.id,
      position: 0,
    },
  });

  await db.menuItem.create({
    data: {
      menuId: headerMenu.id,
      label: "Elbise & Hazır Giyim",
      type: "URL",
      url: "/kategori/elbise-hazir-giyim",
      position: 1,
    },
  });

  await db.menuItem.create({
    data: {
      menuId: headerMenu.id,
      label: "Saten & İpek",
      type: "URL",
      url: "/kategori/saten-ipek-koleksiyonu",
      position: 2,
    },
  });

  await db.menuItem.create({
    data: {
      menuId: headerMenu.id,
      label: "Yeni Gelenler",
      type: "URL",
      url: "/katalog?sort=newest",
      position: 3,
    },
  });

  const footerMenu = await db.menu.create({
    data: {
      handle: "footer",
      name: "Alt Menü (Footer)",
    },
  });

  await db.menuItem.create({
    data: {
      menuId: footerMenu.id,
      label: "Hakkımızda",
      type: "PAGE",
      url: "/sayfa/hakkimizda",
      position: 0,
    },
  });

  await db.menuItem.create({
    data: {
      menuId: footerMenu.id,
      label: "Teslimat & Kargo",
      type: "PAGE",
      url: "/sayfa/teslimat-ve-kargo",
      position: 1,
    },
  });

  await db.menuItem.create({
    data: {
      menuId: footerMenu.id,
      label: "KVKK Aydınlatma",
      type: "PAGE",
      url: "/sayfa/kvkk",
      position: 2,
    },
  });

  await db.menuItem.create({
    data: {
      menuId: footerMenu.id,
      label: "Müşteri Destek & İletişim",
      type: "PAGE",
      url: "/sayfa/iletisim",
      position: 3,
    },
  });

  // 17.5. Standart Kargo Yöntemi (1.500 TL üzeri ücretsiz kargo baremi)
  await db.shippingMethod.create({
    data: {
      name: "Standart Kargo (Yurtiçi / Aras)",
      description: "1.500 TL ve üzeri siparişlerde kargo ücretsiz",
      carrier: "yurtici",
      price: 7990,
      freeOverAmount: 150000,
      cities: [],
      estimatedDays: "1-3 iş günü",
      isActive: true,
      position: 0,
    },
  });

  // 18. Vezolla Resmi Sistem Ayarlarını Kaydet
  await db.setting.createMany({
    data: [
      { key: "store", value: DEFAULT_STORE_SETTINGS },
      { key: "theme", value: DEFAULT_THEME_SETTINGS },
      { key: "payment", value: DEFAULT_PAYMENT_SETTINGS },
      { key: "conversion", value: DEFAULT_CONVERSION_SETTINGS },
      { key: "abandoned_cart", value: DEFAULT_ABANDONED_CART_SETTINGS },
    ],
  });

  console.log("=== SIFIR KURULUM BAŞARIYLA TAMAMLANDI ===");
  console.log("Marka: VEZOLLA (Zarafet İçten Başlar)");
  console.log("Tema: Vezolla Elegance (#F6F1ED krem zemin, #2C2C2E antrasit metin, #B67878 toz gül)");
  console.log("Logo: /brand/transparan-logo.png | Favicon: /favicon.svg");
  console.log("Giriş: admin@vezolla.com / Admin123!");
  console.log("Katalog durumu: 0 ürün (sıfır kurulumlu, gerçek ürün/XML girişine hazır)");

  await pool.end();
}

main().catch((err) => {
  console.error("Sıfır kurulum sırasında hata:", err);
  process.exit(1);
});
