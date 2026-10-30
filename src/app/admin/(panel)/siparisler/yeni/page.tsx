import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatMoney, parseMoneyInput } from "@/lib/money";
import { TR_CITY_NAMES } from "@/data/tr-cities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createManualOrderAction } from "@/modules/orders/actions";

export const dynamic = "force-dynamic";

async function submitManualOrderForm(formData: FormData) {
  "use server";

  const items: Array<{ variantId: string; quantity: number }> = [];
  for (const [key, val] of formData.entries()) {
    if (key.startsWith("variant_qty_")) {
      const variantId = key.slice("variant_qty_".length);
      const qty = Number.parseInt(String(val), 10);
      if (variantId && Number.isFinite(qty) && qty > 0) {
        items.push({ variantId, quantity: qty });
      }
    }
  }

  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const city = String(formData.get("city") ?? "İstanbul").trim();
  const district = String(formData.get("district") ?? "Merkez").trim();
  const line1 = String(formData.get("line1") ?? "").trim();
  const customerId = String(formData.get("customerId") ?? "").trim() || null;

  const discountMinor = parseMoneyInput(String(formData.get("discount") ?? "0"));
  const shippingMinor = parseMoneyInput(String(formData.get("shipping") ?? "0"));
  const paymentMethod = String(formData.get("paymentMethod") ?? "bank_transfer");
  const markAsPaid = formData.get("markAsPaid") === "on";
  const note = String(formData.get("note") ?? "").trim() || null;

  const res = await createManualOrderAction({
    customerId,
    email,
    phone,
    shippingAddress: {
      title: "Manuel Sipariş Adresi",
      firstName,
      lastName,
      phone,
      city,
      district,
      line1,
      invoiceType: "INDIVIDUAL",
    },
    items,
    discountMinor,
    shippingMinor,
    paymentMethod,
    markAsPaid,
    note,
  });

  if (!res.ok || !res.orderId) {
    redirect(
      `/admin/siparisler/yeni?error=${encodeURIComponent(
        res.error ?? "Sipariş oluşturulamadı."
      )}`
    );
  }

  redirect(`/admin/siparisler/${res.orderId}`);
}

