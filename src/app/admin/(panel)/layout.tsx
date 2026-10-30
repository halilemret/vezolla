import * as React from "react";
import { requireStaff } from "@/lib/auth/session";
import { getStoreSettings } from "@/lib/settings/service";
import { db } from "@/lib/db";
import { AdminShell } from "@/components/admin/admin-shell";

export const dynamic = "force-dynamic";

export default async function AdminPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const staff = await requireStaff();
  const [store, pendingOrders, pendingReturns, pendingReviews] = await Promise.all([
    getStoreSettings(),
    db.order.count({
      where: {
        status: "OPEN",
        OR: [
          { paymentStatus: "AWAITING_TRANSFER" },
          { fulfillmentStatus: { in: ["UNFULFILLED", "PREPARING"] } },
        ],
      },
    }),
    db.returnRequest.count({ where: { status: "REQUESTED" } }),
    db.review.count({ where: { status: "PENDING" } }),
  ]);

  return (
    <AdminShell
      staff={{
        name: staff.name,
        email: staff.email,
        roleName: staff.isOwner ? "Mağaza Sahibi" : staff.role.name,
      }}
      storeName={store.storeName}
      pendingCounts={{
        orders: pendingOrders,
        returns: pendingReturns,
        reviews: pendingReviews,
      }}
    >
      {children}
    </AdminShell>
  );
}
