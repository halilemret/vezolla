import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { ApiService } from "../services/api";
import { Colors } from "../theme/colors";
import type { AdminNotificationItem } from "../types";

export const NotificationsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();

  const [notifications, setNotifications] = useState<AdminNotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    setError(null);
    const res = await ApiService.getNotifications(false);
    if (res.error) {
      setError(res.error.message);
    } else if (res.notifications) {
      setNotifications(res.notifications);
      setUnreadCount(res.unreadCount ?? 0);
    }
    setIsLoading(false);
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchNotifications();
  };

  const handleMarkAllRead = async () => {
    await ApiService.markAllNotificationsRead();
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() }))
    );
    setUnreadCount(0);
  };

  const handleNotificationPress = async (item: AdminNotificationItem) => {
    // Okundu olarak işaretle
    if (!item.readAt) {
      ApiService.markNotificationRead(item.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }

    // Hedef ekrana yönlendir
    if (item.type.includes("order")) {
      // Link örn: "/admin/siparisler/cuid..."
      const orderId = item.link?.split("/").pop();
      if (orderId && orderId !== "siparisler") {
        navigation.navigate("OrdersTab", {
          screen: "OrderDetail",
          params: { orderId },
        });
      } else {
        navigation.navigate("OrdersTab");
      }
    } else if (item.type.includes("return")) {
      navigation.navigate("ReturnsTab");
    }
  };

  const renderItem = ({ item }: { item: AdminNotificationItem }) => {
    const isUnread = !item.readAt;
    const isOrder = item.type.includes("order");
    const isReturn = item.type.includes("return");

    return (
      <TouchableOpacity
        style={[styles.card, isUnread && styles.cardUnread]}
        activeOpacity={0.7}
        onPress={() => handleNotificationPress(item)}
      >
        <View style={styles.iconCol}>
          <View
            style={[
              styles.iconWrapper,
              isOrder
                ? { backgroundColor: Colors.surfaceSubtle }
                : isReturn
                ? { backgroundColor: Colors.warningBg }
                : { backgroundColor: Colors.surfaceSubtle },
            ]}
          >
            <Ionicons
              name={
                isOrder
                  ? "receipt-outline"
                  : isReturn
                  ? "repeat-outline"
                  : "notifications-outline"
              }
              size={18}
              color={isReturn ? Colors.warning : Colors.text}
            />
          </View>
        </View>

        <View style={styles.contentCol}>
          <View style={styles.topRow}>
            <Text style={[styles.title, isUnread && styles.titleUnread]}>
              {item.title}
            </Text>
            {isUnread && <View style={styles.unreadDot} />}
          </View>

          {item.body ? <Text style={styles.body}>{item.body}</Text> : null}

          <Text style={styles.timeText}>
            {new Date(item.createdAt).toLocaleString("tr-TR", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Geri</Text>
        </TouchableOpacity>
        <View style={styles.titleWrap}>
          <Text style={styles.headerTitle}>Bildirimler</Text>
          {unreadCount > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllBtn}>
            <Text style={styles.markAllText}>Tümünü Oku</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 60 }} />
        )}
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={fetchNotifications}>
            <Text style={styles.retryText}>Yenile</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {isLoading && !isRefreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.text} />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="notifications-off-outline" size={36} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>Bildirim Yok</Text>
              <Text style={styles.emptySubtitle}>
                Yeni bir sipariş veya iade talebi geldiğinde burada listelenecektir.
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    paddingVertical: 4,
    paddingRight: 10,
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text,
  },
  titleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.text,
  },
  countBadge: {
    backgroundColor: Colors.accent,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  countBadgeText: {
    color: Colors.textInverse,
    fontSize: 10,
    fontWeight: "700",
  },
  markAllBtn: {
    paddingVertical: 4,
  },
  markAllText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.accent,
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
    padding: 12,
    marginBottom: 8,
    flexDirection: "row",
    gap: 12,
  },
  cardUnread: {
    borderColor: Colors.borderDark,
    backgroundColor: "#fffdfc",
  },
  iconCol: {
    justifyContent: "flex-start",
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  contentCol: {
    flex: 1,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.text,
    flex: 1,
  },
  titleUnread: {
    fontWeight: "700",
    color: Colors.text,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent,
    marginLeft: 6,
  },
  body: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 3,
    lineHeight: 16,
  },
  timeText: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 6,
  },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.text,
  },
  emptySubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: "center",
    lineHeight: 16,
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
});
