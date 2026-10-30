import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import { ApiService } from "../services/api";
import { Colors } from "../theme/colors";

export const LoginScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { login, serverUrl, updateServerUrl } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Server URL config modal
  const [modalVisible, setModalVisible] = useState(false);
  const [tempUrl, setTempUrl] = useState(serverUrl);
  const [pingStatus, setPingStatus] = useState<"idle" | "testing" | "ok" | "failed">("idle");

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setErrorMessage("Lütfen e-posta ve şifrenizi giriniz");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await login(email.trim(), password);
      if (!res.success) {
        setErrorMessage(res.error ?? "Giriş başarısız");
      }
    } catch {
      setErrorMessage("Beklenmeyen bir hata oluştu");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setPingStatus("testing");
    const ok = await ApiService.pingServer(tempUrl);
    setPingStatus(ok ? "ok" : "failed");
  };

  const handleSaveServerUrl = async () => {
    await updateServerUrl(tempUrl);
    setModalVisible(false);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.brandTitle}>AREA42</Text>
          <Text style={styles.appTitle}>Yönetim Paneli</Text>
          <Text style={styles.subtitle}>Mağaza operasyonlarını mobilden yönetin</Text>
        </View>

        <View style={styles.card}>
          {errorMessage ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          <View style={styles.field}>
            <Text style={styles.label}>E-Posta</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="admin@area42.com"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Şifre</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={[styles.loginButton, isLoading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color={Colors.textInverse} />
            ) : (
              <Text style={styles.loginButtonText}>Giriş Yap</Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.serverConfigBtn}
          onPress={() => {
            setTempUrl(serverUrl);
            setPingStatus("idle");
            setModalVisible(true);
          }}
        >
          <Text style={styles.serverConfigText}>
            Sunucu: <Text style={styles.serverUrlText}>{serverUrl}</Text> ⚙️
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Server URL Modal */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Sunucu Bağlantı Adresi</Text>
            <Text style={styles.modalDesc}>
              Mobil cihazın Next.js mağaza API'sine ulaşacağı adres (örn: http://192.168.1.50:3000 veya https://magaza.com)
            </Text>

            <View style={styles.presetsRow}>
              {[
                { label: "localhost", url: "http://localhost:3000" },
                { label: "Wi-Fi (192.168.1.113)", url: "http://192.168.1.113:3000" },
                { label: "Radmin (26.193.5.144)", url: "http://26.193.5.144:3000" },
              ].map((p) => (
                <TouchableOpacity
                  key={p.url}
                  style={[
                    styles.presetPill,
                    tempUrl.trim() === p.url && styles.presetPillActive,
                  ]}
                  onPress={() => {
                    setTempUrl(p.url);
                    setPingStatus("idle");
                  }}
                >
                  <Text
                    style={[
                      styles.presetText,
                      tempUrl.trim() === p.url && styles.presetTextActive,
                    ]}
                  >
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={[styles.input, { marginTop: 10 }]}
              value={tempUrl}
              onChangeText={(t) => {
                setTempUrl(t);
                setPingStatus("idle");
              }}
              placeholder="http://192.168.1.x:3000"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.pingRow}>
              <TouchableOpacity
                style={styles.pingBtn}
                onPress={handleTestConnection}
                disabled={pingStatus === "testing"}
              >
                {pingStatus === "testing" ? (
                  <ActivityIndicator size="small" color={Colors.text} />
                ) : (
                  <Text style={styles.pingBtnText}>Bağlantıyı Test Et</Text>
                )}
              </TouchableOpacity>

              {pingStatus === "ok" && (
                <Text style={styles.pingOkText}>✓ Sunucu Erişilebilir</Text>
              )}
              {pingStatus === "failed" && (
                <Text style={styles.pingFailText}>✕ Ulaşılamadı</Text>
              )}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Vazgeç</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSaveServerUrl}
              >
                <Text style={styles.saveBtnText}>Kaydet</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  brandTitle: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 2,
    color: Colors.accent,
    marginBottom: 4,
  },
  appTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.text,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 6,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
  },
  errorBox: {
    backgroundColor: Colors.dangerBg,
    borderColor: Colors.dangerBorder,
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
    marginBottom: 16,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 12,
    fontWeight: "500",
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.text,
    marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text,
    minHeight: 44,
  },
  loginButton: {
    backgroundColor: Colors.text,
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: Colors.textInverse,
    fontSize: 14,
    fontWeight: "600",
  },
  serverConfigBtn: {
    marginTop: 24,
    alignItems: "center",
  },
  serverConfigText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  serverUrlText: {
    color: Colors.text,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.text,
  },
  modalDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  presetsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 12,
  },
  presetPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSubtle,
  },
  presetPillActive: {
    borderColor: Colors.text,
    backgroundColor: Colors.text,
  },
  presetText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: "500",
  },
  presetTextActive: {
    color: Colors.textInverse,
    fontWeight: "600",
  },
  pingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    gap: 12,
  },
  pingBtn: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 36,
    justifyContent: "center",
  },
  pingBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.text,
  },
  pingOkText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.success,
  },
  pingFailText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.danger,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 20,
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  cancelBtnText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  saveBtn: {
    backgroundColor: Colors.text,
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textInverse,
  },
});
