import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import {
  listAbandonedCarts,
  getCheckoutFunnelAnalytics,
} from "@/modules/analytics/abandoned-cart";
import { getAbandonedCartSettings } from "@/lib/settings/service";
import { AbandonedCartsClient } from "./abandoned-carts-client";

export const metadata: Metadata = {
  title: "Terk Edilmiş Sepetler ve Funnel Analizi | Yönetim Paneli",
};

export const dynamic = "force-dynamic";

export default async function AbandonedCartsPage() {
  await requireStaff();

  const [
    abandonedResult,
    funnelAnalytics,
    settings,
    activePromotions,
  ] = await Promise.all([
    listAbandonedCarts({ minAgeMinutes: 15, limit: 50 }),
    getCheckoutFunnelAnalytics(30),
    getAbandonedCartSettings(),
    db.promotion.findMany({
      where: { code: { not: null } },
      select: { code: true, name: true },
      take: 20,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Terk Edilmiş Sepetler ve Ziyaretçi Funnel Analizi
        </h1>
        <p className="text-xs text-muted-foreground">
          Misafir ve kayıtlı müşterilerin sepet terk davranışlarını, checkout adımı dökülmelerini izleyin ve otomatik veya manuel kurtarma e-postaları gönderin.
        </p>
      </div>

      <AbandonedCartsClient
        initialCarts={abandonedResult.carts}
        initialTotal={abandonedResult.total}
        initialStats={abandonedResult.stats}
        funnelAnalytics={funnelAnalytics}
        initialSettings={settings}
        activePromotions={activePromotions}
      />
    </div>
  );
}
