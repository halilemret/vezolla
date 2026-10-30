import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors cursor-pointer disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900",
  {
    variants: {
      variant: {
        primary: "bg-zinc-900 text-white hover:bg-zinc-800",
        accent: "bg-[#9a3412] text-white hover:bg-[#7c2d12]",
        secondary: "bg-zinc-100 text-zinc-900 hover:bg-zinc-200 border border-zinc-200",
        outline: "border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50",
        ghost: "text-zinc-800 hover:bg-zinc-100",
        danger: "bg-red-700 text-white hover:bg-red-800",
      },
      size: {
        sm: "min-h-9 px-3 py-1.5 text-xs",
        md: "min-h-11 px-4 py-2 text-sm",
        lg: "min-h-12 px-6 py-2.5 text-base",
        icon: "min-h-11 min-w-11 p-2",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { buttonVariants };
