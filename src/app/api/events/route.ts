import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import {
  CONSENT_COOKIE,
  VISITOR_COOKIE,
  getCurrentCustomer,
} from "@/lib/auth/session";
import {
  visitorEventPayloadSchema,
  type VisitorEventPayload,
} from "@/modules/personalization/schemas";
import {
  detectDeviceTypeFromUserAgent,
  setVisitorConsent,
  trackVisitorEvent,
} from "@/modules/personalization/tracker";

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

function parseConsentCookie(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return (
    normalized === "1" ||
    normalized === "true" ||
    normalized === "accepted" ||
    normalized === "granted"
  );
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!rawBody || typeof rawBody !== "object") {
      return NextResponse.json(
        { ok: false, error: "Geçersiz olay verisi gönderildi." },
        { status: 400 }
      );
    }

    const cookieVisitorId = request.cookies.get(VISITOR_COOKIE)?.value;
    const cookieConsent = parseConsentCookie(request.cookies.get(CONSENT_COOKIE)?.value);

    const bodyVisitorId =
      typeof rawBody.visitorId === "string" && rawBody.visitorId.trim()
        ? rawBody.visitorId.trim()
        : null;
    const visitorId = bodyVisitorId ?? cookieVisitorId ?? `vis_${randomUUID().replace(/-/g, "")}`;

    // Çerez onay güncellemesi (consent banner)
    if (
      rawBody.action === "set_consent" ||
      rawBody.type === "consent" ||
      rawBody.type === "consent_update"
    ) {
      const nextConsent = Boolean(rawBody.consent);
      await setVisitorConsent(visitorId, nextConsent);

      const response = NextResponse.json({
        ok: true,
        visitorId,
        consent: nextConsent,
      });

      response.cookies.set(VISITOR_COOKIE, visitorId, {
        httpOnly: false,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: ONE_YEAR_SECONDS,
      });

      response.cookies.set(CONSENT_COOKIE, nextConsent ? "granted" : "denied", {
        httpOnly: false,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: ONE_YEAR_SECONDS,
      });

      return response;
    }

    const parsed = visitorEventPayloadSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: parsed.error.issues[0]?.message ?? "Olay şeması doğrulanamadı.",
        },
        { status: 400 }
      );
    }

    const payload: VisitorEventPayload = parsed.data;
    const effectiveConsent =
      typeof payload.consent === "boolean" ? payload.consent : cookieConsent;

    const customer = await getCurrentCustomer();
    const userAgent = request.headers.get("user-agent");
    const referrerHeader = request.headers.get("referer");

    const result = await trackVisitorEvent({
      ...payload,
      visitorId,
      customerId: customer?.id ?? null,
      consent: effectiveConsent,
      referrer: payload.referrer ?? referrerHeader ?? undefined,
      deviceType: payload.deviceType ?? detectDeviceTypeFromUserAgent(userAgent),
      userAgent,
    });

    const response = NextResponse.json({
      ok: true,
      visitorId: result.visitorId,
      consent: result.consent,
      persisted: result.persisted,
      eventId: result.eventId,
      updatedAffinities: result.updatedAffinities,
      attribution: {
        platform: result.attribution.platform,
        segmentId: result.attribution.segmentId,
        segmentIds: result.attribution.segmentIds,
        featuredProductIds: result.attribution.featuredProductIds,
      },
    });

    if (!cookieVisitorId) {
      response.cookies.set(VISITOR_COOKIE, visitorId, {
        httpOnly: false,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: ONE_YEAR_SECONDS,
      });
    }

    if (typeof payload.consent === "boolean") {
      response.cookies.set(CONSENT_COOKIE, payload.consent ? "1" : "0", {
        httpOnly: false,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: ONE_YEAR_SECONDS,
      });
    }

    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Olay işlenirken hata oluştu.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
