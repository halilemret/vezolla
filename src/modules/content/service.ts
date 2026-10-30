import "server-only";
import { db } from "@/lib/db";
import { ensureUniqueSlug } from "@/lib/slug";
import type { Prisma } from "@/generated/prisma/client";
import { getStoreSettings } from "@/lib/settings/service";

export async function createOrUpdatePage(input: {
  id?: string;
  title: string;
  slug?: string;
  content: string;
  status: "DRAFT" | "PUBLISHED";
  seoTitle?: string;
  seoDescription?: string;
}) {
  if (input.id) {
    return db.page.update({
      where: { id: input.id },
      data: {
        title: input.title.trim(),
        ...(input.slug ? { slug: input.slug.trim() } : {}),
        content: input.content,
        status: input.status,
        seoTitle: input.seoTitle?.trim() || null,
        seoDescription: input.seoDescription?.trim() || null,
      },
    });
  }

  const slug = input.slug?.trim()
    ? input.slug.trim()
    : await ensureUniqueSlug(input.title, async (s) => {
        const found = await db.page.findUnique({ where: { slug: s } });
        return Boolean(found);
      });

  return db.page.create({
    data: {
      title: input.title.trim(),
      slug,
      content: input.content,
      status: input.status,
      seoTitle: input.seoTitle?.trim() || null,
      seoDescription: input.seoDescription?.trim() || null,
    },
  });
}

export async function deletePage(id: string): Promise<void> {
  const page = await db.page.findUnique({ where: { id } });
  if (!page) return;
  if (page.isSystem) {
    throw new Error("Yasal sistem sayfaları silinemez; içeriğini düzenleyebilirsiniz.");
  }
  await db.page.delete({ where: { id } });
}

export async function ensureDefaultCategories(): Promise<void> {
  const existingIntimate = await db.category.findFirst({
    where: {
      OR: [
        { slug: "ic-giyim-fantazi" },
        { slug: "ic-giyim" },
        { name: { contains: "İç Giyim", mode: "insensitive" } },
      ],
    },
  });

  if (!existingIntimate) {
    const root = await db.category.create({
      data: {
        name: "İç Giyim & Fantazi",
        slug: "ic-giyim-fantazi",
        description: "Seçkin iç giyim, fantazi gecelik, büstiyer, korse ve vücut çorabı koleksiyonları. %100 gizli paketleme güvencesiyle.",
        position: 0,
        isActive: true,
      },
    });

    const subcategories = [
      { name: "Sütyen & Külot Takımları", slug: "sutyen-kulot-takimlari" },
      { name: "Gecelik & Sabahlık", slug: "gecelik-sabahlik" },
      { name: "Büstiyer & Korse", slug: "bustiyer-korse" },
      { name: "Babydoll & Vücut Çorabı", slug: "babydoll-vucut-corabi" },
      { name: "İpek & Saten Koleksiyonu", slug: "ipek-saten-koleksiyonu" },
    ];

    let i = 0;
    for (const sub of subcategories) {
      await db.category.create({
        data: {
          name: sub.name,
          slug: sub.slug,
          parentId: root.id,
          position: i++,
          isActive: true,
        },
      });
    }
  }
}

