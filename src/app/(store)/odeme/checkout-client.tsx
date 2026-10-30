"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Truck,
  CreditCard,
  Buildings as Building2,
  Money as Banknote,
  FileText,
  WarningCircle as AlertCircle,
  Lock,
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
} from "@/modules/checkout/actions";
import type { CartSummary } from "@/modules/checkout/cart";
import type { GeneratedContracts } from "@/modules/checkout/contracts";
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
}

export function CheckoutClient({
  initialSummary,
  initialContracts,
  customer,
  savedAddresses,
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
          <h2 className="text-base font-semibold text-foreground">
            1. İletişim ve Teslimat Bilgileri
          </h2>

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
        </section>

        {/* 2. Kargo Seçimi */}
        <section className="rounded-lg border border-border bg-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold text-foreground">
              2. Teslimat / Kargo Yöntemi
            </h2>
          </div>

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
        </section>

        {/* 3. Ödeme Yöntemi */}
        <section className="rounded-lg border border-border bg-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold text-foreground">
              3. Ödeme Yöntemi
            </h2>
          </div>

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
        </section>

        {/* 4. Yasal Sözleşmeler */}
        <section className="rounded-lg border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold text-foreground">
                4. Yasal Sözleşmeler ve Onay
              </h2>
            </div>
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
                  <p className="truncate font-medium text-foreground">
                    {line.quantity}x {line.title}
                  </p>
                  <p className="text-muted-foreground">{line.variantTitle}</p>
                </div>
                <span className="shrink-0 font-semibold tabular-nums text-foreground">
                  {formatMoney(line.lineTotalMinor, summary.currency)}
                </span>
              </div>
            ))}
          </div>

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
          </dl>

          <Button
            type="submit"
            disabled={submitting}
            className="h-11 w-full gap-2 text-sm"
          >
            <Lock className="h-4 w-4" />
            {submitting
              ? "Siparişiniz Oluşturuluyor..."
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
    </form>
  );
}
