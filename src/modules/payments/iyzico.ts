import { createHmac, randomBytes } from "node:crypto";
import type { PaymentSettings } from "@/lib/settings/schemas";
import type {
  PaymentAdapter,
  PaymentInitInput,
  PaymentInitResult,
  PaymentRefundInput,
  PaymentRefundResult,
} from "@/modules/payments/types";

function resolveIyzicoCredentials(settings: PaymentSettings): {
  apiKey: string;
  secretKey: string;
  baseUrl: string;
  hasRealKeys: boolean;
} {
  const apiKey = (settings.iyzicoApiKey || process.env.IYZICO_API_KEY || "").trim();
  const secretKey = (settings.iyzicoSecretKey || process.env.IYZICO_SECRET_KEY || "").trim();
  const baseUrl = (
    settings.iyzicoBaseUrl ||
    process.env.IYZICO_BASE_URL ||
    "https://sandbox-api.iyzipay.com"
  )
    .trim()
    .replace(/\/+$/, "");

  return {
    apiKey,
    secretKey,
    baseUrl,
    hasRealKeys: Boolean(apiKey && secretKey),
  };
}

/**
 * iyzico REST v2 IYZWSv2 HMAC-SHA256 yetkilendirme başlığı üretir.
 */
export function buildIyzicoV2AuthHeader(params: {
  apiKey: string;
  secretKey: string;
  uriPath: string;
  bodyJson: string;
  randomKey?: string;
}): { authorization: string; randomKey: string } {
  const randomKey = params.randomKey ?? `${Date.now()}${randomBytes(4).toString("hex")}`;
  const payloadToSign = `${randomKey}${params.uriPath}${params.bodyJson}`;
  const signature = createHmac("sha256", params.secretKey)
    .update(payloadToSign, "utf8")
    .digest("hex");

  const authParams = `apiKey:${params.apiKey}&randomKey:${randomKey}&signature:${signature}`;
  const base64Token = Buffer.from(authParams, "utf8").toString("base64");

  return {
    authorization: `IYZWSv2 ${base64Token}`,
    randomKey,
  };
}

function formatMinorToDecimal(amountMinor: number): string {
  return (Math.max(0, amountMinor) / 100).toFixed(2);
}

interface IyzicoInitResponse {
  status?: string;
  errorCode?: string;
  errorMessage?: string;
  token?: string;
  checkoutFormContent?: string;
  paymentPageUrl?: string;
  conversationId?: string;
}

interface IyzicoDetailResponse {
  status?: string;
  paymentStatus?: string;
  errorMessage?: string;
  paymentId?: string;
  basketId?: string;
  conversationId?: string;
  paidPrice?: number | string;
}