export async function ensureDefaultPages(): Promise<void> {
  const store = await getStoreSettings();
  const defaultPages = [
    {
      slug: "iletisim",
      title: "İletişim ve Müşteri Destek",
      isSystem: true,
      content: `<h2>Bize Ulaşın</h2>
<p>Siparişleriniz, kargo takibi veya ürünlerimizle ilgili her türlü soru, öneri ve destek talebiniz için müşteri destek ekibimiz haftanın 7 günü hizmetinizdedir.</p>
<h3>İletişim Bilgilerimiz</h3>
<ul>
  <li><strong>E-posta Destek:</strong> ${store.supportEmail || "destek@magaza.com"}</li>
  <li><strong>Telefon / WhatsApp:</strong> ${store.supportPhone || "0850 000 00 00"}</li>
  <li><strong>Çalışma Saatleri:</strong> Hafta içi 09:00 - 18:00, Cumartesi 10:00 - 15:00</li>
  <li><strong>Merkez Adres:</strong> ${store.address || "İstanbul"}, ${store.district || "Merkez"} / ${store.city || "Türkiye"}</li>
</ul>
<p>Dilerseniz siparişlerinizin anlık durumunu <a href="/siparis-takip">Sipariş Takip Sayfamız</a> üzerinden 7/24 sorgulayabilirsiniz.</p>`,
    },
    {
      slug: "kvkk",
      title: "KVKK Aydınlatma Metni",
      isSystem: true,
      content: `<h2>Kişisel Verilerin Korunması ve İşlenmesi Aydınlatma Metni</h2>
<p>6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") uyarınca, veri sorumlusu sıfatıyla kişisel verilerinizi yasal sınırlar ve güvenlik standartları çerçevesinde işlemekteyiz.</p>
<p>Kişisel verileriniz siparişlerin hazırlanması, faturalandırma ve kargo teslimat süreçlerinin yürütülmesi amacıyla işlenmektedir.</p>`,
    },
    {
      slug: "hakkimizda",
      title: "Hakkımızda",
      isSystem: false,
      content: `<h2>Zarafet İçten Başlar</h2>
<p>Vezolla, zarafeti gösterişte değil incelikte arayan bir giyim markasıdır. Akışkan bir kumaş kıvrımını andıran amblemi ve sade, yüksek kontrastlı tipografisiyle kalıcı, rafine ve zahmetsiz bir şıklığı temsil eder.</p>
<h3>Temel Değerlerimiz</h3>
<ul>
  <li><strong>Zarafet:</strong> Abartıdan uzak, ölçülü ve zamansız bir duruş.</li>
  <li><strong>Sadelik:</strong> Az ama doğru detay; temiz çizgi ve geniş boşluk.</li>
  <li><strong>Kalite:</strong> Kumaştan dikişe, her ayrıntıda özen.</li>
</ul>
<p>Koleksiyonlarımız, seçkin zarafeti ve özgüveni dışa yansıtan birinci sınıf kumaş ve titiz kalıp işçiliğiyle hazırlanmaktadır.</p>`,
    },
    {
      slug: "teslimat-ve-kargo",
      title: "Teslimat ve Kargo Bilgileri",
      isSystem: true,
      content: `<h2>Teslimat ve Kargo Süreçleri</h2>
<p>Tüm siparişleriniz anlaşmalı kargo firmalarımız güvencesiyle sevk edilir. Saat 16:00'a kadar verilen siparişler aynı gün işleme alınır.</p>
<p>Kargonuz yola çıktığında SMS ve e-posta ile tarafınıza takip numarası iletilir.</p>`,
    },
    {
      slug: "sikca-sorulan-sorular",
      title: "Sıkça Sorulan Sorular (SSS)",
      isSystem: false,
      content: `<h2>Sıkça Sorulan Sorular</h2>
<h3>Siparişim ne zaman kargoya verilir?</h3>
<p>Stoktaki tüm ürünler 1-2 iş günü içerisinde kargo firmasına teslim edilir.</p>
<h3>Gizli paketleme yapılıyor mu?</h3>
<p>Evet, tüm gönderilerimiz dışarıdan içeriği kesinlikle görünmeyen, nötr ve korunaklı ambalajlarda sevk edilir. Kargo fişinde ürün içeriği belirtilmez.</p>
<h3>Nasıl iade yapabilirim?</h3>
<p>14 gün içerisinde İade ve Değişim Koşulları sayfamızda belirtilen adımlarla iade talebi oluşturabilirsiniz.</p>`,
    },
  ];

  for (const p of defaultPages) {
    const existing = await db.page.findUnique({ where: { slug: p.slug } });
    if (!existing) {
      await db.page.create({
        data: {
          slug: p.slug,
          title: p.title,
          content: p.content,
          status: "PUBLISHED",
          isSystem: p.isSystem,
        },
      });
    }
  }
}

