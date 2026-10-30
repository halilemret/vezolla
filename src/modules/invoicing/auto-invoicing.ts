import "server-only";
import { onDomainEvent } from "@/lib/events";
import { getInvoiceSettings } from "@/lib/settings/service";
import { createInvoiceForOrder } from "./service";

let isRegistered = false;

/**
 * Sipariş ödendiğinde (iyzico webhook veya panel üzerinden ödeme onayı)
 * otomatik e-Fatura / e-Arşiv Fatura kesilmesini sağlayan domain event dinleyicisini kaydeder.
 */
export function registerAutoInvoicingEventListener(): void {
  if (isRegistered) return;
  isRegistered = true;

  onDomainEvent("order.paid", async (payload) => {
    const orderId = String(payload.orderId ?? "").trim();
    if (!orderId) return;

    try {
      const settings = await getInvoiceSettings();
      if (!settings.enabled || !settings.autoInvoiceOnPaid) {
        return;
      }

      await createInvoiceForOrder(orderId);
    } catch (err) {
      console.error(`Otomatik fatura kesilirken hata oluştu (Sipariş: ${orderId}):`, err);
    }
  });
}

// Modül yüklendiğinde otomatik kaydet
registerAutoInvoicingEventListener();