export const iyzicoAdapter: PaymentAdapter = {
  code: "iyzico",
  label: "Kredi / Banka Kartı (iyzico)",

  isAvailable(settings: PaymentSettings) {
    if (!settings.iyzicoEnabled) {
      return {
        available: false,
        feeMinor: 0,
        reason: "Kart ile ödeme şu anda kapalı.",
      };
    }
    return {
      available: true,
      feeMinor: 0,
    };
  },

  async initiate(input: PaymentInitInput): Promise<PaymentInitResult> {
    const creds = resolveIyzicoCredentials(input.settings);

    // Sandbox anahtarı girilmemişse yerel simülasyon akışı
    if (!creds.hasRealKeys) {
      const simToken = `sim_iyzico_${input.orderId}_${Date.now()}`;
      const checkoutFormContent = `<form method="POST" action="${input.callbackUrl}" class="space-y-3 rounded-md border border-zinc-200 bg-zinc-50 p-4">
  <input type="hidden" name="token" value="${simToken}" />
  <input type="hidden" name="orderId" value="${input.orderId}" />
  <p class="text-xs text-zinc-700">Geliştirme ortamı iyzico kart simülasyonu aktif. Sipariş tutarı: <strong>${formatMinorToDecimal(input.amountMinor)} ${input.currency}</strong></p>
  <button type="submit" class="inline-flex rounded-md bg-zinc-900 px-4 py-2 text-xs font-medium text-white">Test Kart Ödemesini Onayla</button>
</form>`;

      return {
        ok: true,
        provider: "iyzico",
        paymentState: "PENDING",
        orderPaymentStatus: "PENDING",
        providerRef: simToken,
        simulated: true,
        checkoutFormContent,
        paymentPageUrl: `${input.callbackUrl}?token=${encodeURIComponent(simToken)}&orderId=${encodeURIComponent(input.orderId)}`,
        providerData: {
          mode: "local_simulation",
          token: simToken,
          orderNumber: input.orderNumber,
        },
      };
    }

    const uriPath = "/payment/iyzipos/checkoutform/initialize/auth/ecom";
    const totalDecimal = formatMinorToDecimal(input.amountMinor);

    const basketItems =
      input.basketItems.length > 0
        ? input.basketItems.map((b) => ({
            id: b.id,
            name: b.name,
            category1: b.categoryName || "Genel",
            itemType: "PHYSICAL",
            price: formatMinorToDecimal(Math.max(1, b.priceMinor)),
          }))
        : [
            {
              id: input.orderId,
              name: `Sipariş #${input.orderNumber}`,
              category1: "Sipariş",
              itemType: "PHYSICAL",
              price: totalDecimal,
            },
          ];

    const sumBasketMinor = input.basketItems.reduce(
      (acc, item) => acc + Math.max(1, item.priceMinor),
      0
    );
    const priceDecimal =
      input.basketItems.length > 0 ? formatMinorToDecimal(sumBasketMinor) : totalDecimal;

    const requestBody = {
      locale: "tr",
      conversationId: input.orderId,
      price: priceDecimal,
      paidPrice: totalDecimal,
      currency: input.currency === "TRY" ? "TRY" : input.currency,
      basketId: String(input.orderNumber),
      paymentGroup: "PRODUCT",
      callbackUrl: input.callbackUrl,
      enabledInstallments: [1, 2, 3, 6, 9],
      buyer: {
        id: input.buyer.id || `guest_${input.orderNumber}`,
        name: input.buyer.firstName,
        surname: input.buyer.lastName,
        gsmNumber: input.buyer.phone,
        email: input.buyer.email,
        identityNumber: input.buyer.tckn || "11111111111",
        registrationAddress: input.buyer.addressLine,
        ip: input.buyer.ip || "127.0.0.1",
        city: input.buyer.city,
        country: "Turkey",
        zipCode: input.buyer.postalCode || "34000",
      },
      shippingAddress: {
        contactName: input.shippingAddress.contactName,
        city: input.shippingAddress.city,
        country: "Turkey",
        address: `${input.shippingAddress.addressLine} ${input.shippingAddress.district}`,
        zipCode: input.shippingAddress.postalCode || "34000",
      },
      billingAddress: {
        contactName: input.billingAddress.contactName,
        city: input.billingAddress.city,
        country: "Turkey",
        address: `${input.billingAddress.addressLine} ${input.billingAddress.district}`,
        zipCode: input.billingAddress.postalCode || "34000",
      },
      basketItems,
    };

    const bodyJson = JSON.stringify(requestBody);
    const auth = buildIyzicoV2AuthHeader({
      apiKey: creds.apiKey,
      secretKey: creds.secretKey,
      uriPath,
      bodyJson,
    });

    try {
      const response = await fetch(`${creds.baseUrl}${uriPath}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: auth.authorization,
          "x-iyzi-rnd": auth.randomKey,
        },
        body: bodyJson,
      });

      const data = (await response.json()) as IyzicoInitResponse;
      if (data.status !== "success" || !data.token) {
        return {
          ok: false,
          provider: "iyzico",
          paymentState: "FAILED",
          orderPaymentStatus: "FAILED",
          errorMessage: data.errorMessage ?? "iyzico ödeme formu başlatılamadı.",
          providerData: data as Record<string, unknown>,
        };
      }

      return {
        ok: true,
        provider: "iyzico",
        paymentState: "PENDING",
        orderPaymentStatus: "PENDING",
        providerRef: data.token,
        checkoutFormContent: data.checkoutFormContent,
        paymentPageUrl: data.paymentPageUrl,
        providerData: {
          token: data.token,
          paymentPageUrl: data.paymentPageUrl ?? null,
          conversationId: data.conversationId ?? input.orderId,
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "iyzico bağlantı hatası";
      return {
        ok: false,
        provider: "iyzico",
        paymentState: "FAILED",
        orderPaymentStatus: "FAILED",
        errorMessage: message,
      };
    }
  },

  async refund(input: PaymentRefundInput): Promise<PaymentRefundResult> {
    const creds = resolveIyzicoCredentials(input.settings);
    if (!creds.hasRealKeys || (input.providerRef && input.providerRef.startsWith("sim_"))) {
      return {
        ok: true,
        providerRef: `sim_refund_${Date.now()}`,
      };
    }

    const uriPath = "/payment/refund";
    const bodyJson = JSON.stringify({
      locale: "tr",
      conversationId: input.orderId,
      paymentTransactionId: input.providerRef ?? input.paymentId,
      price: formatMinorToDecimal(input.amountMinor),
      currency: input.currency === "TRY" ? "TRY" : input.currency,
      ip: input.ip || "127.0.0.1",
    });

    const auth = buildIyzicoV2AuthHeader({
      apiKey: creds.apiKey,
      secretKey: creds.secretKey,
      uriPath,
      bodyJson,
    });

    try {
      const response = await fetch(`${creds.baseUrl}${uriPath}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: auth.authorization,
          "x-iyzi-rnd": auth.randomKey,
        },
        body: bodyJson,
      });

      const data = (await response.json()) as {
        status?: string;
        paymentId?: string;
        errorMessage?: string;
      };

      if (data.status !== "success") {
        return {
          ok: false,
          errorMessage: data.errorMessage ?? "iyzico iade işlemi başarısız oldu.",
        };
      }

      return {
        ok: true,
        providerRef: data.paymentId ?? `iyzico_refund_${Date.now()}`,
      };
    } catch (err) {
      return {
        ok: false,
        errorMessage: err instanceof Error ? err.message : "iyzico iade bağlantı hatası",
      };
    }
  },
};

