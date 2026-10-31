"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ShieldCheck,
  Truck,
  CreditCard,
  Buildings as Building2,
  Money as Banknote,
  FileText,
  WarningCircle as AlertCircle,
  Lock,
  X,
  CaretDown,
  CheckCircle,
  Sparkle,
  Crown,
  ArrowRight,
} from "@phosphor-icons/react";
import { TR_CITIES } from "@/data/tr-cities";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  getCartSummaryAction,
  previewOrderContractsAction,
  placeOrderAction,
  saveCheckoutStepAction,
  cancelPendingOrderAction,
  applyLoyaltyPointsAction,
  removeLoyaltyPointsAction,
} from "@/modules/checkout/actions";
import type { CartSummary } from "@/modules/checkout/cart";
import type { GeneratedContracts } from "@/modules/checkout/contracts";
import type { ClubSettings } from "@/lib/settings/schemas";
import { trackStoreEvent } from "@/components/store/visitor-tracker";

export interface SavedAddressOption {
  id: string;
  title: string;
  firstName: string;
  lastName: string;
  phone: string;
  city: string;
  district: string;
  neighborhood: string | null;
  line1: string;
  postalCode: string | null;
  invoiceType: string;
  tckn: string | null;
  companyName: string | null;
  taxOffice: string | null;
  taxNumber: string | null;
  isDefault: boolean;
}

interface IyzicoModalData {
  orderId: string;
  orderNumber: number;
  html: string;
}

function IyzicoModal({
  data,
  onClose,
  isCancelling,
}: {
  data: IyzicoModalData;
  onClose: () => void;
  isCancelling: boolean;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const closeButtonRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  React.useEffect(() => {
    if (!containerRef.current || !data.html) return;
    const container = containerRef.current;
    container.innerHTML = data.html;

    let cancelled = false;
    const runScripts = async () => {
      const scripts = Array.from(container.querySelectorAll("script"));
      for (const oldScript of scripts) {
        if (cancelled) break;
        const newScript = document.createElement("script");
        Array.from(oldScript.attributes).forEach((attr) => {
          newScript.setAttribute(attr.name, attr.value);
        });
        if (oldScript.src) {
          await new Promise<void>((resolve) => {
            newScript.onload = () => resolve();
            newScript.onerror = () => resolve();
            oldScript.parentNode?.replaceChild(newScript, oldScript);
          });
        } else {
          newScript.appendChild(document.createTextNode(oldScript.innerHTML));
          oldScript.parentNode?.replaceChild(newScript, oldScript);
        }
      }
    };
    void runScripts();

    return () => {
      cancelled = true;
    };
  }, [data.html]);

  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !isCancelling) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, isCancelling]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="iyzico-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isCancelling) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
    >
      <div className="relative w-full max-w-xl max-h-[92vh] flex flex-col rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-4 bg-muted/30">
          <div>
            <h2 id="iyzico-modal-title" className="text-base font-semibold text-foreground">
              Güvenli Kart ile Ödeme
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Sipariş #{data.orderNumber} • 256-Bit SSL iyzico Güvenli Ödeme Ekranı
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            disabled={isCancelling}
            aria-label="Pencereyi Kapat ve Vazgeç"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div ref={containerRef} className="min-h-[280px]" />
        </div>

        <div className="flex items-center justify-between border-t border-border px-5 py-3 bg-muted/20 text-xs text-muted-foreground">
          <span>Ödemeden vazgeçerseniz sepetiniz korunur.</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isCancelling}
          >
            {isCancelling ? "İptal Ediliyor..." : "Vazgeç"}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface CheckoutClientProps {
  initialSummary: CartSummary;
  initialContracts: GeneratedContracts;
  customer: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
  } | null;
  savedAddresses: SavedAddressOption[];
  clubSettings?: ClubSettings | null;
}

