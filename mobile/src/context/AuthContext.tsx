import React, { createContext, useContext, useEffect, useState } from "react";
import { StorageService, DEFAULT_BASE_URL } from "../services/storage";
import { ApiService } from "../services/api";
import { NotificationService } from "../services/notifications";
import type { StaffUser } from "../types";

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  staff: StaffUser | null;
  serverUrl: string;
  login: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateServerUrl: (url: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [staff, setStaff] = useState<StaffUser | null>(null);
  const [serverUrl, setServerUrl] = useState<string>(DEFAULT_BASE_URL);

  useEffect(() => {
    async function init() {
      try {
        const [savedUrl, token, savedStaff] = await Promise.all([
          StorageService.getBaseUrl(),
          StorageService.getToken(),
          StorageService.getStaff(),
        ]);

        setServerUrl(savedUrl);

        if (token && savedStaff) {
          setStaff(savedStaff);
          setIsAuthenticated(true);
          NotificationService.registerForPushNotifications().catch(() => {});

          // Verify token in background
          ApiService.getMe().then((res) => {
            if (res.staff) {
              setStaff(res.staff);
              StorageService.setStaff(res.staff);
            } else if (res.error?.status === 401) {
              // Token expired
              StorageService.clearAll();
              setIsAuthenticated(false);
              setStaff(null);
            }
          });
        }
      } finally {
        setIsLoading(false);
      }
    }

    init();
  }, []);

  const login = async (email: string, pass: string) => {
    const res = await ApiService.login(email, pass);
    if (res.error || !res.token || !res.staff) {
      return { success: false, error: res.error?.message ?? "Giriş başarısız" };
    }

    await Promise.all([
      StorageService.setToken(res.token),
      StorageService.setStaff(res.staff),
    ]);

    setStaff(res.staff);
    setIsAuthenticated(true);
    NotificationService.registerForPushNotifications().catch(() => {});
    return { success: true };
  };

  const logout = async () => {
    try {
      await ApiService.logout();
    } catch {}
    await StorageService.clearAll();
    setStaff(null);
    setIsAuthenticated(false);
  };

  const updateServerUrl = async (url: string) => {
    await StorageService.setBaseUrl(url);
    const updated = await StorageService.getBaseUrl();
    setServerUrl(updated);
  };

  const refreshProfile = async () => {
    const res = await ApiService.getMe();
    if (res.staff) {
      setStaff(res.staff);
      await StorageService.setStaff(res.staff);
    }
  };

  // Yeni sipariş ve iade taleplerini otomatik izleme (iOS Expo Go & Android için anlık bildirim)
  useEffect(() => {
    if (!isAuthenticated) return;

    let isMounted = true;
    const alertedIds = new Set<string>();
    const sessionStartTime = Date.now();

    // Mevcut eski bildirimleri hafızaya al ki tekrar ses çalmasın
    ApiService.getNotifications(false).then((res) => {
      if (res.notifications) {
        res.notifications.forEach((n) => alertedIds.add(n.id));
      }
    });

    const checkNewNotifications = async () => {
      if (!isMounted) return;
      try {
        const res = await ApiService.getNotifications(true);
        if (res.notifications && res.notifications.length > 0) {
          for (const notif of res.notifications) {
            if (!alertedIds.has(notif.id)) {
              alertedIds.add(notif.id);

              const notifTime = new Date(notif.createdAt).getTime();
              // Oturum başladıktan sonra veya son 30 saniye içinde gelen bildirimse tetikle
              if (notifTime >= sessionStartTime - 30000) {
                await NotificationService.triggerLocalNotification({
                  title: notif.title,
                  body: notif.body ?? "",
                  data: {
                    id: notif.id,
                    type: notif.type,
                    link: notif.link,
                  },
                });
              }
            }
          }
        }
      } catch {}
    };

    const interval = setInterval(checkNewNotifications, 8000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isAuthenticated]);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        staff,
        serverUrl,
        login,
        logout,
        updateServerUrl,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
