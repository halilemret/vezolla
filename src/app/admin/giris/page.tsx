"use client";

import * as React from "react";
import { loginStaffAction } from "@/modules/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AdminLoginPage() {
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const res = await loginStaffAction(formData);
    if (res?.error) {
      setError(res.error);
      setPending(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fafaf9] px-4">
      <div className="w-full max-w-sm rounded-md border border-zinc-200 bg-white p-6">
        <h1 className="text-lg font-semibold text-zinc-900">Yönetim Paneli Girişi</h1>
        <p className="mt-1 text-xs text-zinc-600">
          Mağaza yönetim ekranlarına erişmek için personel hesabınızla giriş yapın.
        </p>

        {error ? (
          <div
            role="alert"
            className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"
          >
            {error}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">E-posta</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              defaultValue="admin@ornek-magaza.local"
              placeholder="ornek@magaza.com"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Şifre</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              defaultValue="Admin123!"
            />
          </div>

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Giriş yapılıyor..." : "Panele Giriş Yap"}
          </Button>
        </form>

        <div className="mt-4 border-t border-zinc-200 pt-3 text-[11px] text-zinc-600">
          Varsayılan geliştirme hesabı: <span className="font-mono">admin@ornek-magaza.local</span> /{" "}
          <span className="font-mono">Admin123!</span>
        </div>
      </div>
    </div>
  );
}
