import "server-only";
import { db } from "@/lib/db";

export interface CreateAdminNotificationParams {
  type: "order.placed" | "return.requested" | string;
  title: string;
  body?: string;
  link?: string;
  data?: Record<string, unknown>;
}

/**
 * Expo Push Bildirim Servisine bildirim paketini gönderir.
 * Ücretsiz ve anında iletim sağlar (iOS & Android).
 */
export async function sendExpoPushNotification(params: {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}): Promise<{ sentCount: number }> {
  try {
    const tokens = await db.staffPushToken.findMany({
      select: { id: true, token: true },
    });

    if (tokens.length === 0) {
      return { sentCount: 0 };
    }

    const messages = tokens.map((t) => ({
      to: t.token,
      sound: "default",
      title: params.title,
      body: params.body,
      data: params.data ?? {},
      priority: "high",
      channelId: "orders-and-returns",
    }));

    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      console.error("[ExpoPush] Gönderim hatası:", await response.text());
      return { sentCount: 0 };
    }

    const result = await response.json();

    // Geçersiz veya silinmiş cihaz token'larını temizle
    if (result.data && Array.isArray(result.data)) {
      const invalidTokenIds: string[] = [];
      result.data.forEach((ticket: { status: string; details?: { error?: string } }, idx: number) => {
        if (
          ticket.status === "error" &&
          (ticket.details?.error === "DeviceNotRegistered" ||
            ticket.details?.error === "InvalidCredentials")
        ) {
          const t = tokens[idx];
          if (t) invalidTokenIds.push(t.id);
        }
      });

      if (invalidTokenIds.length > 0) {
        await db.staffPushToken.deleteMany({
          where: { id: { in: invalidTokenIds } },
        });
      }
    }

    return { sentCount: tokens.length };
  } catch (error) {
    console.error("[ExpoPush] İstisna:", error);
    return { sentCount: 0 };
  }
}

/**
 * Yöneticiye sistem içi bildirim kaydeder ve kayıtlı tüm mobil cihazlara
 * anlık push bildirimi gönderir.
 */
export async function notifyAdmins(params: CreateAdminNotificationParams): Promise<void> {
  const notification = await db.adminNotification.create({
    data: {
      type: params.type,
      title: params.title,
      body: params.body ?? null,
      link: params.link ?? null,
    },
  });

  // Arka planda mobil push bildirimi gönder
  sendExpoPushNotification({
    title: params.title,
    body: params.body ?? "",
    data: {
      notificationId: notification.id,
      type: params.type,
      link: params.link,
      ...(params.data ?? {}),
    },
  }).catch((err) => {
    console.error("[notifyAdmins] Push gönderilemedi:", err);
  });
}
