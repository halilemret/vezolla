export type OrderStatus = "OPEN" | "COMPLETED" | "CANCELLED";

export type PaymentStatus =
  | "PENDING"
  | "AWAITING_TRANSFER"
  | "AWAITING_COD"
  | "PAID"
  | "PARTIALLY_REFUNDED"
  | "REFUNDED"
  | "FAILED"
  | "CANCELLED";

export type FulfillmentStatus =
  | "UNFULFILLED"
  | "PREPARING"
  | "PARTIALLY_SHIPPED"
  | "SHIPPED"
  | "DELIVERED"
  | "PARTIALLY_RETURNED"
  | "RETURNED";

export interface StaffUser {
  id: string;
  email: string;
  name: string;
  isOwner: boolean;
  isActive: boolean;
  roleId: string;
  role: {
    id: string;
    name: string;
    permissions: string[];
  };
}

export interface DashboardMetrics {
  todayOrderCount: number;
  todayRevenue: number;
  awaitingTransferCount: number;
  unfulfilledCount: number;
  pendingReturnsCount: number;
  lowStockCount: number;
}

export interface CriticalStockItem {
  id: string;
  variantId: string;
  warehouseId: string;
  warehouseName: string;
  productTitle: string;
  variantTitle: string;
  sku: string | null;
  onHand: number;
  reserved: number;
  lowStockThreshold: number;
}

export interface DashboardData {
  metrics: DashboardMetrics;
  recentOrders: OrderSummary[];
  criticalStockItems: CriticalStockItem[];
}

export interface OrderItemSummary {
  id: string;
  title: string;
  variantTitle: string | null;
  sku: string | null;
  quantity: number;
  unitPrice: number;
  total: number;
  imageUrl: string | null;
}

export interface OrderSummary {
  id: string;
  number: number;
  email: string;
  phone: string | null;
  total: number;
  currency: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  placedAt: string;
  customer?: {
    id?: string;
    firstName: string;
    lastName: string;
    email?: string;
  } | null;
  items?: OrderItemSummary[];
}

export interface AddressInfo {
  firstName: string;
  lastName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  district: string;
  city: string;
  postalCode?: string;
  companyName?: string;
  taxNumber?: string;
}

export interface OrderFulfillment {
  id: string;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  status: "PREPARING" | "SHIPPED" | "DELIVERED" | "CANCELLED";
  shippedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
}

export interface OrderPayment {
  id: string;
  provider: string;
  amount: number;
  status: string;
  createdAt: string;
}

export interface OrderEvent {
  id: string;
  type: string;
  message: string;
  isInternal: boolean;
  createdAt: string;
}

export interface OrderDetail extends OrderSummary {
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  paymentFee: number;
  taxTotal: number;
  refundedTotal: number;
  shippingAddress: AddressInfo;
  billingAddress: AddressInfo;
  shippingMethodId: string | null;
  customerNote: string | null;
  cancelReason: string | null;
  items: OrderItemSummary[];
  fulfillments: OrderFulfillment[];
  payments: OrderPayment[];
  events: OrderEvent[];
  returns: ReturnRequestSummary[];
}

export interface InventoryLevel {
  id: string;
  warehouseId: string;
  onHand: number;
  reserved: number;
  warehouse?: {
    id: string;
    name: string;
    code: string;
  };
}

export interface ProductVariant {
  id: string;
  title: string;
  sku: string | null;
  barcode: string | null;
  price: number;
  compareAtPrice: number | null;
  isActive: boolean;
  inventoryLevels: InventoryLevel[];
}

export interface ProductSummary {
  id: string;
  title: string;
  slug: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  isActive: boolean;
  totalStock: number;
  primaryImage: string | null;
  categories: string[];
  variantCount: number;
  minPrice: number;
  maxPrice: number;
  variants: ProductVariant[];
}

export type ReturnStatus =
  | "REQUESTED"
  | "APPROVED"
  | "REJECTED"
  | "RECEIVED"
  | "REFUNDED"
  | "CANCELLED";

export interface ReturnRequestSummary {
  id: string;
  orderId: string;
  status: ReturnStatus;
  reason: string | null;
  customerNote: string | null;
  staffNote: string | null;
  refundAmount: number | null;
  createdAt: string;
  order?: {
    id: string;
    number: number;
    email: string;
    customer?: {
      firstName: string;
      lastName: string;
    } | null;
  };
}

export interface AdminNotificationItem {
  id: string;
  type: "order.placed" | "return.requested" | string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}
