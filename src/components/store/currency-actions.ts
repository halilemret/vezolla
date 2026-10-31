"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  type SupportedCurrency,
  CURRENCY_COOKIE,
  SUPPORTED_CURRENCIES,
} from "@/lib/currency";

export async function setCurrencyCookieAction(
  currency: SupportedCurrency
): Promise<{ ok: boolean }> {
  if (!SUPPORTED_CURRENCIES.includes(currency)) {
    return { ok: false };
  }

  const cookieStore = await cookies();
  cookieStore.set(CURRENCY_COOKIE, currency, {
    maxAge: 60 * 60 * 24 * 365, // 1 yıl
    path: "/",
    sameSite: "lax",
    httpOnly: false,
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function getActiveCurrencyServerAction(): Promise<SupportedCurrency> {
  // Vezolla mağazasının tek ve sabit para birimi TRY (₺)'dir.
  return "TRY";
}

