import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ProductCard } from "@/components/store/product-card";
import { EmptyState } from "@/components/ui/empty-state";

export default async function StoreCollectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const collection = await db.collection.findUnique({
    where: { slug },
    include: {
      products: {
        orderBy: { position: "asc" },
        include: {
          product: {
            include: {
              brand: { select: { name: true, slug: true } },
              images: { orderBy: { position: "asc" }, take: 2 },
              variants: { where: { isActive: true }, orderBy: { position: "asc" }, take: 3 },
            },
          },
        },
      },
    },
  });

  if (!collection || !collection.isActive) {
    notFound();
  }

  const products = collection.products
    .map((cp) => cp.product)
    .filter((p) => p.status === "ACTIVE" && p.deletedAt === null);

  return (
    <div className="space-y-6">
      <div className="border-b border-zinc-200 pb-4">
        <h1 className="font-[family-name:var(--font-serif)] text-3xl text-zinc-900">
          {collection.title}
        </h1>
        {collection.description ? (
          <p className="mt-1 max-w-2xl text-sm text-zinc-600">{collection.description}</p>
        ) : null}
      </div>

      {products.length === 0 ? (
        <EmptyState
          title="Bu koleksiyonda henüz ürün bulunmuyor"
          description="Tüm ürünleri görmek için katalog sayfasını ziyaret edebilirsiniz."
          actionLabel="Kataloğa Dön"
          actionHref="/katalog"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
