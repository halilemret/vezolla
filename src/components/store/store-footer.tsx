import Link from "next/link";
import type { StoreSettings, ThemeSettings } from "@/lib/settings/schemas";

export function StoreFooter({
  store,
  pages,
  footerItems,
  theme,
}: {
  store: StoreSettings;
  pages: Array<{ id: string; title: string; slug: string }>;
  footerItems: Array<{ id: string; label: string; url: string | null }>;
  theme?: ThemeSettings;
}) {
  return (
    <footer className="mt-16 border-t border-[var(--border)] bg-[var(--card)] text-[var(--ink)] transition-colors">
      <div className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
        <div className="flex flex-col justify-between gap-8 md:flex-row">
          <div className="max-w-sm space-y-3">
            {theme?.logoImageUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={theme.logoImageUrl}
                alt={theme.logoText || store.storeName}
                className="h-10 sm:h-12 w-auto max-w-[220px] object-contain"
              />
            ) : (
              <p className="font-[family-name:var(--font-serif)] text-2xl font-bold tracking-tight text-[var(--ink)]">
                {theme?.logoText || store.storeName}
              </p>
            )}
            <p className="text-xs font-medium text-[var(--muted)]">
              {store.tagline || "Zarafet İçten Başlar"}
            </p>
            <div className="pt-2 text-xs text-[var(--muted)] space-y-1">
              {store.companyLegalName ? <p className="font-medium text-[var(--ink)]">{store.companyLegalName}</p> : null}
              {store.address ? (
                <p>
                  {store.address}, {store.district} / {store.city}
                </p>
              ) : null}
              <p>
                Müşteri Destek: <span className="font-mono text-[var(--ink)]">{store.supportEmail}</span>
                {store.supportPhone ? ` | ${store.supportPhone}` : ""}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-10 text-xs">
            <div className="space-y-2">
              <div className="font-semibold uppercase tracking-wider text-zinc-900">
                Alışveriş ve Hesap
              </div>
              <ul className="space-y-1.5">
                <li>
                  <Link href="/katalog" className="hover:text-zinc-900 hover:underline">
                    Tüm Ürünler
                  </Link>
                </li>
                <li>
                  <Link href="/sepet" className="hover:text-zinc-900 hover:underline">
                    Sepetim
                  </Link>
                </li>
                <li>
                  <Link href="/siparis-takip" className="hover:text-zinc-900 hover:underline">
                    Sipariş Takibi
                  </Link>
                </li>
                <li>
                  <Link href="/hesabim" className="hover:text-zinc-900 hover:underline">
                    Müşteri Hesabım
                  </Link>
                </li>
              </ul>
            </div>

            <div className="space-y-2">
              <div className="font-semibold uppercase tracking-wider text-zinc-900">
                Bilgilendirme ve Yasal Metinler
              </div>
              <ul className="space-y-1.5">
                {pages.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/sayfa/${p.slug}`}
                      className="hover:text-zinc-900 hover:underline"
                    >
                      {p.title}
                    </Link>
                  </li>
                ))}
                {footerItems.map((item) =>
                  item.url ? (
                    <li key={item.id}>
                      <Link href={item.url} className="hover:text-zinc-900 hover:underline">
                        {item.label}
                      </Link>
                    </li>
                  ) : null
                )}
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col justify-between gap-2 border-t border-zinc-200 pt-5 text-[11px] text-zinc-600 sm:flex-row">
          <span>
            {new Date().getFullYear()} {store.companyLegalName || store.storeName}. Tüm hakları saklıdır.
          </span>
          {store.mersisNumber ? (
            <span className="font-mono">MERSİS: {store.mersisNumber}</span>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
