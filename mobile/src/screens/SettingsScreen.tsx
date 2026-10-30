import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import { ApiService } from "../services/api";
import { NotificationService } from "../services/notifications";
import { Colors } from "../theme/colors";

export const SettingsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { staff, logout, serverUrl, updateServerUrl } = useAuth();

  const [inputUrl, setInputUrl] = useState(serverUrl);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<"ok" | "failed" | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    const ok = await ApiService.pingServer(inputUrl);
    setIsTesting(false);
    setTestResult(ok ? "ok" : "failed");
  };

  const handleSaveUrl = async () => {
    if (!inputUrl.trim()) return;
    setIsSaving(true);
    await updateServerUrl(inputUrl.trim());
    setIsSaving(false);
    Alert.alert("Başarılı", "Sunucu adresi güncellendi.");
  };

  const handleLogout = () => {
    Alert.alert("Çıkış Yap", "Oturumu kapatmak istediğinize emin misiniz?", [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Çıkış Yap",
        style: "destructive",
        onPress: () => logout(),
      },
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Ayarlar & Profil</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Personel Bilgisi */}
        <View style={styles.card}>
          <Text style={styles.sectionHeading}>Giriş Yapan Personel</Text>
          <Text style={styles.staffName}>{staff?.name ?? "Yetkili"}</Text>
          <Text style={styles.staffEmail}>{staff?.email ?? ""}</Text>
          <View style={styles.roleRow}>
            <Text style={styles.roleLabel}>Yetki Rolü:</Text>
            <Text style={styles.roleVal}>
              {staff?.isOwner ? "Mağaza Sahibi (Tam Yetkili)" : staff?.role.name ?? "Yönetici"}
            </Text>
          </View>
        </View>

        {/* Sunucu Bağlantı Ayarları */}
        <View style={styles.card}>
          <Text style={styles.sectionHeading}>Sunucu Bağlantısı (API)</Text>
          <Text style={styles.sectionDesc}>
            Uygulamanın bağlandığı backend adresi. Fiziksel cihaz testi için yerel IP (örn: http://192.168.1.50:3000) kullanabilirsiniz.
          </Text>

          <TextInput
            style={styles.urlInput}
            value={inputUrl}
            onChangeText={(t) => {
              setInputUrl(t);
              setTestResult(null);
            }}
            placeholder="http://192.168.1.x:3000"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <View style={styles.testRow}>
            <TouchableOpacity
              style={styles.testBtn}
              onPress={handleTestConnection}
              disabled={isTesting}
            >
              {isTesting ? (
                <ActivityIndicator size="small" color={Colors.text} />
              ) : (
                <Text style={styles.testBtnText}>Bağlantıyı Test Et</Text>
              )}
            </TouchableOpacity>

            {testResult === "ok" && (
              <Text style={styles.testOkText}>✓ Sunucu Erişilebilir</Text>
            )}
            {testResult === "failed" && (
              <Text style={styles.testFailText}>✕ Bağlantı Başarısız</Text>
            )}
          </View>

          {inputUrl.trim() !== serverUrl.trim() && (
            <TouchableOpacity
              style={styles.saveUrlBtn}
              onPress={handleSaveUrl}
              disabled={isSaving}
            >
              <Text style={styles.saveUrlBtnText}>Adresi Kaydet</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Yetki Özeti */}
        {staff?.role.permissions && staff.role.permissions.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.sectionHeading}>Yetkili İzinler</Text>
            <View style={styles.permissionsWrap}>
              {staff.role.permissions.map((p) => (
                <View key={p} style={styles.permPill}>
                  <Text style={styles.permText}>{p}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Bildirim Testi */}
        <View style={styles.card}>
          <Text style={styles.sectionHeading}>Bildirim Sistemi</Text>
          <Text style={styles.sectionDesc}>
            Telefonunuza bildirim banner'ı ve sesin ulaşıp ulaşmadığını test edin.
          </Text>
          <TouchableOpacity
            style={styles.testNotifBtn}
            onPress={async () => {
              await NotificationService.triggerLocalNotification({
                title: "🔔 Test Bildirimi Başarılı!",
                body: "Yeni bir sipariş veya iade talebi geldiğinde telefonunuza bu şekilde sesli bildirim düşecektir.",
              });
            }}
          >
            <Text style={styles.testNotifBtnText}>📱 Telefonda Bildirimi Test Et</Text>
          </TouchableOpacity>
        </View>

        {/* Cihaz ve Uygulama Bilgisi */}
        <View style={styles.card}>
          <Text style={styles.sectionHeading}>Uygulama Bilgisi</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>Platform:</Text>
            <Text style={styles.infoVal}>
              {Platform.OS === "ios" ? "Apple iOS" : Platform.OS === "android" ? "Google Android" : Platform.OS}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>Expo Sürümü:</Text>
            <Text style={styles.infoVal}>SDK 58 (React Native 0.88)</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>Versiyon:</Text>
            <Text style={styles.infoVal}>1.0.0</Text>
          </View>
        </View>

        {/* Çıkış Yap Butonu */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutBtnText}>Oturumu Kapat (Çıkış Yap)</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
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
  sectionHeading: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: 8,
  },
  sectionDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 12,
    lineHeight: 16,
  },
  staffName: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.text,
  },
  staffEmail: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  roleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 6,
  },
  roleLabel: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  roleVal: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.accent,
  },
  urlInput: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: Colors.text,
    minHeight: 42,
  },
  testRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    gap: 12,
  },
  testBtn: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    minHeight: 34,
    justifyContent: "center",
  },
  testBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.text,
  },
  testOkText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.success,
  },
  testFailText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.danger,
  },
  saveUrlBtn: {
    backgroundColor: Colors.text,
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 12,
  },
  saveUrlBtnText: {
    color: Colors.textInverse,
    fontSize: 12,
    fontWeight: "600",
  },
  testNotifBtn: {
    backgroundColor: Colors.surfaceSubtle,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 11,
    alignItems: "center",
  },
  testNotifBtnText: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
  permissionsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  permPill: {
    backgroundColor: Colors.surfaceSubtle,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  permText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: "500",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
  },
  infoKey: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  infoVal: {
    fontSize: 12,
    fontWeight: "500",
    color: Colors.text,
  },
  logoutBtn: {
    backgroundColor: Colors.surface,
    borderColor: Colors.dangerBorder,
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  logoutBtnText: {
    color: Colors.danger,
    fontSize: 13,
    fontWeight: "600",
  },
});
