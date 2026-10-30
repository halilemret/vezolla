import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { ApiService } from "./api";

// Uygulama açıkken (foreground) gelen bildirimlerin ses ve banner ile gösterilmesi
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
    priority: Notifications.AndroidNotificationPriority.HIGH,
  }),
});

export const NotificationService = {
  /**
   * Cihaz push bildirim iznini ister.
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        return false;
      }

      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("orders-and-returns", {
          name: "Sipariş ve İade Bildirimleri",
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#9a3412",
          sound: "default",
        });
      }

      return true;
    } catch (err) {
      console.warn("[Push] İzin alma hatası:", err);
      return false;
    }
  },

  /**
   * Cihaz push bildirim token'ını alır ve sunucuya kaydeder (Üretim/EAS build ve Android Expo Go için).
   */
  async registerForPushNotifications(): Promise<string | null> {
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) return null;

    try {
      // Not: iOS Expo Go'da Apple APNs token dağıtımını kısıtlar.
      // Standart EAS Build veya Android'de Expo Push Token döner.
      const tokenData = await Notifications.getExpoPushTokenAsync().catch((err) => {
        console.log("[Push] Expo Go remote token kısıtlaması (normaldir):", err?.message);
        return null;
      });

      if (!tokenData?.data) {
        return null;
      }

      const token = tokenData.data;

      await ApiService.registerPushToken(
        token,
        Platform.OS,
        `${Device.brand ?? ""} ${Device.modelName ?? ""}`.trim()
      );

      return token;
    } catch (error) {
      console.log("[Push] Token kaydı atlandı:", error);
      return null;
    }
  },

  /**
   * Cihazda yerel sistem bildirimi tetikler (iOS Expo Go ve Android'de anında ses ve banner gösterir).
   */
  async triggerLocalNotification(params: {
    title: string;
    body: string;
    data?: Record<string, unknown>;
  }): Promise<void> {
    await this.requestPermissions();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: params.title,
        body: params.body,
        data: params.data ?? {},
        sound: "default",
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null, // null anında gösterme anlamına gelir
    });
  },
};
