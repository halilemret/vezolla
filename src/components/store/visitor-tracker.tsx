"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

export function VisitorConsentAndBeacon({
  initialConsent,
}: {
  initialConsent: "granted" | "denied" | "unset";
}) {
  const [consent, setConsent] = React.useState<"granted" | "denied" | "unset">(initialConsent);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Geliş kaynağı (ad_id, campaign_id, utm_*, gclid, fbclid, ttclid) yakalama
  React.useEffect(() => {
    const queryStr = searchParams.toString();
    const hasAdSignal =
      queryStr.includes("ad_id=") ||
      queryStr.includes("campaign_id=") ||
      queryStr.includes("utm_") ||
      queryStr.includes("gclid=") ||
      queryStr.includes("fbclid=") ||
      queryStr.includes("ttclid=");

    if (hasAdSignal) {
      fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "landing",
          url: `${pathname}?${queryStr}`,
          referrer: typeof document !== "undefined" ? document.referrer : "",
        }),
      }).catch(() => {});
    }
  }, [pathname, searchParams]);

  const handleDecision = async (decision: boolean) => {
    setConsent(decision ? "granted" : "denied");
    try {
      await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "consent_update",
          consent: decision,
          url: window.location.href,
        }),
      });
    } catch {
      // Sessizce geç
    }
  };

  if (consent !== "unset") {
    return null;
  }

  return (
    <div
      role="region"
      aria-label="Çerez ve Kişiselleştirme Tercihi"
      className="fixed right-4 bottom-4 left-4 z-40 mx-auto max-w-3xl rounded-md border border-zinc-300 bg-white p-4 shadow-lg"
    >
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="text-xs text-zinc-700">
          <strong className="font-semibold text-zinc-900">KVKK ve Çerez Aydınlatması:</strong>{" "}
          İncelediğiniz ürünlere göre ana sayfada kişisel öneriler sunabilmemiz için çerez onayınızı rica ediyoruz. Onay vermezseniz kalıcı davranış profili tutulmaz; yalnızca sepet ve oturum çerezleri çalışır.
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleDecision(false)}
          >
            Yalnızca Zorunlu
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => handleDecision(true)}
          >
            Kabul Et
          </Button>
        </div>
      </div>
    </div>
  );
}

export function trackStoreEvent(payload: {
  type: string;
  productId?: string;
  variantId?: string;
  categoryId?: string | null;
  value?: string;
  meta?: Record<string, unknown>;
}) {
  if (typeof window === "undefined") return;
  fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

export function ProductViewBeacon({
  productId,
  variantId,
  categoryId,
}: {
  productId: string;
  variantId?: string | null;
  categoryId?: string | null;
}) {
  React.useEffect(() => {
    fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "view_product",
        productId,
        variantId: variantId ?? undefined,
        categoryId: categoryId ?? undefined,
      }),
    }).catch(() => {});
  }, [productId, variantId, categoryId]);

  return null;
}
