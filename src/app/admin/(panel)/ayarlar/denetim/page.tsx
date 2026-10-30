import Link from "next/link";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { ArrowLeft, Funnel, ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { requireStaff } from "@/lib/auth/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export const dynamic = "force-dynamic";

interface JsonDiffRow {
  key: string;
  beforeVal: string;
  afterVal: string;
  status: "added" | "removed" | "changed";
}

function toRecord(val: unknown): Record<string, unknown> | null {
  if (!val || typeof val !== "object" || Array.isArray(val)) return null;
  return val as Record<string, unknown>;
}

function stringifyCompact(val: unknown): string {
  if (val === undefined) return "(yok)";
  if (val === null) return "null";
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  try {
    return JSON.stringify(val);
  } catch {
    return String(val);
  }
}

function computeJsonDiff(before: unknown, after: unknown): JsonDiffRow[] {
  const beforeObj = toRecord(before);
  const afterObj = toRecord(after);

  if (!beforeObj && !afterObj) return [];

  const keys = Array.from(
    new Set([
      ...(beforeObj ? Object.keys(beforeObj) : []),
      ...(afterObj ? Object.keys(afterObj) : []),
    ])
  ).filter((k) => k !== "updatedAt" && k !== "createdAt");

  const rows: JsonDiffRow[] = [];

  for (const key of keys) {
    const hasBefore = beforeObj ? Object.prototype.hasOwnProperty.call(beforeObj, key) : false;
    const hasAfter = afterObj ? Object.prototype.hasOwnProperty.call(afterObj, key) : false;
    const bVal = beforeObj ? beforeObj[key] : undefined;
    const aVal = afterObj ? afterObj[key] : undefined;

    const bStr = stringifyCompact(bVal);
    const aStr = stringifyCompact(aVal);

    if (!hasBefore && hasAfter) {
      rows.push({ key, beforeVal: "(yok)", afterVal: aStr, status: "added" });
    } else if (hasBefore && !hasAfter) {
      rows.push({ key, beforeVal: bStr, afterVal: "(silindi)", status: "removed" });
    } else if (bStr !== aStr) {
      rows.push({ key, beforeVal: bStr, afterVal: aStr, status: "changed" });
    }
  }

  return rows;
}

export default async function AdminAuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireStaff();

  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const entityType = typeof params.entityType === "string" ? params.entityType.trim() : "";
  const staffUserId = typeof params.staffUserId === "string" ? params.staffUserId.trim() : "";

  const where: Prisma.AuditLogWhereInput = {
    ...(entityType ? { entityType } : {}),
    ...(staffUserId === "system"
      ? { staffUserId: null }
      : staffUserId
        ? { staffUserId }
        : {}),
    ...(q
      ? {
          OR: [
            { action: { contains: q, mode: "insensitive" } },
            { summary: { contains: q, mode: "insensitive" } },
            { entityId: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [logs, totalCount, distinctEntities, staffList] = await Promise.all([
    db.auditLog.findMany({
      where,
      include: {
        staffUser: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      distinct: ["entityType"],
      select: { entityType: true },
      orderBy: { entityType: "asc" },
    }),
    db.staffUser.findMany({
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 border-b border-zinc-200 pb-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/ayarlar"
              className="inline-flex items-center gap-1 rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-800 hover:bg-zinc-100"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Ayarlara Dön
            </Link>
            <Badge variant="neutral">Toplam {totalCount} kayıt</Badge>
          </div>
          <h1 className="mt-2 flex items-center gap-2 text-xl font-bold tracking-tight text-zinc-900">
            <ShieldCheck className="h-5 w-5 text-[#9a3412]" />
            Denetim Kaydı (AuditLog) ve JSON Fark Görünümü
          </h1>
          <p className="mt-1 text-xs text-zinc-600">
            Yönetim panelinde yapılan tüm kritik işlemlerin kim tarafından, hangi IP adresiyle ve
            hangi önceki / sonraki veri farkıyla gerçekleştirildiğini inceleyin.
          </p>
        </div>
      </div>

      <form
        method="GET"
        action="/admin/ayarlar/denetim"
        className="grid grid-cols-1 gap-3 rounded-md border border-zinc-200 bg-white p-4 sm:grid-cols-12"
      >
        <div className="sm:col-span-5">
          <Label htmlFor="audit-q">Eylem, Özet veya Kayıt ID Ara</Label>
          <Input
            id="audit-q"
            name="q"
            defaultValue={q}
            placeholder="Örn: settings.store.update, product, refund..."
            className="mt-1"
          />
        </div>

        <div className="sm:col-span-3">
          <Label htmlFor="audit-entity">Varlık Tipi (EntityType)</Label>
          <Select id="audit-entity" name="entityType" defaultValue={entityType} className="mt-1">
            <option value="">Tüm Varlık Tipleri</option>
            {distinctEntities.map((item) => (
              <option key={item.entityType} value={item.entityType}>
                {item.entityType}
              </option>
            ))}
          </Select>
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="audit-staff">Personel</Label>
          <Select id="audit-staff" name="staffUserId" defaultValue={staffUserId} className="mt-1">
            <option value="">Tümü</option>
            <option value="system">Sistem (Otomatik)</option>
            {staffList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex items-end gap-2 sm:col-span-2">
          <Button type="submit" variant="primary" className="w-full">
            <Funnel className="h-4 w-4" />
            Filtrele
          </Button>
        </div>
      </form>

      {logs.length === 0 ? (
        <EmptyState
          title="Eşleşen denetim kaydı bulunamadı"
          description="Seçtiğiniz arama veya filtre kriterlerine uygun bir işlem kaydı yok. Filtreleri temizleyerek tüm kayıtları görüntüleyebilirsiniz."
          actionLabel="Filtreleri Temizle"
          actionHref="/admin/ayarlar/denetim"
        />
      ) : (
        <div className="overflow-x-auto rounded-md border border-zinc-200 bg-white">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                <th className="px-3.5 py-2.5">Tarih / IP</th>
                <th className="px-3.5 py-2.5">Personel</th>
                <th className="px-3.5 py-2.5">Eylem ve Varlık</th>
                <th className="px-3.5 py-2.5">Açıklama ve Önceki / Sonraki JSON Farkı</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {logs.map((log) => {
                const diffRows = computeJsonDiff(log.before, log.after);
                const hasRawJson = log.before !== null || log.after !== null;

                return (
                  <tr key={log.id} className="align-top hover:bg-zinc-50/70">
                    <td className="whitespace-nowrap px-3.5 py-3 font-mono text-[11px] tabular-nums text-zinc-700">
                      <div className="font-semibold text-zinc-900">
                        {format(log.createdAt, "dd MMM yyyy HH:mm:ss", { locale: tr })}
                      </div>
                      <div className="text-zinc-500">IP: {log.ip ?? "127.0.0.1"}</div>
                    </td>

                    <td className="px-3.5 py-3">
                      {log.staffUser ? (
                        <div>
                          <div className="font-semibold text-zinc-900">{log.staffUser.name}</div>
                          <div className="font-mono text-[11px] text-zinc-600">
                            {log.staffUser.email}
                          </div>
                        </div>
                      ) : (
                        <Badge variant="neutral">Sistem</Badge>
                      )}
                    </td>

                    <td className="px-3.5 py-3">
                      <div className="font-mono font-semibold text-zinc-900">{log.action}</div>
                      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-zinc-600">
                        <Badge variant="neutral">{log.entityType}</Badge>
                        {log.entityId ? (
                          <span className="font-mono text-zinc-700">#{log.entityId}</span>
                        ) : null}
                      </div>
                    </td>

                    <td className="px-3.5 py-3">
                      <div className="font-medium text-zinc-900">
                        {log.summary ?? "İşlem kaydı"}
                      </div>

                      {diffRows.length > 0 ? (
                        <div className="mt-2 overflow-x-auto rounded border border-zinc-200 bg-zinc-50">
                          <table className="w-full border-collapse text-left font-mono text-[11px]">
                            <thead>
                              <tr className="border-b border-zinc-200 bg-zinc-100 text-[10px] font-semibold uppercase text-zinc-600">
                                <th className="px-2 py-1">Alan</th>
                                <th className="px-2 py-1">Önceki (Before)</th>
                                <th className="px-2 py-1">Sonraki (After)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-200">
                              {diffRows.slice(0, 8).map((row) => (
                                <tr key={`${log.id}-diff-${row.key}`}>
                                  <td className="px-2 py-1 font-semibold text-zinc-900">
                                    {row.key}
                                  </td>
                                  <td className="max-w-xs truncate bg-red-50/70 px-2 py-1 text-red-900">
                                    {row.beforeVal}
                                  </td>
                                  <td className="max-w-xs truncate bg-green-50/70 px-2 py-1 text-green-900">
                                    {row.afterVal}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : null}

                      {hasRawJson ? (
                        <details className="mt-2 rounded border border-zinc-200 bg-zinc-50 px-2.5 py-1.5">
                          <summary className="cursor-pointer text-[11px] font-semibold text-zinc-700">
                            Ham JSON Verisini Göster (Önceki / Sonraki)
                          </summary>
                          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <div>
                              <div className="text-[10px] font-semibold uppercase text-zinc-600">
                                Önceki (before)
                              </div>
                              <pre className="mt-1 max-h-48 overflow-auto rounded border border-zinc-200 bg-white p-2 font-mono text-[11px] text-zinc-800">
                                {log.before ? JSON.stringify(log.before, null, 2) : "null"}
                              </pre>
                            </div>
                            <div>
                              <div className="text-[10px] font-semibold uppercase text-zinc-600">
                                Sonraki (after)
                              </div>
                              <pre className="mt-1 max-h-48 overflow-auto rounded border border-zinc-200 bg-white p-2 font-mono text-[11px] text-zinc-800">
                                {log.after ? JSON.stringify(log.after, null, 2) : "null"}
                              </pre>
                            </div>
                          </div>
                        </details>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
