const TR_MAP: Record<string, string> = {
  ç: "c",
  Ç: "c",
  ğ: "g",
  Ğ: "g",
  ı: "i",
  I: "i",
  İ: "i",
  ö: "o",
  Ö: "o",
  ş: "s",
  Ş: "s",
  ü: "u",
  Ü: "u",
};

export function slugify(input: string): string {
  const mapped = input
    .split("")
    .map((ch) => TR_MAP[ch] ?? ch)
    .join("");

  const slug = mapped
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return slug || "kayit";
}

export async function ensureUniqueSlug(
  baseText: string,
  exists: (candidate: string) => Promise<boolean>
): Promise<string> {
  const base = slugify(baseText);
  if (!(await exists(base))) {
    return base;
  }
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}-${i}`;
    if (!(await exists(candidate))) {
      return candidate;
    }
  }
  return `${base}-${Date.now().toString(36)}`;
}
