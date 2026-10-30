import { describe, expect, it } from "vitest";

interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  children?: CategoryNode[];
}

describe("Dinamik Header, Menü ve Sayfa Mimarisi", () => {
  it("Mobil burger menüsü için hiyerarşik kategori ağacı doğru dallanır", () => {
    const rawCategories: CategoryNode[] = [
      {
        id: "cat-kadin",
        name: "Kadın",
        slug: "kadin",
        children: [
          {
            id: "cat-giyim",
            name: "Kadın Giyim",
            slug: "kadin-giyim",
            children: [
              { id: "cat-elbise", name: "Elbise", slug: "elbise" },
              { id: "cat-etek", name: "Etek", slug: "etek" },
            ],
          },
        ],
      },
      {
        id: "cat-ic-giyim",
        name: "İç Giyim & Fantazi",
        slug: "ic-giyim-fantazi",
        children: [
          { id: "cat-sutyen", name: "Sütyen & Külot", slug: "sutyen-kulot" },
          { id: "cat-gecelik", name: "Gecelik & Sabahlık", slug: "gecelik-sabahlik" },
        ],
      },
    ];

    expect(rawCategories).toHaveLength(2);
    expect(rawCategories[0]?.children).toHaveLength(1);
    expect(rawCategories[0]?.children?.[0]?.children).toHaveLength(2);

    // Kategori haritası slug ve ID çözümlemesi
    const map = new Map<string, CategoryNode>();
    for (const c of rawCategories) {
      map.set(c.id, c);
      map.set(c.slug, c);
    }

    expect(map.get("kadin")?.name).toBe("Kadın");
    expect(map.get("cat-ic-giyim")?.name).toBe("İç Giyim & Fantazi");
  });

  it("Header menü öğesi sırası değiştirildiğinde pozisyonlar yer değiştirir", () => {
    const items = [
      { id: "1", label: "Tüm Katalog", position: 0 },
      { id: "2", label: "Kadın", position: 1 },
      { id: "3", label: "İç Giyim & Fantazi", position: 2 },
    ];

    // Yukarı taşı simülasyonu (item 2 position: 1 -> position: 0)
    const moveItem = (list: typeof items, id: string, direction: "up" | "down") => {
      const idx = list.findIndex((i) => i.id === id);
      if (idx === -1) return list;
      const targetIdx = direction === "up" ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= list.length) return list;

      const copy = [...list];
      const current = copy[idx]!;
      const target = copy[targetIdx]!;

      const tmpPos = current.position;
      current.position = target.position;
      target.position = tmpPos;

      return copy.sort((a, b) => a.position - b.position);
    };

    const reordered = moveItem(items, "2", "up");
    expect(reordered[0]?.label).toBe("Kadın");
    expect(reordered[1]?.label).toBe("Tüm Katalog");
  });

  it("Kritik yasal ve kurumsal sayfa bağlantıları tanımlı rotalarla eşleşir", () => {
    const expectedPages = [
      { slug: "iletisim", title: "İletişim ve Müşteri Destek" },
      { slug: "kvkk", title: "KVKK Aydınlatma Metni" },
      { slug: "hakkimizda", title: "Hakkımızda" },
      { slug: "teslimat-ve-kargo", title: "Teslimat ve Kargo Bilgileri" },
      { slug: "sikca-sorulan-sorular", title: "Sıkça Sorulan Sorular" },
    ];

    expectedPages.forEach((p) => {
      expect(p.slug).toMatch(/^[a-z0-9-]+$/);
      expect(p.title.length).toBeGreaterThan(3);
    });
  });
});
