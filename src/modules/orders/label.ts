import "server-only";
import { getStoreSettings } from "@/lib/settings/service";
import { getOrderDetail } from "@/modules/orders/service";
import {
  buildShippingLabelZpl,
  generateCarrierBarcode,
  DISCREET_SHIPPING_LABEL,
  type ShippingLabelData,
} from "@/modules/shipping/carriers";

export interface ShippingLabelBundle {
  orderId: string;
  orderNumber: number;
  fulfillmentId: string;
  data: ShippingLabelData;
  zpl: string;
}

function readAddress(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
}

const MAX_ITEM_SUMMARY_LENGTH = 180;

/**
 * Bir gönderim için etiket verisini ve ZPL çıktısını üretir.
 * fulfillmentId verilmezse siparişin en son gönderimi kullanılır.
 * Kapıda ödeme tahsilatı çifte tahsil edilmemesi için yalnızca ilk gönderim etiketine yazılır.
 */
export async function loadShippingLabel(
  orderId: string,
  fulfillmentId?: string | null
): Promise<ShippingLabelBundle | null> {
  const [order, store] = await Promise.all([getOrderDetail(orderId), getStoreSettings()]);
  if (!order || order.fulfillments.length === 0) return null;

  const byCreatedAsc = [...order.fulfillments].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  );
  const target = fulfillmentId
    ? byCreatedAsc.find((f) => f.id === fulfillmentId)
    : byCreatedAsc[byCreatedAsc.length - 1];
  if (!target) return null;

  const sequence = byCreatedAsc.findIndex((f) => f.id === target.id) + 1;
  const ship = readAddress(order.shippingAddress);
  const recipientName =
    `${String(ship.firstName ?? "")} ${String(ship.lastName ?? "")}`.trim() || order.email;

  const isFirstShipment = sequence === 1;
  const codPending = order.paymentMethod === "cod" && order.paymentStatus !== "PAID";

  // Gizli kargo taahhüdü: Dış etiket üzerine ürün adları asla yazılmaz, nötr tanım kullanılır
  const summary = DISCREET_SHIPPING_LABEL;

  const data: ShippingLabelData = {
    carrierCode: target.carrier,
    barcode:
      target.trackingNumber ?? generateCarrierBarcode(target.carrier, order.number, sequence),
    orderNumber: order.number,
    sender: {
      name: store.companyLegalName || store.storeName,
      line1: store.address,
      district: store.district,
      city: store.city,
      phone: store.supportPhone,
    },
    recipient: {
      name: recipientName,
      line1: String(ship.line1 ?? ""),
      district: String(ship.district ?? ""),
      city: String(ship.city ?? ""),
      phone: String(ship.phone ?? order.phone ?? ""),
    },
    codAmountMinor: codPending && isFirstShipment ? order.total : null,
    itemSummary: summary,
    parcelLabel:
      order.fulfillments.length > 1 ? `Gonderi ${sequence}/${order.fulfillments.length}` : undefined,
  };

  return {
    orderId: order.id,
    orderNumber: order.number,
    fulfillmentId: target.id,
    data,
    zpl: buildShippingLabelZpl(data),
  };
}
