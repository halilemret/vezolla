import Link from "next/link";
import { ArrowLeft, CreditCard } from "@phosphor-icons/react/dist/ssr";
import { requireStaff } from "@/lib/auth/session";
import { getInstallmentSettings } from "@/lib/settings/service";
import { InstallmentSettingsClient } from "./client";

export const metadata = {
  title: "Kredi Kartı Taksit Yönetimi | Yönetim Paneli",
};

export default async function AdminInstallmentSettingsPage() {
  await requireStaff("settings.manage");
  const installmentSettings = await getInstallmentSettings();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/ayarlar"
              className="text-xs text-zinc-500 hover:text-zinc-900 flex items-center gap-1"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Tüm Ayarlar
            </Link>
          </div>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-zinc-800" />
            Kredi Kartı Taksit Yönetim Merkezi
          </h1>
          <p className="text-xs text-zinc-600">
            Anasayfa, ürün detay ve ödeme sayfalarında gösterilen 6 büyük kart ailesinin taksit oranlarını ve metinlerini yönetin.
          </p>
        </div>
      </div>

      <InstallmentSettingsClient initialSettings={installmentSettings} />
    </div>
  );
}
