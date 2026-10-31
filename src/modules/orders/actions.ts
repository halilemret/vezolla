"use server";

import { revalidatePath } from "next/cache";
import { getCurrentCustomer, getCurrentStaff, requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { parseMoneyInput } from "@/lib/money";
import {
  addOrderNote,
  cancelOrder,
  createFulfillment,
  createManualOrder,
  createReturnRequest,
  markFulfillmentDelivered,
  markOrderPaid,
  receiveReturnRequest,
  refundOrder,
  updateReturnRequestStatus,
  type CreateFulfillmentInput,
  type CreateManualOrderInput,
  type CreateReturnRequestInput,
} from "@/modules/orders/service";

function revalidateOrderPaths(orderId?: string) {
  revalidatePath("/admin/siparisler");
  revalidatePath("/admin/iadeler");
  revalidatePath("/admin");
  revalidatePath("/hesabim");
  if (orderId) {
    revalidatePath(`/admin/siparisler/${orderId}`);
    revalidatePath(`/hesabim/siparisler/${orderId}`);
  }
}

export async function markOrderPaidAction(
  orderIdOrForm: string | FormData,
  noteArg?: string
): Promise<{ ok: boolean; error?: string }> {
  const staff = await requireStaff("orders.write");
  const orderId =
    typeof orderIdOrForm === "string"
      ? orderIdOrForm
      : String(orderIdOrForm.get("orderId") ?? "").trim();
  const note =
    typeof orderIdOrForm === "string"
      ? noteArg
      : String(orderIdOrForm.get("note") ?? "").trim() || undefined;

  const res = await markOrderPaid({
    orderId,
    staffUserId: staff.id,
    note,
  });
  revalidateOrderPaths(orderId);
  return res;
}

export async function createFulfillmentAction(
  inputOrForm: Omit<CreateFulfillmentInput, "staffUserId"> | FormData
): Promise<{ ok: boolean; error?: string; fulfillmentId?: string }> {
  const staff = await requireStaff("orders.write");

  let payload: CreateFulfillmentInput;
  if (inputOrForm instanceof FormData) {
    const orderId = String(inputOrForm.get("orderId") ?? "").trim();
    const carrier = String(inputOrForm.get("carrier") ?? "yurtici").trim();
    const trackingNumber = String(inputOrForm.get("trackingNumber") ?? "").trim() || null;
    const warehouseId = String(inputOrForm.get("warehouseId") ?? "").trim() || null;

    const items: Array<{ orderItemId: string; quantity: number }> = [];
    for (const [key, val] of inputOrForm.entries()) {
      if (key.startsWith("qty_")) {
        const orderItemId = key.slice(4);
        const qty = Number.parseInt(String(val), 10);
        if (orderItemId && Number.isFinite(qty) && qty > 0) {
          items.push({ orderItemId, quantity: qty });
        }
      }
    }

    payload = {
      orderId,
      carrier,
      trackingNumber,
      warehouseId,
      items: items.length > 0 ? items : undefined,
      staffUserId: staff.id,
    };
  } else {
    payload = {
      ...inputOrForm,
      staffUserId: staff.id,
    };
  }

  const res = await createFulfillment(payload);
  revalidateOrderPaths(payload.orderId);
  return res;
}

export async function markFulfillmentDeliveredAction(
  fulfillmentIdOrForm: string | FormData
): Promise<{ ok: boolean; error?: string }> {
  const staff = await requireStaff("orders.write");
  const fulfillmentId =
    typeof fulfillmentIdOrForm === "string"
      ? fulfillmentIdOrForm
      : String(fulfillmentIdOrForm.get("fulfillmentId") ?? "").trim();

  const res = await markFulfillmentDelivered({
    fulfillmentId,
    staffUserId: staff.id,
  });
  revalidateOrderPaths();
  return res;
}

export async function cancelOrderAction(
  orderIdOrForm: string | FormData,
  reasonArg?: string
): Promise<{ ok: boolean; error?: string }> {
  const staff = await requireStaff("orders.write");
  const orderId =
    typeof orderIdOrForm === "string"
      ? orderIdOrForm
      : String(orderIdOrForm.get("orderId") ?? "").trim();
  const reason =
    typeof orderIdOrForm === "string"
      ? reasonArg
      : String(orderIdOrForm.get("reason") ?? "").trim() || undefined;

  const res = await cancelOrder({
    orderId,
    reason,
    staffUserId: staff.id,
  });
  revalidateOrderPaths(orderId);
  return res;
}

export async function addOrderNoteAction(
  orderIdOrForm: string | FormData,
  messageArg?: string,
  isInternalArg = true
): Promise<{ ok: boolean; error?: string }> {
  const staff = await requireStaff("orders.write");

  let orderId = "";
  let message = "";
  let isInternal = isInternalArg;

  if (typeof orderIdOrForm === "string") {
    orderId = orderIdOrForm;
    message = messageArg ?? "";
  } else {
    orderId = String(orderIdOrForm.get("orderId") ?? "").trim();
    message = String(orderIdOrForm.get("message") ?? "").trim();
    isInternal = orderIdOrForm.get("isInternal") !== "false";
  }

  const res = await addOrderNote({
    orderId,
    message,
    isInternal,
    staffUserId: staff.id,
  });
  revalidateOrderPaths(orderId);
  return res;
}

export async function createManualOrderAction(
  input: Omit<CreateManualOrderInput, "staffUserId">
): Promise<{ ok: boolean; error?: string; orderId?: string; orderNumber?: number }> {
  const staff = await requireStaff("orders.write");
  const res = await createManualOrder({
    ...input,
    staffUserId: staff.id,
  });
  if (res.ok && res.orderId) {
    revalidateOrderPaths(res.orderId);
  }
  return res;
}

export async function createReturnRequestAction(
  inputOrForm: CreateReturnRequestInput | FormData
): Promise<{ ok: boolean; error?: string; returnRequestId?: string }> {
  const [staff, customer] = await Promise.all([
    getCurrentStaff(),
    getCurrentCustomer(),
  ]);

  if (!staff && !customer) {
    return { ok: false, error: "İade talebi oluşturmak için oturum açmalısınız." };
  }

  let payload: CreateReturnRequestInput;
  if (inputOrForm instanceof FormData) {
    const orderId = String(inputOrForm.get("orderId") ?? "").trim();
    const reason = String(inputOrForm.get("reason") ?? "").trim() || null;
    const customerNote = String(inputOrForm.get("customerNote") ?? "").trim() || null;
    const items: Array<{ orderItemId: string; quantity: number }> = [];

    for (const [key, val] of inputOrForm.entries()) {
      if (key.startsWith("return_qty_")) {
        const orderItemId = key.slice("return_qty_".length);
        const qty = Number.parseInt(String(val), 10);
        if (orderItemId && Number.isFinite(qty) && qty > 0) {
          items.push({ orderItemId, quantity: qty });
        }
      }
    }

    const hygieneAccepted =
      inputOrForm.get("hygieneAccepted") === "on" ||
      inputOrForm.get("hygieneAccepted") === "true";
    const carrierCode = String(inputOrForm.get("carrierCode") ?? "YURTICI").trim();

    payload = {
      orderId,
      reason,
      customerNote,
      restock: inputOrForm.get("restock") !== "false",
      hygieneAccepted,
      carrierCode,
      items,
    };
  } else {
    payload = inputOrForm;
  }

  // Müşteri çağırıyorsa siparişin kendisine ait olduğunu doğrula
  if (!staff && customer) {
    const order = await db.order.findUnique({
      where: { id: payload.orderId },
      select: { customerId: true, email: true },
    });
    if (
      !order ||
      (order.customerId !== customer.id &&
        order.email.toLowerCase() !== customer.email.toLowerCase())
    ) {
      return { ok: false, error: "Bu sipariş için işlem yetkiniz yok." };
    }
  }

  const res = await createReturnRequest(payload);
  revalidateOrderPaths(payload.orderId);
  return res;
}

export async function approveReturnRequestAction(
  returnRequestId: string,
  staffNote?: string
): Promise<{ ok: boolean; error?: string }> {
  const staff = await requireStaff("orders.refund");
  const res = await updateReturnRequestStatus({
    returnRequestId,
    status: "APPROVED",
    staffNote,
    staffUserId: staff.id,
  });
  revalidateOrderPaths();
  return res;
}

export async function rejectReturnRequestAction(
  returnRequestId: string,
  staffNote?: string
): Promise<{ ok: boolean; error?: string }> {
  const staff = await requireStaff("orders.refund");
  const res = await updateReturnRequestStatus({
    returnRequestId,
    status: "REJECTED",
    staffNote,
    staffUserId: staff.id,
  });
  revalidateOrderPaths();
  return res;
}

export async function receiveReturnRequestAction(
  returnRequestId: string,
  restock = true,
  staffNote?: string
): Promise<{ ok: boolean; error?: string }> {
  const staff = await requireStaff("orders.refund");
  const res = await receiveReturnRequest({
    returnRequestId,
    restock,
    staffNote,
    staffUserId: staff.id,
  });
  revalidateOrderPaths();
  return res;
}

export async function refundOrderAction(
  inputOrForm:
    | {
        orderId: string;
        amountMinor: number;
        reason?: string | null;
        returnRequestId?: string | null;
      }
    | FormData
): Promise<{ ok: boolean; error?: string }> {
  const staff = await requireStaff("orders.refund");

  let orderId = "";
  let amountMinor = 0;
  let reason: string | null = null;
  let returnRequestId: string | null = null;

  if (inputOrForm instanceof FormData) {
    orderId = String(inputOrForm.get("orderId") ?? "").trim();
    const rawAmount = String(inputOrForm.get("amount") ?? "0").trim();
    amountMinor = parseMoneyInput(rawAmount);
    reason = String(inputOrForm.get("reason") ?? "").trim() || null;
    returnRequestId = String(inputOrForm.get("returnRequestId") ?? "").trim() || null;
  } else {
    orderId = inputOrForm.orderId;
    amountMinor = inputOrForm.amountMinor;
    reason = inputOrForm.reason ?? null;
    returnRequestId = inputOrForm.returnRequestId ?? null;
  }

  const res = await refundOrder({
    orderId,
    amountMinor,
    reason,
    returnRequestId,
    staffUserId: staff.id,
  });
  revalidateOrderPaths(orderId);
  return res;
}
