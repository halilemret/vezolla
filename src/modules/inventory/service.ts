import "server-only";
import { db } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { emitDomainEvent } from "@/lib/events";
import { sendTransactionalEmail } from "@/lib/mail";
import {
  recordStockMovementSchema,
  stockTransferSchema,
  warehouseInputSchema,
  type RecordStockMovementInput,
  type StockMovementTypeInput,
  type StockTransferInput,
  type WarehouseInput,
} from "@/modules/inventory/schemas";

export interface StockCalculationResult {
  delta: number;
  balanceAfter: number;
  restockedFromZero: boolean;
}

/**
 * Saf stok hareketi hesaplayıcısı.
 * Girdi miktarını ve hareket tipini alarak işaretli değişim miktarını (delta)
 * ve hareket sonrası stok bakiyesini (balanceAfter) döndürür.
 */
export function calculateStockMovement(
  currentOnHand: number,
  type: StockMovementTypeInput,
  inputQuantity: number,
  mode?: "delta" | "set"
): StockCalculationResult {
  const safeCurrent = Math.max(0, Math.trunc(currentOnHand));
  const rawQty = Math.trunc(inputQuantity);

  let delta = 0;
  let balanceAfter = safeCurrent;

  const effectiveMode = mode ?? (type === "COUNT" ? "set" : "delta");

  if (effectiveMode === "set") {
    balanceAfter = Math.max(0, rawQty);
    delta = balanceAfter - safeCurrent;
  } else if (type === "RECEIVE" || type === "RETURN" || type === "TRANSFER_IN") {
    delta = Math.abs(rawQty);
    balanceAfter = safeCurrent + delta;
  } else if (type === "SALE" || type === "TRANSFER_OUT") {
    const outQty = Math.abs(rawQty);
    balanceAfter = Math.max(0, safeCurrent - outQty);
    delta = balanceAfter - safeCurrent;
  } else {
    // ADJUST veya IMPORT (delta modunda işaretli miktar)
    balanceAfter = Math.max(0, safeCurrent + rawQty);
    delta = balanceAfter - safeCurrent;
  }

  return {
    delta,
    balanceAfter,
    restockedFromZero: safeCurrent <= 0 && balanceAfter > 0,
  };
}

/**
 * Varsayılan depoyu getirir; hiç depo yoksa "Merkez Depo" oluşturur.
 */
export async function ensureDefaultWarehouse() {
  const existingDefault = await db.warehouse.findFirst({
    where: { isDefault: true, isActive: true },
    orderBy: { priority: "asc" },
  });
  if (existingDefault) {
    return existingDefault;
  }

  const firstActive = await db.warehouse.findFirst({
    where: { isActive: true },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  });

  if (firstActive) {
    return db.warehouse.update({
      where: { id: firstActive.id },
      data: { isDefault: true },
    });
  }

  const anyWarehouse = await db.warehouse.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (anyWarehouse) {
    return db.warehouse.update({
      where: { id: anyWarehouse.id },
      data: { isDefault: true, isActive: true },
    });
  }

  return db.warehouse.create({
    data: {
      name: "Merkez Depo",
      code: "MERKEZ",
      address: "Merkez Lojistik Deposu",
      isActive: true,
      isDefault: true,
      priority: 0,
    },
  });
}

export async function listWarehouses() {
  await ensureDefaultWarehouse();
  return db.warehouse.findMany({
    orderBy: [{ isDefault: "desc" }, { priority: "asc" }, { name: "asc" }],
    include: {
      _count: {
        select: {
          levels: true,
          movements: true,
        },
      },
    },
  });
}

