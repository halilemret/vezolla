import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hasPermission, type PermissionKey } from "@/lib/rbac/permissions";

export const STAFF_COOKIE = "eticaret_staff_session";
export const CUSTOMER_COOKIE = "eticaret_customer_session";
export const VISITOR_COOKIE = "eticaret_vid";
export const CART_COOKIE = "eticaret_cart";
export const CONSENT_COOKIE = "eticaret_consent";
export const SEGMENT_PREVIEW_COOKIE = "eticaret_preview_segment";

const STAFF_SESSION_DAYS = 14;
const CUSTOMER_SESSION_DAYS = 30;

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, {
    memoryCost: 19456,
    timeCost: 2,
    outputLen: 32,
    parallelism: 1,
  });
}

export async function verifyPassword(passwordHash: string, plain: string): Promise<boolean> {
  try {
    return await verify(passwordHash, plain);
  } catch {
    return false;
  }
}

export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export async function getRequestMeta(): Promise<{ ip: string | null; userAgent: string | null }> {
  try {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for");
    const ip = forwarded ? (forwarded.split(",")[0]?.trim() ?? null) : h.get("x-real-ip");
    const userAgent = h.get("user-agent");
    return { ip, userAgent };
  } catch {
    return { ip: null, userAgent: null };
  }
}

export async function createStaffSession(userId: string): Promise<string> {
  const token = generateToken(32);
  const id = hashToken(token);
  const expiresAt = new Date(Date.now() + STAFF_SESSION_DAYS * 86400 * 1000);
  const meta = await getRequestMeta();

  await db.staffSession.create({
    data: {
      id,
      userId,
      expiresAt,
      ip: meta.ip,
      userAgent: meta.userAgent,
    },
  });

  await db.staffUser.update({
    where: { id: userId },
    data: { lastLoginAt: new Date() },
  });

  const cookieStore = await cookies();
  cookieStore.set(STAFF_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

  return token;
}

export async function destroyStaffSession(customToken?: string): Promise<void> {
  let raw: string | undefined = customToken;
  if (!raw) {
    try {
      const cookieStore = await cookies();
      raw = cookieStore.get(STAFF_COOKIE)?.value;
    } catch {}
  }
  if (raw) {
    const id = hashToken(raw);
    await db.staffSession.deleteMany({ where: { id } });
  }
  try {
    const cookieStore = await cookies();
    cookieStore.delete(STAFF_COOKIE);
  } catch {}
}

export type AuthenticatedStaff = {
  id: string;
  email: string;
  name: string;
  isOwner: boolean;
  isActive: boolean;
  roleId: string;
  role: {
    id: string;
    name: string;
    permissions: string[];
  };
};

export async function getCurrentStaff(customToken?: string): Promise<AuthenticatedStaff | null> {
  let raw: string | undefined = customToken;

  if (!raw) {
    try {
      const h = await headers();
      const authHeader = h.get("authorization");
      if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
        raw = authHeader.slice(7).trim();
      }
    } catch {}
  }

  if (!raw) {
    try {
      const cookieStore = await cookies();
      raw = cookieStore.get(STAFF_COOKIE)?.value;
    } catch {}
  }

  if (!raw) return null;

  const id = hashToken(raw);
  const session = await db.staffSession.findUnique({
    where: { id },
    include: {
      user: {
        include: {
          role: true,
        },
      },
    },
  });

  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now() || !session.user.isActive) {
    await db.staffSession.delete({ where: { id } }).catch(() => {});
    return null;
  }

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    isOwner: session.user.isOwner,
    isActive: session.user.isActive,
    roleId: session.user.roleId,
    role: {
      id: session.user.role.id,
      name: session.user.role.name,
      permissions: session.user.role.permissions,
    },
  };
}

export async function requireStaff(permission?: PermissionKey): Promise<AuthenticatedStaff> {
  const staff = await getCurrentStaff();
  if (!staff) {
    redirect("/admin/giris");
  }
  if (permission && !hasPermission(staff, permission)) {
    throw new Error(`Bu işlem için "${permission}" yetkisi gerekiyor.`);
  }
  return staff;
}

export async function createCustomerSession(customerId: string): Promise<string> {
  const token = generateToken(32);
  const id = hashToken(token);
  const expiresAt = new Date(Date.now() + CUSTOMER_SESSION_DAYS * 86400 * 1000);
  const meta = await getRequestMeta();

  await db.customerSession.create({
    data: {
      id,
      customerId,
      expiresAt,
      ip: meta.ip,
      userAgent: meta.userAgent,
    },
  });

  // Anonim ziyaretçi kaydı varsa bu müşteriyle birleştir
  const cookieStore = await cookies();
  const visitorId = cookieStore.get(VISITOR_COOKIE)?.value;
  if (visitorId) {
    await db.visitor
      .updateMany({
        where: { id: visitorId, customerId: null },
        data: { customerId },
      })
      .catch(() => {});
  }

  cookieStore.set(CUSTOMER_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

  return token;
}

export async function destroyCustomerSession(): Promise<void> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(CUSTOMER_COOKIE)?.value;
  if (raw) {
    const id = hashToken(raw);
    await db.customerSession.deleteMany({ where: { id } });
  }
  cookieStore.delete(CUSTOMER_COOKIE);
}

export type AuthenticatedCustomer = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  groupId: string | null;
  acceptsMarketing: boolean;
};

export async function getCurrentCustomer(): Promise<AuthenticatedCustomer | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(CUSTOMER_COOKIE)?.value;
  if (!raw) return null;

  const id = hashToken(raw);
  const session = await db.customerSession.findUnique({
    where: { id },
    include: { customer: true },
  });

  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now() || !session.customer.isActive) {
    await db.customerSession.delete({ where: { id } }).catch(() => {});
    return null;
  }

  return {
    id: session.customer.id,
    email: session.customer.email,
    firstName: session.customer.firstName,
    lastName: session.customer.lastName,
    phone: session.customer.phone,
    groupId: session.customer.groupId,
    acceptsMarketing: session.customer.acceptsMarketing,
  };
}

export async function requireCustomer(): Promise<AuthenticatedCustomer> {
  const customer = await getCurrentCustomer();
  if (!customer) {
    redirect("/giris");
  }
  return customer;
}
