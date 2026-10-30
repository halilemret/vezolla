import * as React from "react";
import { cn } from "@/lib/cn";

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "flex min-h-10 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus-visible:border-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-zinc-900 disabled:cursor-not-allowed disabled:bg-zinc-100",
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
);
Select.displayName = "Select";
