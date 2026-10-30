import { NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/auth/session";
import { saveMediaUpload } from "@/lib/storage";

export async function POST(request: Request) {
  const staff = await getCurrentStaff();
  if (!staff) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }

  try {
    const formData = (await request.formData()) as unknown as globalThis.FormData;
    const file = formData.get("file");
    const folder = (formData.get("folder") as string | null) ?? "urunler";
    const alt = (formData.get("alt") as string | null) ?? undefined;

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Dosya seçilmedi" }, { status: 400 });
    }

    if (file.size > 15 * 1024 * 1024) {
      return NextResponse.json({ error: "Dosya boyutu 15 MB sınırını aşıyor" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const saved = await saveMediaUpload({
      buffer,
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      folder,
      alt,
    });

    return NextResponse.json({ asset: saved });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Yükleme başarısız";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
