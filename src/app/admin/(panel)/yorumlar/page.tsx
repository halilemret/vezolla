import { db } from "@/lib/db";
import { moderateReviewAction } from "@/modules/content/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

export default async function AdminReviewsPage() {
  const reviews = await db.review.findMany({
    include: {
      product: { select: { id: true, title: true, slug: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Ürün Yorumları ve Onay Kuyruğu</h1>
        <p className="mt-1 text-xs text-zinc-600">
          Müşterilerin gönderdiği gerçek ürün değerlendirmelerini onaylayın, reddedin veya mağaza yanıtı yazın.
        </p>
      </div>

      {reviews.length === 0 ? (
        <EmptyState
          title="Henüz ürün yorumu bulunmuyor"
          description="Müşteriler satın aldıkları ürünlere değerlendirme bıraktığında onay kuyruğu burada listelenir."
        />
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <div
              key={r.id}
              className="rounded-md border border-zinc-200 bg-white p-4 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-zinc-900">{r.authorName}</span>
                  <span className="font-mono text-xs font-semibold text-zinc-800 tabular-nums">
                    {r.rating}/5 Puan
                  </span>
                  {r.isVerifiedPurchase ? (
                    <Badge variant="success">Doğrulanmış Satın Alma</Badge>
                  ) : (
                    <Badge variant="neutral">Ziyaretçi Yorumu</Badge>
                  )}
                  <Badge
                    variant={
                      r.status === "APPROVED"
                        ? "success"
                        : r.status === "PENDING"
                          ? "warning"
                          : "danger"
                    }
                  >
                    {r.status === "APPROVED"
                      ? "Onaylandı"
                      : r.status === "PENDING"
                        ? "Onay Bekliyor"
                        : "Reddedildi"}
                  </Badge>
                </div>
                <div className="text-xs text-zinc-600 tabular-nums">
                  Ürün: <strong>{r.product.title}</strong> |{" "}
                  {format(r.createdAt, "dd MMM yyyy HH:mm", { locale: tr })}
                </div>
              </div>

              {r.title ? <p className="text-sm font-medium text-zinc-900">{r.title}</p> : null}
              <p className="text-sm text-zinc-700">{r.body}</p>

              <form
                action={moderateReviewAction}
                className="flex flex-col gap-2 border-t border-zinc-200 pt-3 sm:flex-row sm:items-center"
              >
                <input type="hidden" name="reviewId" value={r.id} />
                <Input
                  name="reply"
                  defaultValue={r.reply ?? ""}
                  placeholder="Mağaza yanıtı (isteğe bağlı)..."
                  className="flex-1"
                />
                <div className="flex items-center gap-2">
                  <Button type="submit" name="status" value="APPROVED" size="sm">
                    Onayla ve Yanıtla
                  </Button>
                  <Button type="submit" name="status" value="REJECTED" variant="danger" size="sm">
                    Reddet
                  </Button>
                </div>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