export async function ensureDefaultMenus() {
  await Promise.all([ensureDefaultCategories(), ensureDefaultPages()]);

  const [header, footer] = await Promise.all([
    db.menu.upsert({
      where: { handle: "header" },
      create: { handle: "header", name: "Üst Menü (Header)" },
      update: {},
      include: { items: { orderBy: { position: "asc" } } },
    }),
    db.menu.upsert({
      where: { handle: "footer" },
      create: { handle: "footer", name: "Alt Menü (Footer)" },
      update: {},
      include: { items: { orderBy: { position: "asc" } } },
    }),
  ]);

  // Eğer header menüsünde henüz hiç öğe yoksa varsayılan dinamik sekmeleri ekle
  if (header.items.length === 0) {
    const rootCats = await db.category.findMany({
      where: { isActive: true, parentId: null },
      orderBy: { position: "asc" },
      take: 4,
    });

    let pos = 0;
    await db.menuItem.create({
      data: {
        menuId: header.id,
        label: "Tüm Katalog",
        type: "URL",
        url: "/katalog",
        position: pos++,
      },
    });

    for (const cat of rootCats) {
      await db.menuItem.create({
        data: {
          menuId: header.id,
          label: cat.name,
          type: "CATEGORY",
          url: `/kategori/${cat.slug}`,
          targetId: cat.id,
          position: pos++,
        },
      });
    }

    await db.menuItem.create({
      data: {
        menuId: header.id,
        label: "Günün Fırsatları",
        type: "URL",
        url: "/katalog?filter=discount",
        position: pos++,
      },
    });

    await db.menuItem.create({
      data: {
        menuId: header.id,
        label: "İletişim & Destek",
        type: "URL",
        url: "/sayfa/iletisim",
        position: pos++,
      },
    });

    const refreshedHeader = await db.menu.findUnique({
      where: { id: header.id },
      include: { items: { orderBy: { position: "asc" } } },
    });
    return { header: refreshedHeader ?? header, footer };
  }

  return { header, footer };
}

export async function addMenuItem(input: {
  menuHandle: string;
  label: string;
  type: "URL" | "CATEGORY" | "COLLECTION" | "PAGE" | "PRODUCT" | "BRAND";
  url?: string;
  targetId?: string;
  openInNewTab?: boolean;
}) {
  const menu = await db.menu.upsert({
    where: { handle: input.menuHandle },
    create: { handle: input.menuHandle, name: input.menuHandle },
    update: {},
  });

  const count = await db.menuItem.count({ where: { menuId: menu.id } });
  return db.menuItem.create({
    data: {
      menuId: menu.id,
      label: input.label.trim(),
      type: input.type,
      url: input.url?.trim() || null,
      targetId: input.targetId || null,
      position: count,
      openInNewTab: input.openInNewTab ?? false,
    },
  });
}

export async function deleteMenuItem(id: string): Promise<void> {
  await db.menuItem.delete({ where: { id } });
}

export async function moveMenuItem(id: string, direction: "up" | "down"): Promise<void> {
  const item = await db.menuItem.findUnique({ where: { id } });
  if (!item) return;

  const siblings = await db.menuItem.findMany({
    where: { menuId: item.menuId },
    orderBy: { position: "asc" },
  });

  const currentIndex = siblings.findIndex((s) => s.id === id);
  if (currentIndex === -1) return;

  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= siblings.length) return;

  const targetItem = siblings[targetIndex];
  if (!targetItem) return;

  await db.$transaction([
    db.menuItem.update({
      where: { id: item.id },
      data: { position: targetItem.position },
    }),
    db.menuItem.update({
      where: { id: targetItem.id },
      data: { position: item.position },
    }),
  ]);
}

