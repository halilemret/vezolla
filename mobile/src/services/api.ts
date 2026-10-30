import { StorageService } from "./storage";
import type {
  AdminNotificationItem,
  DashboardData,
  OrderDetail,
  OrderSummary,
  ProductSummary,
  ReturnRequestSummary,
  StaffUser,
} from "../types";

export interface ApiError {
  message: string;
  status?: number;
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<{ data?: T; error?: ApiError }> {
  try {
    const [baseUrl, token] = await Promise.all([
      StorageService.getBaseUrl(),
      StorageService.getToken(),
    ]);

    const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
    const headers = new Headers(options.headers || {});

    if (!headers.has("Content-Type") && options.body && typeof options.body === "string") {
      headers.set("Content-Type", "application/json");
    }

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const contentType = response.headers.get("content-type");
    const isJson = contentType && contentType.includes("application/json");
    const json = isJson ? await response.json() : null;

    if (!response.ok) {
      return {
        error: {
          message: json?.error || `İşlem başarısız oldu (${response.status})`,
          status: response.status,
        },
      };
    }

    return { data: json as T };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ağ bağlantısı kurulamadı";
    return {
      error: {
        message:
          message.includes("Network request failed") || message.includes("Failed to fetch")
            ? "Sunucuya bağlanılamadı. Ayarlardan sunucu adresini (IP) kontrol ediniz."
            : message,
      },
    };
  }
}

export const ApiService = {
  // Auth
  async login(email: string, password: string): Promise<{
    token?: string;
    staff?: StaffUser;
    error?: ApiError;
  }> {
    const res = await request<{ token: string; staff: StaffUser }>(
      "/api/admin/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }
    );

    if (res.error) {
      return { error: res.error };
    }
    return res.data || {};
  },

  async logout(): Promise<void> {
    await request("/api/admin/auth/logout", { method: "POST" });
  },

  async getMe(): Promise<{ staff?: StaffUser; error?: ApiError }> {
    const res = await request<{ staff: StaffUser }>("/api/admin/auth/me");
    if (res.error) return { error: res.error };
    return res.data || {};
  },

  // Dashboard
  async getDashboard(): Promise<{ data?: DashboardData; error?: ApiError }> {
    return await request<DashboardData>("/api/admin/dashboard");
  },

  // Orders
  async getOrders(params: {
    page?: number;
    limit?: number;
    status?: string;
    paymentStatus?: string;
    fulfillmentStatus?: string;
    search?: string;
  } = {}): Promise<{
    orders?: OrderSummary[];
    pagination?: { page: number; limit: number; total: number; totalPages: number };
    error?: ApiError;
  }> {
    const query = new URLSearchParams();
    if (params.page) query.set("page", String(params.page));
    if (params.limit) query.set("limit", String(params.limit));
    if (params.status) query.set("status", params.status);
    if (params.paymentStatus) query.set("paymentStatus", params.paymentStatus);
    if (params.fulfillmentStatus) query.set("fulfillmentStatus", params.fulfillmentStatus);
    if (params.search) query.set("search", params.search);

    const qs = query.toString();
    const res = await request<{
      orders: OrderSummary[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/api/admin/orders${qs ? `?${qs}` : ""}`);

    if (res.error) return { error: res.error };
    return res.data || {};
  },

  async getOrder(id: string): Promise<{ order?: OrderDetail; error?: ApiError }> {
    const res = await request<{ order: OrderDetail }>(`/api/admin/orders/${id}`);
    if (res.error) return { error: res.error };
    return res.data || {};
  },

  async markOrderPaid(orderId: string, note?: string): Promise<{ ok?: boolean; error?: ApiError }> {
    const res = await request<{ ok: boolean }>(`/api/admin/orders/${orderId}`, {
      method: "PATCH",
      body: JSON.stringify({ action: "mark_paid", note }),
    });
    if (res.error) return { error: res.error };
    return res.data || {};
  },

  async fulfillOrder(params: {
    orderId: string;
    carrier: string;
    trackingNumber?: string | null;
    warehouseId?: string | null;
  }): Promise<{ ok?: boolean; fulfillmentId?: string; error?: ApiError }> {
    const res = await request<{ ok: boolean; fulfillmentId?: string }>(
      `/api/admin/orders/${params.orderId}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          action: "fulfill",
          carrier: params.carrier,
          trackingNumber: params.trackingNumber,
          warehouseId: params.warehouseId,
        }),
      }
    );
    if (res.error) return { error: res.error };
    return res.data || {};
  },

  async markDelivered(orderId: string, fulfillmentId: string): Promise<{ ok?: boolean; error?: ApiError }> {
    const res = await request<{ ok: boolean }>(`/api/admin/orders/${orderId}`, {
      method: "PATCH",
      body: JSON.stringify({ action: "deliver", fulfillmentId }),
    });
    if (res.error) return { error: res.error };
    return res.data || {};
  },

  async cancelOrder(orderId: string, reason: string): Promise<{ ok?: boolean; error?: ApiError }> {
    const res = await request<{ ok: boolean }>(`/api/admin/orders/${orderId}`, {
      method: "PATCH",
      body: JSON.stringify({ action: "cancel", reason }),
    });
    if (res.error) return { error: res.error };
    return res.data || {};
  },

  async addOrderNote(
    orderId: string,
    content: string,
    isCustomerVisible = false
  ): Promise<{ ok?: boolean; error?: ApiError }> {
    const res = await request<{ ok: boolean }>(`/api/admin/orders/${orderId}`, {
      method: "PATCH",
      body: JSON.stringify({
        action: "add_note",
        content,
        isCustomerVisible,
      }),
    });
    if (res.error) return { error: res.error };
    return res.data || {};
  },

  // Products
  async getProducts(params: {
    page?: number;
    limit?: number;
    search?: string;
    stock?: "all" | "low" | "out";
    categoryId?: string;
  } = {}): Promise<{
    products?: ProductSummary[];
    pagination?: { page: number; limit: number; total: number; totalPages: number };
    error?: ApiError;
  }> {
    const query = new URLSearchParams();
    if (params.page) query.set("page", String(params.page));
    if (params.limit) query.set("limit", String(params.limit));
    if (params.search) query.set("search", params.search);
    if (params.stock) query.set("stock", params.stock);
    if (params.categoryId) query.set("categoryId", params.categoryId);

    const qs = query.toString();
    const res = await request<{
      products: ProductSummary[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/api/admin/products${qs ? `?${qs}` : ""}`);

    if (res.error) return { error: res.error };
    return res.data || {};
  },

  async adjustStock(params: {
    variantId: string;
    warehouseId?: string;
    quantity: number;
    type?: "COUNT" | "ADJUST" | "RECEIVE";
    mode?: "set" | "delta";
    reason?: string;
  }): Promise<{ ok?: boolean; message?: string; error?: ApiError }> {
    const res = await request<{ ok: boolean; message: string }>(
      "/api/admin/products/stock",
      {
        method: "POST",
        body: JSON.stringify(params),
      }
    );
    if (res.error) return { error: res.error };
    return res.data || {};
  },

  // Returns
  async getReturns(status = "ALL"): Promise<{
    returns?: ReturnRequestSummary[];
    error?: ApiError;
  }> {
    const res = await request<{ returns: ReturnRequestSummary[] }>(
      `/api/admin/returns?status=${status}`
    );
    if (res.error) return { error: res.error };
    return res.data || {};
  },

  async updateReturnStatus(
    returnId: string,
    action: "approve" | "reject" | "receive",
    staffNote?: string
  ): Promise<{ ok?: boolean; error?: ApiError }> {
    const res = await request<{ ok: boolean }>(`/api/admin/returns/${returnId}`, {
      method: "PATCH",
      body: JSON.stringify({ action, staffNote }),
    });
    if (res.error) return { error: res.error };
    return res.data || {};
  },

  // Test Server Connection
  async pingServer(targetUrl: string): Promise<boolean> {
    try {
      const cleanUrl = targetUrl.trim().replace(/\/+$/, "");
      // Try /api/ping first
      try {
        const pingRes = await fetch(`${cleanUrl}/api/ping`, {
          method: "GET",
        });
        if (pingRes.ok) return true;
      } catch {}

      // Fallback to /api/admin/auth/me
      const res = await fetch(`${cleanUrl}/api/admin/auth/me`, {
        method: "GET",
      });
      return res.status === 401 || res.status === 200;
    } catch {
      return false;
    }
  },

  // Notifications
  async getNotifications(unreadOnly = false): Promise<{
    notifications?: AdminNotificationItem[];
    unreadCount?: number;
    error?: ApiError;
  }> {
    const res = await request<{
      notifications: AdminNotificationItem[];
      unreadCount: number;
    }>(`/api/admin/notifications?unreadOnly=${unreadOnly}`);
    if (res.error) return { error: res.error };
    return res.data || {};
  },

  async markNotificationRead(notificationId: string): Promise<{ ok?: boolean; error?: ApiError }> {
    const res = await request<{ ok: boolean }>("/api/admin/notifications", {
      method: "PATCH",
      body: JSON.stringify({ notificationId }),
    });
    if (res.error) return { error: res.error };
    return res.data || {};
  },

  async markAllNotificationsRead(): Promise<{ ok?: boolean; error?: ApiError }> {
    const res = await request<{ ok: boolean }>("/api/admin/notifications", {
      method: "PATCH",
      body: JSON.stringify({ all: true }),
    });
    if (res.error) return { error: res.error };
    return res.data || {};
  },

  async registerPushToken(
    token: string,
    platform?: string,
    deviceInfo?: string
  ): Promise<{ ok?: boolean; error?: ApiError }> {
    const res = await request<{ ok: boolean }>("/api/admin/notifications/push-token", {
      method: "POST",
      body: JSON.stringify({ token, platform, deviceInfo }),
    });
    if (res.error) return { error: res.error };
    return res.data || {};
  },
};
