import Link from "next/link";
import { ArrowLeft, Crown } from "@phosphor-icons/react/dist/ssr";
import { requireStaff } from "@/lib/auth/session";
import { getClubSettings } from "@/lib/settings/service";
import { ClubSettingsClient } from "./client";

export const metadata = {
  title: "VezollaClub Sadakat ve Puan Yönetimi | Yönetim Paneli",
};

export default async function AdminVezollaClubSettingsPage() {
  await requireStaff("settings.manage");
  const clubSettings = await getClubSettings();

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
            <Crown className="h-6 w-6 text-amber-600" weight="fill" />
            VezollaClub Sadakat ve Puan Yönetim Merkezi
          </h1>
          <p className="text-xs text-zinc-600">
            Ürün sayfası, sepet, ödeme adımı ve müşteri profilindeki tüm puan kurallarını, metinleri, oranları ve rozetleri buradan yönetin.
          </p>
        </div>
      </div>

      <ClubSettingsClient initialSettings={clubSettings} />
    </div>
  );
}
