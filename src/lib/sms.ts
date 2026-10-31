import "server-only";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";

export interface SmsSendOptions {
  to: string;
  message: string;
  isCommercial?: boolean;
  customerId?: string | null;
}

export interface SmsSendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
  skipped?: boolean;
  isMock?: boolean;
}

/**
 * Türkiye telefon numaralarını E.164 uluslararası formatına (905xxxxxxxxx) normalize eder.
 */
export function normalizeTurkishPhoneNumber(phone: string): string | null {
  let digits = phone.replace(/\D/g, "");
  if (!digits) return null;

  if (digits.startsWith("0090")) {
    digits = digits.slice(2);
  }

  if (digits.length === 10 && digits.startsWith("5")) {
    return `90${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("05")) {
    return `9${digits}`;
  }
  if (digits.length === 12 && digits.startsWith("905")) {
    return digits;
  }

  // Geçersiz veya yurt dışı
  if (digits.length >= 10) {
    return digits;
  }
  return null;
}


/**
 * SMS Gönderim Motoru.
 * Netgsm / İletimerkezi sağlayıcılarını veya yerel geliştirme mock'unu destekler.
 * Ticari elektronik iletilerde İYS (İleti Yönetim Sistemi / Pazarlama Onayı) filtresini zorunlu kılar.
 */
export async function sendSms(options: SmsSendOptions): Promise<SmsSendResult> {
  const normalizedPhone = normalizeTurkishPhoneNumber(options.to);
  if (!normalizedPhone) {
    return {
      ok: false,
      error: "Geçersiz telefon numarası formatı.",
    };
  }

  // İYS & ETK Mevzuat Kontrolü (Ticari Elektronik İleti)
  if (options.isCommercial) {
    if (!options.customerId) {
      return {
        ok: false,
        skipped: true,
        error: "İYS_CONSENT_REQUIRED: Müşteri kimliği belirtilmeyen ticari SMS gönderilemez.",
      };
    }

    const customer = await db.customer.findUnique({
      where: { id: options.customerId },
      select: { acceptsMarketing: true, marketingConsentAt: true },
    });

    if (!customer || !customer.acceptsMarketing || !customer.marketingConsentAt) {
      return {
        ok: false,
        skipped: true,
        error: "IYS_CONSENT_REQUIRED: Müşterinin ticari elektronik ileti (SMS/Pazarlama) izni bulunmuyor.",
      };
    }
  }

  // 1. Netgsm Entegrasyonu
  const netgsmUser = process.env.NETGSM_USERCODE;
  const netgsmPass = process.env.NETGSM_PASSWORD;
  const netgsmHeader = process.env.NETGSM_HEADER || "VEZOLLA";

  if (netgsmUser && netgsmPass) {
    try {
      const url = `https://api.netgsm.com.tr/sms/send/get/?usercode=${encodeURIComponent(
        netgsmUser
      )}&password=${encodeURIComponent(netgsmPass)}&gsmno=${normalizedPhone}&message=${encodeURIComponent(
        options.message
      )}&msgheader=${encodeURIComponent(netgsmHeader)}`;

      const response = await fetch(url, { method: "GET" });
      const text = await response.text();

      // Netgsm 00 veya 01 ile başlayan kodları başarı olarak döner
      if (text.startsWith("00") || text.startsWith("01") || text.startsWith("02")) {
        return { ok: true, messageId: text.trim() };
      }
      return { ok: false, error: `Netgsm Hatası: ${text}` };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Netgsm bağlantı hatası";
      return { ok: false, error: errorMsg };
    }
  }

  // 2. İletimerkezi Entegrasyonu
  const iletimerkeziKey = process.env.ILETIMERKEZI_KEY;
  const iletimerkeziHash = process.env.ILETIMERKEZI_HASH;
  const iletimerkeziSender = process.env.ILETIMERKEZI_SENDER || "VEZOLLA";

  if (iletimerkeziKey && iletimerkeziHash) {
    try {
      const xmlBody = `
        <request>
          <authentication>
            <key>${iletimerkeziKey}</key>
            <hash>${iletimerkeziHash}</hash>
          </authentication>
          <order>
            <sender>${iletimerkeziSender}</sender>
            <sendDateTime></sendDateTime>
            <message>
              <text><![CDATA[${options.message}]]></text>
              <receipents>
                <number>${normalizedPhone}</number>
              </receipents>
            </message>
          </order>
        </request>
      `.trim();

      const response = await fetch("https://api.iletimerkezi.com/v1/send-sms", {
        method: "POST",
        headers: { "Content-Type": "text/xml" },
        body: xmlBody,
      });
      const resXml = await response.text();

      if (resXml.includes("<code>200</code>")) {
        return { ok: true, messageId: "iletimerkezi-" + Date.now() };
      }
      return { ok: false, error: `İletimerkezi Hatası: ${resXml}` };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "İletimerkezi bağlantı hatası";
      return { ok: false, error: errorMsg };
    }
  }

  // 3. Yerel Geliştirme & Test Mock Bildirimi
  console.info(
    `[SMS Mock (${options.isCommercial ? "Ticari/İYS" : "İşlemsel"})] Alıcı: ${normalizedPhone} | Mesaj: ${options.message}`
  );
  return {
    ok: true,
    messageId: `mock-sms-${Date.now()}`,
    isMock: true,
  };
}

/**
 * Sipariş onaylandığında müşteriye işlemsel SMS gönderir.
 */
export async function sendOrderConfirmedSms(params: {
  phone?: string | null;
  number: number;
  total: number;
  currency: string;
}): Promise<SmsSendResult> {
  if (!params.phone) return { ok: false, skipped: true, error: "Telefon numarası yok" };

  const formattedTotal = formatMoney(params.total, params.currency);
  const message = `Sayın Müşterimiz, #${params.number} numaralı siparişiniz (${formattedTotal}) başarıyla alınmıştır. Siparişiniz hazırlandığında bilgilendirileceksiniz. Vezolla`;

  return sendSms({
    to: params.phone,
    message,
    isCommercial: false,
  });
}

