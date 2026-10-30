import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "@node-rs/argon2";
import { PrismaClient } from "../src/generated/prisma/client";
import { ALL_PERMISSION_KEYS } from "../src/lib/rbac/permissions";

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5433/eticaret";

const PRODUCT_LIFESTYLE_IMAGES: Record<string, string> = {
  "dimmerli-mimari-led-masa-lambasi":
    "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=800&q=80",
  "moduler-aluminyum-dizustu-standi":
    "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=800&q=80",
  "el-yapimi-seramik-demleme-ve-fincan-seti":
    "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=800&q=80",
  "masif-mese-masaustu-duzenleyici-set":
    "https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=800&q=80",
  "su-gecirmez-kanvas-gunluk-sirt-cantasi":
    "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=80",
  "cift-cidarli-paslanmaz-celik-termos":
    "https://images.unsplash.com/photo-1517256064527-09c73fc73e38?auto=format&fit=crop&w=800&q=80",
  "dogal-tas-yikama-keten-masa-ortusu":
    "https://images.unsplash.com/photo-1616046229478-9901c5536a45?auto=format&fit=crop&w=800&q=80",
  "el-tornasi-mat-sirli-seramik-surahi":
    "https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=800&q=80",
  "masif-ceviz-kesme-ve-sunum-tahtasi":
    "https://images.unsplash.com/photo-1590736969955-71cc94801759?auto=format&fit=crop&w=800&q=80",
  "pirinc-govdeli-keten-baslikli-masa-lambasi":
    "https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?auto=format&fit=crop&w=800&q=80",
};

