import {
  Truck,
  ShieldCheck,
  ArrowCounterClockwise,
  CreditCard,
} from "@phosphor-icons/react/dist/ssr";

export interface TrustBadgesProps {
  enabled?: boolean;
  badge1Title?: string;
  badge1Desc?: string;
  badge2Title?: string;
  badge2Desc?: string;
  badge3Title?: string;
  badge3Desc?: string;
  badge4Title?: string;
  badge4Desc?: string;
}

export function TrustBadges({
  enabled = true,
  badge1Title = "Aynı Gün Hızlı Kargo",
  badge1Desc = "1.500 TL üzeri siparişlerde kargo ücretsiz",
  badge2Title = "%100 Orijinal Ürün",
  badge2Desc = "2 yıl resmi distribütör ve marka garantisi",
  badge3Title = "14 Gün Kolay İade",
  badge3Desc = "Koşulsuz ve ücretsiz kapıdan iade imkanı",
  badge4Title = "Güvenli Ödeme & Taksit",
  badge4Desc = "12 aya varan taksit ve 3D Secure koruması",
}: TrustBadgesProps) {
  if (!enabled) return null;

  const PILLARS = [
    {
      icon: Truck,
      title: badge1Title,
      description: badge1Desc,
    },
    {
      icon: ShieldCheck,
      title: badge2Title,
      description: badge2Desc,
    },
    {
      icon: ArrowCounterClockwise,
      title: badge3Title,
      description: badge3Desc,
    },
    {
      icon: CreditCard,
      title: badge4Title,
      description: badge4Desc,
    },
  ];

  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {PILLARS.map((p) => {
        const Icon = p.icon;
        return (
          <div
            key={p.title}
            className="flex items-center gap-3.5 rounded-xl border border-zinc-200/90 bg-white p-4 transition-all hover:border-zinc-300 hover:shadow-xs"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-800">
              <Icon className="h-5 w-5 text-zinc-900" weight="duotone" />
            </div>
            <div className="space-y-0.5">
              <h4 className="text-xs font-bold text-zinc-900">{p.title}</h4>
              <p className="text-[11px] text-zinc-600 leading-tight">
                {p.description}
              </p>
            </div>
          </div>
        );
      })}
    </section>
  );
}
