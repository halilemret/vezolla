"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { claimExitIntentOfferAction } from "@/modules/checkout/actions";

const SESSION_KEY = "eticaret_exit_intent_shown";
const ARM_DELAY_MS = 4000;
const TOP_EDGE_PX = 12;
const SUPPRESSED_PREFIXES = ["/odeme", "/siparis-sonuc", "/giris", "/kayit"];

interface ExitIntentModalProps {
  cartCount: number;
  enabled: boolean;
  /** Sunucuda hesaplanan gösterim oranı; yüzdesel olmayan kampanyalarda null */
  discountPercent: number | null;
  discountCode: string;
}

export function ExitIntentModal({
  cartCount,
  enabled,
  discountPercent,
  discountCode,
}: ExitIntentModalProps) {
  const router = useRouter();
  const pathname = usePathname();
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const suppressed = SUPPRESSED_PREFIXES.some((p) => pathname.startsWith(p));
  const eligible = enabled && cartCount > 0 && !suppressed;

  React.useEffect(() => {
    if (!eligible) return;
    if (window.sessionStorage.getItem(SESSION_KEY)) return;
    // Dokunmatik cihazlarda imleç olmadığı için bu tetikleyici çalışmaz
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    let armed = false;
    const armTimer = window.setTimeout(() => {
      armed = true;
    }, ARM_DELAY_MS);

    function handleLeave(event: MouseEvent) {
      if (!armed || event.clientY > TOP_EDGE_PX) return;
      if (window.sessionStorage.getItem(SESSION_KEY)) return;
      window.sessionStorage.setItem(SESSION_KEY, "1");
      setOpen(true);
    }

    document.documentElement.addEventListener("mouseleave", handleLeave);
    return () => {
      window.clearTimeout(armTimer);
      document.documentElement.removeEventListener("mouseleave", handleLeave);
    };
  }, [eligible]);

  React.useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  async function handleClaim() {
    setPending(true);
    setError(null);
    const res = await claimExitIntentOfferAction();
    setPending(false);
    if (!res.ok) {
      setError(res.error ?? "Kupon uygulanamadı. Lütfen tekrar deneyin.");
      return;
    }
    setOpen(false);
    router.push("/sepet");
    router.refresh();
  }

  const headline =
    discountPercent !== null
      ? `Sepetinizde %${discountPercent} indirim sizi bekliyor`
      : "Sepetiniz için özel bir indirim kodunuz var";

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="exit-intent-title"
      aria-describedby="exit-intent-desc"
      onClose={() => setOpen(false)}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-md border border-zinc-200 bg-[#fafaf9] p-0 text-zinc-900 backdrop:bg-zinc-900/50"
    >
      <div className="relative p-6 sm:p-8">
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Pencereyi kapat"
          className="absolute right-3 top-3 inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
        >
          <X size={20} aria-hidden="true" />
        </button>

        <p className="text-xs font-semibold uppercase tracking-wider text-[#9a3412]">
          Gitmeden önce
        </p>
        <h2 id="exit-intent-title" className="mt-2 pr-8 text-xl font-semibold tracking-tight">
          {headline}
        </h2>
        <p id="exit-intent-desc" className="mt-2 text-sm leading-relaxed text-zinc-600">
          Sepetinizdeki ürünler hâlâ ayrılmış durumda. Aşağıdaki kodu tek tıkla sepetinize
          uygulayabilirsiniz. Kod her müşteri için bir kez kullanılabilir.
        </p>

        <div className="mt-5 rounded-md border border-dashed border-zinc-400 bg-white px-4 py-3 text-center">
          <span className="font-mono text-lg font-semibold tracking-widest tabular-nums text-zinc-900">
            {discountCode}
          </span>
        </div>

        {error ? (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
          <Button
            type="button"
            variant="accent"
            size="md"
            disabled={pending}
            onClick={handleClaim}
            className="sm:flex-1"
          >
            {pending ? "Uygulanıyor" : "Kuponu uygula ve sepete git"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={() => setOpen(false)}
            className="sm:flex-1"
          >
            Alışverişe devam et
          </Button>
        </div>
      </div>
    </dialog>
  );
}
