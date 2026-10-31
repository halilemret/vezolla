"use client";

import * as React from "react";
import {
  Ruler,
  X,
  Check,
  Sparkle,
  Question,
  CoatHanger,
  Info,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

export interface SizeGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSize?: (size: string) => void;
  sizeGuideType?: "NONE" | "BRA" | "CLOTHING" | "CUSTOM" | string | null;
  sizeGuideData?: string | null;
  categoryName?: string | null;
  productTitle?: string;
}

export function calculateBraSize(underbustCm: number, bustCm: number): {
  band: number;
  cup: string;
  fullSize: string;
  sisterSizeLo: string;
  sisterSizeHi: string;
  differenceCm: number;
  description: string;
} {
  // Sırt Bandı Hesaplama (Avrupa / Türkiye standardı)
  let band = 75;
  if (underbustCm < 63) band = 60;
  else if (underbustCm < 68) band = 65;
  else if (underbustCm < 73) band = 70;
  else if (underbustCm < 78) band = 75;
  else if (underbustCm < 83) band = 80;
  else if (underbustCm < 88) band = 85;
  else if (underbustCm < 93) band = 90;
  else if (underbustCm < 98) band = 95;
  else if (underbustCm < 103) band = 100;
  else if (underbustCm < 108) band = 105;
  else band = 110;

  const diff = Math.max(0, bustCm - underbustCm);

  // Cup Hesaplama
  let cup = "B";
  let cupIndex = 2; // 0: AA, 1: A, 2: B, 3: C, 4: D, 5: E, 6: F, 7: G
  const cups = ["AA", "A", "B", "C", "D", "E", "F", "G"];

  if (diff < 10) {
    cup = "AA";
    cupIndex = 0;
  } else if (diff <= 12) {
    cup = "A";
    cupIndex = 1;
  } else if (diff <= 14) {
    cup = "B";
    cupIndex = 2;
  } else if (diff <= 16) {
    cup = "C";
    cupIndex = 3;
  } else if (diff <= 18) {
    cup = "D";
    cupIndex = 4;
  } else if (diff <= 20) {
    cup = "E";
    cupIndex = 5;
  } else if (diff <= 22) {
    cup = "F";
    cupIndex = 6;
  } else {
    cup = "G";
    cupIndex = 7;
  }

  const fullSize = `${band}${cup}`;

  // Kardeş Bedenler:
  // Daha sıkı sırt: band - 5, cup + 1 (ör: 80B -> 75C)
  // Daha rahat sırt: band + 5, cup - 1 (ör: 80B -> 85A)
  const cupHi = cups[cupIndex + 1] ?? cup;
  const cupLo = cups[Math.max(0, cupIndex - 1)];
  const sisterBandLo = band <= 60 ? 60 : band - 5;
  const sisterBandHi = band >= 110 ? 110 : band + 5;
  const sisterSizeLo = `${sisterBandLo}${cupHi}`;
  const sisterSizeHi = `${sisterBandHi}${cupLo}`;

  return {
    band,
    cup,
    fullSize,
    sisterSizeLo,
    sisterSizeHi,
    differenceCm: diff,
    description: `Göğüs altı ${underbustCm} cm ve çevre ${bustCm} cm için en ideal kalıp ${fullSize}'dir.`,
  };
}

export function resolveSizeGuideKind(
  sizeGuideType?: string | null,
  categoryName?: string | null,
  productTitle?: string,
  sizeGuideData?: string | null
): "NONE" | "CUSTOM" | "BRA" | "CLOTHING" {
  if (sizeGuideType === "NONE") return "NONE";
  if (sizeGuideType === "CUSTOM" || (sizeGuideData && sizeGuideData.trim().length > 0)) {
    return "CUSTOM";
  }
  if (sizeGuideType === "BRA") return "BRA";
  if (sizeGuideType === "CLOTHING") return "CLOTHING";

  const text = `${categoryName ?? ""} ${productTitle ?? ""}`.toLowerCase();
  if (
    text.includes("sütyen") ||
    text.includes("bra") ||
    text.includes("bralet") ||
    text.includes("destekli") ||
    text.includes("balenli")
  ) {
    return "BRA";
  }
  return "CLOTHING";
}

