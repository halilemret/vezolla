import type { BadgeVariant } from "../components/Badge";
import type { FulfillmentStatus, OrderStatus, PaymentStatus, ReturnStatus } from "../types";

export function getOrderStatusBadge(status: OrderStatus): { label: string; variant: BadgeVariant } {
  switch (status) {
    case "OPEN":
      return { label: "Açık", variant: "neutral" };
    case "COMPLETED":
      return { label: "Tamamlandı", variant: "success" };
    case "CANCELLED":
      return { label: "İptal Edildi", variant: "danger" };
    default:
      return { label: status, variant: "neutral" };
  }
}

export function getPaymentStatusBadge(status: PaymentStatus): { label: string; variant: BadgeVariant } {
  switch (status) {
    case "PAID":
      return { label: "Ödendi", variant: "success" };
    case "AWAITING_TRANSFER":
      return { label: "Havale Bekliyor", variant: "warning" };
    case "AWAITING_COD":
      return { label: "Kapıda Ödeme", variant: "info" };
    case "PENDING":
      return { label: "Ödeme Bekliyor", variant: "warning" };
    case "REFUNDED":
      return { label: "İade Edildi", variant: "neutral" };
    case "PARTIALLY_REFUNDED":
      return { label: "Kısmi İade", variant: "neutral" };
    case "FAILED":
      return { label: "Ödeme Başarısız", variant: "danger" };
    case "CANCELLED":
      return { label: "İptal", variant: "danger" };
    default:
      return { label: status, variant: "neutral" };
  }
}

export function getFulfillmentStatusBadge(
  status: FulfillmentStatus
): { label: string; variant: BadgeVariant } {
  switch (status) {
    case "UNFULFILLED":
      return { label: "Kargolanmadı", variant: "warning" };
    case "PREPARING":
      return { label: "Hazırlanıyor", variant: "info" };
    case "SHIPPED":
      return { label: "Kargoya Verildi", variant: "accent" };
    case "DELIVERED":
      return { label: "Teslim Edildi", variant: "success" };
    case "PARTIALLY_SHIPPED":
      return { label: "Kısmi Sevk", variant: "info" };
    case "RETURNED":
      return { label: "İade Alındı", variant: "danger" };
    case "PARTIALLY_RETURNED":
      return { label: "Kısmi İade", variant: "danger" };
    default:
      return { label: status, variant: "neutral" };
  }
}

export function getReturnStatusBadge(status: ReturnStatus): { label: string; variant: BadgeVariant } {
  switch (status) {
    case "REQUESTED":
      return { label: "Onay Bekliyor", variant: "warning" };
    case "APPROVED":
      return { label: "Onaylandı", variant: "accent" };
    case "RECEIVED":
      return { label: "Teslim Alındı", variant: "success" };
    case "REFUNDED":
      return { label: "İade Edildi", variant: "success" };
    case "REJECTED":
      return { label: "Reddedildi", variant: "danger" };
    case "CANCELLED":
      return { label: "İptal Edildi", variant: "danger" };
    default:
      return { label: status, variant: "neutral" };
  }
}
