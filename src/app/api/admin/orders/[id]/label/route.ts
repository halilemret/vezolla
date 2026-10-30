import { NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { loadShippingLabel } from "@/modules/orders/label";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const staff = await getCurrentStaff();
  if (!staff || !hasPermission(staff, "orders.read")) {
    return NextResponse.json(
      { error: "Bu işlem için sipariş görüntüleme yetkisi gerekiyor." },
      { status: 403 }
    );
  }

  const { id } = await params;
  const fulfillmentId = new URL(request.url).searchParams.get("fulfillmentId");

  const label = await loadShippingLabel(id, fulfillmentId);
  if (!label) {
    return NextResponse.json(
      { error: "Etiket üretilemedi. Sipariş veya gönderim bulunamadı." },
      { status: 404 }
    );
  }

  return new NextResponse(label.zpl, {
    status: 200,
    headers: {
      "Content-Type": "application/x-zpl; charset=utf-8",
      "Content-Disposition": `attachment; filename="etiket-siparis-${label.orderNumber}.zpl"`,
      "Cache-Control": "no-store",
    },
  });
}