export default async function AdminNewManualOrderPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireStaff("orders.write");
  const sp = await searchParams;
  const errorMessage = typeof sp.error === "string" ? sp.error : null;

  const [variants, customers] = await Promise.all([
    db.productVariant.findMany({
      where: {
        isActive: true,
        product: { deletedAt: null, status: "ACTIVE" },
      },
      include: {
        product: { select: { title: true } },
        inventoryLevels: {
          where: { warehouse: { isActive: true } },
          select: { onHand: true, reserved: true },
        },
      },
      orderBy: [{ product: { title: "asc" } }, { position: "asc" }],
      take: 80,
    }),
    db.customer.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-zinc-600">
            <Link href="/admin/siparisler" className="hover:underline">
              Siparişler
            </Link>
            <span>/</span>
            <span className="text-zinc-900">Manuel Sipariş Oluştur</span>
          </div>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-zinc-900">
            Manuel Sipariş Oluştur
          </h1>
          <p className="mt-1 text-xs text-zinc-600">
            Telefon, mağaza veya kurumsal talepler için stok rezervasyonlu ve sözleşmeli yeni sipariş kaydı açın.
          </p>
        </div>
        <Link href="/admin/siparisler">
          <Button variant="outline" size="sm">
            Sipariş Listesine Dön
          </Button>
        </Link>
      </div>

      {errorMessage ? (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-900"
        >
          {errorMessage}
        </div>
      ) : null}

      <form action={submitManualOrderForm} className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-md border border-zinc-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-zinc-900">1. Sipariş Kalemleri</h2>
            <p className="mt-1 text-xs text-zinc-600">
              Siparişe eklenecek varyantların miktarlarını girin. Stoklar depo öncelik sırasına göre rezerve edilir.
            </p>

            {variants.length === 0 ? (
              <p className="mt-4 text-xs text-zinc-600">
                Aktif ürün varyantı bulunamadı. Önce katalogdan ürün ekleyiniz.
              </p>
            ) : (
              <div className="mt-4 max-h-96 overflow-y-auto rounded border border-zinc-200">
                <table className="w-full border-collapse text-left text-xs">
                  <thead className="sticky top-0 border-b border-zinc-200 bg-zinc-50 text-[11px] font-semibold uppercase text-zinc-600">
                    <tr>
                      <th className="px-3 py-2.5">Ürün / Varyant</th>
                      <th className="px-3 py-2.5">SKU</th>
                      <th className="px-3 py-2.5 text-right">Stok</th>
                      <th className="px-3 py-2.5 text-right">Birim Fiyat</th>
                      <th className="w-28 px-3 py-2.5 text-right">Adet</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {variants.map((v) => {
                      const available = v.inventoryLevels.reduce(
                        (sum, l) => sum + Math.max(0, l.onHand - l.reserved),
                        0
                      );
                      return (
                        <tr key={v.id} className="hover:bg-zinc-50">
                          <td className="px-3 py-2">
                            <div className="font-medium text-zinc-900">{v.product.title}</div>
                            <div className="text-[11px] text-zinc-600">{v.title}</div>
                          </td>
                          <td className="px-3 py-2 font-mono text-[11px] text-zinc-600">
                            {v.sku ?? "-"}
                          </td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums text-zinc-700">
                            {available}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-medium tabular-nums text-zinc-900">
                            {formatMoney(v.price)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Input
                              type="number"
                              name={`variant_qty_${v.id}`}
                              min={0}
                              max={v.allowBackorder ? 999 : available}
                              defaultValue={0}
                              className="min-h-8 px-2 py-1 text-right font-mono text-xs tabular-nums"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-md border border-zinc-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-zinc-900">
              2. Müşteri ve Teslimat Adresi
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="customerId">Kayıtlı Müşteri (Opsiyonel)</Label>
                <Select id="customerId" name="customerId" defaultValue="" className="mt-1">
                  <option value="">Yeni / Misafir Müşteri Olarak Gir</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.firstName} {c.lastName} ({c.email})
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <Label htmlFor="firstName">Alıcı Adı</Label>
                <Input id="firstName" name="firstName" required className="mt-1" />
              </div>

              <div>
                <Label htmlFor="lastName">Alıcı Soyadı</Label>
                <Input id="lastName" name="lastName" required className="mt-1" />
              </div>

              <div>
                <Label htmlFor="email">E-posta Adresi</Label>
                <Input id="email" name="email" type="email" required className="mt-1" />
              </div>

              <div>
                <Label htmlFor="phone">Telefon</Label>
                <Input
                  id="phone"
                  name="phone"
                  required
                  placeholder="0555 000 00 00"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="city">İl</Label>
                <Select id="city" name="city" defaultValue="İstanbul" className="mt-1">
                  {TR_CITY_NAMES.map((cityName) => (
                    <option key={cityName} value={cityName}>
                      {cityName}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <Label htmlFor="district">İlçe</Label>
                <Input
                  id="district"
                  name="district"
                  required
                  defaultValue="Kadıköy"
                  className="mt-1"
                />
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="line1">Açık Adres</Label>
                <Textarea
                  id="line1"
                  name="line1"
                  required
                  placeholder="Mahalle, cadde, sokak, bina ve daire numarası"
                  className="mt-1 min-h-20"
                />
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-md border border-zinc-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-zinc-900">
              3. Ödeme, İndirim ve Kargo
            </h2>

            <div className="mt-4 space-y-4">
              <div>
                <Label htmlFor="paymentMethod">Ödeme Yöntemi</Label>
                <Select
                  id="paymentMethod"
                  name="paymentMethod"
                  defaultValue="bank_transfer"
                  className="mt-1"
                >
                  <option value="bank_transfer">Havale / EFT</option>
                  <option value="cod">Kapıda Ödeme</option>
                  <option value="iyzico">Kredi / Banka Kartı</option>
                  <option value="manual">Manuel / Nakit Tahsilat</option>
                </Select>
              </div>

              <div>
                <Label htmlFor="discount">Manuel İndirim Tutarı (TL)</Label>
                <Input
                  id="discount"
                  name="discount"
                  placeholder="0,00"
                  defaultValue="0"
                  className="mt-1 font-mono tabular-nums"
                />
              </div>

              <div>
                <Label htmlFor="shipping">Kargo Ücreti (TL)</Label>
                <Input
                  id="shipping"
                  name="shipping"
                  placeholder="0,00"
                  defaultValue="0"
                  className="mt-1 font-mono tabular-nums"
                />
              </div>

              <div>
                <Label htmlFor="note">Sipariş Notu</Label>
                <Textarea
                  id="note"
                  name="note"
                  placeholder="Operasyon veya müşteri notu..."
                  className="mt-1 min-h-20"
                />
              </div>

              <label className="flex items-center gap-2 text-xs font-medium text-zinc-800">
                <input
                  type="checkbox"
                  name="markAsPaid"
                  className="h-4 w-4 rounded border-zinc-300 text-zinc-900"
                />
                <span>Ödeme tahsil edildi olarak işaretle (PAID)</span>
              </label>

              <Button type="submit" variant="primary" className="w-full">
                Siparişi Oluştur ve Stok Ayır
              </Button>
            </div>
          </section>
        </div>
      </form>
    </div>
  );
}
