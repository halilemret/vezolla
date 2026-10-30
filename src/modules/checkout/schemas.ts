import { z } from "zod";

export const checkoutAddressSchema = z
  .object({
    title: z.string().trim().optional().nullable(),
    firstName: z.string().trim().min(2, "Ad en az 2 karakter olmalıdır."),
    lastName: z.string().trim().min(2, "Soyad en az 2 karakter olmalıdır."),
    phone: z.string().trim().min(10, "Geçerli bir telefon numarası giriniz."),
    city: z.string().trim().min(2, "İl seçiniz."),
    district: z.string().trim().min(2, "İlçe seçiniz."),
    neighborhood: z.string().trim().optional().nullable(),
    line1: z.string().trim().min(5, "Açık adres en az 5 karakter olmalıdır."),
    postalCode: z.string().trim().optional().nullable(),
    invoiceType: z.enum(["INDIVIDUAL", "CORPORATE"]).default("INDIVIDUAL"),
    tckn: z.string().trim().optional().nullable(),
    companyName: z.string().trim().optional().nullable(),
    taxOffice: z.string().trim().optional().nullable(),
    taxNumber: z.string().trim().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.invoiceType === "CORPORATE") {
      if (!data.companyName || data.companyName.trim().length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["companyName"],
          message: "Kurumsal fatura için firma unvanı zorunludur.",
        });
      }
      if (!data.taxOffice || data.taxOffice.trim().length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["taxOffice"],
          message: "Kurumsal fatura için vergi dairesi zorunludur.",
        });
      }
      if (!data.taxNumber || data.taxNumber.trim().length < 10) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["taxNumber"],
          message: "Kurumsal fatura için 10 veya 11 haneli vergi numarası zorunludur.",
        });
      }
    }
  });

export type CheckoutAddress = z.infer<typeof checkoutAddressSchema>;

export const placeOrderInputSchema = z.object({
  cartId: z.string().optional(),
  email: z.string().trim().email("Geçerli bir e-posta adresi giriniz."),
  phone: z.string().trim().min(10, "Geçerli bir telefon numarası giriniz."),
  shippingAddress: checkoutAddressSchema,
  billingSameAsShipping: z.boolean().default(true),
  billingAddress: checkoutAddressSchema.optional(),
  shippingMethodId: z.string().min(1, "Kargo yöntemi seçiniz."),
  paymentMethod: z.enum(["iyzico", "bank_transfer", "cod", "credit_card"]).default("iyzico"),
  customerNote: z.string().trim().max(1000).optional().nullable(),
  acceptPreInformation: z.literal(true, {
    error: "Ön Bilgilendirme Formunu onaylamanız gerekmektedir.",
  }),
  acceptDistanceSales: z.literal(true, {
    error: "Mesafeli Satış Sözleşmesini onaylamanız gerekmektedir.",
  }),
});

export type PlaceOrderInput = z.infer<typeof placeOrderInputSchema>;
