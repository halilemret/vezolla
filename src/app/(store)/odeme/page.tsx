import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentCustomer } from "@/lib/auth/session";
import { computeCartSummary } from "@/modules/checkout/cart";
import { buildCartContractPreview } from "@/modules/checkout/service";
import { CheckoutClient } from "./checkout-client";

export const metadata: Metadata = {
  title: "Güvenli Ödeme",
};

export default async function CheckoutPage() {
  const [summary, customer] = await Promise.all([
    computeCartSummary(),
    getCurrentCustomer(),
  ]);

  if (summary.lines.length === 0) {
    redirect("/sepet");
  }

  const rawAddresses = customer
    ? await db.address.findMany({
        where: { customerId: customer.id },
        orderBy: [{ isDefaultShipping: "desc" }, { createdAt: "desc" }],
      })
    : [];

  const savedAddresses = rawAddresses.map((a) => ({
    id: a.id,
    title: a.title ?? "Adresim",
    firstName: a.firstName,
    lastName: a.lastName,
    phone: a.phone,
    city: a.city,
    district: a.district,
    neighborhood: a.neighborhood,
    line1: a.line1,
    postalCode: a.postalCode,
    invoiceType: a.invoiceType,
    tckn: a.tckn,
    companyName: a.companyName,
    taxOffice: a.taxOffice,
    taxNumber: a.taxNumber,
    isDefault: a.isDefaultShipping,
  }));

  const initialContracts = await buildCartContractPreview({
    email: customer?.email ?? summary.email ?? undefined,
    phone: customer?.phone ?? summary.phone ?? undefined,
  });

  return (
    <div className="mx-auto max-w-[1360px] px-4 py-8 sm:px-6 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Güvenli Ödeme ve Sipariş Onayı
        </h1>
        <p className="text-xs text-muted-foreground">
          Teslimat adresinizi, kargo tercihinizi ve ödeme yönteminizi seçerek
          siparişinizi tamamlayın.
        </p>
      </div>

      <CheckoutClient
        initialSummary={summary}
        initialContracts={initialContracts}
        customer={
          customer
            ? {
                id: customer.id,
                email: customer.email,
                firstName: customer.firstName,
                lastName: customer.lastName,
                phone: customer.phone,
              }
            : null
        }
        savedAddresses={savedAddresses}
      />
    </div>
  );
}