export async function upsertWarehouse(
  rawInput: WarehouseInput,
  staffUserId?: string | null
) {
  const input = warehouseInputSchema.parse(rawInput);

  const result = await db.$transaction(async (tx) => {
    if (input.isDefault) {
      await tx.warehouse.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    if (input.id) {
      return tx.warehouse.update({
        where: { id: input.id },
        data: {
          name: input.name,
          code: input.code,
          address: input.address ?? null,
          isActive: input.isActive,
          isDefault: input.isDefault,
          priority: input.priority,
        },
      });
    }

    const count = await tx.warehouse.count();
    return tx.warehouse.create({
      data: {
        name: input.name,
        code: input.code,
        address: input.address ?? null,
        isActive: input.isActive,
        isDefault: count === 0 ? true : input.isDefault,
        priority: input.priority,
      },
    });
  });

  await recordAudit({
    staffUserId: staffUserId ?? null,
    action: input.id ? "warehouse.update" : "warehouse.create",
    entityType: "Warehouse",
    entityId: result.id,
    summary: `${result.name} (${result.code}) deposu kaydedildi.`,
  });

  return result;
}

export async function setDefaultWarehouse(
  warehouseId: string,
  staffUserId?: string | null
) {
  const updated = await db.$transaction(async (tx) => {
    await tx.warehouse.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    });
    return tx.warehouse.update({
      where: { id: warehouseId },
      data: { isDefault: true, isActive: true },
    });
  });

  await recordAudit({
    staffUserId: staffUserId ?? null,
    action: "warehouse.set_default",
    entityType: "Warehouse",
    entityId: updated.id,
    summary: `${updated.name} varsayılan depo olarak atandı.`,
  });

  return updated;
}

/**
 * Ürünün tüm aktif varyantlarının toplam stok miktarını yeniden hesaplar ve günceller.
 */
export async function recalculateProductTotalStock(productId: string): Promise<number> {
  const variants = await db.productVariant.findMany({
    where: { productId, isActive: true },
    include: {
      inventoryLevels: {
        where: {
          warehouse: { isActive: true },
        },
      },
    },
  });

  let totalStock = 0;
  for (const variant of variants) {
    for (const level of variant.inventoryLevels) {
      totalStock += Math.max(0, level.onHand);
    }
  }

  await db.product.update({
    where: { id: productId },
    data: { totalStock },
  });

  return totalStock;
}

/**
 * Stok 0'dan pozitif değere çıktığında bekleyen BackInStockRequest kayıtlarını bilgilendirir.
 */
export async function processBackInStockNotifications(
  variantId: string
): Promise<number> {
  const variant = await db.productVariant.findUnique({
    where: { id: variantId },
    include: {
      product: {
        select: {
          id: true,
          title: true,
          slug: true,
        },
      },
    },
  });

  if (!variant) return 0;

  const pendingRequests = await db.backInStockRequest.findMany({
    where: {
      variantId,
      notifiedAt: null,
    },
  });

  if (pendingRequests.length === 0) return 0;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const displayTitle =
    variant.title && variant.title !== "Varsayılan"
      ? `${variant.product.title} (${variant.title})`
      : variant.product.title;
  const productUrl = `${baseUrl}/urun/${variant.product.slug}`;

  const now = new Date();
  for (const req of pendingRequests) {
    await sendTransactionalEmail({
      to: req.email,
      templateKey: "back_in_stock",
      variables: {
        productTitle: displayTitle,
        productUrl,
      },
    });

    await db.backInStockRequest.update({
      where: { id: req.id },
      data: { notifiedAt: now },
    });
  }

  return pendingRequests.length;
}

/**
 * Stok hareketi kaydeder, InventoryLevel.onHand ve Product.totalStock günceller.
 * Stok 0'dan pozitif değere çıktığında BackInStockRequest bildirimlerini tetikler.
 */
