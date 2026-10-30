import { notFound } from "next/navigation";
import { db } from "@/lib/db";

export default async function StoreCmsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const page = await db.page.findUnique({
    where: { slug },
  });

  if (!page || page.status !== "PUBLISHED") {
    notFound();
  }

  return (
    <article className="mx-auto max-w-3xl rounded-md border border-zinc-200 bg-white p-6 sm:p-10">
      <h1 className="font-[family-name:var(--font-serif)] text-3xl text-zinc-900">
        {page.title}
      </h1>
      <div
        className="prose prose-sm mt-6 max-w-none text-zinc-700 leading-relaxed space-y-3"
        dangerouslySetInnerHTML={{ __html: page.content }}
      />
    </article>
  );
}
