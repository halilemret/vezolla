"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth/session";
import { stockMovementTypeEnum } from "@/modules/inventory/schemas";
import {
  createBackInStockRequest,
  processBackInStockNotifications,
  recordStockMovement,
  setDefaultWarehouse,
  transferStockBetweenWarehouses,
  updateLowStockThreshold,
  upsertWarehouse,
} from "@/modules/inventory/service";

function getStr(formData: FormData, key: string): string {
  const val = formData.get(key);
  return typeof val === "string" ? val.trim() : "";
}

export async function saveWarehouseFormAction(
  formData: FormData
): Promise<void> {
  const staff = await requireStaff("inventory.write");
  const id = getStr(formData, "id") || undefined;
  const name = getStr(formData, "name");
  const code = getStr(formData, "code");
  if (!name || !code) return;

  const address = getStr(formData, "address") || null;
  const priority = Number.parseInt(getStr(formData, "priority"), 10) || 0;
  const isDefault =
    formData.get("isDefault") === "on" || formData.get("isDefault") === "true";
  const isActive =
    formData.get("isActive") !== "false" && formData.get("isActive") !== null;

  await upsertWarehouse(
    {
      id,
      name,
      code,
      address,
      priority,
      isDefault,
      isActive,
    },
    staff.id
  );

  revalidatePath("/admin/stok");
}

export async function setDefaultWarehouseFormAction(
  formData: FormData
): Promise<void> {
  const staff = await requireStaff("inventory.write");
  const warehouseId = getStr(formData, "warehouseId");
  if (!warehouseId) return;

  await setDefaultWarehouse(warehouseId, staff.id);
  revalidatePath("/admin/stok");
}

export async function recordStockMovementFormAction(
  formData: FormData
): Promise<void> {
  const staff = await requireStaff("inventory.write");
  const variantId = getStr(formData, "variantId");
  const warehouseId = getStr(formData, "warehouseId") || undefined;
  const typeRaw = getStr(formData, "type");
  const quantityRaw = getStr(formData, "quantity");
  const reason = getStr(formData, "reason") || null;
  const thresholdRaw = getStr(formData, "lowStockThreshold");

  if (!variantId || !typeRaw || !quantityRaw) return;
  const parsedType = stockMovementTypeEnum.safeParse(typeRaw);
  if (!parsedType.success) return;

  const quantity = Number.parseInt(quantityRaw, 10);
  if (!Number.isFinite(quantity)) return;

  const lowStockThreshold =
    thresholdRaw !== "" && Number.isFinite(Number.parseInt(thresholdRaw, 10))
      ? Math.max(0, Number.parseInt(thresholdRaw, 10))
      : undefined;

  await recordStockMovement({
    variantId,
    warehouseId,
    type: parsedType.data,
    quantity,
    lowStockThreshold,
    reason,
    staffUserId: staff.id,
  });

  revalidatePath("/admin/stok");
  revalidatePath("/admin/katalog/urunler");
  revalidatePath("/");
}

export async function quickInlineStockAdjustFormAction(
  formData: FormData
): Promise<void> {
  const staff = await requireStaff("inventory.write");
  const variantId = getStr(formData, "variantId");
  const warehouseId = getStr(formData, "warehouseId") || undefined;
  const newOnHandRaw = getStr(formData, "newOnHand");
  const deltaRaw = getStr(formData, "delta");
  const reason = getStr(formData, "reason") || "Hızlı satır içi stok düzeltme";

  if (!variantId) return;

  if (newOnHandRaw !== "") {
    const newOnHand = Math.max(0, Number.parseInt(newOnHandRaw, 10) || 0);
    await recordStockMovement({
      variantId,
      warehouseId,
      type: "COUNT",
      mode: "set",
      quantity: newOnHand,
      reason,
      staffUserId: staff.id,
    });
  } else if (deltaRaw !== "") {
    const delta = Number.parseInt(deltaRaw, 10) || 0;
    if (delta !== 0) {
      await recordStockMovement({
        variantId,
        warehouseId,
        type: "ADJUST",
        mode: "delta",
        quantity: delta,
        reason,
        staffUserId: staff.id,
      });
    }
  }

  revalidatePath("/admin/stok");
  revalidatePath("/admin/katalog/urunler");
  revalidatePath("/");
}

export async function transferStockFormAction(
  formData: FormData
): Promise<void> {
  const staff = await requireStaff("inventory.write");
  const variantId = getStr(formData, "variantId");
  const fromWarehouseId = getStr(formData, "fromWarehouseId");
  const toWarehouseId = getStr(formData, "toWarehouseId");
  const quantity = Number.parseInt(getStr(formData, "quantity"), 10) || 0;
  const reason = getStr(formData, "reason") || null;

  if (
    !variantId ||
    !fromWarehouseId ||
    !toWarehouseId ||
    fromWarehouseId === toWarehouseId ||
    quantity <= 0
  ) {
    return;
  }

  await transferStockBetweenWarehouses({
    variantId,
    fromWarehouseId,
    toWarehouseId,
    quantity,
    reason,
    staffUserId: staff.id,
  });

  revalidatePath("/admin/stok");
  revalidatePath("/admin/katalog/urunler");
}

export async function updateThresholdFormAction(
  formData: FormData
): Promise<void> {
  const staff = await requireStaff("inventory.write");
  const variantId = getStr(formData, "variantId");
  const warehouseId = getStr(formData, "warehouseId");
  const thresholdRaw = getStr(formData, "lowStockThreshold");
  if (!variantId || !warehouseId) return;

  const threshold =
    thresholdRaw === ""
      ? null
      : Math.max(0, Number.parseInt(thresholdRaw, 10) || 0);

  await updateLowStockThreshold(variantId, warehouseId, threshold, staff.id);
  revalidatePath("/admin/stok");
}

export async function createBackInStockRequestFormAction(
  formData: FormData
): Promise<void> {
  const variantId = getStr(formData, "variantId");
  const email = getStr(formData, "email");
  if (!variantId || !email) return;

  await createBackInStockRequest(variantId, email);
  revalidatePath("/admin/stok");
}

export async function notifyBackInStockFormAction(
  formData: FormData
): Promise<void> {
  await requireStaff("inventory.write");
  const variantId = getStr(formData, "variantId");
  if (!variantId) return;

  await processBackInStockNotifications(variantId);
  revalidatePath("/admin/stok");
}
