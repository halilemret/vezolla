import type { PaymentSettings } from "@/lib/settings/schemas";
import { bankTransferAdapter } from "@/modules/payments/bank-transfer";
import { codAdapter } from "@/modules/payments/cod";
import { iyzicoAdapter } from "@/modules/payments/iyzico";
import type { PaymentAdapter, PaymentMethodCode } from "@/modules/payments/types";

const ADAPTERS: Record<string, PaymentAdapter> = {
  iyzico: iyzicoAdapter,
  credit_card: iyzicoAdapter,
  bank_transfer: bankTransferAdapter,
  cod: codAdapter,
};

export function getPaymentAdapter(methodCode: string): PaymentAdapter {
  const normalized = methodCode.trim().toLowerCase();
  return ADAPTERS[normalized] ?? bankTransferAdapter;
}

export function normalizePaymentMethodCode(methodCode: string): PaymentMethodCode {
  const normalized = methodCode.trim().toLowerCase();
  if (normalized === "iyzico" || normalized === "credit_card") return "iyzico";
  if (normalized === "cod") return "cod";
  if (normalized === "manual") return "manual";
  return "bank_transfer";
}

export function getPaymentMethodLabel(methodCode: string): string {
  const normalized = normalizePaymentMethodCode(methodCode);
  if (normalized === "iyzico") return "Kredi / Banka Kartı (iyzico)";
  if (normalized === "cod") return "Kapıda Ödeme";
  if (normalized === "manual") return "Manuel Sipariş";
  return "Havale / EFT";
}

export interface AvailablePaymentOption {
  code: PaymentMethodCode;
  label: string;
  description: string;
  available: boolean;
  feeMinor: number;
  reason?: string;
  bankAccounts?: PaymentSettings["bankAccounts"];
  instructions?: string;
}

export function getAvailablePaymentOptions(
  settings: PaymentSettings,
  orderSubtotalAfterDiscountMinor: number
): AvailablePaymentOption[] {
  const iyzicoCheck = iyzicoAdapter.isAvailable(settings, orderSubtotalAfterDiscountMinor);
  const bankCheck = bankTransferAdapter.isAvailable(settings, orderSubtotalAfterDiscountMinor);
  const codCheck = codAdapter.isAvailable(settings, orderSubtotalAfterDiscountMinor);

  return [
    {
      code: "iyzico",
      label: iyzicoAdapter.label,
      description: "Tüm banka ve kredi kartlarıyla 3D Secure güvencesiyle anında ödeme.",
      available: iyzicoCheck.available,
      feeMinor: iyzicoCheck.feeMinor,
      reason: iyzicoCheck.reason,
    },
    {
      code: "bank_transfer",
      label: bankTransferAdapter.label,
      description: settings.bankTransferInstructions,
      available: bankCheck.available,
      feeMinor: bankCheck.feeMinor,
      reason: bankCheck.reason,
      bankAccounts: settings.bankAccounts,
      instructions: settings.bankTransferInstructions,
    },
    {
      code: "cod",
      label: codAdapter.label,
      description: "Siparişinizi teslim alırken kargo görevlisine nakit veya kartla ödeme.",
      available: codCheck.available,
      feeMinor: codCheck.feeMinor,
      reason: codCheck.reason,
    },
  ];
}
