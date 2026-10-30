import type { PaymentSettings } from "@/lib/settings/schemas";
import type {
  PaymentAdapter,
  PaymentInitInput,
  PaymentInitResult,
  PaymentRefundInput,
  PaymentRefundResult,
} from "@/modules/payments/types";

export const bankTransferAdapter: PaymentAdapter = {
  code: "bank_transfer",
  label: "Havale / EFT",

  isAvailable(settings: PaymentSettings) {
    if (!settings.bankTransferEnabled) {
      return {
        available: false,
        feeMinor: 0,
        reason: "Havale / EFT ile ödeme şu anda kapalı.",
      };
    }
    return {
      available: true,
      feeMinor: 0,
    };
  },

  async initiate(input: PaymentInitInput): Promise<PaymentInitResult> {
    if (!input.settings.bankTransferEnabled) {
      return {
        ok: false,
        provider: "bank_transfer",
        paymentState: "FAILED",
        orderPaymentStatus: "FAILED",
        errorMessage: "Havale / EFT ödeme yöntemi devre dışı.",
      };
    }

    const accountsText = input.settings.bankAccounts
      .map(
        (acc) =>
          `${acc.bankName} - ${acc.accountHolder} - IBAN: ${acc.iban}${acc.branch ? ` (${acc.branch})` : ""}`
      )
      .join(" | ");

    const instructions = `${input.settings.bankTransferInstructions} Sipariş No: #${input.orderNumber}. Hesaplar: ${accountsText}`;

    return {
      ok: true,
      provider: "bank_transfer",
      paymentState: "PENDING",
      orderPaymentStatus: "AWAITING_TRANSFER",
      providerRef: `TR-${input.orderNumber}`,
      instructions,
      providerData: {
        bankAccounts: input.settings.bankAccounts,
        instructions: input.settings.bankTransferInstructions,
        referenceCode: `SIP-${input.orderNumber}`,
      },
    };
  },

  async refund(_input: PaymentRefundInput): Promise<PaymentRefundResult> {
    return {
      ok: true,
      providerRef: `eft_refund_${Date.now()}`,
    };
  },
};
