import { NextResponse } from "next/server";
import { authenticateStaffApi } from "@/lib/auth/api-auth";
import { listReturnRequestsAdmin } from "@/modules/orders/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { errorResponse } = await authenticateStaffApi("orders.read");
  if (errorResponse) return errorResponse;

  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? "ALL";

  try {
    const returns = await listReturnRequestsAdmin(status);
    return NextResponse.json({ returns });
  } catch (err) {
    const message = err instanceof Error ? err.message : "İadeler getirilemedi";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
