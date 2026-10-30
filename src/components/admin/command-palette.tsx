"use client";

import * as React from "react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { MagnifyingGlass, ArrowRight } from "@phosphor-icons/react";
import { formatMoney } from "@/lib/money";

interface SearchResults {
  products: Array<{ id: string; title: string; status: string; totalStock: number }>;
  orders: Array<{ id: string; number: number; email: string; total: number }>;
  customers: Array<{ id: string; firstName: string; lastName: string; email: string }>;
}

const STATIC_COMMANDS = [
  { label: "Yeni Ürün Oluştur", href: "/admin/katalog/urunler/yeni", group: "Hızlı İşlem" },
  { label: "Yeni Manuel Sipariş Oluştur", href: "/admin/siparisler/yeni", group: "Hızlı İşlem" },
  { label: "Yeni Kupon / İndirim Kuralı", href: "/admin/promosyonlar", group: "Hızlı İşlem" },
  { label: "XML Tedarikçi Kaynağı Ekle", href: "/admin/xml/kaynaklar", group: "Hızlı İşlem" },
  { label: "Segment ve Kişiselleştirme Kuralları", href: "/admin/kisisellestirme", group: "Hızlı İşlem" },
  { label: "Ana Sayfa Blok Düzenleyici", href: "/admin/icerik/bloklar", group: "Sayfalar" },
  { label: "Ürün Listesi", href: "/admin/katalog/urunler", group: "Sayfalar" },
  { label: "Kategoriler ve Ağaç Yapısı", href: "/admin/katalog/kategoriler", group: "Sayfalar" },
  { label: "Ürün Tipleri ve Özel Alanlar", href: "/admin/katalog/ozel-alanlar", group: "Sayfalar" },
  { label: "Stok ve Depo Yönetimi", href: "/admin/stok", group: "Sayfalar" },
  { label: "Siparişler", href: "/admin/siparisler", group: "Sayfalar" },
  { label: "İade Talepleri (RMA)", href: "/admin/iadeler", group: "Sayfalar" },
  { label: "Müşteriler ve Gruplar", href: "/admin/musteriler", group: "Sayfalar" },
  { label: "Satış ve Kâr Raporları", href: "/admin/raporlar", group: "Sayfalar" },
  { label: "SEO & GEO Optimizasyonu", href: "/admin/seo-geo", group: "Sayfalar" },
  { label: "Mağaza ve Tema Ayarları", href: "/admin/ayarlar", group: "Sayfalar" },
  { label: "Denetim Kaydı (Audit Log)", href: "/admin/ayarlar/denetim", group: "Sayfalar" },
];

export function CommandPalette() {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResults>({
    products: [],
    orders: [],
    customers: [],
  });
  const router = useRouter();

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  React.useEffect(() => {
    if (!open || query.trim().length < 2) {
      setResults({ products: [], orders: [], customers: [] });
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/search?q=${encodeURIComponent(query.trim())}`, {
          signal: ctrl.signal,
        });
        if (res.ok) {
          const data = (await res.json()) as SearchResults;
          setResults(data);
        }
      } catch {
        // İptal edildi
      }
    }, 150);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query, open]);

  const navigate = (href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-9 items-center gap-3 rounded-md border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-100"
      >
        <MagnifyingGlass className="h-4 w-4 text-zinc-600" />
        <span>Ürün, sipariş veya komut ara...</span>
        <kbd className="rounded border border-zinc-300 bg-white px-1.5 py-0.5 font-mono text-[11px] text-zinc-700">
          Ctrl K
        </kbd>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/45 pt-20"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-[95vw] max-w-xl overflow-hidden rounded-md border border-zinc-200 bg-white shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <Command label="Komut Paleti" shouldFilter={true}>
              <div className="flex items-center border-b border-zinc-200 px-3">
                <MagnifyingGlass className="mr-2 h-4 w-4 text-zinc-500" />
                <Command.Input
                  autoFocus
                  value={query}
                  onValueChange={setQuery}
                  placeholder="Ürün adı, SKU, #sipariş no, müşteri veya ekran adı yazın..."
                  className="flex h-11 w-full bg-transparent text-sm text-zinc-900 placeholder:text-zinc-500 focus:outline-none"
                />
              </div>
              <Command.List className="max-h-96 overflow-y-auto p-2">
                <Command.Empty className="py-6 text-center text-xs text-zinc-600">
                  Eşleşen kayıt veya komut bulunamadı.
                </Command.Empty>

                {results.products.length > 0 ? (
                  <Command.Group
                    heading="Ürünler"
                    className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500"
                  >
                    {results.products.map((p) => (
                      <Command.Item
                        key={p.id}
                        value={`urun ${p.title}`}
                        onSelect={() => navigate(`/admin/katalog/urunler/${p.id}`)}
                        className="flex cursor-pointer items-center justify-between rounded px-2.5 py-2 text-sm text-zinc-900 aria-selected:bg-zinc-100"
                      >
                        <span>{p.title}</span>
                        <span className="font-mono text-xs text-zinc-600 tabular-nums">
                          Stok: {p.totalStock}
                        </span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                ) : null}

                {results.orders.length > 0 ? (
                  <Command.Group
                    heading="Siparişler"
                    className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500"
                  >
                    {results.orders.map((o) => (
                      <Command.Item
                        key={o.id}
                        value={`siparis #${o.number} ${o.email}`}
                        onSelect={() => navigate(`/admin/siparisler/${o.id}`)}
                        className="flex cursor-pointer items-center justify-between rounded px-2.5 py-2 text-sm text-zinc-900 aria-selected:bg-zinc-100"
                      >
                        <span>
                          <strong className="font-mono">#{o.number}</strong> ({o.email})
                        </span>
                        <span className="font-mono text-xs text-zinc-700 tabular-nums">
                          {formatMoney(o.total)}
                        </span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                ) : null}

                {results.customers.length > 0 ? (
                  <Command.Group
                    heading="Müşteriler"
                    className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500"
                  >
                    {results.customers.map((c) => (
                      <Command.Item
                        key={c.id}
                        value={`musteri ${c.firstName} ${c.lastName} ${c.email}`}
                        onSelect={() => navigate(`/admin/musteriler/${c.id}`)}
                        className="flex cursor-pointer items-center justify-between rounded px-2.5 py-2 text-sm text-zinc-900 aria-selected:bg-zinc-100"
                      >
                        <span>
                          {c.firstName} {c.lastName}
                        </span>
                        <span className="text-xs text-zinc-600">{c.email}</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                ) : null}

                <Command.Group
                  heading="Ekranlar ve Komutlar"
                  className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500"
                >
                  {STATIC_COMMANDS.map((cmd) => (
                    <Command.Item
                      key={cmd.href}
                      value={`${cmd.group} ${cmd.label}`}
                      onSelect={() => navigate(cmd.href)}
                      className="flex cursor-pointer items-center justify-between rounded px-2.5 py-2 text-sm text-zinc-900 aria-selected:bg-zinc-100"
                    >
                      <span>{cmd.label}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-zinc-500" />
                    </Command.Item>
                  ))}
                </Command.Group>
              </Command.List>
            </Command>
          </div>
        </div>
      ) : null}
    </>
  );
}
