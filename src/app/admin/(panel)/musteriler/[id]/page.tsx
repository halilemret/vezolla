import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { EntityAuditHistory } from "@/components/admin/audit-history";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getCustomerDetail } from "@/modules/customers/service";
import {
  anonymizeCustomerKvkkAction,
  updateCustomerAdminAction,
} from "@/modules/customers/actions";

export const dynamic = "force-dynamic";

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff("customers.read");
  const { id } = await params;

  const [customer, groups] = await Promise.all([
    getCustomerDetail(id),
    db.customerGroup.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!customer) {
    notFound();
  }

  async function handleUpdateCustomer(formData: FormData) {
    "use server";
    await updateCustomerAdminAction(formData);
  }

  async function handleAnonymize(formData: FormData) {
    "use server";
    const cid = String(formData.get("customerId") ?? "");
    if (cid) {
      await anonymizeCustomerKvkkAction(cid);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 border-b border-zinc-200 pb-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2 text-xs text-zinc-600">
            <Link href="/admin/musteriler" className="hover:underline">
              Müşteriler
            </Link>
            <span>/</span>
            <span className="text-zinc-900">
              {customer.firstName} {customer.lastName}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-zinc-900">
              {customer.firstName} {customer.lastName}
            </h1>
            {customer.group ? (
              <Badge variant="accent">{customer.group.name}</Badge>
            ) : (
              <Badge variant="neutral">Standart Grup</Badge>
            )}
            <Badge variant={customer.isActive ? "success" : "danger"}>
              {customer.isActive ? "Aktif Hesap" : "Pasif / Anonim"}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-zinc-600">
            {customer.email} {customer.phone ? `| Tel: ${customer.phone}` : ""} | Kayıt:{" "}
            {format(customer.createdAt, "dd MMM yyyy", { locale: tr })}
          </p>
        </div>

        <Link href={`/admin/siparisler?customerId=${customer.id}`}>
          <Button variant="outline" size="sm">
            Tüm Siparişlerini Gör ({customer.orderCount})
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-md border border-zinc-200 bg-white p-4">
          <div className="text-xs font-medium text-zinc-600">Toplam Sipariş</div>
          <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-zinc-900">
            {customer.orderCount}
          </div>
        </div>
        <div className="rounded-md border border-zinc-200 bg-white p-4">
          <div className="text-xs font-medium text-zinc-600">Toplam Harcama (LTV)</div>
          <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-zinc-900">
            {formatMoney(customer.totalSpent)}
          </div>
        </div>
        <div className="rounded-md border border-zinc-200 bg-white p-4">
          <div className="text-xs font-medium text-zinc-600">Son Sipariş Tarihi</div>
          <div className="mt-1 font-mono text-base font-bold tabular-nums text-zinc-900">
            {customer.lastOrderAt
              ? format(customer.lastOrderAt, "dd MMMM yyyy HH:mm", { locale: tr })
              : "Henüz sipariş yok"}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-md border border-zinc-200 bg-white">
            <div className="border-b border-zinc-200 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-zinc-900">Sipariş Geçmişi</h2>
            </div>
            {customer.orders.length === 0 ? (
              <p className="p-5 text-xs text-zinc-600">
                Bu müşteriye ait sipariş kaydı bulunmuyor.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50 text-[11px] font-semibold uppercase text-zinc-600">
                      <th className="px-4 py-2.5">Sipariş No</th>
                      <th className="px-4 py-2.5">Tarih</th>
                      <th className="px-4 py-2.5">Ödeme</th>
                      <th className="px-4 py-2.5">Gönderim</th>
                      <th className="px-4 py-2.5 text-right">Tutar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {customer.orders.map((ord) => (
                      <tr key={ord.id} className="hover:bg-zinc-50">
                        <td className="px-4 py-2.5 font-mono font-semibold text-zinc-900">
                          <Link
                            href={`/admin/siparisler/${ord.id}`}
                            className="underline"
                          >
                            #{ord.number}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5 text-zinc-600 tabular-nums">
                          {format(ord.placedAt, "dd MMM yyyy HH:mm", { locale: tr })}
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge
                            variant={ord.paymentStatus === "PAID" ? "success" : "neutral"}
                          >
                            {ord.paymentStatus}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge variant="neutral">{ord.fulfillmentStatus}</Badge>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums text-zinc-900">
                          {formatMoney(ord.total, ord.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-md border border-zinc-200 bg-white p-5 text-xs">
            <h2 className="text-sm font-semibold text-zinc-900">Kayıtlı Adresler</h2>
            {customer.addresses.length === 0 ? (
              <p className="mt-2 text-zinc-600">Kayıtlı adres bulunmuyor.</p>
            ) : (
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {customer.addresses.map((addr) => (
                  <div
                    key={addr.id}
                    className="rounded border border-zinc-200 bg-zinc-50 p-3.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-zinc-900">
                        {addr.title ?? "Adres"}
                      </span>
                      {addr.isDefaultShipping ? (
                        <Badge variant="neutral">Varsayılan</Badge>
                      ) : null}
                    </div>
                    <div className="mt-1 text-zinc-800">
                      {addr.firstName} {addr.lastName}
                    </div>
                    <div className="text-zinc-700">{addr.line1}</div>
                    <div className="text-zinc-700">
                      {addr.district} / {addr.city}
                    </div>
                    <div className="mt-1 font-mono text-zinc-600">{addr.phone}</div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {customer.visitors.length > 0 ? (
            <section className="rounded-md border border-zinc-200 bg-white p-5 text-xs">
              <h2 className="text-sm font-semibold text-zinc-900">
                Kişiselleştirme ve Davranışsal İlgi Profili
              </h2>
              {customer.visitors.map((v) => (
                <div key={v.id} className="mt-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-zinc-600">
                    <span className="font-mono">Ziyaretçi #{v.id.slice(0, 8)}</span>
                    <span>| Oturum: {v.sessionCount}</span>
                    {v.city ? <span>| İl: {v.city}</span> : null}
                  </div>
                  {v.affinities.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {v.affinities.map((aff) => (
                        <Badge key={`${aff.dimension}:${aff.key}`} variant="neutral">
                          {aff.dimension}: {aff.key} ({aff.score.toFixed(1)})
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </section>
          ) : null}

          <EntityAuditHistory entityType="Customer" entityId={customer.id} />
        </div>

        <div className="space-y-6">
          <section className="rounded-md border border-zinc-200 bg-white p-5 text-xs">
            <h2 className="text-sm font-semibold text-zinc-900">
              Müşteri Bilgileri ve İç Not
            </h2>

            <form action={handleUpdateCustomer} className="mt-4 space-y-3">
              <input type="hidden" name="customerId" value={customer.id} />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="firstName">Ad</Label>
                  <Input
                    id="firstName"
                    name="firstName"
                    defaultValue={customer.firstName}
                    required
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Soyad</Label>
                  <Input
                    id="lastName"
                    name="lastName"
                    defaultValue={customer.lastName}
                    required
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="phone">Telefon</Label>
                <Input
                  id="phone"
                  name="phone"
                  defaultValue={customer.phone ?? ""}
                  className="mt-1 font-mono"
                />
              </div>

              <div>
                <Label htmlFor="groupId">Müşteri Grubu</Label>
                <Select
                  id="groupId"
                  name="groupId"
                  defaultValue={customer.groupId ?? ""}
                  className="mt-1"
                >
                  <option value="">Standart (Grup Yok)</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <Label htmlFor="tags">Etiketler (virgülle ayırın)</Label>
                <Input
                  id="tags"
                  name="tags"
                  defaultValue={customer.tags.join(", ")}
                  placeholder="vip, kurumsal, sadik"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="note">Operasyon İç Notu (Müşteriye görünmez)</Label>
                <Textarea
                  id="note"
                  name="note"
                  defaultValue={customer.note ?? ""}
                  placeholder="Müşteriyle ilgili özel notlar..."
                  className="mt-1 min-h-20"
                />
              </div>

              <label className="flex items-center gap-2 font-medium text-zinc-800">
                <input
                  type="checkbox"
                  name="acceptsMarketing"
                  defaultChecked={customer.acceptsMarketing}
                  className="h-4 w-4 rounded border-zinc-300"
                />
                <span>Ticari elektronik ileti (İYS / E-bülten) izni var</span>
              </label>

              <Button type="submit" variant="primary" size="sm" className="w-full">
                Müşteri Kartını Güncelle
              </Button>
            </form>
          </section>

          {customer.isActive ? (
            <section className="rounded-md border border-red-200 bg-white p-5 text-xs">
              <h2 className="text-sm font-semibold text-red-900">
                KVKK Unutulma Hakkı / Anonimleştirme
              </h2>
              <p className="mt-1 text-zinc-600">
                Müşterinin kişisel verilerini, oturumlarını ve adreslerini siler; mali sipariş kayıtlarını vergi mevzuatı gereği anonim olarak korur.
              </p>
              <form action={handleAnonymize} className="mt-3">
                <input type="hidden" name="customerId" value={customer.id} />
                <Button type="submit" variant="danger" size="sm" className="w-full">
                  Kişisel Verileri Anonimleştir (KVKK)
                </Button>
              </form>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
