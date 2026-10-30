"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { registerCustomerAction } from "@/modules/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function RegisterForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/hesabim";
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await registerCustomerAction(fd);
    if (res?.error) {
      setError(res.error);
      setPending(false);
    }
  };

  return (
    <div className="mx-auto max-w-md rounded-md border border-zinc-200 bg-white p-6">
      <h1 className="font-[family-name:var(--font-serif)] text-2xl text-zinc-900">
        Yeni Müşteri Hesabı
      </h1>
      <p className="mt-1 text-xs text-zinc-600">
        Hızlı ödeme, sipariş takibi ve adres defteri için hesap oluşturun.
      </p>

      {error ? (
        <div
          role="alert"
          className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900"
        >
          {error}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-5 space-y-3.5">
        <input type="hidden" name="next" value={next} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="firstName">Ad</Label>
            <Input id="firstName" name="firstName" required placeholder="Adınız" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="lastName">Soyad</Label>
            <Input id="lastName" name="lastName" required placeholder="Soyadınız" className="mt-1" />
          </div>
        </div>
        <div>
          <Label htmlFor="email">E-posta Adresi</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            placeholder="adiniz@ornek.com"
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="phone">Telefon (İsteğe Bağlı)</Label>
          <Input id="phone" name="phone" type="tel" placeholder="05xx xxx xx xx" className="mt-1" />
        </div>
        <div>
          <Label htmlFor="password">Şifre (En az 6 karakter)</Label>
          <Input
            id="password"
            name="password"
            type="password"
            minLength={6}
            required
            className="mt-1"
          />
        </div>

        <label className="flex items-start gap-2 text-xs text-zinc-700">
          <input type="checkbox" name="acceptsMarketing" className="mt-0.5" />
          <span>Kampanya ve yeni ürün bilgilendirme e-postaları almak istiyorum.</span>
        </label>

        <label className="flex items-start gap-2 text-xs text-zinc-800">
          <input type="checkbox" name="kvkkAccepted" required className="mt-0.5" />
          <span>
            <Link href="/sayfa/kvkk" className="underline">
              KVKK Aydınlatma Metnini
            </Link>{" "}
            okudum ve kabul ediyorum.
          </span>
        </label>

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Hesap oluşturuluyor..." : "Hesabı Oluştur"}
        </Button>
      </form>

      <div className="mt-4 border-t border-zinc-200 pt-3 text-xs text-zinc-700">
        Zaten hesabınız var mı?{" "}
        <Link
          href={next && next !== "/hesabim" ? `/giris?next=${encodeURIComponent(next)}` : "/giris"}
          className="font-semibold text-[#9a3412] hover:underline"
        >
          Giriş Yapın
        </Link>
      </div>
    </div>
  );
}

export default function CustomerRegisterPage() {
  return (
    <React.Suspense fallback={<div className="mx-auto max-w-md p-6 text-center text-xs text-zinc-500">Yükleniyor...</div>}>
      <RegisterForm />
    </React.Suspense>
  );
}