interface StandardSizeRow {
  size: string;
  trEquivalent: string;
  bustCm: string;
  waistCm: string;
  hipCm: string;
}

const APPAREL_SIZE_TABLE: StandardSizeRow[] = [
  { size: "XS", trEquivalent: "34", bustCm: "80 - 84", waistCm: "62 - 66", hipCm: "88 - 92" },
  { size: "S", trEquivalent: "36", bustCm: "84 - 88", waistCm: "66 - 70", hipCm: "92 - 96" },
  { size: "M", trEquivalent: "38", bustCm: "88 - 92", waistCm: "70 - 74", hipCm: "96 - 100" },
  { size: "L", trEquivalent: "40", bustCm: "92 - 96", waistCm: "74 - 78", hipCm: "100 - 104" },
  { size: "XL", trEquivalent: "42", bustCm: "96 - 102", waistCm: "78 - 84", hipCm: "104 - 110" },
  { size: "XXL", trEquivalent: "44", bustCm: "102 - 108", waistCm: "84 - 90", hipCm: "110 - 116" },
];

const BRIEFS_SIZE_TABLE = [
  { size: "S", trEquivalent: "36", waistCm: "64 - 68", hipCm: "90 - 94" },
  { size: "M", trEquivalent: "38", waistCm: "68 - 72", hipCm: "94 - 98" },
  { size: "L", trEquivalent: "40", waistCm: "72 - 76", hipCm: "98 - 102" },
  { size: "XL", trEquivalent: "42", waistCm: "76 - 80", hipCm: "102 - 106" },
  { size: "XXL", trEquivalent: "44", waistCm: "80 - 86", hipCm: "106 - 112" },
];

