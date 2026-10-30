import { formatMoney } from "@/lib/money";
import type { PaymentSettings } from "@/lib/settings/schemas";
import type {
  PaymentAdapter,
  PaymentInitInput,
  PaymentInitResult,
  PaymentRefundInput,
  PaymentRefundResult,
} from "@/modules/payments/types";

export const codAdapter: PaymentAdapter = {
  code: "cod",
  label: "Kapıda Ödeme",

  isAvailable(settings: PaymentSettings, orderSubtotalMinor: number) {
    if (!settings.codEnabled) {
      return {
        available: false,
        feeMinor: settings.codFeeMinor,
        reason: "Kapıda ödeme şu anda kapalı.",
      };
    }

    if (settings.codMaxOrderMinor > 0 && orderSubtotalMinor > settings.codMaxOrderMinor) {
      return {
        available: false,
        feeMinor: settings.codFeeMinor,
        reason: `Kapıda ödeme en fazla ${formatMoney(settings.codMaxOrderMinor)} tutarındaki siparişlerde geçerlidir.`,
      };
    }

    return {
      available: true,
      feeMinor: settings.codFeeMinor,
    };
  },

  async initiate(input: PaymentInitInput): Promise<PaymentInitResult> {
    if (!input.settings.codEnabled) {
      return {
        ok: false,
        provider: "cod",
        paymentState: "FAILED",
        orderPaymentStatus: "FAILED",
        errorMessage: "Kapıda ödeme yöntemi aktif değil.",
      };
    }

    const baseWithoutFee = Math.max(0, input.amountMinor - input.settings.codFeeMinor);
    if (
      input.settings.codMaxOrderMinor > 0 &&
      baseWithoutFee > input.settings.codMaxOrderMinor
    ) {
      return {
        ok: false,
        provider: "cod",
        paymentState: "FAILED",
        orderPaymentStatus: "FAILED",
        errorMessage: `Kapıda ödeme üst limiti (${formatMoney(input.settings.codMaxOrderMinor)}) aşıldı.`,
      };
    }

    return {
      ok: true,
      provider: "cod",
      paymentState: "PENDING",
      orderPaymentStatus: "AWAITING_COD",
      providerRef: `COD-${input.orderNumber}`,
      instructions: "Sipariş tutarını teslimat sırasında kargo görevlisine nakit veya kart ile ödeyebilirsiniz.",
      providerData: {
        codFeeMinor: input.settings.codFeeMinor,
      },
    };
  },

  async refund(_input: PaymentRefundInput): Promise<PaymentRefundResult> {
    return {
      ok: true,
      providerRef: `cod_refund_${Date.now()}`,
    };
  },
};
