import type { FulfillmentStatus, ShipmentStatus } from "@/generated/prisma/client";

export interface CarrierWebhookPayload {
  trackingNumber?: string;
  carrier?: string;
  status?: string;
  orderNumber?: number;
  description?: string;
  location?: string;
  timestamp?: string;
}

/**
 * Taşıyıcı / Kargo durumlarını standart iç durumlara eşler.
 */
export function normalizeCarrierStatus(rawStatus: string): {
  shipmentStatus: ShipmentStatus;
  fulfillmentStatus: FulfillmentStatus;
  label: string;
  isDelivered: boolean;
  isReturned: boolean;
} {
  const s = rawStatus.trim().toUpperCase();

  if (["DELIVERED", "TESLIM_EDILDI", "TESLIM"].includes(s)) {
    return {
      shipmentStatus: "DELIVERED",
      fulfillmentStatus: "DELIVERED",
      label: "Kargo teslim edildi",
      isDelivered: true,
      isReturned: false,
    };
  }

  if (["RETURNED", "IADE_EDILDI", "GONDERENE_IADE", "IADE"].includes(s)) {
    return {
      shipmentStatus: "CANCELLED",
      fulfillmentStatus: "RETURNED",
      label: "Kargo gönderene iade edildi",
      isDelivered: false,
      isReturned: true,
    };
  }

  if (["OUT_FOR_DELIVERY", "DAGITIMDA", "DAGITIMA_CIKTI"].includes(s)) {
    return {
      shipmentStatus: "SHIPPED",
      fulfillmentStatus: "SHIPPED",
      label: "Kurye teslimat için dağıtıma çıktı",
      isDelivered: false,
      isReturned: false,
    };
  }

  // Varsayılan transfer / yolda
  return {
    shipmentStatus: "SHIPPED",
    fulfillmentStatus: "SHIPPED",
    label: "Kargo aktarma merkezinde / yolda",
    isDelivered: false,
    isReturned: false,
  };
}
