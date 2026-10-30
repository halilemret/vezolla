"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth/session";
import { saveInvoiceSettings } from "@/lib/settings/service";
import type { InvoiceSettings } from "@/lib/settings/schemas";
import { createInvoiceForOrder, cancelInvoice } from "./service";

export async function createInvoiceAction(
  orderIdOrForm: string | FormData,
  customNoteArg?: string
): Promise<{ ok: boolean; error?: string; invoiceId?: string; invoiceNumber?: string }> {
  const staff = await requireStaff("orders.write");
  const orderId =
    typeof orderIdOrForm === "string"
      ? orderIdOrForm
      : String(orderIdOrForm.get("orderId") ?? "").trim();
  const customNote =
    typeof orderIdOrForm === "string"
      ? customNoteArg
      : String(orderIdOrForm.get("customNote") ?? "").trim() || undefined;

  const res = await createInvoiceForOrder(orderId, {
    force: true,
    staffUserId: staff.id,
    customNote,
  });

  revalidatePath("/admin/faturalar");
  revalidatePath(`/admin/siparisler/${orderId}`);
  revalidatePath("/admin/siparisler");
  revalidatePath("/admin");
  return res;
}

export async function cancelInvoiceAction(
  invoiceIdOrForm: string | FormData,
  reasonArg?: string
): Promise<{ ok: boolean; error?: string }> {
  const staff = await requireStaff("orders.write");
  const invoiceId =
    typeof invoiceIdOrForm === "string"
      ? invoiceIdOrForm
      : String(invoiceIdOrForm.get("invoiceId") ?? "").trim();
  const reason =
    typeof invoiceIdOrForm === "string"
      ? (reasonArg || "Yönetici tarafından iptal edildi.")
      : String(invoiceIdOrForm.get("reason") ?? "").trim() || "Yönetici tarafından iptal edildi.";

  const res = await cancelInvoice(invoiceId, reason, staff.id);

  revalidatePath("/admin/faturalar");
  revalidatePath("/admin/siparisler");
  return res;
}

export async function saveInvoiceSettingsAction(
  settings: InvoiceSettings
): Promise<{ ok: boolean; error?: string }> {
  await requireStaff("settings.manage");
  try {
    await saveInvoiceSettings(settings);
    revalidatePath("/admin/ayarlar");
    revalidatePath("/admin/faturalar");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Ayarlar kaydedilemedi.",
    };
  }
}
