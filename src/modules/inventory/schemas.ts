import { z } from "zod";

export const stockMovementTypeEnum = z.enum([
  "RECEIVE",
  "SALE",
  "RETURN",
  "ADJUST",
  "COUNT",
  "TRANSFER_IN",
  "TRANSFER_OUT",
  "IMPORT",
]);

export type StockMovementTypeInput = z.infer<typeof stockMovementTypeEnum>;

export const warehouseInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Depo adı zorunludur"),
  code: z
    .string()
    .trim()
    .min(1, "Depo kodu zorunludur")
    .transform((v) => v.toUpperCase()),
  address: z.string().trim().nullable().optional(),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  priority: z.number().int().default(0),
});

export type WarehouseInput = z.infer<typeof warehouseInputSchema>;

export const recordStockMovementSchema = z.object({
  variantId: z.string().min(1, "Varyant seçilmelidir"),
  warehouseId: z.string().optional(),
  type: stockMovementTypeEnum,
  quantity: z.number().int(),
  mode: z.enum(["delta", "set"]).optional(),
  lowStockThreshold: z.number().int().min(0).nullable().optional(),
  reason: z.string().trim().nullable().optional(),
  referenceType: z.string().trim().nullable().optional(),
  referenceId: z.string().trim().nullable().optional(),
  staffUserId: z.string().nullable().optional(),
});

export type RecordStockMovementInput = z.infer<typeof recordStockMovementSchema>;

export const stockTransferSchema = z
  .object({
    variantId: z.string().min(1, "Varyant seçilmelidir"),
    fromWarehouseId: z.string().min(1, "Kaynak depo seçilmelidir"),
    toWarehouseId: z.string().min(1, "Hedef depo seçilmelidir"),
    quantity: z.number().int().positive("Transfer miktarı 0'dan büyük olmalıdır"),
    reason: z.string().trim().nullable().optional(),
    staffUserId: z.string().nullable().optional(),
  })
  .refine((data) => data.fromWarehouseId !== data.toWarehouseId, {
    message: "Kaynak ve hedef depo aynı olamaz",
    path: ["toWarehouseId"],
  });

export type StockTransferInput = z.infer<typeof stockTransferSchema>;
