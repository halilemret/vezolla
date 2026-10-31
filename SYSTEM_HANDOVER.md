# VEZOLLA E-Ticaret Platformu — Kapsamlı Sistem & Agent Devir Teslim Dokümanı (Handover)

> Bu belge, projeyi devralacak yeni AI Agent'ın veya baş mühendisin sisteme sıfır sürtünmeyle adapte olması, mimari kararları, iş kurallarını, güvenlik kısıtlamalarını ve teknik standartları eksiksiz sürdürebilmesi amacıyla hazırlanmıştır.

---

## 1. Sistemin Özeti ve Kimliği

- **Platform Adı**: VEZOLLA E-Ticaret Platformu
- **Marka Kimliği**: "Zarafet İçten Başlar" — Didone / Serif editoryal katalog kimliği, sakin lüks estetik, yüksek kontrast, WCAG AA uyumluluğu.
- **Mimari Tip**: Modüler Monolit (Modular Monolith) — Next.js 16 App Router + React 19 + Prisma 7 Multi-Schema PostgreSQL + Expo (React Native) Mobil Operasyon Uygulaması.
- **Kritik Giriş Bilgileri**:
  - Web Panel: `http://localhost:3000/admin/giris`
  - Süper Yönetici: `admin@vezolla.com` / `Admin123!`
  - Yedek Yönetici: `admin@ornek-magaza.local` / `Admin123!`
  - Veritabanı: `postgresql://postgres:postgres@localhost:5433/eticaret` (Lokal gömülü Postgres)

---

## 2. Teknoloji Yığını ve Altyapı

| Katman | Teknoloji / Kütüphane | Versiyon | Görev & Kritik Detay |
|---|---|---|---|
| **Fullstack Framework** | **Next.js** (App Router, Turbopack) | `16.4.3` | SSR, React Server Components, Server Actions (`server-only`). |
| **UI Library** | **React** | `19.3.1` | Modern useActionState, Transitions, Concurrent render. |
| **Stil & Tasarım** | **Tailwind CSS v4** | `4.3.3` | PostCSS tabanlı CSS değişkenleri (`var(--ink)`, `var(--surface)`, `var(--card)`). |
| **ORM & Veritabanı** | **Prisma** + `@prisma/adapter-pg` | `7.10.1` | Çoklu şema (`prisma/schema/*.prisma`), Pg Connection Pool. |
| **Lokal Veritabanı** | **embedded-postgres** | `18.4.0` | Sıfır kurulum gerektiren gömülü PostgreSQL (`.data/postgres`). |
| **Mobil Uygulama** | **Expo / React Native** | `SDK 52+` | Mağaza yöneticisi iOS/Android operasyon uygulaması (`mobile/`). |
| **İkonografi** | **@phosphor-icons/react** | `2.1.10` | Tutarlı, minimalist ve semantik ikon seti (Lucide alternatifi). |
| **Zengin Metin Editörü**| **Tiptap (StarterKit, Image, Link)**| `3.32.0` | Ürün açıklamaları ve CMS sayfaları için Headless WYSIWYG. |
| **Barkod & ZPL** | **bwip-js** | `4.11.4` | Kargo takip Code128 barkodları ve termal yazıcı ZPL üretimi. |
| **Ödeme Altyapısı** | **İyzico API** | Custom REST | 3D Secure checkout formu, taksit matrisi, webhook callback. |
| **XML & Feed Motoru**| **saxes** + **fast-xml-parser** | `6.0` / `5.11` | Düşük bellek tüketimli akışkan (streaming) dropshipping XML aktarımı. |
| **Test Paketi** | **Vitest** | `5.0.5` | 21 test dosyasında 126+ kapsamlı birim ve senaryo testi. |
| **Tip Doğrulama** | **TypeScript** (Strict) + **Zod** | `5.9` / `4.6` | Sıfır `any`, katı input/output Zod şemaları. |

---

## 3. Asla Çiğnenmeyecek Kurallar (Inviolable Anti-Slop Rules)

Projede aktif olan ve agent'ın tavizsiz uygulaması gereken **6 temel kural**:

1. **Parasal Değerler Kuralı (Minor Unit Integer)**:
   - Veritabanında ve iş mantığında **asla `Float` veya ondalık sayı tutulmaz**.
   - Tüm tutarlar **kuruş (minor unit)** olarak `Int` tipinde saklanır (`149,90 TL` = `14990`).
   - Formatlama: `formatMoney(minorAmount)` (`src/lib/money.ts`).
   - Kullanıcı / XML girdisini okuma: `parseMoneyInput(raw)`.

