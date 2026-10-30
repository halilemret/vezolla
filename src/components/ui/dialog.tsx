"use client";

import * as React from "react";
import { Dialog as RadixDialog } from "radix-ui";
import { X } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";

export const Dialog = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;
export const DialogClose = RadixDialog.Close;

export function DialogContent({
  className,
  title,
  description,
  children,
}: {
  className?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 z-50 bg-black/45" />
      <RadixDialog.Content
        className={cn(
          "fixed top-1/2 left-1/2 z-50 max-h-[90vh] w-[95vw] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-md border border-zinc-200 bg-white p-6 shadow-lg focus:outline-none",
          className
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 pb-3">
          <div>
            <RadixDialog.Title className="text-base font-semibold text-zinc-900">
              {title}
            </RadixDialog.Title>
            {description ? (
              <RadixDialog.Description className="mt-0.5 text-xs text-zinc-600">
                {description}
              </RadixDialog.Description>
            ) : null}
          </div>
          <RadixDialog.Close
            aria-label="Pencereyi kapat"
            className="inline-flex h-8 w-8 items-center justify-center rounded text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
          >
            <X className="h-4 w-4" />
          </RadixDialog.Close>
        </div>
        <div className="mt-4">{children}</div>
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}
