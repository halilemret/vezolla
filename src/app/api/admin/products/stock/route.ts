import { NextResponse } from "next/server";
import { authenticateStaffApi } from "@/lib/auth/api-auth";
import { stockMovementTypeEnum } from "@/modules/inventory/schemas";
import { recordStockMovement } from "@/modules/inventory/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { staff, errorResponse } = await authenticateStaffApi("inventory.write");
  if (errorResponse) return errorResponse;

  try {
    const body = await request.json();
    const variantId = String(body.variantId ?? "").trim();
    const warehouseId = body.warehouseId ? String(body.warehouseId).trim() : undefined;
    const typeRaw = String(body.type ?? "COUNT").trim();
    const quantity = Number(body.quantity);
    const mode = body.mode === "delta" ? "delta" : "set";
    const reason = body.reason ? String(body.reason).trim() : "Mobil uygulama üzerinden stok güncelleme";

    if (!variantId) {
      return NextResponse.json({ error: "Varyant ID zorunludur" }, { status: 400 });
    }

    const parsedType = stockMovementTypeEnum.safeParse(typeRaw);
    if (!parsedType.success) {
      return NextResponse.json({ error: "Geçersiz stok hareket türü" }, { status: 400 });
    }

    if (!Number.isFinite(quantity)) {
      return NextResponse.json({ error: "Geçerli bir stok miktarı giriniz" }, { status: 400 });
    }

    const movement = await recordStockMovement({
      variantId,
      warehouseId,
      type: parsedType.data,
      mode,
      quantity,
      reason,
      staffUserId: staff?.id ?? null,
    });

    return NextResponse.json({
      ok: true,
      movement,
      message: "Stok hareketi başarıyla işlendi",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stok güncellenemedi";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
