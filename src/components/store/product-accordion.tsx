"use client";

import * as React from "react";
import {
  CaretDown,
  FileText,
  ListDashes,
  ShieldCheck,
  Sparkle,
  Truck,
  CheckCircle,
} from "@phosphor-icons/react";

export interface ProductAttributeDisplay {
  id: string;
  label: string;
  value: string;
}

export interface ProductAccordionProps {
  description?: string | null;
  attributes?: ProductAttributeDisplay[];
  brandName?: string | null;
  categoryName?: string | null;
}

interface AccordionItem {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
}

const ACCORDION_SECTIONS: AccordionItem[] = [
  {
    id: "desc",
    title: "Ürün Açıklaması & Kumaş Dokusu",
    icon: FileText,
  },
  {
    id: "tech",
    title: "Teknik Özellikler & Materyal",
    icon: ListDashes,
  },
  {
    id: "packaging",
    title: "Gizli Paketleme & Teslimat Bilgisi",
    icon: ShieldCheck,
  },
  {
    id: "care",
    title: "Yıkama ve Bakım Talimatı",
    icon: Sparkle,
  },
];

export function ProductAccordion({
  description,
  attributes = [],
  brandName,
  categoryName,
}: ProductAccordionProps) {
  // İlk sekme (Açıklama) varsayılan olarak açık başlar
  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>({
    desc: true,
    tech: false,
    packaging: false,
    care: false,
  });

  const toggleSection = (id: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5 shadow-xs space-y-3">
      {ACCORDION_SECTIONS.map((section, idx) => {
        const isOpen = !!openSections[section.id];
        const Icon = section.icon;

        return (
          <div
            key={section.id}
            className={`rounded-md border transition-colors ${
              isOpen ? "bg-[var(--surface)] border-[var(--border)]" : "bg-[var(--card)] border-[var(--border)] hover:bg-[var(--surface)]/60"
            }`}
          >
            <button
              type="button"
              onClick={() => toggleSection(section.id)}
              aria-expanded={isOpen}
              aria-controls={`accordion-panel-${section.id}`}
              id={`accordion-trigger-${section.id}`}
              className="flex w-full items-center justify-between px-4 py-3.5 text-left text-sm font-semibold text-[var(--ink)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)] focus-visible:ring-offset-2 cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--card)] text-[var(--ink)] border border-[var(--border)] shadow-2xs">
                  <Icon className="h-4 w-4 text-[var(--accent)]" />
                </span>
                <span>{section.title}</span>
              </div>
              <CaretDown
                className={`h-4 w-4 text-[var(--muted)] transition-transform duration-200 ${
                  isOpen ? "rotate-180 text-[var(--ink)]" : ""
                }`}
              />
            </button>

            {isOpen && (
              <div
                id={`accordion-panel-${section.id}`}
                role="region"
                aria-labelledby={`accordion-trigger-${section.id}`}
                className="border-t border-[var(--border)] px-4 py-3.5 text-xs text-[var(--ink)] space-y-3 animate-in fade-in duration-150"
              >
                {/* 1. Ürün Açıklaması & Kumaş Dokusu */}
                {section.id === "desc" && (
                  <div className="space-y-3 leading-relaxed">
                    {description ? (
                      <div
                        className="prose prose-sm max-w-none text-[var(--ink)] leading-relaxed space-y-2.5"
                        dangerouslySetInnerHTML={{ __html: description }}
                      />
                    ) : (
                      <p className="text-[var(--muted)]">
                        Bu ürün teninizle kusursuz uyum sağlayan yumuşak dokulu, nefes alabilen kumaş yapısına sahiptir.
                        Gün boyu süren konfor ve zarafeti bir arada sunmak üzere titizlikle tasarlanmıştır.
                      </p>
                    )}
                    <div className="mt-3 rounded-md bg-[var(--card)] border border-[var(--border)] p-3 text-[var(--muted)] text-[11px] space-y-1">
                      <p className="font-semibold text-[var(--ink)]">Kumaş ve Ten Teması:</p>
                      <p>
                        • Hassas tenler için tahriş etmeyen yumuşak dikiş teknolojisi ile üretilmiştir.
                      </p>
                      <p>
                        • Esnek yapısı vücut hatlarınızı doğal şekilde sararken hareket özgürlüğü sağlar.
                      </p>
                    </div>
                  </div>
                )}

                {/* 2. Teknik Özellikler & Materyal Tablosu */}
                {section.id === "tech" && (
                  <div className="space-y-3">
                    {attributes.length > 0 || brandName || categoryName ? (
                      <div className="overflow-hidden rounded-md border border-[var(--border)]">
                        <table className="w-full text-xs">
                          <tbody className="divide-y divide-[var(--border)]">
                            {categoryName && (
                              <tr className="bg-[var(--card)]">
                                <th className="w-2/5 bg-[var(--surface)] px-3.5 py-2 text-left font-medium text-[var(--muted)] border-r border-[var(--border)]">
                                  Kategori
                                </th>
                                <td className="px-3.5 py-2 font-medium text-[var(--ink)]">
                                  {categoryName}
                                </td>
                              </tr>
                            )}
                            {brandName && (
                              <tr className="bg-[var(--card)]">
                                <th className="w-2/5 bg-[var(--surface)] px-3.5 py-2 text-left font-medium text-[var(--muted)] border-r border-[var(--border)]">
                                  Marka
                                </th>
                                <td className="px-3.5 py-2 font-medium text-[var(--ink)]">
                                  {brandName}
                                </td>
                              </tr>
                            )}
                            {attributes.map((attr) => (
                              <tr key={attr.id} className="bg-[var(--card)]">
                                <th className="w-2/5 bg-[var(--surface)] px-3.5 py-2 text-left font-medium text-[var(--muted)] border-r border-[var(--border)]">
                                  {attr.label}
                                </th>
                                <td className="px-3.5 py-2 text-[var(--ink)]">
                                  {attr.value || "-"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-[var(--muted)]">
                        Bu ürünün teknik özellikleri ve materyal detayları yakında güncellenecektir.
                      </p>
                    )}
                  </div>
                )}

                {/* 3. Gizli Paketleme & Teslimat Bilgisi */}
                {section.id === "packaging" && (
                  <div className="space-y-3 leading-relaxed">
                    <div className="rounded-md border border-emerald-200 bg-emerald-50/50 p-3.5 text-emerald-950 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-200 space-y-1.5">
                      <div className="flex items-center gap-2 font-semibold">
                        <ShieldCheck className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                        <span>Nötr Koli Güvencesi & Yüzde Yüz Mahremiyet</span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-emerald-900/90 dark:text-emerald-300">
                        Siparişiniz tamamen nötr, içeriği dışarıdan hiçbir şekilde anlaşılamayan kapalı paketlerde teslim edilir.
                        Kargo poşeti veya kolisi üzerinde ürün adı, ürün görseli ya da mahremiyetinizi zedeleyecek hiçbir ibare yer almaz.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 pt-1 text-[11px]">
                      <div className="flex items-start gap-2 rounded-md bg-[var(--card)] border border-[var(--border)] p-2.5">
                        <Truck className="h-4 w-4 shrink-0 text-[var(--accent)] mt-0.5" />
                        <div>
                          <strong className="block font-semibold text-[var(--ink)]">Hızlı ve Sigortalı Sevkiyat:</strong>
                          <span className="text-[var(--muted)]">Hafta içi saat 16:00'ya kadar oluşturulan siparişler aynı gün kargoya teslim edilir.</span>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 rounded-md bg-[var(--card)] border border-[var(--border)] p-2.5">
                        <CheckCircle className="h-4 w-4 shrink-0 text-[var(--accent)] mt-0.5" />
                        <div>
                          <strong className="block font-semibold text-[var(--ink)]">14 Gün İade Hakkı:</strong>
                          <span className="text-[var(--muted)]">Hijyen bandı açılmamış ve denenmemiş ürünlerde 14 gün koşulsuz kolay iade güvencesi.</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. Yıkama ve Bakım Talimatı */}
                {section.id === "care" && (
                  <div className="space-y-2 leading-relaxed text-xs">
                    <p className="text-[var(--muted)]">
                      Ürününüzün formunu, rengini ve kumaş elastikiyetini uzun süre ilk günkü gibi korumak için lütfen aşağıdaki talimatlara uyunuz:
                    </p>
                    <ul className="list-disc pl-4 space-y-1 text-[var(--muted)] text-[11px]">
                      <li>Maksimum 30°C sıcaklıkta elde veya çamaşır makinesinin hassas yıkama programında yıkayınız.</li>
                      <li>Ağartıcı, klor veya yoğun leke çıkarıcı kimyasal maddeler kullanmayınız.</li>
                      <li>Kurutma makinesinde kurutmayınız. Doğrudan güneş ışığına maruz bırakmadan, sererek kurutunuz.</li>
                      <li>Dantel, tül, balen veya destekli modellerde formun bozulmaması için koruyucu yıkama filesi kullanınız.</li>
                      <li>Gerekli durumlarda yalnızca düşük ısıda ve tersinden hafif buharsız ütüleme yapınız.</li>
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
