export const PERMISSIONS = [
  {
    key: "catalog.read",
    group: "Katalog",
    label: "Ürün, kategori, koleksiyon ve markaları görüntüleme",
  },
  {
    key: "catalog.write",
    group: "Katalog",
    label: "Ürün, varyant, kategori, koleksiyon, marka ve özel alan düzenleme",
  },
  {
    key: "inventory.read",
    group: "Stok",
    label: "Depo ve stok hareketlerini görüntüleme",
  },
  {
    key: "inventory.write",
    group: "Stok",
    label: "Stok girişi, sayım düzeltmesi ve depo yönetimi",
  },
  {
    key: "xml.manage",
    group: "XML Entegrasyonu",
    label: "Tedarikçi XML kaynakları ve dışa aktarma feed yönetimi",
  },
  {
    key: "orders.read",
    group: "Sipariş",
    label: "Siparişleri ve iade taleplerini görüntüleme",
  },
  {
    key: "orders.write",
    group: "Sipariş",
    label: "Sipariş durumu, kargolama, havale onayı ve manuel sipariş",
  },
  {
    key: "orders.refund",
    group: "Sipariş",
    label: "Ödeme iadesi ve RMA onaylama",
  },
  {
    key: "customers.read",
    group: "Müşteri",
    label: "Müşteri ve müşteri gruplarını görüntüleme",
  },
  {
    key: "customers.write",
    group: "Müşteri",
    label: "Müşteri bilgisi, grup ve iç not düzenleme",
  },
  {
    key: "promotions.manage",
    group: "Promosyon",
    label: "Kupon ve otomatik indirim kuralları yönetimi",
  },
  {
    key: "content.manage",
    group: "İçerik ve Vitrin",
    label: "CMS sayfaları, ana sayfa blokları, menüler, yorumlar ve medya",
  },
  {
    key: "personalization.manage",
    group: "Kişiselleştirme",
    label: "Segmentler, reklam eşleştirmeleri, öne çıkarma kuralları ve A/B testleri",
  },
  {
    key: "reports.read",
    group: "Raporlar",
    label: "Satış, kâr, sepet ve kişiselleştirme raporlarını görüntüleme",
  },
  {
    key: "settings.manage",
    group: "Ayarlar",
    label: "Mağaza, ödeme, kargo, vergi, tema ve e-posta ayarları",
  },
  {
    key: "staff.manage",
    group: "Personel ve Yetki",
    label: "Personel hesapları, roller ve denetim kaydı",
  },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];

export const ALL_PERMISSION_KEYS: PermissionKey[] = PERMISSIONS.map((p) => p.key);

export interface StaffPermissionSubject {
  isOwner: boolean;
  role: {
    permissions: string[];
  };
}

export function hasPermission(
  subject: StaffPermissionSubject | null | undefined,
  permission: PermissionKey
): boolean {
  if (!subject) return false;
  if (subject.isOwner) return true;
  if (subject.role.permissions.includes("*")) return true;
  return subject.role.permissions.includes(permission);
}
