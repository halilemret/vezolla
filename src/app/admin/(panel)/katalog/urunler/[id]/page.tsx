import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth/session";
import { getProductEditorData } from "@/modules/catalog/service";
import { EntityAuditHistory } from "@/components/admin/audit-history";
import ProductEditorPage from "../yeni/page";

export default async function AdminProductEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff("catalog.read");
  const { id } = await params;

  const editorData = await getProductEditorData(id);
  if (!editorData.product) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <ProductEditorPage initialData={editorData} />
      <EntityAuditHistory entityType="Product" entityId={editorData.product.id} />
    </div>
  );
}