export function CheckoutClient({
  initialSummary,
  initialContracts,
  customer,
  savedAddresses,
  clubSettings,
}: CheckoutClientProps) {
  const router = useRouter();
  const defaultSaved =
    savedAddresses.find((a) => a.isDefault) ?? savedAddresses[0] ?? null;

  const [summary, setSummary] = React.useState<CartSummary>(initialSummary);
  const [contracts, setContracts] =
    React.useState<GeneratedContracts>(initialContracts);

  const [email, setEmail] = React.useState(
    customer?.email ?? initialSummary.email ?? ""
  );
  const [phone, setPhone] = React.useState(
    defaultSaved?.phone ?? customer?.phone ?? initialSummary.phone ?? ""
  );

  const [title, setTitle] = React.useState(defaultSaved?.title ?? "Ev Adresim");
  const [firstName, setFirstName] = React.useState(
    defaultSaved?.firstName ?? customer?.firstName ?? ""
  );
  const [lastName, setLastName] = React.useState(
    defaultSaved?.lastName ?? customer?.lastName ?? ""
  );
  const [city, setCity] = React.useState(defaultSaved?.city ?? "İstanbul");
  const [district, setDistrict] = React.useState(
    defaultSaved?.district ?? "Kadıköy"
  );
  const [neighborhood, setNeighborhood] = React.useState(
    defaultSaved?.neighborhood ?? ""
  );
  const [line1, setLine1] = React.useState(defaultSaved?.line1 ?? "");
  const [postalCode, setPostalCode] = React.useState(
    defaultSaved?.postalCode ?? ""
  );

  const [invoiceType, setInvoiceType] = React.useState<
    "INDIVIDUAL" | "CORPORATE"
  >(
    defaultSaved?.invoiceType === "CORPORATE" ? "CORPORATE" : "INDIVIDUAL"
  );
  const [tckn, setTckn] = React.useState(defaultSaved?.tckn ?? "");
  const [companyName, setCompanyName] = React.useState(
    defaultSaved?.companyName ?? ""
  );
  const [taxOffice, setTaxOffice] = React.useState(
    defaultSaved?.taxOffice ?? ""
  );
  const [taxNumber, setTaxNumber] = React.useState(
    defaultSaved?.taxNumber ?? ""
  );

  const [shippingMethodId, setShippingMethodId] = React.useState(
    initialSummary.selectedShippingMethod?.id ?? ""
  );
  const [paymentMethod, setPaymentMethod] = React.useState<
    "iyzico" | "bank_transfer" | "cod"
  >(
    (initialSummary.selectedPaymentMethod as
      | "iyzico"
      | "bank_transfer"
      | "cod") || "iyzico"
  );
  const [customerNote, setCustomerNote] = React.useState("");

  const [acceptPreInfo, setAcceptPreInfo] = React.useState(false);
  const [acceptDistanceSales, setAcceptDistanceSales] = React.useState(false);
  const [showContractsModal, setShowContractsModal] = React.useState(false);

  const [submitting, setSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [iyzicoModalData, setIyzicoModalData] = React.useState<IyzicoModalData | null>(null);
  const [cancellingOrder, setCancellingOrder] = React.useState(false);
  const [loyaltyInput, setLoyaltyInput] = React.useState("");
  const [openStep, setOpenStep] = React.useState<"address" | "shipping" | "payment" | "contracts">("address");

  const isAddressValid = Boolean(email && phone && firstName && lastName && line1 && city && district);
  const isShippingSelected = Boolean(shippingMethodId || summary.selectedShippingMethod?.id);
  const isPaymentSelected = Boolean(paymentMethod);
  const isContractsAccepted = Boolean(acceptPreInfo && acceptDistanceSales);
  const [loyaltyPending, setLoyaltyPending] = React.useState(false);
  const [loyaltyError, setLoyaltyError] = React.useState<string | null>(null);

  async function handleApplyLoyaltyPoints() {
    const pts = Number.parseInt(loyaltyInput, 10);
    if (!Number.isFinite(pts) || pts <= 0) {
      setLoyaltyError("Lütfen geçerli bir puan miktarı giriniz.");
      return;
    }
    setLoyaltyPending(true);
    setLoyaltyError(null);
    try {
      const res = await applyLoyaltyPointsAction(pts);
      if (res.ok && res.summary) {
        setSummary(res.summary);
        setLoyaltyInput("");
      } else if (res.error) {
        setLoyaltyError(res.error);
      }
    } finally {
      setLoyaltyPending(false);
    }
  }

  async function handleRemoveLoyaltyPoints() {
    setLoyaltyPending(true);
    setLoyaltyError(null);
    try {
      const res = await removeLoyaltyPointsAction();
      if (res.ok && res.summary) {
        setSummary(res.summary);
      } else if (res.error) {
        setLoyaltyError(res.error);
      }
    } finally {
      setLoyaltyPending(false);
    }
  }

  const searchParams = useSearchParams();
  const urlError = searchParams?.get("error");

  React.useEffect(() => {
    if (urlError) {
      setErrorMessage(decodeURIComponent(urlError));
    }
  }, [urlError]);

  async function handleCloseIyzicoModal() {
    if (!iyzicoModalData || cancellingOrder) return;
    setCancellingOrder(true);
    try {
      await cancelPendingOrderAction(iyzicoModalData.orderId);
      setErrorMessage(
        "Ödeme işlemi iptal edildi. Sepetiniz korundu, dilediğiniz zaman tekrar deneyebilirsiniz."
      );
    } catch {
      setErrorMessage("Ödeme iptal edilirken bir hata oluştu.");
    } finally {
      setCancellingOrder(false);
      setIyzicoModalData(null);
    }
  }

  const cityEntry = React.useMemo(
    () => TR_CITIES.find((c) => c.name === city) ?? TR_CITIES[0],
    [city]
  );

  function applySavedAddress(addr: SavedAddressOption) {
    setTitle(addr.title);
    setFirstName(addr.firstName);
    setLastName(addr.lastName);
    setPhone(addr.phone);
    setCity(addr.city);
    setDistrict(addr.district);
    setNeighborhood(addr.neighborhood ?? "");
    setLine1(addr.line1);
    setPostalCode(addr.postalCode ?? "");
    setInvoiceType(
      addr.invoiceType === "CORPORATE" ? "CORPORATE" : "INDIVIDUAL"
    );
    setTckn(addr.tckn ?? "");
    setCompanyName(addr.companyName ?? "");
    setTaxOffice(addr.taxOffice ?? "");
    setTaxNumber(addr.taxNumber ?? "");
  }

  async function refreshQuotes(
    nextCity: string,
    nextShippingId: string,
    nextPayment: "iyzico" | "bank_transfer" | "cod"
  ) {
    const updated = await getCartSummaryAction({
      shippingCity: nextCity,
      shippingMethodId: nextShippingId,
      paymentMethod: nextPayment,
    });
    setSummary(updated);
    if (updated.selectedShippingMethod) {
      setShippingMethodId(updated.selectedShippingMethod.id);
    }
  }

  async function handleOpenContractsPreview() {
    const nextContracts = await previewOrderContractsAction({
      email,
      phone,
      shippingMethodId,
      paymentMethod,
      shippingAddress: {
        title,
        firstName,
        lastName,
        phone,
        city,
        district,
        neighborhood: neighborhood || null,
        line1,
        postalCode: postalCode || null,
        invoiceType,
        tckn: tckn || null,
        companyName: companyName || null,
        taxOffice: taxOffice || null,
        taxNumber: taxNumber || null,
      },
    });
    setContracts(nextContracts);
    setShowContractsModal(true);
  }

  // İlk açılışta begin_checkout olayını tetikle
  React.useEffect(() => {
    trackStoreEvent({
      type: "begin_checkout",
      value: summary.cartId,
      meta: {
        itemCount: summary.itemCount,
        totalMinor: summary.totalMinor,
      },
    });
  }, [summary.cartId, summary.itemCount, summary.totalMinor]);

  // Kullanıcı bilgi girdikçe veya adım ilerledikçe sepet durumunu veritabanına ve analitiğe kaydet
  React.useEffect(() => {
    const timer = setTimeout(() => {
      let step: "address" | "shipping" | "payment" | "contracts" = "address";
      if (acceptPreInfo && acceptDistanceSales) {
        step = "contracts";
      } else if (paymentMethod) {
        step = "payment";
      } else if (shippingMethodId) {
        step = "shipping";
      }

      void saveCheckoutStepAction({
        email: email || null,
        phone: phone || null,
        lastStep: step,
        shippingAddress: {
          title: title || "Teslimat Adresi",
          firstName,
          lastName,
          phone,
          city,
          district,
          neighborhood: neighborhood || null,
          line1,
          postalCode: postalCode || null,
          invoiceType,
          tckn: tckn || null,
          companyName: companyName || null,
          taxOffice: taxOffice || null,
          taxNumber: taxNumber || null,
        },
        shippingMethodId: shippingMethodId || null,
        paymentMethod: paymentMethod || null,
        note: customerNote || null,
      });

      trackStoreEvent({
        type: "checkout_step",
        value: step,
        meta: {
          cartId: summary.cartId,
          email: email || undefined,
          hasAddress: Boolean(firstName && line1),
          shippingMethodId,
          paymentMethod,
        },
      });
    }, 800);

    return () => clearTimeout(timer);
  }, [
    email,
    phone,
    title,
    firstName,
    lastName,
    city,
    district,
    neighborhood,
    line1,
    postalCode,
    invoiceType,
    tckn,
    companyName,
    taxOffice,
    taxNumber,
    shippingMethodId,
    paymentMethod,
    customerNote,
    acceptPreInfo,
    acceptDistanceSales,
    summary.cartId,
  ]);

  async function handleSubmitOrder(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    if (!acceptPreInfo || !acceptDistanceSales) {
      setErrorMessage(
        "Devam etmek için Ön Bilgilendirme Formu ve Mesafeli Satış Sözleşmesini onaylamanız gerekmektedir."
      );
      return;
    }

    if (!summary.isMinOrderSubtotalMet && summary.minOrderSubtotalMinor > 0) {
      setErrorMessage(
        `Sipariş oluşturabilmek için sepet tutarınız en az ${formatMoney(
          summary.minOrderSubtotalMinor,
          summary.currency
        )} olmalıdır.`
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await placeOrderAction({
        cartId: summary.cartId,
        email,
        phone,
        shippingAddress: {
          title: title || "Teslimat Adresi",
          firstName,
          lastName,
          phone,
          city,
          district,
          neighborhood: neighborhood || null,
          line1,
          postalCode: postalCode || null,
          invoiceType,
          tckn: tckn || null,
          companyName: companyName || null,
          taxOffice: taxOffice || null,
          taxNumber: taxNumber || null,
        },
        billingSameAsShipping: true,
        shippingMethodId:
          shippingMethodId ||
          summary.selectedShippingMethod?.id ||
          "default-standard",
        paymentMethod,
        customerNote: customerNote || null,
        acceptPreInformation: true,
        acceptDistanceSales: true,
      });

      if (!res.ok || !res.orderId) {
        setErrorMessage(res.error ?? "Sipariş oluşturulamadı.");
        return;
      }

      if (res.checkoutFormContent) {
        setIyzicoModalData({
          orderId: res.orderId,
          orderNumber: res.orderNumber ?? 0,
          html: res.checkoutFormContent,
        });
        return;
      }

      if (res.paymentPageUrl && paymentMethod === "iyzico") {
        window.location.href = res.paymentPageUrl;
        return;
      }

      // Havale / Kapıda Ödeme gibi doğrudan onaylanan siparişler için satın alma analitiğini tetikle
      for (const line of summary.lines) {
        trackStoreEvent({
          type: "purchase",
          productId: line.productId,
          variantId: line.variantId,
          meta: {
            orderId: res.orderId,
            orderNumber: res.orderNumber,
            quantity: line.quantity,
          },
        });
      }

      router.push(`/siparis-sonuc/${res.orderId}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmitOrder}
      className="grid grid-cols-1 gap-8 lg:grid-cols-12"
    >
      {/* Sol Kolon: Adres, Kargo, Ödeme ve Sözleşmeler */}
      <div className="lg:col-span-7 space-y-6">
        {errorMessage && (
          <div className="flex items-start gap-2.5 rounded-md border border-danger/30 bg-danger/10 p-3.5 text-xs font-medium text-danger">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Kayıtlı Adresler */}
        {savedAddresses.length > 0 && (
          <section className="rounded-lg border border-border bg-card p-5 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">
              Kayıtlı Adresleriniz
            </h2>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {savedAddresses.map((addr) => (
                <button
                  key={addr.id}
                  type="button"
                  onClick={() => {
                    applySavedAddress(addr);
                    void refreshQuotes(
                      addr.city,
                      shippingMethodId,
                      paymentMethod
                    );
                  }}
                  className="rounded-md border border-border bg-background p-3 text-left text-xs transition-colors hover:border-foreground"
                >
                  <div className="flex items-center justify-between font-semibold text-foreground">
                    <span>{addr.title}</span>
                    {addr.isDefault && (
                      <Badge variant="neutral">Varsayılan</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    {addr.firstName} {addr.lastName} • {addr.district} /{" "}
                    {addr.city}
                  </p>
                  <p className="mt-0.5 line-clamp-1 text-muted-foreground">
                    {addr.line1}
                  </p>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* 1. İletişim ve Teslimat Adresi */}
        <section className="rounded-lg border border-border bg-card p-5 space-y-4">
          <button
            type="button"
            onClick={() => setOpenStep(openStep === "address" ? ("" as any) : "address")}
            className="flex w-full items-center justify-between text-left focus:outline-none cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  isAddressValid
                    ? "bg-emerald-600 text-white"
                    : "bg-[var(--ink)] text-[var(--card)]"
                }`}
              >
                {isAddressValid ? <CheckCircle className="h-4 w-4" weight="bold" /> : "1"}
              </div>
              <h2 className="text-base font-semibold text-foreground">
                1. İletişim ve Teslimat Bilgileri
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {isAddressValid && openStep !== "address" && (
                <span className="text-xs text-muted-foreground font-medium hidden sm:inline">
                  {firstName} {lastName} ({district}/{city})
                </span>
              )}
              <CaretDown
                className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                  openStep === "address" ? "rotate-180" : ""
                }`}
              />
            </div>
          </button>

          {openStep === "address" && (
            <div className="pt-2 space-y-4 border-t border-border/60">

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="email">E-posta Adresi</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ornek@eposta.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Telefon Numarası</Label>
              <Input
                id="phone"
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="05XX XXX XX XX"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="addrTitle">Adres Başlığı</Label>
              <Input
                id="addrTitle"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ev, İş vb."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="firstName">Alıcı Adı</Label>
              <Input
                id="firstName"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">Alıcı Soyadı</Label>
              <Input
                id="lastName"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="city">İl</Label>
              <select
                id="city"
                value={city}
                onChange={(e) => {
                  const nextCity = e.target.value;
                  setCity(nextCity);
                  const found = TR_CITIES.find((c) => c.name === nextCity);
                  if (found?.districts[0]) {
                    setDistrict(found.districts[0]);
                  }
                  void refreshQuotes(
                    nextCity,
                    shippingMethodId,
                    paymentMethod
                  );
                }}
                className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
              >
                {TR_CITIES.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="district">İlçe</Label>
              <select
                id="district"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
              >
                {(cityEntry?.districts ?? ["Merkez"]).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="neighborhood">Mahalle / Semt</Label>
              <Input
                id="neighborhood"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                placeholder="Örn: Caferağa Mah."
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div className="sm:col-span-3 space-y-1.5">
              <Label htmlFor="line1">Açık Adres</Label>
              <Input
                id="line1"
                required
                value={line1}
                onChange={(e) => setLine1(e.target.value)}
                placeholder="Cadde, sokak, bina ve daire numarası"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="postalCode">Posta Kodu</Label>
              <Input
                id="postalCode"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder="34710"
              />
            </div>
          </div>

          {/* Fatura Tipi (Bireysel / Kurumsal) */}
          <div className="border-t border-border pt-4 space-y-3">
            <div className="flex items-center gap-4">
              <span className="text-xs font-medium text-foreground">
                Fatura Tipi:
              </span>
              <label className="inline-flex items-center gap-1.5 text-xs">
                <input
                  type="radio"
                  name="invoiceType"
                  checked={invoiceType === "INDIVIDUAL"}
                  onChange={() => setInvoiceType("INDIVIDUAL")}
                />
                Bireysel
              </label>
              <label className="inline-flex items-center gap-1.5 text-xs">
                <input
                  type="radio"
                  name="invoiceType"
                  checked={invoiceType === "CORPORATE"}
                  onChange={() => setInvoiceType("CORPORATE")}
                />
                Kurumsal
              </label>
            </div>

            {invoiceType === "INDIVIDUAL" ? (
              <div className="max-w-xs space-y-1.5">
                <Label htmlFor="tckn">
                  T.C. Kimlik Numarası (İsteğe Bağlı)
                </Label>
                <Input
                  id="tckn"
                  maxLength={11}
                  value={tckn}
                  onChange={(e) => setTckn(e.target.value)}
                  placeholder="11 haneli TCKN"
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="companyName">Firma Unvanı</Label>
                  <Input
                    id="companyName"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="taxOffice">Vergi Dairesi</Label>
                  <Input
                    id="taxOffice"
                    required
                    value={taxOffice}
                    onChange={(e) => setTaxOffice(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="taxNumber">Vergi Numarası</Label>
                  <Input
                    id="taxNumber"
                    required
                    value={taxNumber}
                    onChange={(e) => setTaxNumber(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
                <Button
                  type="button"
                  onClick={() => {
                    if (!isAddressValid) {
                      setErrorMessage("Lütfen zorunlu iletişim ve adres bilgilerini doldurunuz.");
                      return;
                    }
                    setErrorMessage(null);
                    setOpenStep("shipping");
                  }}
                  size="sm"
                  className="gap-1.5"
                >
                  <span>Kargo Seçimine İlerle</span>
                  <ArrowRight className="h-4 w-4" weight="bold" />
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* 2. Kargo Seçimi (Akordeon Adım) */}
        <section className="rounded-lg border border-border bg-card p-5 space-y-3">
          <button
            type="button"
            onClick={() => setOpenStep(openStep === "shipping" ? ("" as any) : "shipping")}
            className="flex w-full items-center justify-between text-left focus:outline-none cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  isShippingSelected
                    ? "bg-emerald-600 text-white"
                    : "bg-[var(--surface)] text-[var(--muted)] border border-[var(--border)]"
                }`}
              >
                {isShippingSelected ? <CheckCircle className="h-4 w-4" weight="bold" /> : "2"}
              </div>
              <Truck className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold text-foreground">
                2. Teslimat / Kargo Yöntemi
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {summary.selectedShippingMethod && openStep !== "shipping" && (
                <Badge variant="neutral" className="text-xs font-medium">
                  {summary.selectedShippingMethod.name}
                </Badge>
              )}
              <CaretDown
                className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                  openStep === "shipping" ? "rotate-180" : ""
                }`}
              />
            </div>
          </button>

          {openStep === "shipping" && (
            <div className="pt-2 space-y-3 border-t border-border/60">
              <div className="grid grid-cols-1 gap-2.5">
                {summary.availableShippingMethods.map((method) => {
                  const selected =
                    (shippingMethodId || summary.selectedShippingMethod?.id) ===
                    method.id;
                  return (
                    <label
                      key={method.id}
                      className={`flex cursor-pointer items-center justify-between rounded-md border p-3.5 text-sm transition-colors ${
                        selected
                          ? "border-foreground bg-muted/40"
                          : "border-border bg-background hover:bg-muted/20"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="shippingMethod"
                          checked={selected}
                          onChange={() => {
                            setShippingMethodId(method.id);
                            void refreshQuotes(city, method.id, paymentMethod);
                          }}
                        />
                        <div>
                          <p className="font-medium text-foreground">
                            {method.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Tahmini teslimat: {method.estimatedDays}
                          </p>
                        </div>
                      </div>
                      <span className="font-semibold tabular-nums text-foreground">
                        {method.effectivePriceMinor === 0
                          ? "Ücretsiz"
                          : formatMoney(method.effectivePriceMinor, summary.currency)}
                      </span>
                    </label>
                  );
                })}
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="button"
                  onClick={() => setOpenStep("payment")}
                  size="sm"
                  className="gap-1.5"
                >
                  <span>Ödeme Yöntemine İlerle</span>
                  <ArrowRight className="h-4 w-4" weight="bold" />
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* 3. Ödeme Yöntemi (Akordeon Adım) */}
        <section className="rounded-lg border border-border bg-card p-5 space-y-3">
          <button
            type="button"
            onClick={() => setOpenStep(openStep === "payment" ? ("" as any) : "payment")}
            className="flex w-full items-center justify-between text-left focus:outline-none cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  isPaymentSelected
                    ? "bg-emerald-600 text-white"
                    : "bg-[var(--surface)] text-[var(--muted)] border border-[var(--border)]"
                }`}
              >
                {isPaymentSelected ? <CheckCircle className="h-4 w-4" weight="bold" /> : "3"}
              </div>
              <CreditCard className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold text-foreground">
                3. Ödeme Yöntemi
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {paymentMethod && openStep !== "payment" && (
                <Badge variant="neutral" className="text-xs font-medium uppercase">
                  {paymentMethod === "iyzico"
                    ? "Kredi / Banka Kartı"
                    : paymentMethod === "bank_transfer"
                    ? "Havale / EFT"
                    : "Kapıda Ödeme"}
                </Badge>
              )}
              <CaretDown
                className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                  openStep === "payment" ? "rotate-180" : ""
                }`}
              />
            </div>
          </button>

          {openStep === "payment" && (
            <div className="pt-2 space-y-3 border-t border-border/60">
              <div className="grid grid-cols-1 gap-2.5">
                {summary.availablePaymentOptions.map((option) => {
                  const selected = paymentMethod === option.code;
                  const Icon =
                    option.code === "bank_transfer"
                      ? Building2
                      : option.code === "cod"
                      ? Banknote
                      : CreditCard;

                  return (
                    <label
                      key={option.code}
                      className={`flex cursor-pointer items-start justify-between rounded-md border p-3.5 text-sm transition-colors ${
                        !option.available
                          ? "cursor-not-allowed border-border bg-muted/30 opacity-60"
                          : selected
                          ? "border-foreground bg-muted/40"
                          : "border-border bg-background hover:bg-muted/20"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="radio"
                          name="paymentMethod"
                          disabled={!option.available}
                          checked={selected}
                          onChange={() => {
                            const code = option.code as
                              | "iyzico"
                              | "bank_transfer"
                              | "cod";
                            setPaymentMethod(code);
                            void refreshQuotes(city, shippingMethodId, code);
                          }}
                          className="mt-1"
                        />
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2 font-medium text-foreground">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            <span>{option.label}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {option.description}
                          </p>
                          {!option.available && option.reason && (
                            <p className="text-xs text-danger">{option.reason}</p>
                          )}
                        </div>
                      </div>
                      {option.feeMinor > 0 && (
                        <span className="text-xs font-medium tabular-nums text-muted-foreground">
                          +{formatMoney(option.feeMinor, summary.currency)} hizmet bedeli
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>

              <div className="pt-2 space-y-1.5">
                <Label htmlFor="customerNote">Sipariş Notu (İsteğe Bağlı)</Label>
                <Textarea
                  id="customerNote"
                  rows={2}
                  value={customerNote}
                  onChange={(e) => setCustomerNote(e.target.value)}
                  placeholder="Teslimat veya paketleme ile ilgili notunuz..."
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="button"
                  onClick={() => setOpenStep("contracts")}
                  size="sm"
                  className="gap-1.5"
                >
                  <span>Sözleşme Onayına İlerle</span>
                  <ArrowRight className="h-4 w-4" weight="bold" />
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* 4. Yasal Sözleşmeler (Akordeon Adım) */}
        <section className="rounded-lg border border-border bg-card p-5 space-y-4">
          <button
            type="button"
            onClick={() => setOpenStep(openStep === "contracts" ? ("" as any) : "contracts")}
            className="flex w-full items-center justify-between text-left focus:outline-none cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  isContractsAccepted
                    ? "bg-emerald-600 text-white"
                    : "bg-[var(--surface)] text-[var(--muted)] border border-[var(--border)]"
                }`}
              >
                {isContractsAccepted ? <CheckCircle className="h-4 w-4" weight="bold" /> : "4"}
              </div>
              <FileText className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold text-foreground">
                4. Ön Bilgilendirme ve Mesafeli Satış Sözleşmesi
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {isContractsAccepted && openStep !== "contracts" && (
                <span className="text-xs text-emerald-600 font-semibold hidden sm:inline">
                  Onaylandı
                </span>
              )}
              <CaretDown
                className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                  openStep === "contracts" ? "rotate-180" : ""
                }`}
              />
            </div>
          </button>

          {openStep === "contracts" && (
            <div className="pt-2 space-y-4 border-t border-border/60">
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={handleOpenContractsPreview}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Sözleşmeleri Güncelle ve Tam Ekran İncele
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-foreground">
                    Ön Bilgilendirme Formu
                  </p>
                  <pre className="max-h-36 overflow-y-auto rounded border border-border bg-muted/30 p-2.5 text-[11px] whitespace-pre-wrap font-sans text-muted-foreground">
                    {contracts.preInformation}
                  </pre>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-foreground">
                    Mesafeli Satış Sözleşmesi
                  </p>
                  <pre className="max-h-36 overflow-y-auto rounded border border-border bg-muted/30 p-2.5 text-[11px] whitespace-pre-wrap font-sans text-muted-foreground">
                    {contracts.distanceSales}
                  </pre>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <label className="flex items-start gap-2.5 text-xs text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acceptPreInfo}
                    onChange={(e) => setAcceptPreInfo(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    <strong>Ön Bilgilendirme Formu</strong> metnini okudum ve kabul
                    ediyorum.
                  </span>
                </label>

                <label className="flex items-start gap-2.5 text-xs text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acceptDistanceSales}
                    onChange={(e) => setAcceptDistanceSales(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    <strong>Mesafeli Satış Sözleşmesi</strong> metnini okudum ve
                    kabul ediyorum.
                  </span>
                </label>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Sağ Kolon: Sipariş Özeti ve Onay Butonu */}
      <div className="lg:col-span-5">
        <div className="sticky top-20 rounded-lg border border-border bg-card p-5 space-y-4">
          <h2 className="text-base font-semibold text-foreground">
            Sipariş Özeti ({summary.itemCount} Ürün)
          </h2>

          <div className="max-h-72 divide-y divide-border overflow-y-auto pr-1">
            {summary.lines.map((line) => (
              <div
                key={line.id}
                className="flex items-center justify-between gap-3 py-2.5 text-xs"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 truncate">
                    <p className="truncate font-medium text-foreground">
                      {line.quantity}x {line.title}
                    </p>
                    {line.isClubPriceApplied && (
                      <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/10 border border-amber-500/30 px-1 py-0.2 text-[9px] font-bold text-amber-800 dark:text-amber-300 shrink-0">
                        <Crown className="h-2.5 w-2.5 text-amber-600 dark:text-amber-400" weight="fill" />
                        Kulüp
                      </span>
                    )}
                  </div>
                  <p className="text-muted-foreground">{line.variantTitle}</p>
                </div>
                <span className="shrink-0 font-semibold tabular-nums text-foreground">
                  {formatMoney(line.lineTotalMinor, summary.currency)}
                </span>
              </div>
            ))}
          </div>

          {/* Vezolla Club Puanı Kullanımı */}
          {customer &&
            (summary.customerLoyaltyBalance ?? 0) > 0 &&
            (!clubSettings || clubSettings.checkoutShowRedemption) && (
            <div className="rounded-[var(--radius-base,0.5rem)] border border-[var(--border)] bg-[var(--surface)] p-3.5 text-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[var(--ink)]">
                  {clubSettings?.checkoutRedemptionTitle ?? "Vezolla Club Sadakat Puanı"}
                </span>
                <span className="font-bold text-[var(--ink)]">
                  {summary.customerLoyaltyBalance} Puan ({formatMoney((summary.customerLoyaltyBalance ?? 0) * (clubSettings?.pointValueKurus ?? summary.loyaltyPointValueKurus ?? 50), summary.currency)})
                </span>
              </div>
              <p className="text-[11px] text-[var(--muted)]">
                {(clubSettings?.checkoutRedemptionNotice ?? "Bu siparişte en fazla {maxPoints} puan (sepetin %{percent}'si) harcayabilirsiniz.")
                  .replace("{maxPoints}", String(summary.maxLoyaltyPointsUsable ?? 0))
                  .replace("{percent}", String(clubSettings?.maxOrderDiscountPercent ?? 20))}
              </p>
              {summary.loyaltyPointsUsed > 0 ? (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-emerald-600 font-semibold">
                    ✓ {summary.loyaltyPointsUsed} Puan uygulandı (-{formatMoney(summary.loyaltyDiscountMinor, summary.currency)})
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs border-[var(--border)] text-[var(--ink)]"
                    onClick={handleRemoveLoyaltyPoints}
                    disabled={loyaltyPending}
                  >
                    Kaldır
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 pt-1">
                  <Input
                    type="number"
                    min="1"
                    max={summary.maxLoyaltyPointsUsable ?? 0}
                    value={loyaltyInput}
                    onChange={(e) => setLoyaltyInput(e.target.value)}
                    placeholder={`Maks ${summary.maxLoyaltyPointsUsable ?? 0}`}
                    className="h-8 text-xs bg-[var(--card)] border-[var(--border)] text-[var(--ink)]"
                  />
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    className="h-8 text-xs font-semibold shrink-0 bg-[var(--ink)] text-[var(--card)] hover:opacity-90"
                    onClick={handleApplyLoyaltyPoints}
                    disabled={loyaltyPending || !(summary.maxLoyaltyPointsUsable && summary.maxLoyaltyPointsUsable > 0)}
                  >
                    Uygula
                  </Button>
                </div>
              )}
              {loyaltyError && (
                <p className="text-[11px] text-rose-600 font-medium">{loyaltyError}</p>
              )}
            </div>
          )}

          <dl className="space-y-2 border-t border-border pt-4 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <dt>Ara Toplam</dt>
              <dd className="tabular-nums text-foreground">
                {formatMoney(summary.subtotalMinor, summary.currency)}
              </dd>
            </div>

            {summary.discountTotalMinor > 0 && (
              <div className="flex justify-between text-success">
                <dt>İndirim Toplamı</dt>
                <dd className="tabular-nums font-medium">
                  -{formatMoney(summary.discountTotalMinor, summary.currency)}
                </dd>
              </div>
            )}

            {summary.loyaltyDiscountMinor > 0 && (
              <div className="flex justify-between text-emerald-600 font-medium">
                <dt>Vezolla Club İndirimi ({summary.loyaltyPointsUsed} Puan)</dt>
                <dd className="tabular-nums">
                  -{formatMoney(summary.loyaltyDiscountMinor, summary.currency)}
                </dd>
              </div>
            )}

            <div className="flex justify-between text-muted-foreground">
              <dt>
                Kargo ({summary.selectedShippingMethod?.name ?? "Standart"})
              </dt>
              <dd className="tabular-nums text-foreground">
                {summary.shippingTotalMinor === 0
                  ? "Ücretsiz"
                  : formatMoney(summary.shippingTotalMinor, summary.currency)}
              </dd>
            </div>

            {summary.paymentFeeMinor > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <dt>Ödeme Hizmet Bedeli</dt>
                <dd className="tabular-nums text-foreground">
                  {formatMoney(summary.paymentFeeMinor, summary.currency)}
                </dd>
              </div>
            )}

            <div className="flex justify-between text-xs text-muted-foreground">
              <dt>Dahil KDV</dt>
              <dd className="tabular-nums">
                {formatMoney(summary.taxTotalMinor, summary.currency)}
              </dd>
            </div>

            <div className="flex justify-between border-t border-border pt-3 text-base font-semibold text-foreground">
              <dt>Ödenecek Tutar</dt>
              <dd className="tabular-nums">
                {formatMoney(summary.totalMinor, summary.currency)}
              </dd>
            </div>

            {/* VezollaClub Sadakat Puanı Kazanım Rozeti */}
            {(() => {
              if (clubSettings && !clubSettings.checkoutShowEarningBadge) return null;
              const priceInTl = Math.round(summary.totalMinor / 100);
              const earnRate = (clubSettings?.earningRatePercent ?? 10) / 100;
              const clubPoints = Math.max(1, Math.round(priceInTl * earnRate));
              const pointValueKurus = clubSettings?.pointValueKurus ?? 50;
              const cashValueTl = Math.round((clubPoints * pointValueKurus) / 100);

              const template =
                clubSettings?.checkoutEarningBadgeTemplate ??
                "Bu siparişinizden {points} VezollaClub Puanı ({value} TL Değerinde) Kazanacaksınız.";

              const renderedText = template
                .replace("{points}", `${clubPoints} VezollaClub Puanı`)
                .replace("{value}", String(cashValueTl));

              return (
                <div className="flex items-center gap-2 rounded-[var(--radius-base,0.375rem)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--ink)]">
                  <Sparkle className="h-4 w-4 shrink-0 text-[var(--accent)]" weight="fill" />
                  <span>{renderedText}</span>
                </div>
              );
            })()}
          </dl>

          {!summary.isMinOrderSubtotalMet && summary.minOrderSubtotalMinor > 0 ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 space-y-1">
              <div className="font-semibold">Minimum Sepet Tutarı Karşılanmadı</div>
              <p>
                Siparişinizi tamamlayabilmek için sepet ara toplamınız en az{" "}
                <strong>{formatMoney(summary.minOrderSubtotalMinor, summary.currency)}</strong> olmalıdır.
              </p>
              <Link href="/sepet" className="mt-1 block font-medium underline">
                Sepete ürün eklemek için tıklayın &rarr;
              </Link>
            </div>
          ) : null}

          <Button
            type="submit"
            disabled={
              submitting ||
              (!summary.isMinOrderSubtotalMet && summary.minOrderSubtotalMinor > 0)
            }
            className="h-11 w-full gap-2 text-sm"
          >
            <Lock className="h-4 w-4" />
            {submitting
              ? "Siparişiniz Oluşturuluyor..."
              : !summary.isMinOrderSubtotalMet && summary.minOrderSubtotalMinor > 0
              ? `Minimum Tutar: ${formatMoney(summary.minOrderSubtotalMinor, summary.currency)}`
              : `Siparişi Onayla (${formatMoney(summary.totalMinor, summary.currency)})`}
          </Button>

          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-success" />
            <span>256-bit SSL güvenli ödeme ve stok rezervasyon koruması</span>
          </div>

          <Link
            href="/sepet"
            className="block text-center text-xs text-muted-foreground hover:text-foreground"
          >
            Sepete Geri Dön
          </Link>
        </div>
      </div>

      {/* Sözleşme Tam Ekran İnceleme Modalı */}
      {showContractsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-border bg-card p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-semibold text-foreground">
                Ön Bilgilendirme Formu ve Mesafeli Satış Sözleşmesi
              </h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowContractsModal(false)}
              >
                Kapat
              </Button>
            </div>
            <div className="space-y-4 text-xs">
              <div>
                <h4 className="font-semibold text-foreground mb-1">
                  Ön Bilgilendirme Formu
                </h4>
                <pre className="rounded border border-border bg-muted/30 p-3 whitespace-pre-wrap font-sans text-muted-foreground">
                  {contracts.preInformation}
                </pre>
              </div>
              <div>
                <h4 className="font-semibold text-foreground mb-1">
                  Mesafeli Satış Sözleşmesi
                </h4>
                <pre className="rounded border border-border bg-muted/30 p-3 whitespace-pre-wrap font-sans text-muted-foreground">
                  {contracts.distanceSales}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* iyzico Responsive Güvenli Ödeme Modalı */}
      {iyzicoModalData && (
        <IyzicoModal
          data={iyzicoModalData}
          onClose={() => void handleCloseIyzicoModal()}
          isCancelling={cancellingOrder}
        />
      )}
    </form>
  );
}
