import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { parsePromotionConditions } from "@/modules/promotions/schemas";
import { CodeGeneratorField } from "./code-generator-field";
import {
  createPromotionFromFormAction,
  deletePromotionAction,
  listPromotionsAdmin,
  togglePromotionActiveAction,
} from "@/modules/promotions/actions";

export const dynamic = "force-dynamic";

function formatPromoBenefit(promo: {
  type: string;
  value: number;
  buyQuantity: number | null;
  getQuantity: number | null;
  getDiscountBps: number | null;
  maxDiscount: number | null;
}) {
  if (promo.type === "PERCENTAGE") {
    const pct = (promo.value / 100).toFixed(promo.value % 100 === 0 ? 0 : 2);
    const cap = promo.maxDiscount ? ` (En fazla ${formatMoney(promo.maxDiscount)})` : "";
    return `%${pct} İndirim${cap}`;
  }
  if (promo.type === "FIXED_AMOUNT") {
    return `${formatMoney(promo.value)} Net İndirim`;
  }
  if (promo.type === "FREE_SHIPPING") {
    return "Ücretsiz Kargo";
  }
  if (promo.type === "BUY_X_GET_Y") {
    const discPct = ((promo.getDiscountBps ?? 10000) / 100).toFixed(0);
    return `${promo.buyQuantity ?? 2} Alana ${promo.getQuantity ?? 1} Adet %${discPct} İndirimli`;
  }
  return "-";
}

