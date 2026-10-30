import { NextResponse } from "next/server";
import { authenticateStaffApi } from "@/lib/auth/api-auth";
import { db } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import type { ProductStatus } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { errorResponse } = await authenticateStaffApi("catalog.read");
  if (errorResponse) return errorResponse;

  const { id } = await params;

  const product = await db.product.findUnique({
    where: { id },
    include: {
      images: { orderBy: { position: "asc" } },
      categories: {
        include: {
          category: { select: { id: true, name: true } },
        },
      },
      brand: true,
      variants: {
        include: {
          inventoryLevels: {
            include: {
              warehouse: { select: { id: true, name: true, code: true } },
            },
          },
        },
      },
    },
  });

  if (!product) {
    return NextResponse.json({ error: "Ürün bulunamadı" }, { status: 404 });
  }

  return NextResponse.json({ product });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { staff, errorResponse } = await authenticateStaffApi("catalog.write");
  if (errorResponse) return errorResponse;

  const { id } = await params;
  const body = await request.json();

  const updateData: { status?: ProductStatus; title?: string } = {};
  if (typeof body.isActive === "boolean") {
    updateData.status = body.isActive ? "ACTIVE" : "DRAFT";
  } else if (body.status && ["ACTIVE", "DRAFT", "ARCHIVED"].includes(body.status)) {
    updateData.status = body.status as ProductStatus;
  }

  if (typeof body.title === "string" && body.title.trim()) {
    updateData.title = body.title.trim();
  }

  const updated = await db.product.update({
    where: { id },
    data: updateData,
  });

  await recordAudit({
    staffUserId: staff?.id ?? null,
    action: "product.update.mobile",
    entityType: "Product",
    entityId: id,
    summary: `Ürün güncellendi: ${updated.title} (Durum: ${updated.status})`,
  });

  return NextResponse.json({ ok: true, product: updated });
}
