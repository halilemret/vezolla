import * as React from "react";
import { cn } from "@/lib/cn";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-24 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-500 focus-visible:border-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-zinc-900 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:opacity-60",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";