export function SizeGuideModal({
  isOpen,
  onClose,
  onSelectSize,
  sizeGuideType,
  sizeGuideData,
  categoryName,
  productTitle,
}: SizeGuideModalProps) {
  const [underbust, setUnderbust] = React.useState<number>(75);
  const [bust, setBust] = React.useState<number>(88);
  const [apparelTab, setApparelTab] = React.useState<"apparel" | "briefs">("apparel");

  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const kind = resolveSizeGuideKind(sizeGuideType, categoryName, productTitle, sizeGuideData);
  if (kind === "NONE") return null;

  const braResult = calculateBraSize(underbust, bust);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="size-guide-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
    >
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-xl space-y-6">
        {/* Başlık ve Kapat Butonu */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--accent)] text-white">
              {kind === "BRA" ? (
                <Ruler className="h-5 w-5" weight="bold" />
              ) : (
                <CoatHanger className="h-5 w-5" weight="bold" />
              )}
            </div>
            <div>
              <h3 id="size-guide-title" className="text-base font-bold text-foreground">
                {kind === "BRA"
                  ? "Sütyen Beden Bulucu"
                  : kind === "CUSTOM"
                  ? "Özel Beden Tablosu"
                  : "Standart Beden Tablosu & Ölçü Rehberi"}
              </h3>
              <p className="text-xs text-muted-foreground">
                {kind === "BRA"
                  ? "Mezura ölçülerinizi girerek size tam uyan kup ve sırt ölçüsünü bulun"
                  : "Vücut ölçülerinize uygun bedeni kolayca tespit edin"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Kapat"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* MODAL İÇERİĞİ: 1. BRA (SÜTYEN BULUCU) */}
        {kind === "BRA" && (
          <div className="space-y-5 text-xs">
            {/* Göğüs Altı */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="underbust-range" className="font-semibold text-foreground flex items-center gap-1">
                  <span>1. Göğüs Altı (Sırt Çevresi)</span>
                  <span className="font-normal text-muted-foreground">(cm)</span>
                </label>
                <span className="rounded-md bg-muted px-2.5 py-1 font-mono text-sm font-bold text-foreground border border-border">
                  {underbust} cm
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Mezurayı göğüs kafesinin hemen altından, sırtınıza paralel şekilde sıkıca sararak ölçün.
              </p>
              <input
                id="underbust-range"
                type="range"
                min="60"
                max="110"
                value={underbust}
                onChange={(e) => {
                  const val = Number.parseInt(e.target.value, 10);
                  setUnderbust(val);
                  if (bust < val + 5) setBust(val + 5);
                }}
                className="w-full accent-[var(--accent)] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>60 cm (Dar)</span>
                <span>80 cm (Standart)</span>
                <span>110 cm (Geniş)</span>
              </div>
            </div>

            {/* Göğüs Çevresi */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="bust-range" className="font-semibold text-foreground flex items-center gap-1">
                  <span>2. Göğüs Çevresi (Meme Ucu Hizası)</span>
                  <span className="font-normal text-muted-foreground">(cm)</span>
                </label>
                <span className="rounded-md bg-muted px-2.5 py-1 font-mono text-sm font-bold text-foreground border border-border">
                  {bust} cm
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Mezurayı göğsün en dolgun noktasından bastırmadan rahatça geçirin.
              </p>
              <input
                id="bust-range"
                type="range"
                min={underbust + 2}
                max="135"
                value={bust}
                onChange={(e) => setBust(Number.parseInt(e.target.value, 10))}
                className="w-full accent-[var(--accent)] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{underbust + 2} cm</span>
                <span>Fark: {braResult.differenceCm} cm</span>
                <span>135 cm</span>
              </div>
            </div>

            {/* Sonuç Kartı */}
            <div className="rounded-[var(--radius-base,0.75rem)] border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
                  Önerilen Bedeniniz
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--accent)]">
                  <Sparkle className="h-3.5 w-3.5" weight="fill" />
                  Mükemmel Uyum
                </span>
              </div>

              <div className="flex items-baseline gap-3">
                <span className="font-mono text-4xl font-extrabold tracking-tight text-foreground">
                  {braResult.fullSize}
                </span>
                <span className="text-xs text-muted-foreground">
                  ({braResult.band} Sırt Bandı / {braResult.cup} Cup)
                </span>
              </div>

              <p className="text-xs text-foreground/80 leading-relaxed">
                {braResult.description}
              </p>

              {/* Kardeş Bedenler */}
              <div className="rounded-lg bg-card p-3 text-xs space-y-1.5 border border-border">
                <div className="font-semibold text-foreground flex items-center gap-1.5">
                  <Question className="h-3.5 w-3.5 text-[var(--accent)]" />
                  <span>Kardeş Bedenler (Alternatif Kalıplar):</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-normal">
                  • Daha sıkı sırt hissi için: <strong className="text-foreground">{braResult.sisterSizeLo}</strong>
                  <br />
                  • Daha rahat sırt hissi için: <strong className="text-foreground">{braResult.sisterSizeHi}</strong>
                </p>
              </div>
            </div>

            {/* Eylemler */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                Kapat
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => {
                  onSelectSize?.(braResult.fullSize);
                  onClose();
                }}
                className="gap-1.5 font-bold"
              >
                <Check className="h-4 w-4" weight="bold" />
                <span>Bu Bedeni Uygula ({braResult.fullSize})</span>
              </Button>
            </div>
          </div>
        )}

        {/* MODAL İÇERİĞİ: 2. CLOTHING (GİYİM / KÜLOT STANDART TABLOSU) */}
        {kind === "CLOTHING" && (
          <div className="space-y-5 text-xs">
            {/* Sekme Değiştirici */}
            <div className="flex rounded-lg border border-border bg-muted/40 p-1">
              <button
                type="button"
                onClick={() => setApparelTab("apparel")}
                className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-all ${
                  apparelTab === "apparel"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Kadın Giyim & Elbise / Pijama
              </button>
              <button
                type="button"
                onClick={() => setApparelTab("briefs")}
                className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-all ${
                  apparelTab === "briefs"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Külot & Alt İç Giyim
              </button>
            </div>

            {/* Beden Ölçü Tablosu */}
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/40 text-muted-foreground border-b border-border text-left">
                    <th className="p-2.5 font-semibold">Beden</th>
                    <th className="p-2.5 font-semibold">TR</th>
                    {apparelTab === "apparel" && <th className="p-2.5 font-semibold">Göğüs (cm)</th>}
                    <th className="p-2.5 font-semibold">Bel (cm)</th>
                    <th className="p-2.5 font-semibold">Basen (cm)</th>
                    {onSelectSize && <th className="p-2.5 text-right font-semibold">İşlem</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {apparelTab === "apparel"
                    ? APPAREL_SIZE_TABLE.map((row) => (
                        <tr key={row.size} className="hover:bg-muted/20 transition-colors">
                          <td className="p-2.5 font-bold text-foreground">{row.size}</td>
                          <td className="p-2.5 text-muted-foreground">{row.trEquivalent}</td>
                          <td className="p-2.5 text-foreground">{row.bustCm}</td>
                          <td className="p-2.5 text-foreground">{row.waistCm}</td>
                          <td className="p-2.5 text-foreground">{row.hipCm}</td>
                          {onSelectSize && (
                            <td className="p-2.5 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectSize(row.size);
                                  onClose();
                                }}
                                className="inline-flex items-center gap-1 rounded bg-zinc-900 px-2 py-1 text-[11px] font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                              >
                                <span>Seç</span>
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                    : BRIEFS_SIZE_TABLE.map((row) => (
                        <tr key={row.size} className="hover:bg-muted/20 transition-colors">
                          <td className="p-2.5 font-bold text-foreground">{row.size}</td>
                          <td className="p-2.5 text-muted-foreground">{row.trEquivalent}</td>
                          <td className="p-2.5 text-foreground">{row.waistCm}</td>
                          <td className="p-2.5 text-foreground">{row.hipCm}</td>
                          {onSelectSize && (
                            <td className="p-2.5 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectSize(row.size);
                                  onClose();
                                }}
                                className="inline-flex items-center gap-1 rounded bg-zinc-900 px-2 py-1 text-[11px] font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                              >
                                <span>Seç</span>
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>

            {/* Nasıl Ölçü Alınır Rehberi */}
            <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-2">
              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                <Info className="h-4 w-4 text-[var(--accent)]" />
                <span>Mezura İle Nasıl Ölçü Alınır?</span>
              </div>
              <ul className="list-disc pl-4 space-y-1 text-muted-foreground text-[11px]">
                <li>
                  <strong className="text-foreground">Göğüs:</strong> Mezurayı sırtınızdan öne doğru göğsün en geniş yerinden geçirin ve yere paralel tutun.
                </li>
                <li>
                  <strong className="text-foreground">Bel:</strong> Göbek deliğinizin yaklaşık 2-3 cm yukarısındaki doğal bel kıvrımını sıkmadan ölçün.
                </li>
                <li>
                  <strong className="text-foreground">Basen:</strong> Ayaklarınız birleşik konumdayken kalçanızın en dolgun çevresini sararak ölçün.
                </li>
              </ul>
            </div>

            <div className="flex justify-end pt-1">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                Kapat
              </Button>
            </div>
          </div>
        )}

        {/* MODAL İÇERİĞİ: 3. CUSTOM (ÜRÜNE ÖZEL BEDEN VERİSİ) */}
        {kind === "CUSTOM" && (
          <div className="space-y-4 text-xs">
            {sizeGuideData ? (
              <div
                className="prose prose-sm max-w-none text-foreground/90 space-y-2"
                dangerouslySetInnerHTML={{ __html: sizeGuideData }}
              />
            ) : (
              <p className="text-muted-foreground">
                Bu ürüne ait özel beden tablosu bilgisi mevcut değildir.
              </p>
            )}
            <div className="flex justify-end pt-2">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                Kapat
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
