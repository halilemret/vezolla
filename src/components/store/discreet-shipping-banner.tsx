import { ShieldCheck, Package, LockKey } from "@phosphor-icons/react/dist/ssr";

export function DiscreetShippingBanner() {
  return (
    <aside
      aria-label="Gizli Paketleme Güvencesi"
      className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 text-[var(--ink)] shadow-xs transition-colors"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)]/10 text-[var(--accent)]">
            <LockKey className="h-5 w-5" weight="duotone" />
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold text-[var(--ink)]">
                %100 Gizli Paketleme & İsimsiz Gönderi
              </h4>
              <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                Maksimum Gizlilik
              </span>
            </div>
            <p className="text-[11px] text-[var(--muted)] leading-relaxed">
              Tüm siparişler dışarıdan içeriği kesinlikle görünmeyen, faturasız ve logosuz nötr kutularda sevk edilir. Kargo fişinde ürün adı belirtilmez.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 text-[11px] font-medium text-[var(--muted)] pt-2 sm:pt-0 border-t sm:border-t-0 border-[var(--border)]">
          <span className="flex items-center gap-1">
            <Package className="h-4 w-4 text-[var(--accent)]" />
            <span>Nötr Koli</span>
          </span>
          <span>·</span>
          <span className="flex items-center gap-1">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>Kapalı Kutu</span>
          </span>
        </div>
      </div>
    </aside>
  );
}
