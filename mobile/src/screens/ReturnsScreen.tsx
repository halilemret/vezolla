import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiService } from "../services/api";
import { formatMoney } from "../utils/money";
import { getReturnStatusBadge } from "../utils/status";
import { Badge } from "../components/Badge";
import { Colors } from "../theme/colors";
import type { ReturnRequestSummary } from "../types";

export const ReturnsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<"REQUESTED" | "ALL">("REQUESTED");
  const [returns, setReturns] = useState<ReturnRequestSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchReturns = useCallback(async () => {
    setError(null);
    setIsLoading(true);

    const res = await ApiService.getReturns(activeTab);
    if (res.error) {
      setError(res.error.message);
    } else if (res.returns) {
      setReturns(res.returns);
    }

    setIsLoading(false);
    setIsRefreshing(false);
  }, [activeTab]);

  useEffect(() => {
    fetchReturns();
  }, [fetchReturns]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchReturns();
  };

  const handleAction = (
    returnId: string,
    action: "approve" | "reject" | "receive",
    title: string
  ) => {
    Alert.alert(
      title,
      `Bu iade talebini "${action === "approve" ? "onaylamak" : action === "reject" ? "reddetmek" : "teslim alındı işaretlemek"}" istediğinize emin misiniz?`,
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Evet, Uygula",
          style: action === "reject" ? "destructive" : "default",
          onPress: async () => {
            setActionLoadingId(returnId);
            const res = await ApiService.updateReturnStatus(returnId, action);
            setActionLoadingId(null);

            if (res.error) {
              Alert.alert("Hata", res.error.message);
            } else {
              fetchReturns();
            }
          },
        },
      ]
    );
  };

  const renderReturnItem = ({ item }: { item: ReturnRequestSummary }) => {
    const badge = getReturnStatusBadge(item.status);
    const isActionPending = actionLoadingId === item.id;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.orderNumber}>
            Sipariş #{item.order?.number ?? "Bilinmiyor"}
          </Text>
          <Badge label={badge.label} variant={badge.variant} />
        </View>

        <Text style={styles.customerName}>
          {item.order?.customer
            ? `${item.order.customer.firstName} ${item.order.customer.lastName}`
            : item.order?.email ?? ""}
        </Text>

        {item.reason ? (
          <View style={styles.reasonBox}>
            <Text style={styles.reasonLabel}>İade Nedeni:</Text>
            <Text style={styles.reasonText}>{item.reason}</Text>
          </View>
        ) : null}

        {item.customerNote ? (
          <View style={styles.noteBox}>
            <Text style={styles.noteLabel}>Müşteri Açıklaması:</Text>
            <Text style={styles.noteText}>{item.customerNote}</Text>
          </View>
        ) : null}

        {item.refundAmount ? (
          <View style={styles.refundRow}>
            <Text style={styles.refundLabel}>İade Edilecek Tutar:</Text>
            <Text style={styles.refundVal}>{formatMoney(item.refundAmount)}</Text>
          </View>
        ) : null}

        <Text style={styles.dateText}>
          Talep Tarihi: {new Date(item.createdAt).toLocaleString("tr-TR")}
        </Text>

        {/* Action Buttons */}
        {item.status === "REQUESTED" && (
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.rejectBtn, isActionPending && styles.btnDisabled]}
              onPress={() => handleAction(item.id, "reject", "İadeyi Reddet")}
              disabled={isActionPending}
            >
              <Text style={styles.rejectBtnText}>Reddet</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.approveBtn, isActionPending && styles.btnDisabled]}
              onPress={() => handleAction(item.id, "approve", "İadeyi Onayla")}
              disabled={isActionPending}
            >
              <Text style={styles.approveBtnText}>Onayla (Kargo Bekle)</Text>
            </TouchableOpacity>
          </View>
        )}

        {item.status === "APPROVED" && (
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.receiveBtn, isActionPending && styles.btnDisabled]}
              onPress={() => handleAction(item.id, "receive", "İadeyi Teslim Al")}
              disabled={isActionPending}
            >
              <Text style={styles.receiveBtnText}>✓ Kargo Teslim Alındı</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>İade Talepleri</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === "REQUESTED" && styles.tabBtnActive]}
          onPress={() => setActiveTab("REQUESTED")}
        >
          <Text style={[styles.tabBtnText, activeTab === "REQUESTED" && styles.tabBtnTextActive]}>
            Onay Bekleyenler
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === "ALL" && styles.tabBtnActive]}
          onPress={() => setActiveTab("ALL")}
        >
          <Text style={[styles.tabBtnText, activeTab === "ALL" && styles.tabBtnTextActive]}>
            Tüm İadeler
          </Text>
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={fetchReturns}>
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
          data={returns}
          keyExtractor={(item) => item.id}
          renderItem={renderReturnItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>İade Talebi Yok</Text>
              <Text style={styles.emptySubtitle}>
                {activeTab === "REQUESTED"
                  ? "İşlem bekleyen yeni bir iade talebi bulunmuyor."
                  : "Kayıtlı herhangi bir iade bulunamadı."}
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
  tabsRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
    gap: 10,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
  },
  tabBtnActive: {
    backgroundColor: Colors.text,
    borderColor: Colors.text,
  },
  tabBtnText: {
    fontSize: 12,
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
    alignItems: "center",
  },
  orderNumber: {
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
  reasonBox: {
    marginTop: 8,
    padding: 8,
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: 6,
  },
  reasonLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  reasonText: {
    fontSize: 12,
    color: Colors.text,
    marginTop: 2,
  },
  noteBox: {
    marginTop: 6,
    padding: 8,
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: 6,
  },
  noteLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  noteText: {
    fontSize: 12,
    color: Colors.text,
    marginTop: 2,
  },
  refundRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  refundLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  refundVal: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.text,
  },
  dateText: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 8,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  approveBtn: {
    flex: 2,
    backgroundColor: Colors.text,
    borderRadius: 6,
    paddingVertical: 9,
    alignItems: "center",
  },
  approveBtnText: {
    color: Colors.textInverse,
    fontSize: 12,
    fontWeight: "600",
  },
  rejectBtn: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderColor: Colors.dangerBorder,
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 9,
    alignItems: "center",
  },
  rejectBtnText: {
    color: Colors.danger,
    fontSize: 12,
    fontWeight: "600",
  },
  receiveBtn: {
    flex: 1,
    backgroundColor: Colors.success,
    borderRadius: 6,
    paddingVertical: 9,
    alignItems: "center",
  },
  receiveBtnText: {
    color: Colors.textInverse,
    fontSize: 12,
    fontWeight: "600",
  },
  btnDisabled: {
    opacity: 0.6,
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
});