export async function recordStockMovement(rawInput: RecordStockMovementInput) {
  const input = recordStockMovementSchema.parse(rawInput);

  const warehouse = input.warehouseId
    ? await db.warehouse.findUnique({ where: { id: input.warehouseId } })
    : await ensureDefaultWarehouse();

  if (!warehouse) {
    throw new Error("Depo bulunamadı.");
  }

  const variant = await db.productVariant.findUnique({
    where: { id: input.variantId },
    include: {
      product: {
        select: { id: true, title: true, slug: true, totalStock: true },
      },
      inventoryLevels: true,
    },
  });

  if (!variant) {
    throw new Error("Varyant bulunamadı.");
  }

  const previousVariantTotal = variant.inventoryLevels.reduce(
    (sum, lvl) => sum + Math.max(0, lvl.onHand),
    0
  );

  const existingLevel = variant.inventoryLevels.find(
    (lvl) => lvl.warehouseId === warehouse.id
  );
  const currentOnHand = existingLevel?.onHand ?? 0;

  const calc = calculateStockMovement(
    currentOnHand,
    input.type,
    input.quantity,
    input.mode
  );

  const { level, movement } = await db.$transaction(async (tx) => {
    const upsertedLevel = await tx.inventoryLevel.upsert({
      where: {
        variantId_warehouseId: {
          variantId: variant.id,
          warehouseId: warehouse.id,
        },
      },
      create: {
        variantId: variant.id,
        warehouseId: warehouse.id,
        onHand: calc.balanceAfter,
        reserved: 0,
        lowStockThreshold: input.lowStockThreshold ?? 5,
      },
      update: {
        onHand: calc.balanceAfter,
        ...(input.lowStockThreshold !== undefined
          ? { lowStockThreshold: input.lowStockThreshold }
          : {}),
      },
    });

    const createdMovement = await tx.stockMovement.create({
      data: {
        variantId: variant.id,
        warehouseId: warehouse.id,
        type: input.type,
        quantity: calc.delta,
        balanceAfter: calc.balanceAfter,
        reason: input.reason ?? null,
        referenceType: input.referenceType ?? null,
        referenceId: input.referenceId ?? null,
        staffUserId: input.staffUserId ?? null,
      },
    });

    return { level: upsertedLevel, movement: createdMovement };
  });

  const newProductTotalStock = await recalculateProductTotalStock(variant.productId);

  const newVariantTotal =
    previousVariantTotal - currentOnHand + calc.balanceAfter;

  let notifiedCount = 0;
  if (previousVariantTotal <= 0 && newVariantTotal > 0) {
    notifiedCount = await processBackInStockNotifications(variant.id);
    await emitDomainEvent("inventory.restocked", {
      variantId: variant.id,
      productId: variant.productId,
      warehouseId: warehouse.id,
      balanceAfter: newVariantTotal,
      notifiedCount,
    });
  }

  return {
    level,
    movement,
    previousOnHand: currentOnHand,
    balanceAfter: calc.balanceAfter,
    delta: calc.delta,
    productTotalStock: newProductTotalStock,
    notifiedCount,
  };
}

/**
 * İki depo arasında stok transferi yapar (TRANSFER_OUT + TRANSFER_IN).
 */
export async function transferStockBetweenWarehouses(rawInput: StockTransferInput) {
  const input = stockTransferSchema.parse(rawInput);

  const outResult = await recordStockMovement({
    variantId: input.variantId,
    warehouseId: input.fromWarehouseId,
    type: "TRANSFER_OUT",
    quantity: input.quantity,
    reason: input.reason ?? "Depolar arası stok transfer çıkışı",
    referenceType: "WarehouseTransfer",
    referenceId: input.toWarehouseId,
    staffUserId: input.staffUserId ?? null,
  });

  const inResult = await recordStockMovement({
    variantId: input.variantId,
    warehouseId: input.toWarehouseId,
    type: "TRANSFER_IN",
    quantity: input.quantity,
    reason: input.reason ?? "Depolar arası stok transfer girişi",
    referenceType: "WarehouseTransfer",
    referenceId: input.fromWarehouseId,
    staffUserId: input.staffUserId ?? null,
  });

  await recordAudit({
    staffUserId: input.staffUserId ?? null,
    action: "inventory.transfer",
    entityType: "ProductVariant",
    entityId: input.variantId,
    summary: `${input.quantity} adet stok transfer edildi.`,
  });

  return { outResult, inResult };
}

export async function updateLowStockThreshold(
  variantId: string,
  warehouseId: string,
  lowStockThreshold: number | null,
  staffUserId?: string | null
) {
  const level = await db.inventoryLevel.upsert({
    where: {
      variantId_warehouseId: {
        variantId,
        warehouseId,
      },
    },
    create: {
      variantId,
      warehouseId,
      onHand: 0,
      reserved: 0,
      lowStockThreshold,
    },
    update: {
      lowStockThreshold,
    },
  });

  await recordAudit({
    staffUserId: staffUserId ?? null,
    action: "inventory.threshold_update",
    entityType: "InventoryLevel",
    entityId: level.id,
    summary: `Kritik stok eşiği ${lowStockThreshold ?? "varsayılan"} olarak güncellendi.`,
  });

  return level;
}

