import { z } from "zod";

export const promotionConditionsSchema = z.object({
  minSubtotalMinor: z.number().int().min(0).optional(),
  minItemCount: z.number().int().min(1).optional(),
  categoryIds: z.array(z.string()).default([]),
  productIds: z.array(z.string()).default([]),
  variantIds: z.array(z.string()).default([]),
  customerGroupIds: z.array(z.string()).default([]),
  customerEmails: z.array(z.string().trim().toLowerCase()).default([]),
  customerIds: z.array(z.string().trim()).default([]),
  firstOrderOnly: z.boolean().default(false),
});

export type PromotionConditions = z.infer<typeof promotionConditionsSchema>;

export const DEFAULT_PROMOTION_CONDITIONS: PromotionConditions = {
  categoryIds: [],
  productIds: [],
  variantIds: [],
  customerGroupIds: [],
  customerEmails: [],
  customerIds: [],
  firstOrderOnly: false,
};

export function parsePromotionConditions(raw: unknown): PromotionConditions {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_PROMOTION_CONDITIONS };
  }
  const parsed = promotionConditionsSchema.safeParse(raw);
  if (!parsed.success) {
    return { ...DEFAULT_PROMOTION_CONDITIONS };
  }
  return parsed.data;
}

export const promotionTypeSchema = z.enum([
  "PERCENTAGE",
  "FIXED_AMOUNT",
  "FREE_SHIPPING",
  "BUY_X_GET_Y",
]);

export type PromotionTypeValue = z.infer<typeof promotionTypeSchema>;

export const promotionInputSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().trim().min(2, "Kampanya adı en az 2 karakter olmalıdır."),
    description: z.string().trim().optional().nullable(),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]+$/, "Kupon kodu yalnızca harf, rakam, tire ve alt çizgi içerebilir.")
      .optional()
      .nullable(),
    type: promotionTypeSchema,
    value: z.number().int().min(0).default(0),
    conditions: promotionConditionsSchema.default(DEFAULT_PROMOTION_CONDITIONS),
    buyQuantity: z.number().int().min(1).optional().nullable(),
    getQuantity: z.number().int().min(1).optional().nullable(),
    getDiscountBps: z.number().int().min(0).max(10000).optional().nullable(),
    maxDiscount: z.number().int().min(0).optional().nullable(),
    usageLimit: z.number().int().min(1).optional().nullable(),
    usagePerCustomer: z.number().int().min(1).optional().nullable(),
    startsAt: z.coerce.date().optional().nullable(),
    endsAt: z.coerce.date().optional().nullable(),
    isActive: z.boolean().default(true),
    isCombinable: z.boolean().default(false),
    priority: z.number().int().default(0),
  })
  .superRefine((data, ctx) => {
    if (data.type === "PERCENTAGE" && (data.value <= 0 || data.value > 10000)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["value"],
        message: "Yüzde indirim oranı %0,01 ile %100 (1-10000 bps) arasında olmalıdır.",
      });
    }
    if (data.type === "FIXED_AMOUNT" && data.value <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["value"],
        message: "Sabit indirim tutarı 0'dan büyük olmalıdır.",
      });
    }
    if (data.type === "BUY_X_GET_Y") {
      if (!data.buyQuantity || data.buyQuantity < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["buyQuantity"],
          message: "X Al Y Öde kampanyasında alınacak miktar en az 1 olmalıdır.",
        });
      }
      if (!data.getQuantity || data.getQuantity < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["getQuantity"],
          message: "X Al Y Öde kampanyasında indirimli miktar en az 1 olmalıdır.",
        });
      }
    }
    if (data.startsAt && data.endsAt && data.endsAt < data.startsAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endsAt"],
        message: "Bitiş tarihi başlangıç tarihinden önce olamaz.",
      });
    }
  });

export type PromotionInput = z.infer<typeof promotionInputSchema>;
