import { db } from "@/lib/db";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

export async function EntityAuditHistory({
  entityType,
  entityId,
}: {
  entityType: string;
  entityId: string;
}) {
  const logs = await db.auditLog.findMany({
    where: { entityType, entityId },
    include: { staffUser: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 25,
  });

  return (
    <section className="rounded-md border border-zinc-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-zinc-900">Değişiklik Geçmişi (Denetim Kaydı)</h2>
      {logs.length === 0 ? (
        <p className="mt-2 text-xs text-zinc-600">
          Bu kayıt için henüz kaydedilmiş bir değişiklik bulunmuyor.
        </p>
      ) : (
        <div className="mt-3 divide-y divide-zinc-200">
          {logs.map((log) => (
            <div key={log.id} className="flex flex-col gap-1 py-2.5 text-xs sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="font-mono font-medium text-zinc-900">{log.action}</span>
                {log.summary ? <span className="ml-2 text-zinc-700">{log.summary}</span> : null}
              </div>
              <div className="flex items-center gap-3 text-zinc-600 tabular-nums">
                <span>{log.staffUser ? log.staffUser.name : "Sistem"}</span>
                <span>{format(log.createdAt, "dd MMM yyyy HH:mm", { locale: tr })}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