function makeProductSvgDataUri(title: string, subtitle: string, accent: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000">
    <rect width="800" height="1000" fill="#F8F7F4"/>
    <rect x="64" y="64" width="672" height="872" rx="12" fill="#FFFFFF" stroke="#E4E2DD" stroke-width="2"/>
    <circle cx="400" cy="400" r="148" fill="${accent}" fill-opacity="0.12"/>
    <rect x="304" y="304" width="192" height="192" rx="20" fill="none" stroke="${accent}" stroke-width="6"/>
    <text x="400" y="680" text-anchor="middle" font-family="system-ui, sans-serif" font-size="26" font-weight="600" fill="#18181B">${title}</text>
    <text x="400" y="724" text-anchor="middle" font-family="system-ui, sans-serif" font-size="16" fill="#71717A">${subtitle}</text>
    <text x="400" y="880" text-anchor="middle" font-family="monospace" font-size="13" fill="#A1A1AA">ÖRNEK TOHUM ÜRÜN GÖRSELİ</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

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

  console.log("Tohumlama (seed) başlatılıyor...");

  // 1. Roller ve Varsayılan Yönetici Hesabı
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

  const adminPasswordHash = await hashPass("Admin123!");
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

  // 2. Müşteri Grupları ve Örnek Müşteri
  const standardGroup = await db.customerGroup.upsert({
    where: { name: "Standart Üye" },
    create: {
      name: "Standart Üye",
      description: "Bireysel perakende müşterileri",
    },
    update: {},
  });

  await db.customerGroup.upsert({
    where: { name: "Kurumsal / Bayi" },
    create: {
      name: "Kurumsal / Bayi",
      description: "Özel fiyat listesine tabi kurumsal alıcılar",
    },
    update: {},
  });

  const customerPassHash = await hashPass("Musteri123!");
  const demoCustomer = await db.customer.upsert({
    where: { email: "musteri@ornek-magaza.local" },
    create: {
      email: "musteri@ornek-magaza.local",
      firstName: "Deniz",
      lastName: "Kaya",
      phone: "0532 555 01 02",
      passwordHash: customerPassHash,
      groupId: standardGroup.id,
      acceptsMarketing: true,
      marketingConsentAt: new Date(),
      kvkkConsentAt: new Date(),
    },
    update: {
      passwordHash: customerPassHash,
    },
  });

  const existingAddr = await db.address.findFirst({
    where: { customerId: demoCustomer.id },
  });
  if (!existingAddr) {
    await db.address.create({
      data: {
        customerId: demoCustomer.id,
        title: "Ev Adresim",
        firstName: "Deniz",
        lastName: "Kaya",
        phone: "0532 555 01 02",
        city: "İstanbul",
        district: "Kadıköy",
        neighborhood: "Caferağa Mah.",
        line1: "Moda Cad. No: 42 Daire: 5",
        postalCode: "34710",
        invoiceType: "INDIVIDUAL",
        isDefaultShipping: true,
        isDefaultBilling: true,
      },
    });
  }

  // 3. Depolar
  const mainWarehouse = await db.warehouse.upsert({
    where: { code: "IST-01" },
    create: {
      name: "Ana Lojistik Merkezi (İstanbul)",
      code: "IST-01",
      address: "Tuzla Organize Sanayi Bölgesi, İstanbul",
      isDefault: true,
      isActive: true,
      priority: 1,
    },
    update: { isDefault: true, isActive: true },
  });

  await db.warehouse.upsert({
    where: { code: "ANK-02" },
    create: {
      name: "İç Anadolu Bölge Deposu (Ankara)",
      code: "ANK-02",
      address: "Sincan OSB, Ankara",
      isDefault: false,
      isActive: true,
      priority: 2,
    },
    update: {},
  });

  // 4. KDV Sınıfları
  const defaultTaxClass = await db.taxClass.upsert({
    where: { name: "Genel KDV (%20)" },
    create: {
      name: "Genel KDV (%20)",
      rateBps: 2000,
      isDefault: true,
    },
    update: { isDefault: true },
  });

  await db.taxClass.upsert({
    where: { name: "İndirimli KDV (%10)" },
    create: {
      name: "İndirimli KDV (%10)",
      rateBps: 1000,
      isDefault: false,
    },
    update: {},
  });

  // 5. Kargo Yöntemleri
  const existingShipping = await db.shippingMethod.count();
  if (existingShipping === 0) {
    await db.shippingMethod.createMany({
      data: [
        {
          name: "Yurtiçi Kargo Standart Teslimat",
          carrier: "yurtici",
          description: "1-3 iş günü içinde adrese teslim",
          price: 7990,
          freeOverAmount: 150000,
          estimatedDays: "1-3 iş günü",
          position: 0,
          isActive: true,
        },
        {
          name: "Kolay Gelsin Randevulu Teslimat",
          carrier: "kolaygelsin",
          description: "Seçtiğiniz saat aralığında hızlı teslimat",
          price: 9990,
          freeOverAmount: 250000,
          estimatedDays: "1-2 iş günü",
          position: 1,
          isActive: true,
        },
      ],
    });
  }

  // 6. E-posta Şablonları
  const emailTemplates = [
    {
      key: "order_placed",
      name: "Sipariş Onay E-postası",
      subject: "Siparişiniz Alındı (#{{orderNumber}})",
      bodyHtml:
        "<p>Merhaba {{customerName}},</p><p><strong>#{{orderNumber}}</strong> numaralı siparişiniz başarıyla alındı. Toplam tutar: <strong>{{orderTotal}}</strong> ({{paymentMethod}}).</p><p><a href=\"{{orderUrl}}\">Sipariş detaylarını görüntülemek için tıklayın.</a></p>",
    },
    {
      key: "order_shipped",
      name: "Sipariş Kargoya Verildi",
      subject: "Siparişiniz Kargoya Verildi (#{{orderNumber}})",
      bodyHtml:
        "<p>Merhaba {{customerName}},</p><p><strong>#{{orderNumber}}</strong> numaralı siparişiniz <strong>{{carrier}}</strong> ile kargoya verilmiştir. Takip Numarası: <strong>{{trackingNumber}}</strong>.</p>",
    },
    {
      key: "back_in_stock",
      name: "Stok Gelince Haber Ver Bildirimi",
      subject: "Beklediğiniz Ürün Tekrar Stokta: {{productTitle}}",
      bodyHtml:
        "<p>Merhaba,</p><p>Takip ettiğiniz <strong>{{productTitle}}</strong> ürünü tekrar stoğa girmiştir. <a href=\"{{productUrl}}\">Ürünü incelemek için tıklayın.</a></p>",
    },
  ];

  for (const tpl of emailTemplates) {
    await db.emailTemplate.upsert({
      where: { key: tpl.key },
      create: tpl,
      update: {},
    });
  }

  // 7. Yasal ve Kurumsal CMS Sayfaları
  const cmsPages = [
    {
      slug: "kvkk-aydinlatma-metni",
      title: "KVKK Aydınlatma Metni",
      content:
        "<p>6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında kişisel verileriniz yalnızca sipariş süreçlerinin yürütülmesi, yasal yükümlülüklerin yerine getirilmesi ve açık rızanız olması halinde kişiselleştirilmiş alışveriş deneyimi sunulması amacıyla işlenmektedir.</p><p>Çerez tercihlerinizi vitrin alt bilgisindeki Çerez Tercihleri bağlantısından dilediğiniz zaman değiştirebilirsiniz.</p>",
      isSystem: true,
    },
    {
      slug: "mesafeli-satis-bilgisi",
      title: "Mesafeli Satış ve Teslimat Bilgisi",
      content:
        "<p>Siparişleriniz ödeme onayının ardından anlaşmalı kargo firmalarımız aracılığıyla sigortalı olarak sevk edilir. Her sipariş için Ön Bilgilendirme Formu ve Mesafeli Satış Sözleşmesi ödeme adımında otomatik olarak üretilir ve sipariş kaydınızda saklanır.</p>",
      isSystem: true,
    },
    {
      slug: "iade-ve-degisim-kosullari",
      title: "İade ve Değişim Koşulları",
      content:
        "<p>6502 sayılı Tüketicinin Korunması Hakkında Kanun uyarınca teslim tarihinden itibaren 14 gün içerisinde cayma hakkınızı kullanabilirsiniz. Hesabım sayfasındaki Siparişlerim bölümünden tek tıkla iade talebi (RMA) oluşturabilirsiniz.</p>",
      isSystem: true,
    },
    {
      slug: "hakkimizda",
      title: "Hakkımızda",
      content:
        "<p>Bu mağaza, kategori ve markadan bağımsız, uçtan uca yönetilebilir modüler e-ticaret altyapısı üzerinde çalışmaktadır. Tüm katalog, XML entegrasyonları, fiyatlandırma kuralları ve ziyaretçi kişiselleştirme kurgusu yönetim panelinden canlı olarak özelleştirilebilir.</p>",
      isSystem: false,
    },
  ];

  for (const p of cmsPages) {
    await db.page.upsert({
      where: { slug: p.slug },
      create: {
        ...p,
        status: "PUBLISHED",
      },
      update: {},
    });
  }

  // 8. Markalar ve Özel Alan Tanımları
  const brandAtolye = await db.brand.upsert({
    where: { slug: "atolye-kuzey" },
    create: {
      name: "Atölye Kuzey",
      slug: "atolye-kuzey",
      description: "Fonksiyonel ve uzun ömürlü günlük kullanım ürünleri",
    },
    update: {},
  });

  const brandMono = await db.brand.upsert({
    where: { slug: "monoform" },
    create: {
      name: "Monoform",
      slug: "monoform",
      description: "Modüler çalışma alanı ve organizasyon ekipmanları",
    },
    update: {},
  });

  const attrMaterial = await db.attributeDefinition.upsert({
    where: { key: "materyal" },
    create: {
      label: "Materyal",
      key: "materyal",
      kind: "SELECT",
      options: [
        "Eloksallı Alüminyum",
        "Masif Meşe",
        "Geri Dönüştürülmüş Kanvas",
        "Paslanmaz Çelik",
        "Seramik",
      ],
      isFilterable: true,
      position: 0,
    },
    update: {},
  });

  const attrWarranty = await db.attributeDefinition.upsert({
    where: { key: "garanti_suresi" },
    create: {
      label: "Garanti Süresi",
      key: "garanti_suresi",
      kind: "NUMBER",
      unit: "Ay",
      isFilterable: true,
      position: 1,
    },
    update: {},
  });

  const attrOrigin = await db.attributeDefinition.upsert({
    where: { key: "mensei" },
    create: {
      label: "Üretim Yeri",
      key: "mensei",
      kind: "TEXT",
      isFilterable: true,
      position: 2,
    },
    update: {},
  });

  // 9. Kategoriler
  const catWorkspace = await db.category.upsert({
    where: { slug: "calisma-alani" },
    create: {
      name: "Çalışma Alanı ve Masaüstü",
      slug: "calisma-alani",
      description: "Masaüstü düzenleyiciler, standlar ve çalışma ekipmanları",
      position: 0,
      isActive: true,
    },
    update: {},
  });

  const catLiving = await db.category.upsert({
    where: { slug: "ev-ve-yasam" },
    create: {
      name: "Ev ve Yaşam",
      slug: "ev-ve-yasam",
      description: "Günlük yaşamı kolaylaştıran zamansız tasarım nesneleri",
      position: 1,
      isActive: true,
    },
    update: {},
  });

  const catTravel = await db.category.upsert({
    where: { slug: "seyahat-ve-tasima" },
    create: {
      name: "Seyahat ve Taşıma",
      slug: "seyahat-ve-tasima",
      description: "Çantalar, termoslar ve koruyucu taşıma kılıfları",
      position: 2,
      isActive: true,
    },
    update: {},
  });

  const catLighting = await db.category.upsert({
    where: { slug: "aydinlatma" },
    create: {
      name: "Aydınlatma ve Aksesuar",
      slug: "aydinlatma",
      description: "Masa lambaları, ortam aydınlatmaları ve tamamlayıcı aksesuarlar",
      position: 3,
      isActive: true,
    },
    update: {},
  });

  // 10. Örnek Ürünler (Açıkça örnek veri olarak etiketlenmiş)
  const sampleProducts = [
    {
      slug: "moduler-aluminyum-dizustu-standi",
      title: "Modüler Alüminyum Dizüstü Standı",
      subtitle: "Ergonomik açı ayarlı masaüstü yükseltici (Örnek Tohum Ürün)",
      description:
        "<p>Tek parça eloksallı alüminyum gövdeden üretilen bu masaüstü stand, 11 inç ile 17 inç arasındaki tüm taşınabilir bilgisayarlarla uyumludur. Hava akışını iyileştirir ve göz hizasında ergonomik çalışma sağlar.</p>",
      brandId: brandMono.id,
      categoryId: catWorkspace.id,
      accent: "#9A3412",
      material: "Eloksallı Alüminyum",
      warranty: 24,
      optionName: "Renk",
      variants: [
        {
          sku: "MNF-STD-GRY",
          barcode: "8680001000101",
          title: "Uzay Grisi",
          optionVal: "Uzay Grisi",
          price: 185000,
          compareAtPrice: 220000,
          costPrice: 110000,
          stock: 18,
        },
        {
          sku: "MNF-STD-SLV",
          barcode: "8680001000102",
          title: "Doğal Gümüş",
          optionVal: "Doğal Gümüş",
          price: 185000,
          compareAtPrice: 220000,
          costPrice: 110000,
          stock: 12,
        },
      ],
    },
    {
      slug: "masif-mese-masaustu-duzenleyici-set",
      title: "Masif Meşe Masaüstü Düzenleyici Set",
      subtitle: "3 parçalı mıknatıslı kalemlik ve aksesuar tepsisi (Örnek Tohum Ürün)",
      description:
        "<p>Doğal yağ ile korunmuş fırınlanmış masif meşe ağacından üretilmiştir. Modüller içindeki gizli mıknatıslar sayesinde çalışma masanızda istediğiniz dizilimde birleştirilebilir.</p>",
      brandId: brandAtolye.id,
      categoryId: catWorkspace.id,
      accent: "#78350F",
      material: "Masif Meşe",
      warranty: 24,
      optionName: "Boyut",
      variants: [
        {
          sku: "ATK-ORG-STD",
          barcode: "8680001000201",
          title: "Standart 3'lü Set",
          optionVal: "Standart 3'lü Set",
          price: 129000,
          compareAtPrice: null,
          costPrice: 72000,
          stock: 25,
        },
        {
          sku: "ATK-ORG-PRO",
          barcode: "8680001000202",
          title: "Geniş 5'li Set",
          optionVal: "Geniş 5'li Set",
          price: 179000,
          compareAtPrice: 199000,
          costPrice: 98000,
          stock: 9,
        },
      ],
    },
    {
      slug: "su-gecirmez-kanvas-gunluk-sirt-cantasi",
      title: "Su Geçirmez Kanvas Günlük Sırt Çantası",
      subtitle: "16 inç bilgisayar bölmeli şehir ve seyahat çantası (Örnek Tohum Ürün)",
      description:
        "<p>Balmumu kaplamalı ağır gramajlı geri dönüştürülmüş kanvas kumaştan üretilmiştir. Darbe emici bilgisayar bölmesi, gizli pasaport cebi ve su şişesi bölmeleriyle günlük kullanıma uygundur.</p>",
      brandId: brandAtolye.id,
      categoryId: catTravel.id,
      accent: "#1E3A8A",
      material: "Geri Dönüştürülmüş Kanvas",
      warranty: 24,
      optionName: "Renk",
      variants: [
        {
          sku: "ATK-BAG-OLV",
          barcode: "8680001000301",
          title: "Haki Yeşil (20L)",
          optionVal: "Haki Yeşil",
          price: 245000,
          compareAtPrice: 289000,
          costPrice: 135000,
          stock: 14,
        },
        {
          sku: "ATK-BAG-BLK",
          barcode: "8680001000302",
          title: "Kömür Siyahı (20L)",
          optionVal: "Kömür Siyahı",
          price: 245000,
          compareAtPrice: 289000,
          costPrice: 135000,
          stock: 11,
        },
      ],
    },
    {
      slug: "cift-cidarli-paslanmaz-celik-termos",
      title: "Çift Cidarlı Paslanmaz Çelik Termos 600ml",
      subtitle: "12 saat sıcak, 24 saat soğuk koruma (Örnek Tohum Ürün)",
      description:
        "<p>304 kalite gıda sınıfı paslanmaz çelik iç ve dış yüzey, bakır kaplamalı vakum izolasyonu ve sızdırmaz kilitli kapak mekanizması ile uzun yolculuklarda güvenle kullanılır.</p>",
      brandId: brandMono.id,
      categoryId: catTravel.id,
      accent: "#065F46",
      material: "Paslanmaz Çelik",
      warranty: 36,
      optionName: "Renk",
      variants: [
        {
          sku: "MNF-TRM-MAT",
          barcode: "8680001000401",
          title: "Mat Siyah",
          optionVal: "Mat Siyah",
          price: 94000,
          compareAtPrice: 115000,
          costPrice: 48000,
          stock: 32,
        },
        {
          sku: "MNF-TRM-TER",
          barcode: "8680001000402",
          title: "Kiremit",
          optionVal: "Kiremit",
          price: 94000,
          compareAtPrice: 115000,
          costPrice: 48000,
          stock: 19,
        },
      ],
    },
    {
      slug: "dimmerli-mimari-led-masa-lambasi",
      title: "Dimmerli Mimari LED Masa Lambası",
      subtitle: "2700K-5500K renk sıcaklığı ayarlı çalışma aydınlatması (Örnek Tohum Ürün)",
      description:
        "<p>Yüksek renksel geriverim indeksine (CRI 95+) sahip titreşimsiz LED paneli, göz yorgunluğunu azaltır. Dokunmatik gövde üzerinden parlaklık ve ışık sıcaklığı kademesiz olarak ayarlanabilir.</p>",
      brandId: brandMono.id,
      categoryId: catLighting.id,
      accent: "#9A3412",
      material: "Eloksallı Alüminyum",
      warranty: 24,
      optionName: "Gövde Rengi",
      variants: [
        {
          sku: "MNF-LMP-ANT",
          barcode: "8680001000501",
          title: "Antrasit",
          optionVal: "Antrasit",
          price: 319000,
          compareAtPrice: 365000,
          costPrice: 175000,
          stock: 8,
        },
      ],
    },
    {
      slug: "el-yapimi-seramik-demleme-ve-fincan-seti",
      title: "El Yapımı Seramik Demleme ve Fincan Seti",
      subtitle: "V60 dripper, karaf ve 2 adet fincan (Örnek Tohum Ürün)",
      description:
        "<p>Yüksek derecede pişirilmiş taş çamuru (stoneware) seramikten elde şekillendirilmiştir. Isıyı uzun süre muhafaza eden kalın cidarlı yapısı ile dengeli bir demleme sunar.</p>",
      brandId: brandAtolye.id,
      categoryId: catLiving.id,
      accent: "#57534E",
      material: "Seramik",
      warranty: 12,
      optionName: "Sır Tonu",
      variants: [
        {
          sku: "ATK-SRM-KRM",
          barcode: "8680001000601",
          title: "Kırık Beyaz Benekli",
          optionVal: "Kırık Beyaz Benekli",
          price: 158000,
          compareAtPrice: null,
          costPrice: 82000,
          stock: 15,
        },
      ],
    },
  ];

  const createdProductIds: string[] = [];

  for (const sp of sampleProducts) {
    const existing = await db.product.findUnique({ where: { slug: sp.slug } });
    if (existing) {
      createdProductIds.push(existing.id);
      continue;
    }

    const minPrice = Math.min(...sp.variants.map((v) => v.price));
    const maxPrice = Math.max(...sp.variants.map((v) => v.price));
    const totalStock = sp.variants.reduce((acc, v) => acc + v.stock, 0);

    const product = await db.product.create({
      data: {
        title: sp.title,
        slug: sp.slug,
        subtitle: sp.subtitle,
        description: sp.description,
        status: "ACTIVE",
        publishedAt: new Date(),
        brandId: sp.brandId,
        taxClassId: defaultTaxClass.id,
        minPrice,
        maxPrice,
        totalStock,
        weightGrams: 650,
        searchText: `${sp.title} ${sp.subtitle} ${sp.material}`.toLowerCase(),
        categories: {
          create: {
            categoryId: sp.categoryId,
            isPrimary: true,
          },
        },
        images: {
          create: {
            url:
              PRODUCT_LIFESTYLE_IMAGES[sp.slug] ??
              makeProductSvgDataUri(sp.title, sp.subtitle, sp.accent),
            alt: sp.title,
            position: 0,
          },
        },
        attributes: {
          create: [
            {
              attributeId: attrMaterial.id,
              valueText: sp.material,
            },
            {
              attributeId: attrWarranty.id,
              valueNumber: sp.warranty,
              valueText: `${sp.warranty}`,
            },
            {
              attributeId: attrOrigin.id,
              valueText: "Türkiye",
            },
          ],
        },
      },
    });

    createdProductIds.push(product.id);

    const opt = await db.productOption.create({
      data: {
        productId: product.id,
        name: sp.optionName,
        position: 0,
      },
    });

    for (let idx = 0; idx < sp.variants.length; idx++) {
      const vData = sp.variants[idx]!;
      const optVal = await db.productOptionValue.create({
        data: {
          optionId: opt.id,
          value: vData.optionVal,
          position: idx,
        },
      });

      const variant = await db.productVariant.create({
        data: {
          productId: product.id,
          sku: vData.sku,
          barcode: vData.barcode,
          title: vData.title,
          price: vData.price,
          compareAtPrice: vData.compareAtPrice,
          costPrice: vData.costPrice,
          position: idx,
          isActive: true,
          optionValues: {
            create: {
              optionValueId: optVal.id,
            },
          },
        },
      });

      await db.inventoryLevel.create({
        data: {
          variantId: variant.id,
          warehouseId: mainWarehouse.id,
          onHand: vData.stock,
          reserved: 0,
          lowStockThreshold: 5,
        },
      });
    }
  }

  // 11. Koleksiyonlar ve Promosyon Kuponları
  const featuredCollection = await db.collection.upsert({
    where: { slug: "one-cikan-secki" },
    create: {
      title: "Öne Çıkan Seçki",
      slug: "one-cikan-secki",
      description: "Çalışma alanı ve günlük yaşam için seçilmiş modüler ürünler",
      type: "MANUAL",
      isActive: true,
    },
    update: {},
  });

  for (let i = 0; i < createdProductIds.length; i++) {
    const pid = createdProductIds[i]!;
    await db.collectionProduct.upsert({
      where: {
        collectionId_productId: {
          collectionId: featuredCollection.id,
          productId: pid,
        },
      },
      create: {
        collectionId: featuredCollection.id,
        productId: pid,
        position: i,
      },
      update: {},
    });
  }

  await db.promotion.upsert({
    where: { code: "HOSGELDIN10" },
    create: {
      name: "Hoş Geldin %10 İndirim Kuponu",
      code: "HOSGELDIN10",
      description: "Tüm ürünlerde geçerli %10 sepet indirimi",
      type: "PERCENTAGE",
      value: 1000,
      conditions: { minSubtotalMinor: 50000 },
      isActive: true,
      isCombinable: false,
      priority: 10,
    },
    update: {},
  });

  await db.promotion.upsert({
    where: { code: "KARGO0" },
    create: {
      name: "Ücretsiz Kargo Kuponu",
      code: "KARGO0",
      description: "Alt limitsiz ücretsiz kargo",
      type: "FREE_SHIPPING",
      value: 0,
      conditions: {},
      isActive: true,
      isCombinable: true,
      priority: 5,
    },
    update: {},
  });

  // 12. Kişiselleştirme: Segmentler, Reklam Eşleştirmesi ve Ana Sayfa Blokları
  let metaAdSegment = await db.segment.findFirst({
    where: { name: "Meta Sonbahar Reklam Ziyaretçileri" },
  });
  if (!metaAdSegment) {
    metaAdSegment = await db.segment.create({
      data: {
        name: "Meta Sonbahar Reklam Ziyaretçileri",
        description:
          "ad_id=meta_ad_101 veya utm_campaign=sonbahar_lansman ile gelen ziyaretçiler",
        priority: 100,
        isActive: true,
        rules: {
          match: "ANY",
          conditions: [
            { field: "ad_id", operator: "equals", value: "meta_ad_101" },
            { field: "utm_campaign", operator: "equals", value: "sonbahar_lansman" },
          ],
        },
      },
    });
  }

  const existingAbandonedSeg = await db.segment.findFirst({
    where: { name: "Sepetinde Ürün Bekleyenler" },
  });
  if (!existingAbandonedSeg) {
    await db.segment.create({
      data: {
        name: "Sepetinde Ürün Bekleyenler",
        description: "Sepetine ürün ekleyip henüz sipariş tamamlamamış ziyaretçiler",
        priority: 80,
        isActive: true,
        rules: {
          match: "ALL",
          conditions: [{ field: "abandoned_cart", operator: "equals", value: true }],
        },
      },
    });
  }

  await db.adMapping.upsert({
    where: {
      matchField_matchValue: {
        matchField: "ad_id",
        matchValue: "meta_ad_101",
      },
    },
    create: {
      name: "Meta Sonbahar Çalışma Alanı Kampanyası (meta_ad_101)",
      platform: "META",
      matchField: "ad_id",
      matchValue: "meta_ad_101",
      segmentId: metaAdSegment.id,
      featuredProductIds: createdProductIds.slice(0, 3),
      isActive: true,
    },
    update: {
      segmentId: metaAdSegment.id,
      featuredProductIds: createdProductIds.slice(0, 3),
    },
  });

  await db.adMapping.upsert({
    where: {
      matchField_matchValue: {
        matchField: "utm_campaign",
        matchValue: "sonbahar_lansman",
      },
    },
    create: {
      name: "Sonbahar Lansman UTM Kampanyası",
      platform: "META",
      matchField: "utm_campaign",
      matchValue: "sonbahar_lansman",
      segmentId: metaAdSegment.id,
      featuredProductIds: createdProductIds.slice(0, 3),
      isActive: true,
    },
    update: {
      segmentId: metaAdSegment.id,
      featuredProductIds: createdProductIds.slice(0, 3),
    },
  });

  // Ana Sayfa Blokları
  const existingBlocks = await db.homeBlock.count();
  if (existingBlocks === 0) {
    await db.homeBlock.create({
      data: {
        page: "home",
        type: "hero_banner",
        name: "Ana Karşılama Alanı (Hero)",
        position: 0,
        isActive: true,
        variants: {
          create: [
            {
              name: "Varsayılan Karşılama",
              segmentId: null,
              weight: 100,
              config: {
                headline: "Uzun Ömürlü ve Modüler Günlük Tasarım Seçkisi",
                subheadline:
                  "Kategori ve markadan bağımsız, XML entegrasyonlu ve ziyaretçi davranışına göre şekillenen e-ticaret vitrini. Tüm blokları yönetim panelinden düzenleyebilirsiniz.",
                ctaLabel: "Kataloğu Keşfet",
                ctaHref: "/katalog",
                imageUrl:
                  "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1200&q=80",
              },
            },
            {
              name: "Meta Sonbahar Reklam Varyantı",
              segmentId: metaAdSegment.id,
              weight: 100,
              config: {
                headline: "Sonbahar Kampanyasına Özel Çalışma Alanı Ekipmanları",
                subheadline:
                  "Tıkladığınız reklama özel seçilen masaüstü standları ve düzenleyicilerde HOSGELDIN10 koduyla %10 indirim fırsatını değerlendirin.",
                ctaLabel: "Kampanya Ürünlerini Gör",
                ctaHref: "/kategori/calisma-alani",
                imageUrl:
                  "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=1200&q=80",
              },
            },
          ],
        },
      },
    });

    await db.homeBlock.create({
      data: {
        page: "home",
        type: "product_rail",
        name: "Kişiselleştirilmiş Öne Çıkan Ürünler",
        position: 1,
        isActive: true,
        variants: {
          create: [
            {
              name: "Varsayılan (Sizin İçin Seçilenler)",
              segmentId: null,
              weight: 100,
              config: {
                title: "Sizin İçin Öne Çıkanlar",
                subtitle:
                  "İncelediğiniz kategorilere ve ilgi profilinize göre dinamik sıralanan ürünler",
                source: "for_you",
                limit: 4,
                hideIfEmpty: false,
              },
            },
          ],
        },
      },
    });

    await db.homeBlock.create({
      data: {
        page: "home",
        type: "category_grid",
        name: "Kategori Vitrini",
        position: 2,
        isActive: true,
        variants: {
          create: [
            {
              name: "Varsayılan Kategoriler",
              segmentId: null,
              weight: 100,
              config: {
                title: "Kategorilere Göz Atın",
                subtitle: "İhtiyacınıza uygun ürün grubunu seçin",
                limit: 4,
              },
            },
          ],
        },
      },
    });

    await db.homeBlock.create({
      data: {
        page: "home",
        type: "product_rail",
        name: "En Çok Tercih Edilenler",
        position: 3,
        isActive: true,
        variants: {
          create: [
            {
              name: "Varsayılan Çok Satanlar",
              segmentId: null,
              weight: 100,
              config: {
                title: "En Çok Tercih Edilen Ürünler",
                subtitle: "Stoktan hızlı gönderim avantajıyla",
                source: "cold_start",
                limit: 6,
                hideIfEmpty: false,
              },
            },
          ],
        },
      },
    });
  }

  // 13. Örnek Tedarikçi XML Kaynağı ve Dışa Aktarma Feed'i
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(
    /\/+$/,
    ""
  );
  const existingFeed = await db.feedSource.findFirst({
    where: { name: "Örnek Tedarikçi XML Kaynağı (Canlı Demo)" },
  });
  if (!existingFeed) {
    await db.feedSource.create({
      data: {
        name: "Örnek Tedarikçi XML Kaynağı (Canlı Demo)",
        kind: "URL",
        url: `${appUrl}/api/admin/xml/sample`,
        itemPath: "Urunler.Urun",
        matchKey: "SKU",
        warehouseId: mainWarehouse.id,
        defaultCategoryId: catLiving.id,
        unmatchedCategoryPolicy: "CREATE",
        missingPolicy: "ZERO_STOCK",
        createAsStatus: "ACTIVE",
        scheduleMinutes: 360,
        isActive: true,
        mapping: {
          skuPath: "StokKodu",
          barcodePath: "Barkod",
          supplierCodePath: "UrunId",
          titlePath: "Baslik",
          subtitlePath: "AltBaslik",
          descriptionPath: "Aciklama",
          brandPath: "Marka",
          categoryPath: "Kategori",
          pricePath: "SatisFiyati",
          compareAtPricePath: "ListeFiyati",
          costPricePath: "AlisFiyati",
          stockPath: "Stok",
          imagesPath: "Gorseller.Gorsel",
          variantsPath: "Varyantlar.Varyant",
          variantSkuPath: "StokKodu",
          variantBarcodePath: "Barkod",
          variantPricePath: "Fiyat",
          variantStockPath: "Stok",
          variantOption1Name: "Renk",
          variantOption1ValuePath: "Renk",
          variantOption2Name: "Boyut",
          variantOption2ValuePath: "Boyut",
        },
        transform: {
          currencyMultiplier: 1,
          sourcePriceIncludesVat: true,
          marginMode: "PERCENT",
          marginPercentBps: 1500,
          marginFixedMinor: 0,
          tiers: [],
          roundingMode: "90",
          minStockThreshold: 2,
          titlePrefix: "",
          titleSuffix: "",
          replacements: [],
        },
        updatePolicy: {
          title: "CREATE_ONLY",
          description: "CREATE_ONLY",
          images: "CREATE_ONLY",
          category: "CREATE_ONLY",
          price: "ALWAYS",
          stock: "ALWAYS",
        },
      },
    });
  }

  await db.exportFeed.upsert({
    where: { token: "google-merchant-demo" },
    create: {
      name: "Google Merchant Center XML Feed",
      token: "google-merchant-demo",
      format: "GOOGLE",
      filters: { inStockOnly: false },
      isActive: true,
    },
    update: {},
  });

  await db.exportFeed.upsert({
    where: { token: "bayi-xml-demo" },
    create: {
      name: "Özel Bayi / Pazaryeri XML Çıktısı",
      token: "bayi-xml-demo",
      format: "CUSTOM",
      filters: { inStockOnly: true },
      isActive: true,
    },
    update: {},
  });

  await db.$disconnect();
  await pool.end();
  console.log("Tohumlama (seed) başarıyla tamamlandı.");
}

main().catch((err) => {
  console.error("Seed hatası:", err);
  process.exit(1);
});
