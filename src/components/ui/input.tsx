import * as React from "react";
import { cn } from "@/lib/cn";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          "flex min-h-10 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-500 focus-visible:border-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-zinc-900 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:opacity-60",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