2. **Sepet, Fiyat ve Stok İstemcide Hesaplanamaz**:
   - İstemci (Client) yalnızca sepete ekleme niyetini bildirir; veritabanı fiyatı, indirim kuralları, promosyon kuponları, vergi ve kargo baremleri **mutlaka sunucu tarafında (Server Actions / Module Service)** hesaplanır.
   - Stok eksiltme ve rezervasyon çoklu depo (`planWarehouseReservations`) üzerinden atomik yapılır.

3. **Anti-Slop Görsel & Tasarım Kısıtlamaları**:
   - Jenerik AI süslemeleri YASAKTIR: `bg-gradient-to-r`, parıltılı blur orbları (`blur-3xl`), neon ışıklar, aşırı glassmorphism (`backdrop-blur`).
   - `backdrop-blur` dozu proje genelinde sınırlandırılmıştır (yalnızca masaüstü yapışkan başlıkta 1 adet).
   - Buton köşe kavisleri hap (`rounded-full`) yerine tok ve zarif `rounded-md` (6px) standardındadır.
   - Metinlerde jenerik em dash (`—`) kullanılmaz; virgül veya nokta kullanılır. Buton metinleri eylemi açıkça anlatmalıdır ("Keşfet" yerine "Varyantları İncele" veya "Sepete Ekle").

4. **Gerçek Veri Zorunluluğu (No Fake Social Proof)**:
   - `(10.000+ Mutlu Müşteri)` veya `4.9/5` gibi doğrulanmamış uydurma istatistikler kod içine gömülemez.
   - Değerlendirme ve puanlar veritabanındaki onaylı incelemelerden (`db.review`) dinamik çekilir.

5. **Strict TypeScript & Boş Fonksiyon Yasağı**:
   - `any` tipi kullanımı kesinlikle yasaktır; tüm modeller Prisma ve Zod ile tiplenmiştir.
   - Geleceğe ertelenen boş fonksiyon gövdeleri (`// TODO: implement here`) bırakılamaz; yazılan her özellik çalışan uçtan uca mantığıyla teslim edilir.

6. **Next.js 16 & Server-Only İzolasyonu**:
   - Sunucu tarafı veri erişim dosyalarının en başında `import "server-only";` bulunmalıdır.
   - Veritabanı sorguları (`db`) istemci bileşenlerine asla doğrudan sızdırılamaz.

---

## 4. Dizin Yapısı ve Modüler Monolit Mimarisi

