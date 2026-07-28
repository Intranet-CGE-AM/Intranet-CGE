import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "../lib/cn";

const buttonVariants = cva(
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-[10px] px-4 text-sm font-semibold transition-[background-color,border-color,color,transform,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)] active:translate-y-px disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "border border-transparent bg-[var(--action)] text-[var(--action-foreground)] shadow-[0_1px_2px_rgb(4_75_78/10%)] hover:bg-[var(--action-hover)]",
        secondary:
          "border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-subtle)]",
        quiet:
          "bg-transparent text-[var(--text-muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text)]",
        danger: "bg-[var(--danger)] text-white hover:bg-[var(--danger-strong)]",
      },
      size: {
        sm: "min-h-9 rounded-lg px-3 text-xs",
        md: "min-h-10 px-4",
        icon: "size-10 p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export function Button({
  asChild,
  className,
  size,
  variant,
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : "button";
  return (
    <Component
      className={cn(buttonVariants({ className, size, variant }))}
      {...props}
    />
  );
}
