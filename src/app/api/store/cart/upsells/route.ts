import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCartUpsellProducts } from "@/modules/checkout/upsell";
import { VISITOR_COOKIE } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const excludeRaw = searchParams.get("exclude") ?? "";
    const excludeVariantIds = excludeRaw
      ? excludeRaw.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    const cookieStore = await cookies();
    const visitorId = cookieStore.get(VISITOR_COOKIE)?.value ?? null;

    const items = await getCartUpsellProducts({
      excludeVariantIds,
      visitorId,
      limit: 4,
    });
    return NextResponse.json({ items });
  } catch (error) {
    console.error("[cart-upsells-api] Hata:", error);
    return NextResponse.json({ items: [] });
  }
}
