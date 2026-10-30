import { NextResponse } from "next/server";
import { authenticateStaffApi } from "@/lib/auth/api-auth";
import { updateReturnRequestStatus, receiveReturnRequest } from "@/modules/orders/service";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { staff, errorResponse } = await authenticateStaffApi("orders.write");
  if (errorResponse) return errorResponse;

  const { id } = await params;
  const body = await request.json();
  const action = String(body.action ?? "").trim();
  const staffNote = body.staffNote ? String(body.staffNote).trim() : undefined;

  try {
    if (action === "approve") {
      const res = await updateReturnRequestStatus({
        returnRequestId: id,
        status: "APPROVED",
        staffNote,
        staffUserId: staff?.id ?? null,
      });
      if (!res.ok) {
        return NextResponse.json({ error: res.error ?? "İade onaylanamadı" }, { status: 400 });
      }
      return NextResponse.json({ ok: true, message: "İade onaylandı" });
    }

    if (action === "reject") {
      const res = await updateReturnRequestStatus({
        returnRequestId: id,
        status: "REJECTED",
        staffNote,
        staffUserId: staff?.id ?? null,
      });
      if (!res.ok) {
        return NextResponse.json({ error: res.error ?? "İade reddedilemedi" }, { status: 400 });
      }
      return NextResponse.json({ ok: true, message: "İade reddedildi" });
    }

    if (action === "receive") {
      const res = await receiveReturnRequest({
        returnRequestId: id,
        staffUserId: staff?.id ?? null,
        staffNote,
      });
      if (!res.ok) {
        return NextResponse.json({ error: res.error ?? "İade teslim alınamadı" }, { status: 400 });
      }
      return NextResponse.json({ ok: true, message: "İade teslim alındı olarak işaretlendi" });
    }

    return NextResponse.json({ error: "Geçersiz iade eylemi" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "İşlem sırasında hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
