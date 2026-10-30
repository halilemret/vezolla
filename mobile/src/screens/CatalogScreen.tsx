import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute } from "@react-navigation/native";
import { ApiService } from "../services/api";
import { formatMoney } from "../utils/money";
import { Badge } from "../components/Badge";
import { Colors } from "../theme/colors";
import type { ProductSummary, ProductVariant } from "../types";

type StockFilter = "all" | "low" | "out";

export const CatalogScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();

  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Quick Stock Adjustment Modal
  const [stockModalVisible, setStockModalVisible] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [selectedProductTitle, setSelectedProductTitle] = useState("");
  const [newStockQty, setNewStockQty] = useState("");
  const [isAdjusting, setIsAdjusting] = useState(false);

  useEffect(() => {
    if (route.params?.filter === "low") {
      setStockFilter("low");
    }
  }, [route.params]);

  const fetchProducts = useCallback(
    async (targetPage = 1, shouldAppend = false) => {
      setError(null);
      if (!shouldAppend) setIsLoading(true);

      const res = await ApiService.getProducts({
        page: targetPage,
        limit: 20,
        stock: stockFilter,
        search: search.trim() || undefined,
      });

      if (res.error) {
        setError(res.error.message);
      } else if (res.products) {
        if (shouldAppend) {
          setProducts((prev) => [...prev, ...(res.products ?? [])]);
        } else {
          setProducts(res.products);
        }
        setPage(targetPage);
        setTotalPages(res.pagination?.totalPages ?? 1);
      }

      setIsLoading(false);
      setIsRefreshing(false);
    },
    [stockFilter, search]
  );

  useEffect(() => {
    fetchProducts(1, false);
  }, [fetchProducts]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchProducts(1, false);
  };

  const onEndReached = () => {
    if (!isLoading && page < totalPages) {
      fetchProducts(page + 1, true);
    }
  };

  const openStockModal = (product: ProductSummary, variant: ProductVariant) => {
    const currentOnHand = variant.inventoryLevels[0]?.onHand ?? 0;
    setSelectedProductTitle(product.title);
    setSelectedVariant(variant);
    setNewStockQty(String(currentOnHand));
    setStockModalVisible(true);
  };

  const handleStockSubmit = async () => {
    if (!selectedVariant) return;
    const qty = Number.parseInt(newStockQty, 10);
    if (!Number.isFinite(qty) || qty < 0) {
      Alert.alert("Geçersiz Miktar", "Lütfen 0 veya daha büyük bir tam sayı giriniz.");
      return;
    }

    setIsAdjusting(true);
    const res = await ApiService.adjustStock({
      variantId: selectedVariant.id,
      quantity: qty,
      type: "COUNT",
      mode: "set",
      reason: "Mobil uygulamadan hızlı stok sayımı",
    });
    setIsAdjusting(false);

    if (res.error) {
      Alert.alert("Hata", res.error.message);
    } else {
      setStockModalVisible(false);
      fetchProducts(page, false);
    }
  };

  const renderProductItem = ({ item }: { item: ProductSummary }) => {
    const isOutOfStock = item.totalStock <= 0;
    const isLowStock = item.totalStock > 0 && item.totalStock <= 5;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.productTitle} numberOfLines={2}>
              {item.title}
            </Text>
            {item.categories.length > 0 && (
              <Text style={styles.categoryText}>{item.categories.join(", ")}</Text>
            )}
          </View>
          <View style={styles.stockBadgeWrapper}>
            {isOutOfStock ? (
              <Badge label="Tükendi" variant="danger" />
            ) : isLowStock ? (
              <Badge label={`Kritik: ${item.totalStock}`} variant="warning" />
            ) : (
              <Badge label={`Stok: ${item.totalStock}`} variant="success" />
            )}
          </View>
        </View>

        <View style={styles.priceRow}>
          <Text style={styles.priceText}>
            {item.minPrice === item.maxPrice
              ? formatMoney(item.minPrice)
              : `${formatMoney(item.minPrice)} - ${formatMoney(item.maxPrice)}`}
          </Text>
          <Text style={styles.variantCountText}>
            {item.variantCount} Varyant
          </Text>
        </View>

        {/* Variants listing inside product */}
        {item.variants && item.variants.length > 0 && (
          <View style={styles.variantsBox}>
            {item.variants.map((v) => {
              const onHand = v.inventoryLevels[0]?.onHand ?? 0;
              return (
                <View key={v.id} style={styles.variantRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.variantTitle}>{v.title}</Text>
                    {v.sku ? <Text style={styles.variantSku}>SKU: {v.sku}</Text> : null}
                  </View>
                  <Text
                    style={[
                      styles.variantStock,
                      onHand <= 0
                        ? { color: Colors.danger }
                        : onHand <= 5
                        ? { color: Colors.warning }
                        : { color: Colors.text },
                    ]}
                  >
                    {onHand} Adet
                  </Text>
                  <TouchableOpacity
                    style={styles.adjustStockBtn}
                    onPress={() => openStockModal(item, v)}
                  >
                    <Text style={styles.adjustStockBtnText}>Düzenle</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Katalog & Stok</Text>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Ürün adı, SKU veya barkod ara..."
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => fetchProducts(1, false)}
          returnKeyType="search"
        />
        {search ? (
          <TouchableOpacity style={styles.clearSearchBtn} onPress={() => setSearch("")}>
            <Text style={styles.clearSearchText}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabsRow}>
        {[
          { id: "all", title: "Tüm Ürünler" },
          { id: "low", title: "Kritik Stok (<= 5)" },
          { id: "out", title: "Tükenenler (0)" },
        ].map((tab) => {
          const isActive = stockFilter === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tabBtn, isActive && styles.tabBtnActive]}
              onPress={() => setStockFilter(tab.id as StockFilter)}
            >
              <Text style={[styles.tabBtnText, isActive && styles.tabBtnTextActive]}>
                {tab.title}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Error state */}
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => fetchProducts(1, false)}>
            <Text style={styles.retryText}>Yenile</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Products list */}
      {isLoading && !isRefreshing && products.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.text} />
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          renderItem={renderProductItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>Ürün Bulunamadı</Text>
              <Text style={styles.emptySubtitle}>
                Seçilen filtrelere uygun ürün listelenemedi.
              </Text>
            </View>
          }
        />
      )}

      {/* Quick Stock Modal */}
      <Modal visible={stockModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Hızlı Stok Sayımı</Text>
            <Text style={styles.modalSub}>{selectedProductTitle}</Text>
            {selectedVariant && (
              <Text style={styles.modalVariant}>
                Varyant: {selectedVariant.title} {selectedVariant.sku ? `(${selectedVariant.sku})` : ""}
              </Text>
            )}

            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Yeni Stok Miktarı</Text>
            <TextInput
              style={styles.modalInput}
              keyboardType="number-pad"
              value={newStockQty}
              onChangeText={setNewStockQty}
              selectTextOnFocus
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setStockModalVisible(false)}
                disabled={isAdjusting}
              >
                <Text style={styles.cancelBtnText}>Vazgeç</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={handleStockSubmit}
                disabled={isAdjusting}
              >
                {isAdjusting ? (
                  <ActivityIndicator size="small" color={Colors.textInverse} />
                ) : (
                  <Text style={styles.confirmBtnText}>Stoğu Güncelle</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.text,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    position: "relative",
  },
  searchInput: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: Colors.text,
    minHeight: 40,
  },
  clearSearchBtn: {
    position: "absolute",
    right: 26,
    top: 20,
  },
  clearSearchText: {
    color: Colors.textMuted,
    fontSize: 14,
  },
  tabsRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: "center",
  },
  tabBtnActive: {
    backgroundColor: Colors.text,
    borderColor: Colors.text,
  },
  tabBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  tabBtnTextActive: {
    color: Colors.textInverse,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  productTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text,
  },
  categoryText: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  stockBadgeWrapper: {
    marginLeft: 8,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  priceText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.text,
  },
  variantCountText: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  variantsBox: {
    marginTop: 6,
  },
  variantRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.surfaceSubtle,
  },
  variantTitle: {
    fontSize: 12,
    fontWeight: "500",
    color: Colors.text,
  },
  variantSku: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  variantStock: {
    fontSize: 12,
    fontWeight: "600",
    marginHorizontal: 8,
  },
  adjustStockBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSubtle,
  },
  adjustStockBtnText: {
    fontSize: 10,
    fontWeight: "600",
    color: Colors.text,
  },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.text,
  },
  emptySubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
    textAlign: "center",
  },
  errorBox: {
    backgroundColor: Colors.dangerBg,
    borderColor: Colors.dangerBorder,
    borderWidth: 1,
    marginHorizontal: 16,
    marginTop: 8,
    padding: 10,
    borderRadius: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  errorText: {
    color: Colors.danger,
    fontSize: 12,
  },
  retryText: {
    color: Colors.danger,
    fontWeight: "700",
    fontSize: 12,
    textDecorationLine: "underline",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.text,
  },
  modalSub: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: "500",
    marginTop: 4,
  },
  modalVariant: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.text,
  },
  modalInput: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    fontWeight: "700",
    color: Colors.text,
    marginTop: 6,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 18,
  },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  cancelBtnText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  confirmBtn: {
    backgroundColor: Colors.text,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  confirmBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textInverse,
  },
});
