import "server-only";
import { db } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import type { Prisma } from "@/generated/prisma/client";
import type { CheckoutAddress } from "@/modules/checkout/schemas";

export interface CustomerFilterParams {
  q?: string;
  groupId?: string;
  page?: number;
  pageSize?: number;
}

export async function listCustomers(params: CustomerFilterParams = {}) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 25));
  const q = (params.q ?? "").trim();

  const where: Prisma.CustomerWhereInput = {};
  if (params.groupId && params.groupId !== "ALL") {
    where.groupId = params.groupId === "NONE" ? null : params.groupId;
  }

  if (q) {
    where.OR = [
      { email: { contains: q, mode: "insensitive" } },
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
    ];
  }

  const [customers, totalCount, groups] = await Promise.all([
    db.customer.findMany({
      where,
      include: {
        group: { select: { id: true, name: true } },
      },
      orderBy: [{ lastOrderAt: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.customer.count({ where }),
    db.customerGroup.findMany({
      include: {
        _count: { select: { customers: true, priceLists: true } },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    customers,
    totalCount,
    groups,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
  };
}

export async function getCustomerDetail(customerId: string) {
  return db.customer.findUnique({
    where: { id: customerId },
    include: {
      group: true,
      addresses: {
        orderBy: [{ isDefaultShipping: "desc" }, { createdAt: "desc" }],
      },
      orders: {
        orderBy: { placedAt: "desc" },
        take: 25,
        include: {
          items: { select: { id: true, title: true, quantity: true } },
        },
      },
      reviews: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          product: { select: { id: true, title: true, slug: true } },
        },
      },
      visitors: {
        orderBy: { lastSeenAt: "desc" },
        take: 3,
        include: {
          affinities: {
            orderBy: { score: "desc" },
            take: 10,
          },
          events: {
            orderBy: { createdAt: "desc" },
            take: 15,
          },
        },
      },
    },
  });
}

export async function updateCustomerAdmin(params: {
  customerId: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  groupId?: string | null;
  note?: string | null;
  tags?: string[];
  isActive?: boolean;
  acceptsMarketing?: boolean;
  staffUserId?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const existing = await db.customer.findUnique({
    where: { id: params.customerId },
  });
  if (!existing) {
    return { ok: false, error: "Müşteri bulunamadı." };
  }

  const updated = await db.customer.update({
    where: { id: existing.id },
    data: {
      firstName: params.firstName.trim() || existing.firstName,
      lastName: params.lastName.trim() || existing.lastName,
      phone: params.phone !== undefined ? (params.phone?.trim() || null) : existing.phone,
      groupId: params.groupId !== undefined ? (params.groupId || null) : existing.groupId,
      note: params.note !== undefined ? (params.note?.trim() || null) : existing.note,
      tags: params.tags ?? existing.tags,
      isActive: params.isActive ?? existing.isActive,
      acceptsMarketing: params.acceptsMarketing ?? existing.acceptsMarketing,
    },
  });

  await recordAudit({
    staffUserId: params.staffUserId ?? null,
    action: "customer.update",
    entityType: "Customer",
    entityId: updated.id,
    summary: `${updated.firstName} ${updated.lastName} (${updated.email}) müşteri kartı güncellendi`,
  });

  return { ok: true };
}

export async function saveCustomerGroup(params: {
  id?: string;
  name: string;
  description?: string | null;
  staffUserId?: string | null;
}): Promise<{ ok: boolean; error?: string; id?: string }> {
  const name = params.name.trim();
  if (name.length < 2) {
    return { ok: false, error: "Grup adı en az 2 karakter olmalıdır." };
  }

  const duplicate = await db.customerGroup.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      ...(params.id ? { id: { not: params.id } } : {}),
    },
  });
  if (duplicate) {
    return { ok: false, error: "Bu isimde bir müşteri grubu zaten mevcut." };
  }

  if (params.id) {
    const updated = await db.customerGroup.update({
      where: { id: params.id },
      data: {
        name,
        description: params.description?.trim() || null,
      },
    });
    await recordAudit({
      staffUserId: params.staffUserId ?? null,
      action: "customer_group.update",
      entityType: "CustomerGroup",
      entityId: updated.id,
      summary: `${updated.name} müşteri grubu güncellendi`,
    });
    return { ok: true, id: updated.id };
  }

  const created = await db.customerGroup.create({
    data: {
      name,
      description: params.description?.trim() || null,
    },
  });

  await recordAudit({
    staffUserId: params.staffUserId ?? null,
    action: "customer_group.create",
    entityType: "CustomerGroup",
    entityId: created.id,
    summary: `${created.name} müşteri grubu oluşturuldu`,
  });

  return { ok: true, id: created.id };
}

export async function deleteCustomerGroup(params: {
  id: string;
  staffUserId?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const grp = await db.customerGroup.findUnique({ where: { id: params.id } });
  if (!grp) {
    return { ok: false, error: "Müşteri grubu bulunamadı." };
  }

  await db.customerGroup.delete({ where: { id: grp.id } });
  await recordAudit({
    staffUserId: params.staffUserId ?? null,
    action: "customer_group.delete",
    entityType: "CustomerGroup",
    entityId: grp.id,
    summary: `${grp.name} müşteri grubu silindi`,
  });

  return { ok: true };
}

export async function anonymizeCustomerKvkk(params: {
  customerId: string;
  staffUserId?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const customer = await db.customer.findUnique({
    where: { id: params.customerId },
  });
  if (!customer) {
    return { ok: false, error: "Müşteri bulunamadı." };
  }

  const anonymizedEmail = `kvkk-silindi-${customer.id.slice(-8)}@anonim.local`;

  await db.$transaction([
    db.customerSession.deleteMany({ where: { customerId: customer.id } }),
    db.address.deleteMany({ where: { customerId: customer.id } }),
    db.wishlistItem.deleteMany({ where: { customerId: customer.id } }),
    db.customer.update({
      where: { id: customer.id },
      data: {
        email: anonymizedEmail,
        passwordHash: null,
        firstName: "Anonim",
        lastName: "Müşteri (KVKK)",
        phone: null,
        acceptsMarketing: false,
        marketingConsentAt: null,
        note: "KVKK unutulma hakkı kapsamında kişisel veriler anonimleştirildi.",
        tags: ["kvkk-anonim"],
        isActive: false,
      },
    }),
  ]);

  await recordAudit({
    staffUserId: params.staffUserId ?? null,
    action: "customer.kvkk_anonymize",
    entityType: "Customer",
    entityId: customer.id,
    summary: `Müşteri (#${customer.id.slice(-6)}) kişisel verileri KVKK kapsamında anonimleştirildi`,
  });

  return { ok: true };
}

export async function saveCustomerAddress(params: {
  customerId: string;
  addressId?: string;
  address: CheckoutAddress;
  isDefaultShipping?: boolean;
  isDefaultBilling?: boolean;
}): Promise<{ ok: boolean; error?: string; id?: string }> {
  const { customerId, addressId, address } = params;

  return db.$transaction(async (tx) => {
    if (params.isDefaultShipping) {
      await tx.address.updateMany({
        where: { customerId },
        data: { isDefaultShipping: false },
      });
    }
    if (params.isDefaultBilling) {
      await tx.address.updateMany({
        where: { customerId },
        data: { isDefaultBilling: false },
      });
    }

    const payload = {
      customerId,
      title: address.title?.trim() || "Adresim",
      firstName: address.firstName.trim(),
      lastName: address.lastName.trim(),
      phone: address.phone.trim(),
      city: address.city.trim(),
      district: address.district.trim(),
      neighborhood: address.neighborhood?.trim() || null,
      line1: address.line1.trim(),
      postalCode: address.postalCode?.trim() || null,
      invoiceType: address.invoiceType,
      tckn: address.tckn?.trim() || null,
      companyName: address.companyName?.trim() || null,
      taxOffice: address.taxOffice?.trim() || null,
      taxNumber: address.taxNumber?.trim() || null,
      isDefaultShipping: Boolean(params.isDefaultShipping),
      isDefaultBilling: Boolean(params.isDefaultBilling),
    };

    if (addressId) {
      const existing = await tx.address.findFirst({
        where: { id: addressId, customerId },
      });
      if (!existing) {
        return { ok: false, error: "Adres bulunamadı." };
      }
      const updated = await tx.address.update({
        where: { id: existing.id },
        data: payload,
      });
      return { ok: true, id: updated.id };
    }

    const created = await tx.address.create({
      data: payload,
    });
    return { ok: true, id: created.id };
  });
}

export async function deleteCustomerAddress(params: {
  customerId: string;
  addressId: string;
}): Promise<{ ok: boolean; error?: string }> {
  await db.address.deleteMany({
    where: {
      id: params.addressId,
      customerId: params.customerId,
    },
  });
  return { ok: true };
}
