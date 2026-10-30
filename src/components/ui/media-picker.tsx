"use client";

import * as React from "react";
import { UploadSimple } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export interface UploadedImage {
  url: string;
  alt?: string;
  width?: number | null;
  height?: number | null;
}

export function ImageUploadField({
  value,
  onChange,
  folder = "urunler",
  placeholder = "/uploads/... veya https://...",
}: {
  value: string;
  onChange: (url: string, meta?: { width?: number | null; height?: number | null }) => void;
  folder?: string;
  placeholder?: string;
}) {
  const [uploading, setUploading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", folder);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = (await res.json()) as {
        asset?: { url: string; width: number | null; height: number | null };
        error?: string;
      };
      if (!res.ok || !data.asset) {
        throw new Error(data.error ?? "Dosya yüklenemedi");
      }
      onChange(data.asset.url, { width: data.asset.width, height: data.asset.height });
      toast.success("Görsel yüklendi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Görsel yüklenemedi");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={uploading}
        onClick={() => fileRef.current?.click()}
      >
        <UploadSimple className="h-4 w-4" />
        {uploading ? "Yükleniyor..." : "Yükle"}
      </Button>
    </div>
  );
}
