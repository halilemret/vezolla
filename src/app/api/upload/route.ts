import { NextResponse } from "next/server";
import { getCurrentStaff, getCurrentCustomer } from "@/lib/auth/session";
import { saveMediaUpload } from "@/lib/storage";

export async function POST(request: Request) {
  const staff = await getCurrentStaff();
  const customer = staff ? null : await getCurrentCustomer();

  try {
    const formData = (await request.formData()) as unknown as globalThis.FormData;
    const file = formData.get("file");
    const folder = (formData.get("folder") as string | null) ?? "urunler";
    const alt = (formData.get("alt") as string | null) ?? undefined;

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Dosya seçilmedi" }, { status: 400 });
    }

    // Yorum görselleri için müşteri veya onaylı ziyaretçi yüklemesine izin verilir
    const isReviewUpload = folder === "reviews" || folder === "yorumlar";
    if (!staff && !customer && !isReviewUpload) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    // Müşteri / ziyaretçi yüklemelerinde yalnızca görsel formatlarına izin verilir
    if (!staff && !file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Yalnızca görsel dosyaları (JPEG, PNG, WebP) yüklenebilir." },
        { status: 400 }
      );
    }

    const maxSizeBytes = isReviewUpload ? 10 * 1024 * 1024 : 15 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return NextResponse.json(
        { error: `Dosya boyutu ${Math.round(maxSizeBytes / (1024 * 1024))} MB sınırını aşıyor.` },
        { status: 400 }
      );
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

    return NextResponse.json({ url: saved.url, asset: saved });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Yükleme başarısız";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
