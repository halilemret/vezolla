"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { loginCustomerAction } from "@/modules/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/hesabim";
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await loginCustomerAction(fd);
    if (res?.error) {
      setError(res.error);
      setPending(false);
    }
  };

  return (
    <div className="mx-auto max-w-md rounded-md border border-zinc-200 bg-white p-6">
      <h1 className="font-[family-name:var(--font-serif)] text-2xl text-zinc-900">
        Müşteri Girişi
      </h1>
      <p className="mt-1 text-xs text-zinc-600">
        Siparişlerinizi, kayıtlı adreslerinizi ve favorilerinizi yönetmek için giriş yapın.
      </p>

      {error ? (
        <div
          role="alert"
          className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900"
        >
          {error}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <input type="hidden" name="next" value={next} />
        <div>
          <Label htmlFor="email">E-posta Adresi</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="adiniz@ornek.com"
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="password">Şifre</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="mt-1"
          />
        </div>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Giriş yapılıyor..." : "Giriş Yap"}
        </Button>
      </form>

      <div className="mt-4 border-t border-zinc-200 pt-3 text-xs text-zinc-700">
        Henüz hesabınız yok mu?{" "}
        <Link
          href={next && next !== "/hesabim" ? `/kayit?next=${encodeURIComponent(next)}` : "/kayit"}
          className="font-semibold text-[#9a3412] hover:underline"
        >
          Yeni Hesap Oluşturun
        </Link>
      </div>
    </div>
  );
}

export default function CustomerLoginPage() {
  return (
    <React.Suspense fallback={<div className="mx-auto max-w-md p-6 text-center text-xs text-zinc-500">Yükleniyor...</div>}>
      <LoginForm />
    </React.Suspense>
  );
}
