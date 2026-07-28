import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";

import { cn } from "../lib/cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
  {
    variants: {
      variant: {
        neutral: "bg-[var(--surface-subtle)] text-[var(--text-muted)]",
        success: "bg-[var(--success-soft)] text-[var(--success-strong)]",
        warning: "bg-[var(--warning-soft)] text-[var(--warning-strong)]",
        danger: "bg-[var(--danger-soft)] text-[var(--danger)]",
        brand: "bg-[var(--brand-soft)] text-[var(--brand)]",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return (
    <span className={cn(badgeVariants({ className, variant }))} {...props} />
  );
}
