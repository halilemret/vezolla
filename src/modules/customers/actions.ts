"use server";

import { revalidatePath } from "next/cache";
import {
  destroyCustomerSession,
  getCurrentCustomer,
  getCurrentStaff,
  requireCustomer,
  requireStaff,
} from "@/lib/auth/session";
import { checkoutAddressSchema } from "@/modules/checkout/schemas";
import {
  anonymizeCustomerKvkk,
  deleteCustomerAddress,
  deleteCustomerGroup,
  saveCustomerAddress,
  saveCustomerGroup,
  updateCustomerAdmin,
} from "@/modules/customers/service";

export async function updateCustomerAdminAction(
  formDataOrInput:
    | FormData
    | {
        customerId: string;
        firstName: string;
        lastName: string;
        phone?: string | null;
        groupId?: string | null;
        note?: string | null;
        tags?: string[];
        isActive?: boolean;
        acceptsMarketing?: boolean;
      }
): Promise<{ ok: boolean; error?: string }> {
  const staff = await requireStaff("customers.write");

  if (formDataOrInput instanceof FormData) {
    const customerId = String(formDataOrInput.get("customerId") ?? "").trim();
    const tagsRaw = String(formDataOrInput.get("tags") ?? "").trim();
    const tags = tagsRaw
      ? tagsRaw
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    const res = await updateCustomerAdmin({
      customerId,
      firstName: String(formDataOrInput.get("firstName") ?? "").trim(),
      lastName: String(formDataOrInput.get("lastName") ?? "").trim(),
      phone: String(formDataOrInput.get("phone") ?? "").trim() || null,
      groupId: String(formDataOrInput.get("groupId") ?? "").trim() || null,
      note: String(formDataOrInput.get("note") ?? "").trim() || null,
      tags,
      isActive: formDataOrInput.get("isActive") !== "false",
      acceptsMarketing: formDataOrInput.get("acceptsMarketing") === "on",
      staffUserId: staff.id,
    });

    revalidatePath("/admin/musteriler");
    revalidatePath(`/admin/musteriler/${customerId}`);
    return res;
  }

  const res = await updateCustomerAdmin({
    ...formDataOrInput,
    staffUserId: staff.id,
  });
  revalidatePath("/admin/musteriler");
  revalidatePath(`/admin/musteriler/${formDataOrInput.customerId}`);
  return res;
}

export async function saveCustomerGroupAction(
  formDataOrInput:
    | FormData
    | { id?: string; name: string; description?: string | null }
): Promise<{ ok: boolean; error?: string; id?: string }> {
  const staff = await requireStaff("customers.write");

  const payload =
    formDataOrInput instanceof FormData
      ? {
          id: String(formDataOrInput.get("id") ?? "").trim() || undefined,
          name: String(formDataOrInput.get("name") ?? "").trim(),
          description: String(formDataOrInput.get("description") ?? "").trim() || null,
        }
      : formDataOrInput;

  const res = await saveCustomerGroup({
    ...payload,
    staffUserId: staff.id,
  });

  revalidatePath("/admin/musteriler");
  return res;
}

export async function deleteCustomerGroupAction(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const staff = await requireStaff("customers.write");
  const res = await deleteCustomerGroup({ id, staffUserId: staff.id });
  revalidatePath("/admin/musteriler");
  return res;
}

export async function anonymizeCustomerKvkkAction(
  customerId?: string
): Promise<{ ok: boolean; error?: string }> {
  const [staff, customer] = await Promise.all([
    getCurrentStaff(),
    getCurrentCustomer(),
  ]);

  if (staff) {
    await requireStaff("customers.write");
    if (!customerId) {
      return { ok: false, error: "Müşteri kimliği belirtilmedi." };
    }
    const res = await anonymizeCustomerKvkk({
      customerId,
      staffUserId: staff.id,
    });
    revalidatePath("/admin/musteriler");
    revalidatePath(`/admin/musteriler/${customerId}`);
    return res;
  }

  if (customer) {
    const res = await anonymizeCustomerKvkk({
      customerId: customer.id,
      staffUserId: null,
    });
    await destroyCustomerSession();
    revalidatePath("/");
    return res;
  }

  return { ok: false, error: "Yetkisiz işlem." };
}

export async function saveCustomerAddressAction(
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  const customer = await requireCustomer();
  const parsed = checkoutAddressSchema.safeParse({
    title: String(formData.get("title") ?? "Adresim").trim(),
    firstName: String(formData.get("firstName") ?? customer.firstName).trim(),
    lastName: String(formData.get("lastName") ?? customer.lastName).trim(),
    phone: String(formData.get("phone") ?? customer.phone ?? "").trim(),
    city: String(formData.get("city") ?? "").trim(),
    district: String(formData.get("district") ?? "").trim(),
    neighborhood: String(formData.get("neighborhood") ?? "").trim() || null,
    line1: String(formData.get("line1") ?? "").trim(),
    postalCode: String(formData.get("postalCode") ?? "").trim() || null,
    invoiceType:
      String(formData.get("invoiceType") ?? "INDIVIDUAL") === "CORPORATE"
        ? "CORPORATE"
        : "INDIVIDUAL",
    tckn: String(formData.get("tckn") ?? "").trim() || null,
    companyName: String(formData.get("companyName") ?? "").trim() || null,
    taxOffice: String(formData.get("taxOffice") ?? "").trim() || null,
    taxNumber: String(formData.get("taxNumber") ?? "").trim() || null,
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Lütfen adres alanlarını kontrol edin.",
    };
  }

  const addressId = String(formData.get("addressId") ?? "").trim() || undefined;
  const res = await saveCustomerAddress({
    customerId: customer.id,
    addressId,
    address: parsed.data,
    isDefaultShipping: formData.get("isDefaultShipping") === "on",
    isDefaultBilling: formData.get("isDefaultBilling") === "on",
  });

  revalidatePath("/hesabim");
  revalidatePath("/hesabim/adreslerim");
  revalidatePath("/odeme");
  return res;
}

export async function deleteCustomerAddressAction(
  addressId: string
): Promise<{ ok: boolean; error?: string }> {
  const customer = await requireCustomer();
  const res = await deleteCustomerAddress({
    customerId: customer.id,
    addressId,
  });
  revalidatePath("/hesabim/adreslerim");
  revalidatePath("/odeme");
  return res;
}
