import AsyncStorage from "@react-native-async-storage/async-storage";
import type { StaffUser } from "../types";

const KEY_TOKEN = "eticaret_admin_token";
const KEY_STAFF = "eticaret_admin_staff";
const KEY_BASE_URL = "eticaret_admin_base_url";

export const DEFAULT_BASE_URL = "http://localhost:3000";

export const StorageService = {
  async getToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(KEY_TOKEN);
    } catch {
      return null;
    }
  },

  async setToken(token: string): Promise<void> {
    try {
      await AsyncStorage.setItem(KEY_TOKEN, token);
    } catch {}
  },

  async removeToken(): Promise<void> {
    try {
      await AsyncStorage.removeItem(KEY_TOKEN);
    } catch {}
  },

  async getStaff(): Promise<StaffUser | null> {
    try {
      const data = await AsyncStorage.getItem(KEY_STAFF);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  async setStaff(staff: StaffUser): Promise<void> {
    try {
      await AsyncStorage.setItem(KEY_STAFF, JSON.stringify(staff));
    } catch {}
  },

  async removeStaff(): Promise<void> {
    try {
      await AsyncStorage.removeItem(KEY_STAFF);
    } catch {}
  },

  async getBaseUrl(): Promise<string> {
    try {
      const url = await AsyncStorage.getItem(KEY_BASE_URL);
      return url && url.trim().length > 0 ? url.trim() : DEFAULT_BASE_URL;
    } catch {
      return DEFAULT_BASE_URL;
    }
  },

  async setBaseUrl(url: string): Promise<void> {
    try {
      const cleanUrl = url.trim().replace(/\/+$/, "");
      await AsyncStorage.setItem(KEY_BASE_URL, cleanUrl);
    } catch {}
  },

  async clearAll(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([KEY_TOKEN, KEY_STAFF]);
    } catch {}
  },
};
