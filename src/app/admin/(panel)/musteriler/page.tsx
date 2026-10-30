import Link from "next/link";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { requireStaff } from "@/lib/auth/session";
import { formatMoney } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { listCustomers } from "@/modules/customers/service";
import {
  deleteCustomerGroupAction,
  saveCustomerGroupAction,
} from "@/modules/customers/actions";

export const dynamic = "force-dynamic";

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireStaff("customers.read");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const groupId = typeof sp.groupId === "string" ? sp.groupId : "ALL";
  const page = typeof sp.page === "string" ? Number.parseInt(sp.page, 10) || 1 : 1;

  const result = await listCustomers({ q, groupId, page, pageSize: 25 });

  async function handleCreateGroup(formData: FormData) {
    "use server";
    await saveCustomerGroupAction(formData);
  }

  async function handleDeleteGroup(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "");
    if (id) {
      await deleteCustomerGroupAction(id);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900">
            Müşteriler ve Müşteri Grupları
          </h1>
          <p className="mt-1 text-xs text-zinc-600">
            Müşteri profillerini, sipariş geçmişlerini, özel fiyat listesi gruplarını ve KVKK taleplerini yönetin.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <form
            method="GET"
            action="/admin/musteriler"
            className="flex flex-col gap-3 rounded-md border border-zinc-200 bg-white p-4 sm:flex-row"
          >
            <Input
              name="q"
              defaultValue={q}
              placeholder="Ad, soyad, e-posta veya telefon ara..."
              className="flex-1"
            />
            <Select name="groupId" defaultValue={groupId} className="sm:w-52">
              <option value="ALL">Tüm Müşteri Grupları</option>
              <option value="NONE">Grubu Olmayanlar</option>
              {result.groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g._count.customers})
                </option>
              ))}
            </Select>
            <Button type="submit" variant="secondary" size="sm">
              Filtrele
            </Button>
          </form>

          {result.customers.length === 0 ? (
            <EmptyState
              title="Müşteri bulunamadı"
              description="Arama kriterlerinize uygun müşteri kaydı bulunmuyor."
            />
          ) : (
            <div className="overflow-x-auto rounded-md border border-zinc-200 bg-white">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
                    <th className="px-4 py-3">Müşteri</th>
                    <th className="px-4 py-3">Grup / Durum</th>
                    <th className="px-4 py-3 text-right">Sipariş</th>
                    <th className="px-4 py-3 text-right">Toplam Harcama</th>
                    <th className="px-4 py-3">Son Sipariş</th>
                    <th className="px-4 py-3 text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {result.customers.map((c) => (
                    <tr key={c.id} className="hover:bg-zinc-50/80">
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/musteriler/${c.id}`}
                          className="font-semibold text-zinc-900 hover:underline"
                        >
                          {c.firstName} {c.lastName}
                        </Link>
                        <div className="text-[11px] text-zinc-600">{c.email}</div>
                        {c.phone ? (
                          <div className="font-mono text-[11px] text-zinc-600">
                            {c.phone}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {c.group ? (
                            <Badge variant="accent">{c.group.name}</Badge>
                          ) : (
                            <Badge variant="neutral">Standart</Badge>
                          )}
                          {!c.passwordHash ? (
                            <Badge variant="neutral">Misafir</Badge>
                          ) : null}
                          {!c.isActive ? <Badge variant="danger">Pasif</Badge> : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-zinc-900">
                        {c.orderCount}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-zinc-900">
                        {formatMoney(c.totalSpent)}
                      </td>
                      <td className="px-4 py-3 text-zinc-600 tabular-nums">
                        {c.lastOrderAt
                          ? format(c.lastOrderAt, "dd MMM yyyy", { locale: tr })
                          : "-"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/admin/musteriler/${c.id}`}
                          className="rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-900 hover:bg-zinc-100"
                        >
                          Detay
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <section className="rounded-md border border-zinc-200 bg-white p-5 text-xs">
            <h2 className="text-sm font-semibold text-zinc-900">Müşteri Grupları</h2>
            <p className="mt-1 text-zinc-600">
              VIP, Bayi veya Personel gibi gruplar tanımlayarak bu gruplara özel fiyat listeleri ve kuponlar atayabilirsiniz.
            </p>

            <form action={handleCreateGroup} className="mt-4 space-y-3">
              <div>
                <Label htmlFor="groupName">Yeni Grup Adı</Label>
                <Input
                  id="groupName"
                  name="name"
                  required
                  placeholder="Örn: Kurumsal Bayi / VIP"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="groupDesc">Açıklama</Label>
                <Input
                  id="groupDesc"
                  name="description"
                  placeholder="Grup açıklaması (opsiyonel)"
                  className="mt-1"
                />
              </div>
              <Button type="submit" variant="primary" size="sm" className="w-full">
                + Müşteri Grubu Ekle
              </Button>
            </form>

            <div className="mt-5 divide-y divide-zinc-200 border-t border-zinc-200 pt-3">
              {result.groups.length === 0 ? (
                <p className="py-2 text-zinc-600">Henüz tanımlı müşteri grubu yok.</p>
              ) : (
                result.groups.map((grp) => (
                  <div
                    key={grp.id}
                    className="flex items-center justify-between gap-2 py-2.5"
                  >
                    <div>
                      <div className="font-semibold text-zinc-900">{grp.name}</div>
                      {grp.description ? (
                        <div className="text-[11px] text-zinc-600">{grp.description}</div>
                      ) : null}
                      <div className="mt-0.5 font-mono text-[11px] text-zinc-600 tabular-nums">
                        {grp._count.customers} müşteri | {grp._count.priceLists} fiyat listesi
                      </div>
                    </div>
                    <form action={handleDeleteGroup}>
                      <input type="hidden" name="id" value={grp.id} />
                      <button
                        type="submit"
                        className="rounded border border-zinc-200 px-2 py-1 text-[11px] text-red-700 hover:bg-red-50"
                      >
                        Sil
                      </button>
                    </form>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
