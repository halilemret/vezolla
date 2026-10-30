import { NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import {
  exportProductsToCsv,
  importProductsFromCsv,
} from "@/modules/catalog/csv";

export async function GET() {
  const staff = await getCurrentStaff();
  if (!staff || !hasPermission(staff, "catalog.read")) {
    return NextResponse.json(
      { error: "Bu işlem için katalog görüntüleme yetkisi gerekiyor." },
      { status: 403 }
    );
  }

  const csv = await exportProductsToCsv();
  const filename = `urunler-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(`\uFEFF${csv}`, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export async function POST(request: Request) {
  const staff = await getCurrentStaff();
  if (!staff || !hasPermission(staff, "catalog.write")) {
    return NextResponse.json(
      { error: "Bu işlem için katalog düzenleme yetkisi gerekiyor." },
      { status: 403 }
    );
  }

  try {
    const contentType = request.headers.get("content-type") ?? "";
    let csvText = "";

    if (contentType.includes("multipart/form-data")) {
      const formData = (await request.formData()) as unknown as globalThis.FormData;
      const file = formData.get("file");
      if (file instanceof File) {
        csvText = await file.text();
      } else {
        const rawText = formData.get("csv");
        if (typeof rawText === "string") {
          csvText = rawText;
        }
      }
    } else if (contentType.includes("application/json")) {
      const body = (await request.json()) as { csv?: string };
      csvText = body.csv ?? "";
    } else {
      csvText = await request.text();
    }

    const cleanedCsv = csvText.replace(/^\uFEFF/, "").trim();
    if (!cleanedCsv) {
      return NextResponse.json(
        { error: "CSV içeriği boş olamaz." },
        { status: 400 }
      );
    }

    const result = await importProductsFromCsv(cleanedCsv, staff.id);
    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "CSV içe aktarma başarısız oldu.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