export async function createBackInStockRequest(
  variantId: string,
  email: string,
  customerId?: string | null
) {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) {
    throw new Error("Geçerli bir e-posta adresi giriniz.");
  }

  return db.backInStockRequest.upsert({
    where: {
      variantId_email: {
        variantId,
        email: cleanEmail,
      },
    },
    create: {
      variantId,
      email: cleanEmail,
      customerId: customerId ?? null,
      notifiedAt: null,
    },
    update: {
      notifiedAt: null,
      customerId: customerId ?? undefined,
    },
  });
}

export async function listInventoryOverview(options?: {
  warehouseId?: string;
  search?: string;
}) {
  await ensureDefaultWarehouse();

  const [warehouses, variants, movements, backInStockRequests] = await Promise.all([
    db.warehouse.findMany({
      orderBy: [{ isDefault: "desc" }, { priority: "asc" }, { name: "asc" }],
      include: {
        _count: {
          select: { levels: true, movements: true },
        },
      },
    }),
    db.productVariant.findMany({
      where: {
        product: { deletedAt: null },
        ...(options?.search
          ? {
              OR: [
                { sku: { contains: options.search, mode: "insensitive" } },
                { barcode: { contains: options.search, mode: "insensitive" } },
                { title: { contains: options.search, mode: "insensitive" } },
                {
                  product: {
                    title: { contains: options.search, mode: "insensitive" },
                  },
                },
              ],
            }
          : {}),
      },
      include: {
        product: {
          select: {
            id: true,
            title: true,
            slug: true,
            status: true,
            totalStock: true,
          },
        },
        inventoryLevels: {
          include: {
            warehouse: {
              select: { id: true, name: true, code: true, isDefault: true },
            },
          },
        },
      },
      orderBy: [{ product: { title: "asc" } }, { position: "asc" }],
      take: 200,
    }),
    db.stockMovement.findMany({
      where: options?.warehouseId ? { warehouseId: options.warehouseId } : undefined,
      include: {
        variant: {
          select: {
            id: true,
            title: true,
            sku: true,
            product: {
              select: { id: true, title: true, slug: true },
            },
          },
        },
        warehouse: {
          select: { id: true, name: true, code: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
    db.backInStockRequest.findMany({
      include: {
        variant: {
          select: {
            id: true,
            title: true,
            sku: true,
            product: {
              select: { id: true, title: true, slug: true, totalStock: true },
            },
            inventoryLevels: {
              select: { onHand: true },
            },
          },
        },
      },
      orderBy: [{ notifiedAt: "asc" }, { createdAt: "desc" }],
      take: 100,
    }),
  ]);

  const defaultWarehouse =
    warehouses.find((w) => w.isDefault) ?? warehouses[0] ?? null;

  const lowStockItems: Array<{
    variantId: string;
    productId: string;
    productTitle: string;
    variantTitle: string;
    sku: string | null;
    warehouseId: string;
    warehouseName: string;
    warehouseCode: string;
    onHand: number;
    reserved: number;
    threshold: number;
  }> = [];

  for (const v of variants) {
    if (v.inventoryLevels.length === 0 && defaultWarehouse) {
      lowStockItems.push({
        variantId: v.id,
        productId: v.product.id,
        productTitle: v.product.title,
        variantTitle: v.title,
        sku: v.sku,
        warehouseId: defaultWarehouse.id,
        warehouseName: defaultWarehouse.name,
        warehouseCode: defaultWarehouse.code,
        onHand: 0,
        reserved: 0,
        threshold: 5,
      });
      continue;
    }

    for (const lvl of v.inventoryLevels) {
      if (options?.warehouseId && lvl.warehouseId !== options.warehouseId) {
        continue;
      }
      const threshold = lvl.lowStockThreshold ?? 5;
      if (lvl.onHand <= threshold) {
        lowStockItems.push({
          variantId: v.id,
          productId: v.product.id,
          productTitle: v.product.title,
          variantTitle: v.title,
          sku: v.sku,
          warehouseId: lvl.warehouse.id,
          warehouseName: lvl.warehouse.name,
          warehouseCode: lvl.warehouse.code,
          onHand: lvl.onHand,
          reserved: lvl.reserved,
          threshold,
        });
      }
    }
  }

  lowStockItems.sort((a, b) => a.onHand - b.onHand);

  return {
    warehouses,
    defaultWarehouse,
    variants,
    lowStockItems,
    movements,
    backInStockRequests,
  };
}