export async function verifyIyzicoCheckoutToken(params: {
  token: string;
  settings: PaymentSettings;
}): Promise<{
  ok: boolean;
  paymentId?: string;
  conversationId?: string;
  errorMessage?: string;
  raw?: Record<string, unknown>;
}> {
  const token = params.token.trim();
  if (!token) {
    return { ok: false, errorMessage: "Ödeme doğrulama anahtarı (token) eksik." };
  }

  // Yerel simülasyon token'ı: sim_iyzico_<orderId>_<ts>
  if (token.startsWith("sim_iyzico_")) {
    const parts = token.split("_");
    const orderId = parts[2] ?? undefined;
    if (token.includes("_fail") || token.includes("_decline")) {
      return {
        ok: false,
        paymentId: token,
        conversationId: orderId,
        errorMessage: "Simüle edilmiş kart reddi (yetersiz bakiye / 3DS reddi).",
        raw: { simulated: true, token, status: "failure" },
      };
    }
    return {
      ok: true,
      paymentId: token,
      conversationId: orderId,
      raw: { simulated: true, token },
    };
  }

  const creds = resolveIyzicoCredentials(params.settings);
  if (!creds.hasRealKeys) {
    return {
      ok: true,
      paymentId: token,
      raw: { simulated: true, token },
    };
  }

  const uriPath = "/payment/iyzipos/checkoutform/auth/ecom/detail";
  const bodyJson = JSON.stringify({
    locale: "tr",
    token,
  });

  const auth = buildIyzicoV2AuthHeader({
    apiKey: creds.apiKey,
    secretKey: creds.secretKey,
    uriPath,
    bodyJson,
  });

  try {
    const response = await fetch(`${creds.baseUrl}${uriPath}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: auth.authorization,
        "x-iyzi-rnd": auth.randomKey,
      },
      body: bodyJson,
    });

    const data = (await response.json()) as IyzicoDetailResponse;
    if (data.status === "success" && data.paymentStatus === "SUCCESS") {
      return {
        ok: true,
        paymentId: data.paymentId ?? token,
        conversationId: data.conversationId,
        raw: data as unknown as Record<string, unknown>,
      };
    }

    return {
      ok: false,
      conversationId: data.conversationId,
      errorMessage: data.errorMessage ?? "Kart ödemesi banka tarafından onaylanmadı.",
      raw: data as unknown as Record<string, unknown>,
    };
  } catch (err) {
    return {
      ok: false,
      errorMessage: err instanceof Error ? err.message : "iyzico doğrulama hatası",
    };
  }
}