/**
 * Kargo takip linki ve takip numarası oluştuğunda müşteriye işlemsel SMS gönderir.
 */
export async function sendShippingUpdateSms(params: {
  phone?: string | null;
  number: number;
  carrier?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
}): Promise<SmsSendResult> {
  if (!params.phone) return { ok: false, skipped: true, error: "Telefon numarası yok" };

  const carrierName = params.carrier || "Kargo";
  const trackInfo = params.trackingNumber ? `Takip No: ${params.trackingNumber}` : "";
  const linkInfo = params.trackingUrl ? `Takip: ${params.trackingUrl}` : "";

  const message = `Sayın Müşterimiz, #${params.number} numaralı siparişiniz ${carrierName} firmasına teslim edilmiştir. ${trackInfo} ${linkInfo}`.trim();

  return sendSms({
    to: params.phone,
    message,
    isCommercial: false,
  });
}

/**
 * İade talebi (RMA) onaylandığında veya oluşturulduğunda kargo şube teslim iade kodunu SMS ile iletir.
 */
export async function sendReturnCodeSms(params: {
  phone?: string | null;
  number: number;
  returnCode: string;
  carrierCode?: string | null;
}): Promise<SmsSendResult> {
  if (!params.phone) return { ok: false, skipped: true, error: "Telefon numarası yok" };

  const carrier = params.carrierCode || "Yurtiçi Kargo";
  const message = `Sayın Müşterimiz, #${params.number} numaralı siparişinizin iade kodu: ${params.returnCode}. Paketinizi ${carrier} şubesine bu kod ile ücretsiz teslim edebilirsiniz. Vezolla`;

  return sendSms({
    to: params.phone,
    message,
    isCommercial: false,
  });
}

/**
 * Terk edilmiş sepet hatırlatması için ticari SMS gönderir.
 * İYS ve ETK gereği sadece pazarlama izni olan müşterilere iletilir.
 */
export async function sendAbandonedCartRecoverySms(params: {
  phone?: string | null;
  customerId: string;
  recoveryUrl: string;
  discountCode?: string | null;
}): Promise<SmsSendResult> {
  if (!params.phone) return { ok: false, skipped: true, error: "Telefon numarası yok" };

  const discountNote = params.discountCode
    ? ` %10 özel indiriminiz için kod: ${params.discountCode}.`
    : "";
  const message = `Sepetinizde ürünler sizi bekliyor!${discountNote} Alışverişinizi hemen tamamlamak için: ${params.recoveryUrl} (İptal için RED yazıp gönderebilirsiniz) Vezolla`;

  return sendSms({
    to: params.phone,
    message,
    isCommercial: true,
    customerId: params.customerId,
  });
}
