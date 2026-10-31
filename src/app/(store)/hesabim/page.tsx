import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentCustomer } from "@/lib/auth/session";
import { getClubSettings } from "@/lib/settings/service";
import {
  getCustomerWishlistDetails,
  getCustomerCollections,
} from "@/modules/wishlist/service";
import { AccountDashboardClient } from "./account-dashboard-client";

export const metadata: Metadata = {
  title: "Hesabım | Özel Müşteri Paneli",
  description:
    "Siparişlerinizi takip edin, favori ve koleksiyonlarınızı yönetin, indirim kuponlarınızı inceleyin.",
};

export default async function CustomerAccountPage() {
  const customer = await getCurrentCustomer();
  if (!customer) {
    redirect("/giris?next=/hesabim");
  }

  const [
    customerDb,
    orders,
    addresses,
    wishlistDetails,
    collections,
    activePromotions,
    recommendedProducts,
    pendingLoyaltyTxs,
    clubSettings,
  ] = await Promise.all([
    db.customer.findUnique({
      where: { id: customer.id },
      include: {
        group: { select: { id: true, name: true } },
      },
    }),
    db.order.findMany({
      where: {
        OR: [
          { customerId: customer.id },
          { email: customer.email.toLowerCase() },
        ],
      },
      orderBy: { placedAt: "desc" },
      include: {
        items: {
          select: {
            id: true,
            title: true,
            variantTitle: true,
            quantity: true,
            total: true,
          },
        },
        fulfillments: {
          select: {
            id: true,
            carrier: true,
            trackingNumber: true,
            trackingUrl: true,
          },
        },
        returns: {
          select: {
            id: true,
            status: true,
            returnCode: true,
            carrierCode: true,
            refundAmount: true,
            hygieneAccepted: true,
            createdAt: true,
          },
        },
      },
    }),
    db.address.findMany({
      where: { customerId: customer.id },
      orderBy: [{ isDefaultShipping: "desc" }, { createdAt: "desc" }],
    }),
    getCustomerWishlistDetails(customer.id),
    getCustomerCollections(customer.id),
    db.promotion.findMany({
      where: {
        isActive: true,
        code: { not: null },
        OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }],
      },
      orderBy: { priority: "desc" },
      take: 6,
      select: {
        id: true,
        name: true,
        description: true,
        code: true,
        type: true,
        value: true,
        endsAt: true,
      },
    }),
    db.product.findMany({
      where: {
        status: "ACTIVE",
        deletedAt: null,
        totalStock: { gt: 0 },
      },
      take: 4,
      orderBy: { createdAt: "desc" },
      include: {
        brand: { select: { name: true, slug: true } },
        images: { orderBy: { position: "asc" }, take: 1 },
        variants: {
          where: { isActive: true },
          orderBy: { position: "asc" },
          take: 1,
        },
      },
    }),
    db.loyaltyTransaction.findMany({
      where: {
        customerId: customer.id,
        status: "PENDING",
      },
      select: { points: true },
    }),
    getClubSettings(),
  ]);

  if (!customerDb) {
    redirect("/giris");
  }

  const formattedRecommended = recommendedProducts.map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    subtitle: p.subtitle,
    minPrice: p.minPrice,
    maxPrice: p.maxPrice,
    totalStock: p.totalStock,
    brandName: p.brand?.name ?? null,
    imageUrl: p.images[0]?.url ?? null,
    compareAtPrice: p.variants[0]?.compareAtPrice ?? null,
    variants: p.variants.map((v) => ({
      id: v.id,
      price: v.price,
      compareAtPrice: v.compareAtPrice,
    })),
  }));

  const pendingLoyaltyPoints = pendingLoyaltyTxs.reduce(
    (sum, t) => sum + t.points,
    0
  );

  return (
    <div className="mx-auto max-w-[1360px] py-4">
      <AccountDashboardClient
        clubSettings={clubSettings}
        pendingLoyaltyPoints={pendingLoyaltyPoints}
        customer={{
          id: customerDb.id,
          email: customerDb.email,
          firstName: customerDb.firstName,
          lastName: customerDb.lastName,
          phone: customerDb.phone,
          totalSpent: customerDb.totalSpent,
          orderCount: customerDb.orderCount,
          loyaltyPoints: customerDb.loyaltyPoints,
          createdAt: customerDb.createdAt,
          acceptsMarketing: customerDb.acceptsMarketing,
        }}
        customerGroupName={customerDb.group?.name ?? null}
        orders={orders.map((o) => ({
          id: o.id,
          number: o.number,
          placedAt: o.placedAt,
          status: o.status,
          paymentStatus: o.paymentStatus,
          fulfillmentStatus: o.fulfillmentStatus,
          total: o.total,
          currency: o.currency,
          items: o.items,
          fulfillments: o.fulfillments,
          returns: o.returns,
        }))}
        addresses={addresses.map((a) => ({
          id: a.id,
          title: a.title,
          firstName: a.firstName,
          lastName: a.lastName,
          phone: a.phone,
          city: a.city,
          district: a.district,
          line1: a.line1,
          isDefaultShipping: a.isDefaultShipping,
        }))}
        wishlist={wishlistDetails}
        collections={collections}
        activePromotions={activePromotions}
        recommendedProducts={formattedRecommended}
      />
    </div>
  );
}
