import type { PaymentSettings } from "@/lib/settings/schemas";

export type PaymentMethodCode = "iyzico" | "bank_transfer" | "cod" | "manual";

export interface PaymentBuyerInfo {
  id?: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  tckn?: string | null;
  ip?: string | null;
  city: string;
  district: string;
  addressLine: string;
  postalCode?: string | null;
}

export interface PaymentBasketItem {
  id: string;
  name: string;
  categoryName: string;
  priceMinor: number;
}

export interface PaymentInitInput {
  orderId: string;
  orderNumber: number;
  amountMinor: number;
  currency: string;
  buyer: PaymentBuyerInfo;
  billingAddress: {
    contactName: string;
    city: string;
    district: string;
    addressLine: string;
    postalCode?: string | null;
  };
  shippingAddress: {
    contactName: string;
    city: string;
    district: string;
    addressLine: string;
    postalCode?: string | null;
  };
  basketItems: PaymentBasketItem[];
  callbackUrl: string;
  settings: PaymentSettings;
}

export interface PaymentInitResult {
  ok: boolean;
  provider: PaymentMethodCode;
  paymentState: "PENDING" | "AUTHORIZED" | "CAPTURED" | "FAILED";
  orderPaymentStatus: "PENDING" | "AWAITING_TRANSFER" | "AWAITING_COD" | "PAID" | "FAILED";
  providerRef?: string | null;
  providerData?: Record<string, unknown>;
  checkoutFormContent?: string;
  paymentPageUrl?: string;
  instructions?: string;
  simulated?: boolean;
  errorMessage?: string;
}

export interface PaymentRefundInput {
  orderId: string;
  paymentId: string;
  providerRef?: string | null;
  amountMinor: number;
  currency: string;
  reason?: string | null;
  ip?: string | null;
  settings: PaymentSettings;
}

export interface PaymentRefundResult {
  ok: boolean;
  providerRef?: string | null;
  errorMessage?: string;
}

export interface PaymentAdapter {
  code: PaymentMethodCode;
  label: string;
  isAvailable(settings: PaymentSettings, orderSubtotalMinor: number): {
    available: boolean;
    feeMinor: number;
    reason?: string;
  };
  initiate(input: PaymentInitInput): Promise<PaymentInitResult>;
  refund(input: PaymentRefundInput): Promise<PaymentRefundResult>;
}
