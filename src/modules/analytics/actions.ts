"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth/session";
import {
  ensureRecoveryPromotion,
  sendAbandonedCartRecoveryEmail,
  runAutomatedCartRecoverySweep,
} from "@/modules/analytics/abandoned-cart";
import { resolveRecoveryCode } from "@/modules/analytics/recovery-offer";
import { saveAbandonedCartSettings } from "@/lib/settings/service";
import type { AbandonedCartSettings } from "@/lib/settings/schemas";

export async function sendCartRecoveryEmailAction(
  cartId: string,
  options?: {
    discountCode?: string;
    customNote?: string;
  }
): Promise<{ ok: boolean; error?: string; recoveryUrl?: string }> {
  const staff = await requireStaff();

  const res = await sendAbandonedCartRecoveryEmail(cartId, {
    discountCode: options?.discountCode,
    customNote: options?.customNote,
    staffUserId: staff.id,
  });

  if (res.ok) {
    revalidatePath("/admin/terkedilmis-sepetler");
    revalidatePath("/admin/raporlar");
  }

  return res;
}

export async function saveAbandonedCartSettingsAction(
  input: AbandonedCartSettings
): Promise<{ ok: boolean; error?: string }> {
  await requireStaff();

  try {
    const saved = await saveAbandonedCartSettings(input);
    if (saved.exitIntentEnabled || saved.autoDiscountCode) {
      await ensureRecoveryPromotion(resolveRecoveryCode(saved), saved.discountPercent);
    }
    revalidatePath("/admin/terkedilmis-sepetler");
    revalidatePath("/admin/kampanyalar");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Ayarlar kaydedilemedi.",
    };
  }
}

export async function triggerManualRecoverySweepAction(): Promise<{
  ok: boolean;
  sentCount: number;
  eligibleCount: number;
  error?: string;
}> {
  await requireStaff();

  try {
    const res = await runAutomatedCartRecoverySweep();
    revalidatePath("/admin/terkedilmis-sepetler");
    return {
      ok: true,
      sentCount: res.sentCount,
      eligibleCount: res.eligibleCount,
    };
  } catch (err) {
    return {
      ok: false,
      sentCount: 0,
      eligibleCount: 0,
      error: err instanceof Error ? err.message : "Kurtarma taraması başarısız.",
    };
  }
}
