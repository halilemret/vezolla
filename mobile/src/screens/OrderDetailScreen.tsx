import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, useNavigation } from "@react-navigation/native";
import { ApiService } from "../services/api";
import { formatMoney } from "../utils/money";
import {
  getOrderStatusBadge,
  getPaymentStatusBadge,
  getFulfillmentStatusBadge,
} from "../utils/status";
import { Badge } from "../components/Badge";
import { Colors } from "../theme/colors";
import type { OrderDetail } from "../types";

export const OrderDetailScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();
  const navigation = useNavigation();
  const orderId = route.params?.orderId;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fulfillment Modal
  const [fulfillModalVisible, setFulfillModalVisible] = useState(false);
  const [carrier, setCarrier] = useState("yurtici");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [isFulfilling, setIsFulfilling] = useState(false);

  // Note Modal
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [isAddingNote, setIsAddingNote] = useState(false);

  // Action Loading
  const [actionLoading, setActionLoading] = useState(false);

  const loadOrderDetail = useCallback(async () => {
    if (!orderId) return;
    setError(null);
    const res = await ApiService.getOrder(orderId);
    if (res.error) {
      setError(res.error.message);
    } else if (res.order) {
      setOrder(res.order);
    }
    setIsLoading(false);
  }, [orderId]);

  useEffect(() => {
    loadOrderDetail();
  }, [loadOrderDetail]);

  // Actions
  const handleMarkPaid = () => {
    Alert.alert(
      "Havale Ödemesini Onayla",
      "Bu sipariş için banka havalesi tahsilatını onaylamak istiyor musunuz?",
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Ödemeyi Onayla",
          onPress: async () => {
            setActionLoading(true);
            const res = await ApiService.markOrderPaid(orderId);
            setActionLoading(false);
            if (res.error) {
              Alert.alert("Hata", res.error.message);
            } else {
              loadOrderDetail();
            }
          },
        },
      ]
    );
  };

  const handleFulfillSubmit = async () => {
    setIsFulfilling(true);
    const res = await ApiService.fulfillOrder({
      orderId,
      carrier,
      trackingNumber: trackingNumber.trim() || null,
    });
    setIsFulfilling(false);

    if (res.error) {
      Alert.alert("Hata", res.error.message);
    } else {
      setFulfillModalVisible(false);
      setTrackingNumber("");
      loadOrderDetail();
    }
  };

  const handleMarkDelivered = (fulfillmentId: string) => {
    Alert.alert(
      "Teslim Edildi İşaretle",
      "Kargo paketinin müşteriye teslim edildiğini onaylıyor musunuz?",
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Teslim Edildi",
          onPress: async () => {
            setActionLoading(true);
            const res = await ApiService.markDelivered(orderId, fulfillmentId);
            setActionLoading(false);
            if (res.error) {
              Alert.alert("Hata", res.error.message);
            } else {
              loadOrderDetail();
            }
          },
        },
      ]
    );
  };

  const handleAddNoteSubmit = async () => {
    if (!noteText.trim()) return;
    setIsAddingNote(true);
    const res = await ApiService.addOrderNote(orderId, noteText.trim());
    setIsAddingNote(false);

    if (res.error) {
      Alert.alert("Hata", res.error.message);
    } else {
      setNoteModalVisible(false);
      setNoteText("");
      loadOrderDetail();
    }
  };

  const handleCancelOrder = () => {
    Alert.alert(
      "Siparişi İptal Et",
      "Siparişi iptal etmek istediğinize emin misiniz? Bu işlem geri alınamaz.",
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Siparişi İptal Et",
          style: "destructive",
          onPress: async () => {
            setActionLoading(true);
            const res = await ApiService.cancelOrder(orderId, "Mobil yönetim panelinden iptal edildi");
            setActionLoading(false);
            if (res.error) {
              Alert.alert("Hata", res.error.message);
            } else {
              loadOrderDetail();
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.text} />
        <Text style={styles.loadingText}>Sipariş yükleniyor...</Text>
      </View>
    );
  }

  if (error || !order) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>{error ?? "Sipariş bulunamadı"}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={loadOrderDetail}>
          <Text style={styles.retryText}>Tekrar Dene</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const payBadge = getPaymentStatusBadge(order.paymentStatus);
  const fulBadge = getFulfillmentStatusBadge(order.fulfillmentStatus);
  const ordBadge = getOrderStatusBadge(order.status);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Geri</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sipariş #{order.number}</Text>
        <TouchableOpacity onPress={() => setNoteModalVisible(true)} style={styles.noteIconBtn}>
          <Text style={styles.noteIconText}>+ Not</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Status Card */}
        <View style={styles.card}>
          <View style={styles.badgesRow}>
            <Badge label={ordBadge.label} variant={ordBadge.variant} />
            <Badge label={payBadge.label} variant={payBadge.variant} />
            <Badge label={fulBadge.label} variant={fulBadge.variant} />
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Tarih:</Text>
            <Text style={styles.metaVal}>
              {new Date(order.placedAt).toLocaleString("tr-TR")}
            </Text>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Toplam Tutar:</Text>
            <Text style={styles.metaValHighlight}>
              {formatMoney(order.total, order.currency)}
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionSection}>
          {order.paymentStatus === "AWAITING_TRANSFER" && order.status === "OPEN" && (
            <TouchableOpacity
              style={[styles.primaryActionBtn, actionLoading && styles.btnDisabled]}
              onPress={handleMarkPaid}
              disabled={actionLoading}
            >
              <Text style={styles.primaryActionText}>✓ Havale Ödemesini Onayla</Text>
            </TouchableOpacity>
          )}

          {(order.fulfillmentStatus === "UNFULFILLED" ||
            order.fulfillmentStatus === "PREPARING") &&
            order.status === "OPEN" && (
              <TouchableOpacity
                style={[styles.accentActionBtn, actionLoading && styles.btnDisabled]}
                onPress={() => setFulfillModalVisible(true)}
                disabled={actionLoading}
              >
                <Text style={styles.accentActionText}>📦 Kargoya Ver / Gönder</Text>
              </TouchableOpacity>
            )}

          {order.status === "OPEN" && (
            <TouchableOpacity
              style={styles.cancelActionBtn}
              onPress={handleCancelOrder}
              disabled={actionLoading}
            >
              <Text style={styles.cancelActionText}>Siparişi İptal Et</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Müşteri ve Teslimat Bilgileri */}
        <View style={styles.card}>
          <Text style={styles.cardHeading}>Müşteri ve Teslimat</Text>
          <Text style={styles.clientName}>
            {order.shippingAddress.firstName} {order.shippingAddress.lastName}
          </Text>
          <Text style={styles.clientContact}>{order.email}</Text>
          {order.phone ? <Text style={styles.clientContact}>{order.phone}</Text> : null}

          <View style={styles.divider} />

          <Text style={styles.addressTitle}>Teslimat Adresi:</Text>
          <Text style={styles.addressLine}>{order.shippingAddress.addressLine1}</Text>
          {order.shippingAddress.addressLine2 ? (
            <Text style={styles.addressLine}>{order.shippingAddress.addressLine2}</Text>
          ) : null}
          <Text style={styles.addressLine}>
            {order.shippingAddress.district} / {order.shippingAddress.city}
          </Text>
        </View>

        {/* Sipariş Kalemleri */}
        <View style={styles.card}>
          <Text style={styles.cardHeading}>Sipariş Kalemleri ({order.items.length})</Text>
          {order.items.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                {item.variantTitle ? (
                  <Text style={styles.itemVariant}>{item.variantTitle}</Text>
                ) : null}
                {item.sku ? <Text style={styles.itemSku}>SKU: {item.sku}</Text> : null}
                <Text style={styles.itemPriceDetail}>
                  {item.quantity} adet x {formatMoney(item.unitPrice, order.currency)}
                </Text>
              </View>
              <Text style={styles.itemTotal}>
                {formatMoney(item.total, order.currency)}
              </Text>
            </View>
          ))}

          <View style={styles.divider} />

          {/* Döküm */}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Ara Toplam</Text>
            <Text style={styles.summaryVal}>{formatMoney(order.subtotal, order.currency)}</Text>
          </View>
          {order.discountTotal > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>İndirim</Text>
              <Text style={[styles.summaryVal, { color: Colors.success }]}>
                -{formatMoney(order.discountTotal, order.currency)}
              </Text>
            </View>
          )}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Kargo Ücreti</Text>
            <Text style={styles.summaryVal}>
              {order.shippingTotal === 0
                ? "Ücretsiz"
                : formatMoney(order.shippingTotal, order.currency)}
            </Text>
          </View>
          <View style={[styles.summaryRow, { marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderColor: Colors.border }]}>
            <Text style={styles.summaryTotalLabel}>Genel Toplam</Text>
            <Text style={styles.summaryTotalVal}>{formatMoney(order.total, order.currency)}</Text>
          </View>
        </View>

        {/* Gönderimler / Kargo Takip */}
        {order.fulfillments && order.fulfillments.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardHeading}>Gönderimler</Text>
            {order.fulfillments.map((f) => (
              <View key={f.id} style={styles.fulfillmentItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fCarrier}>
                    Kargo: {f.carrier?.toUpperCase() ?? "Standart"}
                  </Text>
                  {f.trackingNumber ? (
                    <Text style={styles.fTracking}>Takip No: {f.trackingNumber}</Text>
                  ) : null}
                  <Text style={styles.fDate}>
                    {new Date(f.createdAt).toLocaleDateString("tr-TR")}
                  </Text>
                </View>
                {f.status === "SHIPPED" && (
                  <TouchableOpacity
                    style={styles.deliverBtn}
                    onPress={() => handleMarkDelivered(f.id)}
                  >
                    <Text style={styles.deliverBtnText}>Teslim Edildi</Text>
                  </TouchableOpacity>
                )}
                {f.status === "DELIVERED" && (
                  <Badge label="Teslim Edildi" variant="success" />
                )}
              </View>
            ))}
          </View>
        ) : null}

        {/* Notlar ve Geçmiş */}
        {order.events && order.events.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardHeading}>Sipariş Geçmişi & Notlar</Text>
            {order.events.map((e) => (
              <View key={e.id} style={styles.eventRow}>
                <Text style={styles.eventMsg}>{e.message}</Text>
                <Text style={styles.eventDate}>
                  {new Date(e.createdAt).toLocaleString("tr-TR")}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      {/* Kargoya Ver Modalı */}
      <Modal visible={fulfillModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Kargoya Ver</Text>
            <Text style={styles.modalSub}>
              Gönderi taşıyıcı firmasını ve takip numarasını belirleyin.
            </Text>

            <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Kargo Firması</Text>
            <View style={styles.carrierGrid}>
              {[
                { id: "yurtici", title: "Yurtiçi" },
                { id: "aras", title: "Aras" },
                { id: "mng", title: "MNG" },
                { id: "surat", title: "Sürat" },
              ].map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.carrierOption, carrier === c.id && styles.carrierOptionActive]}
                  onPress={() => setCarrier(c.id)}
                >
                  <Text
                    style={[styles.carrierText, carrier === c.id && styles.carrierTextActive]}
                  >
                    {c.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Kargo Takip No (Opsiyonel)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Örn: 123456789012"
              placeholderTextColor={Colors.textMuted}
              value={trackingNumber}
              onChangeText={setTrackingNumber}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setFulfillModalVisible(false)}
                disabled={isFulfilling}
              >
                <Text style={styles.cancelBtnText}>Vazgeç</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={handleFulfillSubmit}
                disabled={isFulfilling}
              >
                {isFulfilling ? (
                  <ActivityIndicator size="small" color={Colors.textInverse} />
                ) : (
                  <Text style={styles.confirmBtnText}>Kargolandı Olarak Kaydet</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Personel Notu Modalı */}
      <Modal visible={noteModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Personel Notu Ekle</Text>
            <Text style={styles.modalSub}>Bu not sipariş geçmişine işlenecektir.</Text>

            <TextInput
              style={[styles.modalInput, { height: 80, textAlignVertical: "top", marginTop: 12 }]}
              multiline
              placeholder="Örn: Müşteri arandı, teslimat tarihi teyit edildi."
              placeholderTextColor={Colors.textMuted}
              value={noteText}
              onChangeText={setNoteText}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setNoteModalVisible(false)}
                disabled={isAddingNote}
              >
                <Text style={styles.cancelBtnText}>Vazgeç</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={handleAddNoteSubmit}
                disabled={isAddingNote || !noteText.trim()}
              >
                {isAddingNote ? (
                  <ActivityIndicator size="small" color={Colors.textInverse} />
                ) : (
                  <Text style={styles.confirmBtnText}>Notu Kaydet</Text>
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
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  errorText: {
    fontSize: 13,
    color: Colors.danger,
    textAlign: "center",
  },
  retryBtn: {
    marginTop: 12,
    padding: 8,
  },
  retryText: {
    color: Colors.accent,
    fontWeight: "600",
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
  backBtn: {
    paddingVertical: 4,
    paddingRight: 10,
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.text,
  },
  noteIconBtn: {
    paddingVertical: 4,
    paddingLeft: 10,
  },
  noteIconText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.accent,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  badgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  metaLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  metaVal: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: "500",
  },
  metaValHighlight: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.text,
  },
  actionSection: {
    gap: 8,
    marginBottom: 12,
  },
  primaryActionBtn: {
    backgroundColor: Colors.success,
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryActionText: {
    color: Colors.textInverse,
    fontSize: 13,
    fontWeight: "600",
  },
  accentActionBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: "center",
  },
  accentActionText: {
    color: Colors.textInverse,
    fontSize: 13,
    fontWeight: "600",
  },
  cancelActionBtn: {
    backgroundColor: Colors.surface,
    borderColor: Colors.dangerBorder,
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: "center",
  },
  cancelActionText: {
    color: Colors.danger,
    fontSize: 12,
    fontWeight: "600",
  },
  btnDisabled: {
    opacity: 0.6,
  },
  cardHeading: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: 10,
  },
  clientName: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text,
  },
  clientContact: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 10,
  },
  addressTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  addressLine: {
    fontSize: 13,
    color: Colors.text,
    lineHeight: 18,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.text,
  },
  itemVariant: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  itemSku: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  itemPriceDetail: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
  },
  itemTotal: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.text,
    marginLeft: 10,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  summaryLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  summaryVal: {
    fontSize: 12,
    color: Colors.text,
    fontWeight: "500",
  },
  summaryTotalLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.text,
  },
  summaryTotalVal: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.text,
  },
  fulfillmentItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  fCarrier: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.text,
  },
  fTracking: {
    fontSize: 12,
    color: Colors.accent,
    marginTop: 2,
  },
  fDate: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  deliverBtn: {
    backgroundColor: Colors.successBg,
    borderColor: Colors.successBorder,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  deliverBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.success,
  },
  eventRow: {
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  eventMsg: {
    fontSize: 12,
    color: Colors.text,
  },
  eventDate: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
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
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.text,
  },
  carrierGrid: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },
  carrierOption: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
  },
  carrierOptionActive: {
    borderColor: Colors.text,
    backgroundColor: Colors.surfaceSubtle,
  },
  carrierText: {
    fontSize: 12,
    fontWeight: "500",
    color: Colors.textSecondary,
  },
  carrierTextActive: {
    color: Colors.text,
    fontWeight: "700",
  },
  modalInput: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
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