export default async function AdminPromotionsPage() {
  await requireStaff("promotions.manage");

  const [promotions, categories, customerGroups, customers] = await Promise.all([
    listPromotionsAdmin(),
    db.category.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.customerGroup.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.customer.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, firstName: true, lastName: true, email: true },
    }),
  ]);

  async function handleSavePromo(formData: FormData) {
    "use server";
    await createPromotionFromFormAction(formData);
  }

  async function handleTogglePromo(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "");
    const nextActive = formData.get("nextActive") === "true";
    if (id) {
      await togglePromotionActiveAction(id, nextActive);
    }
  }

  async function handleDeletePromo(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "");
    if (id) {
      await deletePromotionAction(id);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-zinc-900">
          Promosyonlar ve Kupon Kodları
        </h1>
        <p className="mt-1 text-xs text-zinc-600">
          Kupon kodlarını, otomatik sepet indirimlerini, X Al Y Öde kurallarını ve ücretsiz kargo kampanyalarını yönetin.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {promotions.length === 0 ? (
            <EmptyState
              title="Henüz kampanya veya kupon tanımlanmadı"
              description="Sağdaki formu kullanarak yüzde indirim, sabit tutar, ücretsiz kargo veya X Al Y Öde kampanyası oluşturabilirsiniz."
            />
          ) : (
            <div className="overflow-x-auto rounded-md border border-zinc-200 bg-white">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
                    <th className="px-4 py-3">Kampanya / Kod</th>
                    <th className="px-4 py-3">Fayda ve Koşullar</th>
                    <th className="px-4 py-3 text-right">Kullanım</th>
                    <th className="px-4 py-3 text-right">Öncelik</th>
                    <th className="px-4 py-3">Durum</th>
                    <th className="px-4 py-3 text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {promotions.map((promo) => {
                    const cond = parsePromotionConditions(promo.conditions);
                    return (
                      <tr key={promo.id} className="hover:bg-zinc-50/80">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-zinc-900">{promo.name}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            {promo.code ? (
                              <span className="rounded border border-zinc-300 bg-zinc-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-zinc-900">
                                {promo.code}
                              </span>
                            ) : (
                              <Badge variant="accent">Otomatik İndirim</Badge>
                            )}
                            {promo.isCombinable ? (
                              <Badge variant="neutral">Birleşebilir</Badge>
                            ) : null}
                            {cond.customerEmails && cond.customerEmails.length > 0 ? (
                              <Badge variant="accent" className="border-amber-200 bg-amber-50 text-amber-800">
                                Özel: {cond.customerEmails.length} e-posta
                              </Badge>
                            ) : null}
                            {cond.customerIds && cond.customerIds.length > 0 ? (
                              <Badge variant="accent" className="border-indigo-200 bg-indigo-50 text-indigo-800">
                                Özel: {cond.customerIds.length} müşteri
                              </Badge>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-zinc-900">
                            {formatPromoBenefit(promo)}
                          </div>
                          <div className="mt-0.5 text-[11px] text-zinc-600">
                            {cond.minSubtotalMinor
                              ? `Min. Sepet: ${formatMoney(cond.minSubtotalMinor)} `
                              : "Alt limitsiz "}
                            {cond.firstOrderOnly ? "| Yalnızca İlk Sipariş " : ""}
                            {promo.endsAt
                              ? `| Bitiş: ${format(promo.endsAt, "dd MMM yyyy", { locale: tr })}`
                              : ""}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-zinc-800">
                          {promo.usageCount}
                          {promo.usageLimit ? ` / ${promo.usageLimit}` : ""}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-zinc-700">
                          {promo.priority}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={promo.isActive ? "success" : "neutral"}>
                            {promo.isActive ? "Aktif" : "Pasif"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <form action={handleTogglePromo}>
                              <input type="hidden" name="id" value={promo.id} />
                              <input
                                type="hidden"
                                name="nextActive"
                                value={promo.isActive ? "false" : "true"}
                              />
                              <button
                                type="submit"
                                className="rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-800 hover:bg-zinc-100"
                              >
                                {promo.isActive ? "Durdur" : "Aktifleştir"}
                              </button>
                            </form>
                            <form action={handleDeletePromo}>
                              <input type="hidden" name="id" value={promo.id} />
                              <button
                                type="submit"
                                className="rounded border border-zinc-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                              >
                                Sil
                              </button>
                            </form>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <section className="rounded-md border border-zinc-200 bg-white p-5 text-xs">
          <h2 className="text-sm font-semibold text-zinc-900">
            Yeni Promosyon veya Kupon Tanımla
          </h2>
          <p className="mt-1 text-zinc-600">
            Kupon kodu boş bırakılırsa koşulları sağlayan sepetlerde otomatik uygulanır.
          </p>

          <form action={handleSavePromo} className="mt-4 space-y-3">
            <div>
              <Label htmlFor="name">Kampanya Adı</Label>
              <Input
                id="name"
                name="name"
                required
                placeholder="Örn: Bahar %15 İndirimi"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="code">Kupon Kodu (Boşsa Otomatik İndirim)</Label>
              <div className="mt-1">
                <CodeGeneratorField
                  id="code"
                  name="code"
                  placeholder="Örn: BAHAR15 veya Rastgele Üret"
                  prefix="VZ"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="type">İndirim Tipi</Label>
                <Select id="type" name="type" defaultValue="PERCENTAGE" className="mt-1">
                  <option value="PERCENTAGE">Yüzde (%)</option>
                  <option value="FIXED_AMOUNT">Sabit Tutar (TL)</option>
                  <option value="FREE_SHIPPING">Ücretsiz Kargo</option>
                  <option value="BUY_X_GET_Y">X Al Y Öde</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="value">Değer (% veya TL)</Label>
                <Input
                  id="value"
                  name="value"
                  defaultValue="15"
                  className="mt-1 font-mono tabular-nums"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 rounded border border-zinc-200 bg-zinc-50 p-2.5">
              <div>
                <Label htmlFor="buyQuantity">X Adet Al</Label>
                <Input
                  id="buyQuantity"
                  name="buyQuantity"
                  type="number"
                  min={1}
                  defaultValue={2}
                  className="mt-1 min-h-8 font-mono text-xs"
                />
              </div>
              <div>
                <Label htmlFor="getQuantity">Y İndirimli</Label>
                <Input
                  id="getQuantity"
                  name="getQuantity"
                  type="number"
                  min={1}
                  defaultValue={1}
                  className="mt-1 min-h-8 font-mono text-xs"
                />
              </div>
              <div>
                <Label htmlFor="getDiscountPct">İndirim %</Label>
                <Input
                  id="getDiscountPct"
                  name="getDiscountPct"
                  type="number"
                  min={1}
                  max={100}
                  defaultValue={100}
                  className="mt-1 min-h-8 font-mono text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="minSubtotal">Min. Sepet (TL)</Label>
                <Input
                  id="minSubtotal"
                  name="minSubtotal"
                  placeholder="0,00"
                  className="mt-1 font-mono tabular-nums"
                />
              </div>
              <div>
                <Label htmlFor="maxDiscount">Tavan İndirim (TL)</Label>
                <Input
                  id="maxDiscount"
                  name="maxDiscount"
                  placeholder="Opsiyonel"
                  className="mt-1 font-mono tabular-nums"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label htmlFor="usageLimit">Toplam Limit</Label>
                <Input
                  id="usageLimit"
                  name="usageLimit"
                  type="number"
                  min={1}
                  placeholder="Sınırsız"
                  className="mt-1 font-mono"
                />
              </div>
              <div>
                <Label htmlFor="usagePerCustomer">Kişi Başı</Label>
                <Input
                  id="usagePerCustomer"
                  name="usagePerCustomer"
                  type="number"
                  min={1}
                  placeholder="Sınırsız"
                  className="mt-1 font-mono"
                />
              </div>
              <div>
                <Label htmlFor="priority">Öncelik</Label>
                <Input
                  id="priority"
                  name="priority"
                  type="number"
                  defaultValue={10}
                  className="mt-1 font-mono"
                />
              </div>
            </div>

            {categories.length > 0 ? (
              <div>
                <Label htmlFor="categoryIds">Kapsanan Kategoriler (Boşsa Tümü)</Label>
                <select
                  id="categoryIds"
                  name="categoryIds"
                  multiple
                  className="mt-1 h-20 w-full rounded-md border border-zinc-300 bg-white p-2 text-xs"
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {customerGroups.length > 0 ? (
              <div>
                <Label htmlFor="customerGroupIds">Müşteri Grupları (Boşsa Tümü)</Label>
                <select
                  id="customerGroupIds"
                  name="customerGroupIds"
                  multiple
                  className="mt-1 h-16 w-full rounded-md border border-zinc-300 bg-white p-2 text-xs"
                >
                  {customerGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="rounded-md border border-amber-200 bg-amber-50/60 p-3 space-y-2.5">
              <div>
                <div className="font-semibold text-zinc-900">
                  Kişiye Özel Kupon Kısıtlaması (Opsiyonel)
                </div>
                <p className="mt-0.5 text-[11px] text-zinc-600">
                  Kuponu yalnızca belirli e-postaların veya kayıtlı müşterilerin kullanmasını istiyorsanız doldurun.
                </p>
              </div>

              <div>
                <Label htmlFor="customerEmails" className="text-zinc-800">
                  Özel E-posta Adresleri
                </Label>
                <textarea
                  id="customerEmails"
                  name="customerEmails"
                  rows={2}
                  placeholder="musteri@example.com, diger@example.com (virgül veya yeni satırla ayırın)"
                  className="mt-1 w-full rounded-md border border-zinc-300 bg-white p-2 text-xs font-mono focus:border-zinc-500 focus:outline-none"
                />
              </div>

              {customers.length > 0 ? (
                <div>
                  <Label htmlFor="customerIds" className="text-zinc-800">
                    Veya Kayıtlı Müşterilerden Seç
                  </Label>
                  <select
                    id="customerIds"
                    name="customerIds"
                    multiple
                    className="mt-1 h-20 w-full rounded-md border border-zinc-300 bg-white p-2 text-xs"
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.firstName} {c.lastName} ({c.email})
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>

            <div className="space-y-1.5 pt-1">
              <label className="flex items-center gap-2 font-medium text-zinc-800">
                <input
                  type="checkbox"
                  name="firstOrderOnly"
                  className="h-4 w-4 rounded border-zinc-300"
                />
                <span>Yalnızca müşterinin ilk siparişinde geçerli</span>
              </label>
              <label className="flex items-center gap-2 font-medium text-zinc-800">
                <input
                  type="checkbox"
                  name="isCombinable"
                  className="h-4 w-4 rounded border-zinc-300"
                />
                <span>Diğer indirimlerle birleştirilebilir (Combinable)</span>
              </label>
            </div>

            <Button type="submit" variant="primary" size="sm" className="w-full">
              Kampanyayı Kaydet
            </Button>
          </form>
        </section>
      </div>
    </div>
  );
}