```
c:\Users\Emre\Documents\area42\eticaret
├── .data/postgres/              # Lokal gömülü PostgreSQL veri tabanı dizini
├── mobile/                      # Expo / React Native iOS & Android Mağaza Operasyon Uygulaması
│   ├── src/                     # Auth, Dashboard, Siparişler, Stok Sayımı, İadeler
│   └── README.md                # Mobil mimari ve çalıştırma kılavuzu
├── prisma/
│   ├── schema/                  # Prisma 7 Multi-File Schema
│   │   ├── base.prisma          # Datasource ve generator ayarları
│   │   ├── catalog.prisma       # Ürün, Varyant, Kategori, Koleksiyon, Nitelik
│   │   ├── content.prisma       # Sayfalar, Dinamik Menüler, Hero Blokları, Yorumlar
│   │   ├── identity.prisma      # Personel, Roller, Müşteriler, Seanslar, Adresler
│   │   ├── inventory.prisma     # Depolar, Stok Seviyeleri, Rezervasyonlar
│   │   ├── personalization.prisma # UTM Ziyaretçi takibi, Segmentasyon, A/B Testi
│   │   ├── sales.prisma         # Sepet, Sipariş, Ödeme, İade, e-Fatura
│   │   ├── seo.prisma           # Anahtar kelimeler, Tarayıcı bot logları, SEO denetim
│   │   ├── system.prisma        # Ayarlar, AuditLog, DomainEvent, Job, Sayaçlar
│   │   └── xml.prisma           # Dropshipping FeedSource, Eşleme, FeedRun
│   └── seed.ts                  # Örnek tohumlama verisi
├── scripts/
│   ├── db.ts                    # `npm run db` gömülü PostgreSQL yöneticisi
│   ├── worker.ts                # `npm run worker` arka plan görev işçisi
│   └── zero-install.ts          # `npm run db:zero-install` sıfırdan kurumsal Vezolla kurulumu
├── src/
│   ├── app/
│   │   ├── (store)/             # Müşteri Vitrini (Katalog, Ürün Detay, Sepet, Ödeme, Takip)
│   │   ├── admin/               # Yönetici Paneli ((panel) workbench sayfaları & login)
│   │   ├── api/                 # REST API, Cron tetikleyici, İyzico callback, Mobil API
│   │   ├── feeds/               # Dışa aktarılan dinamik XML feed uçları (Google Merchant vb.)
│   │   └── llms.txt/            # AI motorları ve LLM crawler'lar için keşif dokümanı
│   ├── components/
│   │   ├── store/               # Vitrin bileşenleri (CartDrawer, FreeShippingBar, ProductCard)
│   │   ├── admin/               # Panel kabuğu, Komut paleti, Audit geçmişi
│   │   └── ui/                  # Temel tasarım sistemi bileşenleri (Button, Dialog, Input...)
│   ├── lib/
│   │   ├── db.ts                # PrismaClient singleton ve Pg havuz yöneticisi
│   │   ├── money.ts             # Kuruş / Parasal dönüşüm yardımcıları
│   │   ├── events.ts            # Outbox domain events yayınlayıcı ve dinleyiciler
│   │   ├── jobs.ts              # Asenkron görev kuyruğu (enqueueJob, executeClaimedJob)
│   │   ├── storage.ts           # Yerel / S3 dosya yükleme soyutlaması
│   │   └── settings/            # Tema presetleri ve sistem ayar şemaları
│   └── modules/                 # Modüler Domain Mantığı (İş Kuralları)
│       ├── catalog/             # Ürün ve kategori servisleri, filtreler
│       ├── checkout/            # Sepet motoru, sözleşmeler, upsell, sipariş tamamlama
│       ├── inventory/           # Stok rezervasyonları, depo transferleri, hareket günlüğü
│       ├── invoicing/           # GİB UBL-TR 1.2 XML motoru, otomatik e-arşiv faturalandırma
│       ├── orders/              # Sipariş yaşam döngüsü, ZPL ve kargo etiket üretimi
│       ├── payments/            # İyzico entegrasyonu, taksit matrisi, callback işleme
│       ├── personalization/     # UTM izleme, sepet terk analizi, ürün önerileri
│       ├── shipping/            # Yurtiçi, Aras, MNG kargo kuralları, ücretsiz kargo baremi
│       └── xml/                 # Büyük XML tedarikçi feeds, streaming parser, delta update
```

---

## 5. Kritik Modüller ve Çalışma Prensipleri

### A. Sepet, Satış ve Stok Rezervasyonu (`src/modules/checkout/`)
- Müşteri sepete ürün eklediğinde veya ödeme adımına geçtiğinde stok hemen kalıcı olarak düşürülmez.
- `planWarehouseReservations`: Depoların öncelik sırasına (`warehousePriority`) göre `onHand - reserved` kontrol edilir.
- `StockReservation`: 15 dakikalık geçici blokaj uygulanır. Süre dolduğunda veya sipariş iptal edildiğinde cron (`/api/cron`) ile stoklar iade edilir.
- `FreeShippingBar`: Mağaza ayarlarındaki bareme göre (Varsayılan: `1.500 TL` / `150000` kuruş) müşteriye anlık ne kadar alışveriş kaldığını hesaplar.
- `InstallmentModal`: Kart bin numarasına ve kart ailesine göre (World, Maximum, Axess, Bonus, Finans, Paraf) peşin fiyatına veya komisyonlu taksit tablosunu çıkarır.

### B. Ödeme ve İyzico Entegrasyonu (`src/modules/payments/`)
- İyzico Sandbox / Canlı API desteği.
- 3D Secure akışı: İstemci formu `checkoutFormContent` ile açar, kullanıcı banka SMS onayını tamamlar.
- Callback: `/api/payments/iyzico/callback` rotası webhook yanıtını doğrular, siparişi `PAID` durumuna geçirir, fatura işini sıraya ekler (`enqueueJob`).

### C. Dropshipping ve XML Entegrasyonu (`src/modules/xml/`)
- SAX ve Fast-XML-Parser ile GB mertebesindeki XML dosyalarını belleği şişirmeden akışkan (streaming) okur.
- İki aşamalı senkronizasyon: `PREVIEW` (önizleme ve istatistik) ve `APPLY` (veritabanına yazma).
- Otomatik kategori eşleme (`FeedCategoryMap`), dinamik fiyat marjı çarpanları ve stok eşikleri.
- Projede test edilmiş ve doğrulanmış gerçek 770 ürünlük `İmoda` XML kaynağı bulunmaktadır.

