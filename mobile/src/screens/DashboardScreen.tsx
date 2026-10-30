import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { ApiService } from "../services/api";
import { formatMoney } from "../utils/money";
import { getOrderStatusBadge, getPaymentStatusBadge, getFulfillmentStatusBadge } from "../utils/status";
import { Badge } from "../components/Badge";
import { StatCard } from "../components/StatCard";
import { Colors } from "../theme/colors";
import type { DashboardData } from "../types";

export const DashboardScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();

  const [data, setData] = useState<DashboardData | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setError(null);
    const [dashRes, notifRes] = await Promise.all([
      ApiService.getDashboard(),
      ApiService.getNotifications(true),
    ]);

    if (dashRes.error) {
      setError(dashRes.error.message);
    } else if (dashRes.data) {
      setData(dashRes.data);
    }

    if (notifRes.unreadCount !== undefined) {
      setUnreadNotifications(notifRes.unreadCount);
    }

    setIsLoading(false);
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    loadDashboard();
    // 30 saniyede bir bildirimleri ve metrikleri arka planda tazele
    const interval = setInterval(loadDashboard, 30000);
    return () => clearInterval(interval);
  }, [loadDashboard]);

  const onRefresh = () => {
    setIsRefreshing(true);
    loadDashboard();
  };

  if (isLoading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.text} />
        <Text style={styles.loadingText}>Veriler yükleniyor...</Text>
      </View>
    );
  }

  const metrics = data?.metrics;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerBrand}>AREA42 ADMIN</Text>
          <Text style={styles.headerTitle}>Operasyon & Aksiyon</Text>
        </View>
        <View style={styles.headerIcons}>
          <TouchableOpacity
            onPress={() => navigation.navigate("Notifications")}
            style={styles.bellBtn}
            accessibilityLabel="Bildirimler"
          >
            <Ionicons name="notifications-outline" size={22} color={Colors.text} />
            {unreadNotifications > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>
                  {unreadNotifications > 9 ? "9+" : unreadNotifications}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onRefresh}
            style={styles.refreshIconBtn}
            accessibilityLabel="Yenile"
          >
            <Ionicons name="reload-outline" size={20} color={Colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
      >
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={loadDashboard} style={styles.retryBtn}>
              <Text style={styles.retryText}>Tekrar Dene</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* 1. Günlük Özet */}
        <Text style={styles.sectionTitle}>Bugünün Performansı</Text>
        <View style={styles.grid}>
          <StatCard
            title="Bugünkü Ciro"
            value={formatMoney(metrics?.todayRevenue ?? 0)}
            subtitle="KDV dahil satış tutarı"
          />
          <StatCard
            title="Bugünkü Sipariş"
            value={`${metrics?.todayOrderCount ?? 0} Adet`}
            subtitle="Tamamlanan / aktif"
            onPress={() => navigation.navigate("OrdersTab")}
          />
        </View>

        {/* 2. Acil Aksiyon Kuyrukları */}
        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Aksiyon Bekleyenler</Text>
        <View style={styles.grid}>
          <StatCard
            title="Havale Onayı Bekleyen"
            value={metrics?.awaitingTransferCount ?? 0}
            subtitle="Banka transferi kontrolü"
            isAlert={(metrics?.awaitingTransferCount ?? 0) > 0}
            onPress={() =>
              navigation.navigate("OrdersTab", {
                screen: "OrdersList",
                params: { paymentStatus: "AWAITING_TRANSFER" },
              })
            }
          />
          <StatCard
            title="Kargolanacak Sipariş"
            value={metrics?.unfulfilledCount ?? 0}
            subtitle="Paketleme veya sevkiyat"
            isAlert={(metrics?.unfulfilledCount ?? 0) > 0}
            onPress={() =>
              navigation.navigate("OrdersTab", {
                screen: "OrdersList",
                params: { fulfillmentStatus: "UNFULFILLED" },
              })
            }
          />
        </View>

        <View style={[styles.grid, { marginTop: 10 }]}>
          <StatCard
            title="Kritik Stok Uyarısı"
            value={metrics?.lowStockCount ?? 0}
            subtitle="5 veya daha az kalanlar"
            isAlert={(metrics?.lowStockCount ?? 0) > 0}
            onPress={() => navigation.navigate("CatalogTab", { filter: "low" })}
          />
          <StatCard
            title="Bekleyen İadeler"
            value={metrics?.pendingReturnsCount ?? 0}
            subtitle="Müşteri iade talepleri"
            isAlert={(metrics?.pendingReturnsCount ?? 0) > 0}
            onPress={() => navigation.navigate("ReturnsTab")}
          />
        </View>

        {/* 3. Son Siparişler */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Son Siparişler</Text>
          <TouchableOpacity onPress={() => navigation.navigate("OrdersTab")}>
            <Text style={styles.seeAllText}>Tümünü Gör →</Text>
          </TouchableOpacity>
        </View>

        {data?.recentOrders && data.recentOrders.length > 0 ? (
          data.recentOrders.map((order) => {
            const payBadge = getPaymentStatusBadge(order.paymentStatus);
            const fulBadge = getFulfillmentStatusBadge(order.fulfillmentStatus);

            return (
              <TouchableOpacity
                key={order.id}
                style={styles.orderCard}
                activeOpacity={0.7}
                onPress={() =>
                  navigation.navigate("OrdersTab", {
                    screen: "OrderDetail",
                    params: { orderId: order.id },
                  })
                }
              >
                <View style={styles.orderCardHeader}>
                  <Text style={styles.orderNumber}>#{order.number}</Text>
                  <Text style={styles.orderTotal}>
                    {formatMoney(order.total, order.currency)}
                  </Text>
                </View>

                <Text style={styles.customerName}>
                  {order.customer
                    ? `${order.customer.firstName} ${order.customer.lastName}`
                    : order.email}
                </Text>

                <View style={styles.badgeRow}>
                  <Badge label={payBadge.label} variant={payBadge.variant} />
                  <Badge label={fulBadge.label} variant={fulBadge.variant} />
                </View>
              </TouchableOpacity>
            );
          })
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Henüz sipariş bulunmuyor.</Text>
          </View>
        )}

        {/* 4. Kritik Stok Önizleme */}
        {data?.criticalStockItems && data.criticalStockItems.length > 0 ? (
          <>
            <View style={[styles.sectionHeaderRow, { marginTop: 20 }]}>
              <Text style={styles.sectionTitle}>Kritik Stok Listesi</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate("CatalogTab", { filter: "low" })}
              >
                <Text style={styles.seeAllText}>Stokları Yönet →</Text>
              </TouchableOpacity>
            </View>

            {data.criticalStockItems.map((item) => (
              <View key={item.id} style={styles.stockCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stockProductTitle} numberOfLines={1}>
                    {item.productTitle}
                  </Text>
                  <Text style={styles.stockVariantTitle}>
                    {item.variantTitle} {item.sku ? `• SKU: ${item.sku}` : ""}
                  </Text>
                  <Text style={styles.stockWarehouse}>Depo: {item.warehouseName}</Text>
                </View>
                <View style={styles.stockBadgeContainer}>
                  <Text style={styles.stockCountText}>{item.onHand} Adet</Text>
                  <Badge label="Kritik" variant="danger" />
                </View>
              </View>
            ))}
          </>
        ) : null}
      </ScrollView>
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
    backgroundColor: Colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerBrand: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    color: Colors.accent,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.text,
  },
  headerIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  bellBtn: {
    padding: 8,
    position: "relative",
  },
  bellBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: Colors.accent,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 3,
  },
  bellBadgeText: {
    color: Colors.textInverse,
    fontSize: 9,
    fontWeight: "700",
  },
  refreshIconBtn: {
    padding: 8,
  },
  refreshIconText: {
    fontSize: 20,
    fontWeight: "600",
    color: Colors.text,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  errorBox: {
    backgroundColor: Colors.dangerBg,
    borderColor: Colors.dangerBorder,
    borderWidth: 1,
    borderRadius: 6,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 13,
  },
  retryBtn: {
    marginTop: 8,
    alignSelf: "flex-start",
  },
  retryText: {
    color: Colors.danger,
    fontWeight: "600",
    fontSize: 12,
    textDecorationLine: "underline",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: 10,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 20,
    marginBottom: 10,
  },
  seeAllText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.accent,
  },
  grid: {
    flexDirection: "row",
    gap: 10,
  },
  orderCard: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    marginBottom: 8,
  },
  orderCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  orderNumber: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.text,
  },
  orderTotal: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.text,
  },
  customerName: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  badgeRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 10,
  },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 20,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  stockCard: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stockProductTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.text,
  },
  stockVariantTitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  stockWarehouse: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  stockBadgeContainer: {
    alignItems: "flex-end",
    gap: 4,
  },
  stockCountText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.danger,
  },
});
