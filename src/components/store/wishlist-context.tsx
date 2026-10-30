"use client";

import * as React from "react";
import Link from "next/link";
import {
  Heart,
  FolderSimplePlus,
  Check,
  X,
  ArrowRight,
  Sparkle,
} from "@phosphor-icons/react";
import {
  toggleWishlistAction,
  getCustomerWishlistStateAction,
  createCollectionAction,
  syncGuestWishlistAction,
} from "@/modules/wishlist/actions";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface WishlistContextType {
  wishlistIds: Set<string>;
  wishlistCount: number;
  collections: Array<{ id: string; name: string }>;
  isWishlisted: (productId: string) => boolean;
  toggleWishlist: (
    productId: string,
    meta?: { title?: string; price?: number }
  ) => Promise<boolean>;
  openCollectionModal: (productId: string, productTitle?: string) => void;
  refreshWishlist: () => Promise<void>;
}

const WishlistContext = React.createContext<WishlistContextType | null>(null);

const GUEST_STORAGE_KEY = "area42_guest_wishlist";

export function WishlistProvider({
  children,
  initialProductIds = [],
  initialCollections = [],
  isAuthenticated = false,
}: {
  children: React.ReactNode;
  initialProductIds?: string[];
  initialCollections?: Array<{ id: string; name: string }>;
  isAuthenticated?: boolean;
}) {
  const [wishlistIds, setWishlistIds] = React.useState<Set<string>>(
    () => new Set(initialProductIds)
  );
  const [collections, setCollections] = React.useState<
    Array<{ id: string; name: string }>
  >(initialCollections);

  // Bildirim Toast State
  const [toastNotification, setToastNotification] = React.useState<{
    show: boolean;
    title: string;
    productId?: string;
    isAdded: boolean;
  } | null>(null);

  // Koleksiyon Seçim Modal State
  const [modalOpen, setModalOpen] = React.useState(false);
  const [targetProduct, setTargetProduct] = React.useState<{
    id: string;
    title: string;
  } | null>(null);
  const [newCollectionName, setNewCollectionName] = React.useState("");
  const [isCreatingCollection, setIsCreatingCollection] = React.useState(false);
  const [collectionSuccess, setCollectionSuccess] = React.useState<string | null>(null);

  // Initial Load & Guest Sync
  React.useEffect(() => {
    if (typeof window === "undefined") return;

    if (isAuthenticated) {
      // Misafir favorilerini kullanıcı hesabına aktar
      try {
        const guestData = localStorage.getItem(GUEST_STORAGE_KEY);
        if (guestData) {
          const parsed = JSON.parse(guestData);
          if (Array.isArray(parsed) && parsed.length > 0) {
            syncGuestWishlistAction(parsed).then(() => {
              localStorage.removeItem(GUEST_STORAGE_KEY);
              getCustomerWishlistStateAction().then((st) => {
                setWishlistIds(new Set(st.productIds));
                setCollections(st.collections);
              });
            });
          }
        }
      } catch {
        // ignore parse errors
      }
    } else {
      // Misafir: localStorage'dan oku
      try {
        const guestData = localStorage.getItem(GUEST_STORAGE_KEY);
        if (guestData) {
          const parsed = JSON.parse(guestData);
          if (Array.isArray(parsed)) {
            setWishlistIds(new Set(parsed));
          }
        }
      } catch {
        // ignore
      }
    }
  }, [isAuthenticated]);

  const refreshWishlist = React.useCallback(async () => {
    if (isAuthenticated) {
      const st = await getCustomerWishlistStateAction();
      setWishlistIds(new Set(st.productIds));
      setCollections(st.collections);
    }
  }, [isAuthenticated]);

  const isWishlisted = React.useCallback(
    (productId: string) => wishlistIds.has(productId),
    [wishlistIds]
  );

  const toggleWishlist = React.useCallback(
    async (
      productId: string,
      meta?: { title?: string; price?: number }
    ): Promise<boolean> => {
      const willAdd = !wishlistIds.has(productId);

      // Optimistic Update
      setWishlistIds((prev) => {
        const next = new Set(prev);
        if (willAdd) {
          next.add(productId);
        } else {
          next.delete(productId);
        }
        return next;
      });

      // Misafir ise localStorage'a yaz
      if (!isAuthenticated && typeof window !== "undefined") {
        try {
          const currentArr = Array.from(wishlistIds);
          const nextArr = willAdd
            ? [...currentArr, productId]
            : currentArr.filter((id) => id !== productId);
          localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(nextArr));
        } catch {}
      }

      // Toast Bildirimi Göster
      const prodTitle = meta?.title ?? "Ürün";
      setToastNotification({
        show: true,
        title: prodTitle,
        productId,
        isAdded: willAdd,
      });

      // 4 saniye sonra otomatik kapat
      setTimeout(() => {
        setToastNotification((curr) =>
          curr?.productId === productId ? null : curr
        );
      }, 4000);

      // Backend Senkronizasyonu
      try {
        const res = await toggleWishlistAction(productId);
        if (!res.ok) {
          // Revert optimistic on error
          setWishlistIds((prev) => {
            const next = new Set(prev);
            if (willAdd) {
              next.delete(productId);
            } else {
              next.add(productId);
            }
            return next;
          });
          return !willAdd;
        }
        return res.added;
      } catch {
        return willAdd;
      }
    },
    [wishlistIds, isAuthenticated]
  );

  const openCollectionModal = React.useCallback(
    (productId: string, productTitle?: string) => {
      setTargetProduct({
        id: productId,
        title: productTitle || "Ürün",
      });
      setCollectionSuccess(null);
      setModalOpen(true);
    },
    []
  );

  async function handleCreateCollection(e: React.FormEvent) {
    e.preventDefault();
    if (!newCollectionName.trim() || isCreatingCollection) return;

    setIsCreatingCollection(true);
    try {
      const res = await createCollectionAction(newCollectionName.trim());
      if (res.ok && res.collectionId) {
        setCollections((prev) => [
          ...prev,
          { id: res.collectionId!, name: newCollectionName.trim() },
        ]);
        setCollectionSuccess(`"${newCollectionName.trim()}" listesi oluşturuldu.`);
        setNewCollectionName("");
      }
    } finally {
      setIsCreatingCollection(false);
    }
  }

  return (
    <WishlistContext.Provider
      value={{
        wishlistIds,
        wishlistCount: wishlistIds.size,
        collections,
        isWishlisted,
        toggleWishlist,
        openCollectionModal,
        refreshWishlist,
      }}
    >
      {children}

      {/* Modern Dopamin Toast Bildirimi */}
      {toastNotification?.show && (
        <aside
          role="status"
          aria-live="polite"
          className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-50 flex max-w-sm items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3.5 shadow-xl shadow-black/15 text-[var(--ink)] animate-in fade-in slide-in-from-bottom-3 duration-300"
        >
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
              toastNotification.isAdded
                ? "bg-rose-50 text-rose-600 dark:bg-rose-950/40"
                : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"
            }`}
          >
            <Heart
              className="h-5 w-5"
              weight={toastNotification.isAdded ? "fill" : "regular"}
            />
          </div>

          <div className="flex-1 min-w-0 pr-1">
            <p className="text-xs font-semibold text-[var(--ink)] truncate">
              {toastNotification.title}
            </p>
            <p className="text-[11px] text-[var(--muted)]">
              {toastNotification.isAdded
                ? "Favorilerinize eklendi!"
                : "Favorilerden kaldırıldı."}
            </p>
          </div>

          {toastNotification.isAdded && (
            <div className="flex items-center gap-1.5 shrink-0">
              <Link
                href="/hesabim?tab=favoriler"
                className="inline-flex items-center gap-1 rounded bg-[var(--surface)] px-2 py-1 text-[11px] font-semibold text-[var(--ink)] hover:bg-[var(--border)] transition-colors"
              >
                Gör
                <ArrowRight className="h-3 w-3" />
              </Link>
              <button
                type="button"
                onClick={() =>
                  openCollectionModal(
                    toastNotification.productId!,
                    toastNotification.title
                  )
                }
                title="Listeye Ekle"
                className="inline-flex items-center gap-1 rounded border border-[var(--border)] bg-transparent px-2 py-1 text-[11px] font-medium text-[var(--ink)] hover:border-[var(--accent)] transition-colors"
              >
                <FolderSimplePlus className="h-3.5 w-3.5 text-[var(--accent)]" />
                Liste
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setToastNotification(null)}
            className="rounded p-1 text-[var(--muted)] hover:text-[var(--ink)]"
            aria-label="Kapat"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </aside>
      )}

      {/* Koleksiyon / Liste Seçim Modalı */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent
          title="Favori Listesine / Koleksiyona Ekle"
          description={
            targetProduct
              ? `"${targetProduct.title}" ürününü dilediğiniz koleksiyona kaydedin.`
              : "Favorilerinizi düzenleyin."
          }
        >
          <div className="space-y-4">
            {collectionSuccess && (
              <div className="flex items-center gap-2 rounded-md bg-emerald-50 dark:bg-emerald-950/30 p-2.5 text-xs text-emerald-800 dark:text-emerald-300">
                <Check className="h-4 w-4 shrink-0" />
                <span>{collectionSuccess}</span>
              </div>
            )}

            {/* Mevcut Koleksiyonlar */}
            <div>
              <p className="text-xs font-semibold text-[var(--ink)] mb-2">
                Kayıtlı Koleksiyonlarım
              </p>
              {collections.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[var(--border)] p-4 text-center text-xs text-[var(--muted)]">
                  Henüz özel bir koleksiyonunuz yok. Aşağıdan hemen oluşturabilirsiniz! (Örn: &quot;Yaz Gardırobu&quot;, &quot;Ev Hediyeleri&quot;)
                </div>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {collections.map((col) => (
                    <div
                      key={col.id}
                      className="flex items-center justify-between rounded-md border border-[var(--border)] bg-[var(--surface)] p-2.5 text-xs transition-colors hover:border-[var(--accent)]"
                    >
                      <span className="font-medium text-[var(--ink)]">{col.name}</span>
                      <Link
                        href={`/hesabim?tab=favoriler&collection=${col.id}`}
                        onClick={() => setModalOpen(false)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--accent)] hover:underline"
                      >
                        İncele
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Yeni Koleksiyon Oluştur */}
            <form onSubmit={handleCreateCollection} className="border-t border-[var(--border)] pt-4 space-y-2">
              <label
                htmlFor="newCollectionInput"
                className="text-xs font-semibold text-[var(--ink)] flex items-center gap-1.5"
              >
                <Sparkle className="h-3.5 w-3.5 text-[var(--accent)]" />
                Yeni Koleksiyon Oluştur
              </label>
              <div className="flex gap-2">
                <input
                  id="newCollectionInput"
                  type="text"
                  placeholder="Örn: 2026 Favorilerim, Hediye Listesi..."
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  className="h-9 flex-1 rounded-md border border-[var(--border)] bg-[var(--card)] px-3 text-xs text-[var(--ink)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!newCollectionName.trim() || isCreatingCollection}
                  className="inline-flex h-9 items-center justify-center rounded-md bg-[var(--accent)] px-3 text-xs font-semibold text-[var(--accent-fg,#fff)] hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {isCreatingCollection ? "Ekleniyor..." : "Oluştur"}
                </button>
              </div>
            </form>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--ink)] hover:bg-[var(--surface)]"
              >
                Kapat
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </WishlistContext.Provider>
  );
}

const fallbackContext: WishlistContextType = {
  wishlistIds: new Set(),
  wishlistCount: 0,
  collections: [],
  isWishlisted: () => false,
  toggleWishlist: async () => false,
  openCollectionModal: () => {},
  refreshWishlist: async () => {},
};

export function useWishlist(): WishlistContextType {
  const ctx = React.useContext(WishlistContext);
  return ctx ?? fallbackContext;
}