export async function createHomeBlock(input: {
  name: string;
  type: string;
  defaultConfig: Record<string, unknown>;
}) {
  const count = await db.homeBlock.count({ where: { page: "home" } });
  return db.homeBlock.create({
    data: {
      page: "home",
      name: input.name.trim(),
      type: input.type,
      position: count,
      isActive: true,
      variants: {
        create: {
          name: "Varsayılan (Tüm Ziyaretçiler)",
          segmentId: null,
          config: input.defaultConfig as Prisma.InputJsonValue,
          isHidden: false,
        },
      },
    },
    include: { variants: true },
  });
}

export async function upsertHomeBlockVariant(input: {
  id?: string;
  blockId: string;
  name: string;
  segmentId?: string | null;
  config: Record<string, unknown>;
  isHidden?: boolean;
}) {
  if (input.id) {
    return db.homeBlockVariant.update({
      where: { id: input.id },
      data: {
        name: input.name.trim(),
        segmentId: input.segmentId || null,
        config: input.config as Prisma.InputJsonValue,
        isHidden: input.isHidden ?? false,
      },
    });
  }
  return db.homeBlockVariant.create({
    data: {
      blockId: input.blockId,
      name: input.name.trim(),
      segmentId: input.segmentId || null,
      config: input.config as Prisma.InputJsonValue,
      isHidden: input.isHidden ?? false,
    },
  });
}

export async function moveHomeBlock(blockId: string, direction: "up" | "down"): Promise<void> {
  const blocks = await db.homeBlock.findMany({
    where: { page: "home" },
    orderBy: { position: "asc" },
  });
  const idx = blocks.findIndex((b) => b.id === blockId);
  if (idx === -1) return;
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  const current = blocks[idx];
  const target = blocks[swapIdx];
  if (!current || !target) return;

  await db.$transaction([
    db.homeBlock.update({ where: { id: current.id }, data: { position: swapIdx } }),
    db.homeBlock.update({ where: { id: target.id }, data: { position: idx } }),
  ]);
}

export async function submitProductReview(input: {
  productId: string;
  customerId?: string | null;
  authorName: string;
  rating: number;
  title?: string;
  body: string;
}) {
  const store = await getStoreSettings();
  const rating = Math.min(5, Math.max(1, Math.round(input.rating)));

  let isVerifiedPurchase = false;
  let matchedOrderId: string | null = null;

  if (input.customerId) {
    const order = await db.order.findFirst({
      where: {
        customerId: input.customerId,
        paymentStatus: "PAID",
        items: { some: { productId: input.productId } },
      },
      select: { id: true },
    });
    if (order) {
      isVerifiedPurchase = true;
      matchedOrderId = order.id;
    }
  }

  if (store.onlyBuyersCanReview && !isVerifiedPurchase) {
    throw new Error(
      "Bu mağazada yalnızca ürünü satın almış müşteriler değerlendirme yazabilir."
    );
  }

  const status = store.autoApproveReviews ? "APPROVED" : "PENDING";

  const review = await db.review.create({
    data: {
      productId: input.productId,
      customerId: input.customerId ?? null,
      orderId: matchedOrderId,
      authorName: input.authorName.trim(),
      rating,
      title: input.title?.trim() || null,
      body: input.body.trim(),
      status,
      isVerifiedPurchase,
    },
  });

  if (status === "APPROVED") {
    await recalculateProductRating(input.productId);
  }

  return review;
}

export async function moderateReview(input: {
  reviewId: string;
  status: "APPROVED" | "REJECTED";
  reply?: string;
}) {
  const review = await db.review.update({
    where: { id: input.reviewId },
    data: {
      status: input.status,
      reply: input.reply?.trim() ? input.reply.trim() : undefined,
      repliedAt: input.reply?.trim() ? new Date() : undefined,
    },
  });

  await recalculateProductRating(review.productId);
  return review;
}

export async function recalculateProductRating(productId: string): Promise<void> {
  const agg = await db.review.aggregate({
    where: { productId, status: "APPROVED" },
    _avg: { rating: true },
    _count: { rating: true },
  });

  await db.product.update({
    where: { id: productId },
    data: {
      ratingAvg: agg._avg.rating ?? null,
      ratingCount: agg._count.rating,
    },
  });
}
