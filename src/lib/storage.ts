import "server-only";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { db } from "@/lib/db";

const PUBLIC_UPLOAD_DIR = path.resolve(process.cwd(), "public", "uploads");
const PRIVATE_STORAGE_DIR = path.resolve(process.cwd(), "storage");

export interface StoredFileResult {
  id: string;
  url: string;
  key: string;
  filename: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
}

function sanitizeFilename(name: string): string {
  const ext = path.extname(name).toLowerCase().replace(/[^.a-z0-9]/g, "");
  const base = path
    .basename(name, path.extname(name))
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const rand = randomBytes(4).toString("hex");
  return `${base || "dosya"}-${rand}${ext || ".bin"}`;
}

/**
 * Görsel veya medya dosyasını `public/uploads/<folder>` altına kaydeder,
 * görsel ise `sharp` ile boyutlarını çıkarır ve MediaAsset kaydı oluşturur.
 */
export async function saveMediaUpload(options: {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  folder?: string;
  alt?: string;
}): Promise<StoredFileResult> {
  const folder = (options.folder ?? "genel").replace(/[^a-z0-9_-]/gi, "");
  const safeName = sanitizeFilename(options.filename);
  const key = `${folder}/${safeName}`;
  const targetDir = path.join(PUBLIC_UPLOAD_DIR, folder);
  await mkdir(targetDir, { recursive: true });

  let outBuffer = options.buffer;
  let width: number | null = null;
  let height: number | null = null;

  if (options.mimeType.startsWith("image/") && !options.mimeType.includes("svg")) {
    try {
      const img = sharp(options.buffer);
      const meta = await img.metadata();
      width = meta.width ?? null;
      height = meta.height ?? null;
      if (width && width > 2000) {
        const resized = await img.resize({ width: 2000, withoutEnlargement: true }).toBuffer({
          resolveWithObject: true,
        });
        outBuffer = resized.data;
        width = resized.info.width;
        height = resized.info.height;
      }
    } catch {
      // Görsel meta okunamazsa olduğu gibi kaydet
    }
  }

  const fullPath = path.join(PUBLIC_UPLOAD_DIR, key);
  await writeFile(fullPath, outBuffer);

  const url = `/uploads/${key}`;
  const asset = await db.mediaAsset.create({
    data: {
      url,
      key,
      filename: options.filename,
      mimeType: options.mimeType,
      size: outBuffer.byteLength,
      width,
      height,
      alt: options.alt ?? null,
      folder,
    },
  });

  return {
    id: asset.id,
    url: asset.url,
    key: asset.key,
    filename: asset.filename,
    mimeType: asset.mimeType,
    size: asset.size,
    width: asset.width,
    height: asset.height,
  };
}

export async function deleteMediaAsset(assetId: string): Promise<void> {
  const asset = await db.mediaAsset.findUnique({ where: { id: assetId } });
  if (!asset) return;
  const fullPath = path.join(PUBLIC_UPLOAD_DIR, asset.key);
  await unlink(fullPath).catch(() => {});
  await db.mediaAsset.delete({ where: { id: assetId } });
}

/**
 * Herkese açık olmayan dosyaları (örn. tedarikçi XML dosyaları) `storage/` altına yazar.
 */
export async function savePrivateFile(subfolder: string, filename: string, buffer: Buffer): Promise<string> {
  const cleanFolder = subfolder.replace(/[^a-z0-9_-]/gi, "");
  const safeName = sanitizeFilename(filename);
  const key = `${cleanFolder}/${safeName}`;
  const dir = path.join(PRIVATE_STORAGE_DIR, cleanFolder);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(PRIVATE_STORAGE_DIR, key), buffer);
  return key;
}

export async function readPrivateFile(key: string): Promise<Buffer> {
  const normalized = key.replace(/\.\./g, "");
  return readFile(path.join(PRIVATE_STORAGE_DIR, normalized));
}
