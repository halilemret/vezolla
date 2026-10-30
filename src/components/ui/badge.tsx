import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

/**
 * R-09 uyumlu durum etiketi: yalnızca gerçek sistem durumlarını (sipariş, stok, senkron durumu)
 * göstermek için kullanılır; süs rozeti olarak kullanılmaz.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        neutral: "bg-zinc-100 text-zinc-800 border border-zinc-200",
        success: "bg-green-100 text-green-900 border border-green-200",
        warning: "bg-amber-100 text-amber-900 border border-amber-200",
        danger: "bg-red-100 text-red-900 border border-red-200",
        accent: "bg-[#ffedd5] text-[#9a3412] border border-[#fed7aa]",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
