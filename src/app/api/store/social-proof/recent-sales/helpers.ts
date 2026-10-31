export interface RecentSaleItem {
  id: string;
  customerName: string;
  city: string;
  productTitle: string;
  slug: string;
  imageUrl: string | null;
  timeAgo: string;
}

/**
 * Müşteri ad ve soyadını KVKK ve mahremiyet standartlarına uygun olarak maskeler.
 * Örnek: "Halil", "Topaloğlu", "Kadıköy", "İstanbul" -> "H*** T. - Kadıköy"
 */
export function maskCustomerName(
  firstName?: string | null,
  lastName?: string | null,
  district?: string | null,
  city?: string | null
): { customerName: string; location: string } {
  const f = (firstName ?? "").trim();
  const l = (lastName ?? "").trim();

  let maskedFirst = "M***";
  if (f.length > 0) {
    maskedFirst = `${f.charAt(0).toLocaleUpperCase("tr-TR")}***`;
  }

  let maskedLast = "";
  if (l.length > 0) {
    maskedLast = `${l.charAt(0).toLocaleUpperCase("tr-TR")}.`;
  }

  const customerName = maskedLast ? `${maskedFirst} ${maskedLast}` : maskedFirst;
  const rawLoc = (district || city || "Türkiye").trim();
  const location = rawLoc
    ? `${rawLoc.charAt(0).toLocaleUpperCase("tr-TR")}${rawLoc.slice(1)}`
    : "Türkiye";

  return { customerName, location };
}

/**
 * Geçen süreyi Türkçe editoryal biçimde döndürür.
 */
export function formatTimeAgo(date: Date, now: Date = new Date()): string {
  const diffMs = Math.max(0, now.getTime() - date.getTime());
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);

  if (diffMin < 1) {
    return "Az önce";
  }
  if (diffMin < 60) {
    return `${diffMin} dakika önce`;
  }
  if (diffHours < 24) {
    return `${diffHours} saat önce`;
  }
  return "Dün";
}
