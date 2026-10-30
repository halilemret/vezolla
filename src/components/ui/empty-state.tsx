import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}

/**
 * R-27 uyumlu boş durum bileşeni: neden boş olduğunu açıklar ve
 * dolduracak somut eylemi sunar.
 */
export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="rounded-md border border-dashed border-zinc-300 bg-white p-8 text-center">
      <h3 className="text-base font-semibold text-zinc-900">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-zinc-600">{description}</p>
      {actionLabel && actionHref ? (
        <div className="mt-4">
          <Link href={actionHref}>
            <Button variant="primary" size="sm">
              {actionLabel}
            </Button>
          </Link>
        </div>
      ) : null}
      {actionLabel && onAction && !actionHref ? (
        <div className="mt-4">
          <Button variant="primary" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
