"use client";

import * as React from "react";
import type { CartSummary } from "@/modules/checkout/cart";
import {
  addCartItemAction,
  updateCartItemQuantityAction,
  removeCartItemAction,
  getCartSummaryAction,
} from "@/modules/checkout/actions";

interface CartContextValue {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  openCart: () => void;
  closeCart: () => void;
  summary: CartSummary | null;
  cartCount: number;
  isLoading: boolean;
  addItem: (
    variantId: string,
    quantity?: number,
    options?: { openDrawer?: boolean }
  ) => Promise<{ ok: boolean; error?: string }>;
  updateQuantity: (lineId: string, quantity: number) => Promise<{ ok: boolean; error?: string }>;
  removeItem: (lineId: string) => Promise<{ ok: boolean; error?: string }>;
  refreshCart: () => Promise<void>;
}

const CartContext = React.createContext<CartContextValue | null>(null);

export function CartProvider({
  children,
  initialSummary,
}: {
  children: React.ReactNode;
  initialSummary?: CartSummary | null;
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [summary, setSummary] = React.useState<CartSummary | null>(initialSummary ?? null);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    if (initialSummary) {
      setSummary(initialSummary);
    }
  }, [initialSummary]);

  const openCart = React.useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeCart = React.useCallback(() => {
    setIsOpen(false);
  }, []);

  const refreshCart = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const latest = await getCartSummaryAction();
      setSummary(latest);
    } catch {
      // Sessizce geç
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addItem = React.useCallback(
    async (variantId: string, quantity = 1, options?: { openDrawer?: boolean }) => {
      setIsLoading(true);
      try {
        const res = await addCartItemAction(variantId, quantity);
        if (res.ok && res.summary) {
          setSummary(res.summary);
          if (options?.openDrawer !== false) {
            setIsOpen(true); // Ekleme sonrası sepete yönlendirmeden çekmeceyi pürüzsüzce aç
          }
          return { ok: true };
        }
        return { ok: false, error: res.error ?? "Ürün sepete eklenemedi." };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : "Bir hata oluştu.",
        };
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const updateQuantity = React.useCallback(
    async (lineId: string, quantity: number) => {
      setIsLoading(true);
      try {
        const res = await updateCartItemQuantityAction(lineId, quantity);
        if (res.ok && res.summary) {
          setSummary(res.summary);
          return { ok: true };
        }
        return { ok: false, error: res.error ?? "Miktar güncellenemedi." };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : "Bir hata oluştu.",
        };
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const removeItem = React.useCallback(
    async (lineId: string) => {
      setIsLoading(true);
      try {
        const res = await removeCartItemAction(lineId);
        if (res.ok && res.summary) {
          setSummary(res.summary);
          return { ok: true };
        }
        return { ok: false, error: res.error ?? "Ürün sepetten çıkarılamadı." };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : "Bir hata oluştu.",
        };
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const cartCount = summary?.itemCount ?? 0;

  const value = React.useMemo(
    () => ({
      isOpen,
      setIsOpen,
      openCart,
      closeCart,
      summary,
      cartCount,
      isLoading,
      addItem,
      updateQuantity,
      removeItem,
      refreshCart,
    }),
    [
      isOpen,
      openCart,
      closeCart,
      summary,
      cartCount,
      isLoading,
      addItem,
      updateQuantity,
      removeItem,
      refreshCart,
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = React.useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart, CartProvider içinde kullanılmalıdır.");
  }
  return ctx;
}