### D. e-Fatura / e-Arşiv UBL-TR 1.2 Motoru (`src/modules/invoicing/`)
- Gelir İdaresi Başkanlığı (GİB) formatına %100 uyumlu UBL-TR 1.2 XML faturası üretir.
- Sipariş tamamlandığında otomatik fatura oluşturur (`auto-invoicing.ts`).
- Yönetim panelinden tek tıkla e-Arşiv faturası PDF/HTML olarak görüntülenebilir veya UBL XML olarak indirilebilir.

### E. Kargo Etiket ve Termal Barkod Sistemi (`src/modules/orders/label.ts`)
- Standart lazer yazıcılar (A4/A6) ve termal etiket yazıcıları (ZPL II) için hazır şablon.
- Code128 barkod oluşturma (`bwip-js`).
- **Gizli Paketleme Standardı (`DISCREET_SHIPPING_LABEL`)**: Fatura/kargo etiketinde iç giyim veya hassas ürün detayları sansürlenir; yalnızca yasal şirket unvanı ve nötr paket kodu yazılır.

---

## 6. Olay ve Arka Plan Görev Mimarisi (Events & Jobs)

- **Domain Events (Outbox Pattern)**:
  - Kod içinde: `await emitDomainEvent("order.paid", { orderId: "..." })`
  - Olay `DomainEvent` tablosuna `PENDING` olarak yazılır ve anında yerel dinleyicilere dağıtılır. Başarısız olursa worker tarafından tekrar denenir.
- **Arka Plan İşleri (Job Queue)**:
  - Kod içinde: `await enqueueJob({ type: "send-abandoned-cart-email", payload: { ... } })`
  - İşler `Job` tablosunda sıralanır; `scripts/worker.ts` veya `/api/cron` tarafından işlenir.
- **Zamanlanmış Görevler (Cron)**:
  - Rezervasyon temizliği (15 dakikayı geçen sepet blokajlarının kaldırılması).
  - Terk edilmiş sepet kurtarma mailleri (2 saat sonra kupon teklifi ile).
  - Günlük XML besleme güncellemeleri.

---

## 7. Geliştirici ve Operasyon Komutları

```bash
# 1. Lokal PostgreSQL Veritabanını Başlat (Terminal 1)
npm run db

# 2. Sıfırdan Temiz Vezolla Verilerini Yükle (Gerekirse)
npm run db:zero-install

# 3. Next.js Web Sunucusunu Başlat (Terminal 2)
npm run dev

# 4. Arka Plan Cron/Worker İşçisini Başlat (Terminal 3)
npm run worker

# 5. Tüm Vitest Testlerini Çalıştır (126+ Test)
npm test

# 6. TypeScript Tip Kontrolü
npm run typecheck

# 7. Expo Mobil Uygulamasını Başlat (Mağaza Operasyonu)
npm run mobile
```

---

## 8. Çalışma Durumu ve Yeni Agent İçin Öncelikli Yol Haritası

### Tamamlanan ve Doğrulanan Son Çalışmalar:
- Vitrin Anti-Slop denetimi ve temizliği tamamlandı (`anti-slop/audit-001-2026-10-27.md`).
- Slide-over Ajax `CartDrawer` ve `cart-context` entegre edildi.
- `FreeShippingBar` ve `InstallmentModal` vitrinde yayına alındı.
- İyzico 3D Callback ve e-Arşiv UBL-TR motoru birim testlerle mühürlendi.
- 126 birim testi `%100` başarıyla geçmektedir.
- TypeScript derlemesi (`npm run typecheck`) sıfır hata vermektedir.

### Yeni Agent'ın Doğrudan Başlayabileceği Görevler:
1. **Uncommitted Değişiklikleri Commit'leme**: Çalışma ağacındaki yeni bileşenleri (`cart-drawer`, `installment-modal`, `free-shipping-bar`, testler) anlamlı commit mesajlarıyla ana dala eklemek.
2. **ESLint 9 Flat Config Uyarlaması**: `eslint.config.mjs` dosyasındaki Next.js flat-compat dairesel referansını temizlemek.
3. **Canlı İyzico ve Kargo API Anahtarları**: `.env` dosyasına gerçek mağaza sanal pos ve SMS ağ geçidi (Netgsm / İletiMerkezi) anahtarlarının bağlanması.
4. **Ek XML Dropshipping Kaynakları**: İmoda dışındaki yeni toptancı XML bağlantılarının panelden tanımlanması.
