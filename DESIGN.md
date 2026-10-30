# DESIGN.md: Görsel Yön ve Tasarım Sistemi

## 1. Durum ve Kimlik (R-37)

Marka adı ve kategori henüz kesinleşmediği için vitrin teması **"Yönsüz Taslak (Draft without direction)"** olarak etiketlenmiştir ve yönetim panelinden (`/admin/ayarlar/tema`) kod değişikliği gerektirmeden özelleştirilebilir.

- **Vitrin Design Read**: Reading this as: brand-agnostic e-commerce storefront draft for retail shoppers, in an editorial catalog language, dial `ENERGY 1 / RHYTHM 1 / MOTION 1`.
- **Yönetim Paneli Design Read**: Reading this as: operational commerce back-office for store operators, in a dense tabular workbench language, dial `ENERGY 1 / RHYTHM 2 / MOTION 1`.

## 2. Renk Paleti (R-01, R-25, R-29)

Aktif palet 2 ana nötr + 1 vurgu renginden oluşur. Tüm metin eşleşmeleri WCAG AA (4.5:1+) kontrast standardını sağlar:

- **Zemin (Surface)**: `#fafaf9` (Stone 50, kağıt hissi veren sıcak açık zemin) ve `#ffffff` (kart/tablo yüzeyi)
- **Mürekkep (Ink / Primary)**: `#18181b` (Zinc 900, birincil metin ve ana aksiyon dolgusu; `#fafaf9` üzerinde 16.8:1 kontrast)
- **İkincil Metin**: `#52525b` (Zinc 600; `#ffffff` üzerinde 7.0:1 kontrast)
- **Kenarlık**: `#e4e4e7` (Zinc 200, 1px keskin ayraçlar)
- **Tek Vurgu Rengi (Accent)**: `#9a3412` (Kiremit / Terracotta, `#ffffff` üzerinde 6.8:1 kontrast). Yalnızca birincil indirim/kampanya vurgusu ve aktif durum işaretinde kullanılır.
- **Durum Renkleri**:
  - Başarılı / Stokta: `#166534` metin, `#dcfce7` zemin
  - Uyarı / Kritik stok: `#92400e` metin, `#fef3c7` zemin
  - Hata / İptal: `#991b1b` metin, `#fee2e2` zemin

## 3. Tipografi (R-06)

- **Vitrin Başlıkları**: `Instrument Serif` (veya panelden seçilen `Plus Jakarta Sans` / `IBM Plex Sans`). Editoryal katalog kimliği verir.
- **Gövde ve Yönetim Paneli**: `Plus Jakarta Sans`. Türkçe karakter desteği tam, yoğun veri tablolarında yüksek okunabilirlik sağlar.
- **Sayısal Veriler (Fiyat, SKU, Barkod, Sipariş No, Stok)**: `font-variant-numeric: tabular-nums` ve `IBM Plex Mono` (yalnızca gerçek kod, SKU, XML düğüm yolu ve para tablolarında).

## 4. İkonografi ve Bileşen Kuralları (R-04, R-10, R-11, R-12)

- **İkon Seti**: `@phosphor-icons/react` (Lucide varsayılanından kaçınmak ve mimari netlik sağlamak için seçildi). Yalnızca işlevi doğrudan anlatan ikonlar kullanılır; süs amaçlı yıldız/parıltı/roket ikonu ve metin içi emoji kullanılmaz.
- **Köşe Yuvarlaklığı (R-11)**: Tutarlı `rounded-md` (6px) tasarım sistemi; tüm öğeleri hap (`rounded-full`) yapmaktan kaçınılır.
- **Gölge ve Blur (R-10, R-12)**: Kartlar gölgesiz, `1px solid #e4e4e7` kenarlıkla ayrılır. Gölge yalnızca açılır menü ve modal katmanında (`shadow-lg`) yükselti belirtmek için kullanılır.
- **Metin Kuralları (R-02, R-15, R-16)**:
  - Metinlerde uzun tire (em dash) kesinlikle kullanılmaz; virgül, iki nokta veya nokta kullanılır.
  - "Keşfet", "Daha Fazla" gibi jenerik butonlar yerine "Varyantları İncele", "Sepete Ekle", "Siparişi Tamamla" gibi somut eylem metinleri kullanılır.
