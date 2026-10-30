# Eticaret Yönetim — Expo Mobil Uygulama (iOS & Android)

Bu uygulama, mağaza yöneticilerinin ve operasyon personelinin tüm sipariş, stok, katalog ve iade süreçlerini iOS ve Android cihazlar üzerinden anlık olarak yönetebilmesi için Expo (React Native) ile geliştirilmiştir.

---

## 📱 Özellikler

1. **Güvenli Kimlik Doğrulama**:
   - Web yönetim paneliyle aynı yetkilendirme altyapısı (Staff Session & Bearer Token).
   - Yetki rolüne göre işlem kısıtlamaları (RBAC).
   - Güvenli token ve sunucu bağlantı saklama (`AsyncStorage`).

2. **Operasyon & Aksiyon Merkezi (Dashboard)**:
   - Günlük ciro ve sipariş adetleri.
   - Acil aksiyon kuyrukları: Havale bekleyen siparişler, kargolanmayı bekleyen paketler, kritik stok uyarıları, bekleyen iadeler.
   - Tek dokunuşla ilgili sipariş veya stok listesine yönlendirme.
   - Son siparişler akışı ve çekip yenileme (Pull to refresh).

3. **Sipariş Yönetimi (Orders)**:
   - Sipariş arama (Sipariş No, Müşteri Adı, E-Posta, Telefon).
   - Durum sekmeleri: Tümü, Havale Onayı Bekleyen, Kargolanacak, Tamamlanan, İptal.
   - **Sipariş Detayı**:
     - Müşteri ve teslimat adresi dökümü.
     - Ürün kalemleri, adetler ve satır toplamları.
     - Havale ödemesini tek dokunuşla onaylama (`PAID`).
     - Kargo firması seçimi ve takip no ile gönderim başlatma (`SHIPPED`).
     - Teslim edildi olarak işaretleme (`DELIVERED`).
     - Sipariş iptali ve gerekçe kaydı.
     - Personel notu ekleme ve sipariş geçmişi.

4. **Katalog & Stok Yönetimi (Catalog & Inventory)**:
   - Ürün ve varyant listesi, kategori bilgisi, fiyat aralığı.
   - Filtreler: Tüm Ürünler, Kritik Stok (`<= 5`), Tükenenler (`0`).
   - Hızlı stok sayımı (`COUNT`) modalı ile anında sunucu tarafı stok güncelleme (server-side mutation).

5. **İade Yönetimi (Returns)**:
   - Müşteri iade taleplerini inceleme (neden ve açıklama).
   - İade onaylama, reddetme veya kargo teslim alındı işaretleme.

6. **Ayarlar & Profil**:
   - Aktif personel bilgisi ve sistem izinleri dökümü.
   - Sunucu adresi (API URL) yapılandırma ve tek dokunuşla bağlantı testi (Ping).
   - Güvenli çıkış yapma.

---

## 🚀 Çalıştırma

### 1. Web / Backend Sunucusunu Başlatın
```bash
# Ana proje dizininde:
npm run dev
```

### 2. Mobil Uygulamayı Başlatın
```bash
# Ana dizinden:
npm run mobile

# veya mobil dizinine geçerek:
cd mobile
npx expo start
```

### 3. Cihazda Görüntüleme
- **Fiziksel Cihaz (iPhone / Android)**:
  - App Store veya Google Play'den **Expo Go** uygulamasını indirin.
  - Terminalde çıkan QR kodunu kameranızla okutun.
  - *Not*: Fiziksel cihazdan bilgisayarınızdaki backend'e erişmek için giriş ekranındaki veya Ayarlar'daki sunucu adresini yerel ağ IP'niz olarak ayarlayın (Örn: `http://192.168.1.50:3000`).
- **Android Emulator**: Terminalde `a` tuşuna basın veya `npm run mobile:android` çalıştırın.
- **iOS Simulator (macOS)**: Terminalde `i` tuşuna basın veya `npm run mobile:ios` çalıştırın.
- **Web Önizleme**: Terminalde `w` tuşuna basın.

---

## 🏗️ Üretime Derleme (EAS Build)

iOS ve Android için bağımsız mağaza paketleri (.ipa, .apk, .aab) oluşturmak için Expo Application Services (EAS) kullanabilirsiniz:

```bash
cd mobile
npx eas build -p android --profile preview
npx eas build -p ios --profile preview
```
