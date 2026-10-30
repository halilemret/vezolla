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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ApiService } from "../services/api";
import { formatMoney } from "../utils/money";
import { getPaymentStatusBadge, getFulfillmentStatusBadge } from "../utils/status";
import { Badge } from "../components/Badge";
import { Colors } from "../theme/colors";
import type { OrderSummary } from "../types";

type FilterTab = "ALL" | "TRANSFER" | "UNFULFILLED" | "COMPLETED" | "CANCELLED";

export const OrdersScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute<any>();

  const [activeTab, setActiveTab] = useState<FilterTab>("ALL");
  const [search, setSearch] = useState("");
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if routed with specific filter params
  useEffect(() => {
    if (route.params?.paymentStatus === "AWAITING_TRANSFER") {
      setActiveTab("TRANSFER");
    } else if (route.params?.fulfillmentStatus === "UNFULFILLED") {
      setActiveTab("UNFULFILLED");
    }
  }, [route.params]);

  const fetchOrders = useCallback(
    async (targetPage = 1, shouldAppend = false) => {
      setError(null);
      if (!shouldAppend) setIsLoading(true);

      const params: Parameters<typeof ApiService.getOrders>[0] = {
        page: targetPage,
        limit: 20,
        search: search.trim() || undefined,
      };

      if (activeTab === "TRANSFER") {
        params.paymentStatus = "AWAITING_TRANSFER";
      } else if (activeTab === "UNFULFILLED") {
        params.fulfillmentStatus = "UNFULFILLED";
      } else if (activeTab === "COMPLETED") {
        params.status = "COMPLETED";
      } else if (activeTab === "CANCELLED") {
        params.status = "CANCELLED";
      }

      const res = await ApiService.getOrders(params);

      if (res.error) {
        setError(res.error.message);
      } else if (res.orders) {
        if (shouldAppend) {
          setOrders((prev) => [...prev, ...(res.orders ?? [])]);
        } else {
          setOrders(res.orders);
        }
        setPage(targetPage);
        setTotalPages(res.pagination?.totalPages ?? 1);
      }

      setIsLoading(false);
      setIsRefreshing(false);
    },
    [activeTab, search]
  );

  useEffect(() => {
    fetchOrders(1, false);
  }, [fetchOrders]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchOrders(1, false);
  };

  const onEndReached = () => {
    if (!isLoading && page < totalPages) {
      fetchOrders(page + 1, true);
    }
  };

  const renderItem = ({ item }: { item: OrderSummary }) => {
    const payBadge = getPaymentStatusBadge(item.paymentStatus);
    const fulBadge = getFulfillmentStatusBadge(item.fulfillmentStatus);
    const customerName = item.customer
      ? `${item.customer.firstName} ${item.customer.lastName}`
      : item.email;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => navigation.navigate("OrderDetail", { orderId: item.id })}
      >
        <View style={styles.cardTop}>
          <Text style={styles.orderNumber}>#{item.number}</Text>
          <Text style={styles.orderAmount}>{formatMoney(item.total, item.currency)}</Text>
        </View>

        <Text style={styles.customerName}>{customerName}</Text>
        <Text style={styles.orderDate}>
          {new Date(item.placedAt).toLocaleString("tr-TR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>

        <View style={styles.badgeRow}>
          <Badge label={payBadge.label} variant={payBadge.variant} />
          <Badge label={fulBadge.label} variant={fulBadge.variant} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Siparişler</Text>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Sipariş no, müşteri adı veya e-posta..."
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => fetchOrders(1, false)}
          returnKeyType="search"
        />
        {search ? (
          <TouchableOpacity
            style={styles.clearSearchBtn}
            onPress={() => {
              setSearch("");
            }}
          >
            <Text style={styles.clearSearchText}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabsWrapper}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[
            { id: "ALL", title: "Tümü" },
            { id: "TRANSFER", title: "Havale Onayı" },
            { id: "UNFULFILLED", title: "Kargolanacak" },
            { id: "COMPLETED", title: "Tamamlanan" },
            { id: "CANCELLED", title: "İptal" },
          ]}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => {
            const isActive = activeTab === item.id;
            return (
              <TouchableOpacity
                style={[styles.tabItem, isActive && styles.tabItemActive]}
                onPress={() => setActiveTab(item.id as FilterTab)}
              >
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                  {item.title}
                </Text>
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={styles.tabsContainer}
        />
      </View>

      {/* Error state */}
      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => fetchOrders(1, false)}>
            <Text style={styles.retryLink}>Yenile</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Orders List */}
      {isLoading && !isRefreshing && orders.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.text} />
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>Sipariş Bulunamadı</Text>
              <Text style={styles.emptySubtitle}>
                Seçilen filtrelere veya aramaya uygun sipariş yok.
              </Text>
            </View>
          }
        />
      )}
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
  tabsWrapper: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  tabsContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  tabItem: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  tabItemActive: {
    backgroundColor: Colors.text,
    borderColor: Colors.text,
  },
  tabText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  tabTextActive: {
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
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  orderNumber: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.text,
  },
  orderAmount: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.text,
  },
  customerName: {
    fontSize: 13,
    color: Colors.text,
    marginTop: 4,
    fontWeight: "500",
  },
  orderDate: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 10,
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
  errorBanner: {
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
  retryLink: {
    color: Colors.danger,
    fontWeight: "700",
    fontSize: 12,
    textDecorationLine: "underline",
  },
});
