import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";

import { cn } from "../lib/cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold",
  {
    variants: {
      variant: {
        neutral:
          "border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--text-muted)]",
        success:
          "border-emerald-200 bg-[var(--success-soft)] text-[var(--success-strong)]",
        warning:
          "border-[var(--warning-border)] bg-[var(--warning-soft)] text-[var(--warning-strong)]",
        danger: "border-rose-200 bg-[var(--danger-soft)] text-[var(--danger)]",
        brand: "border-teal-200 bg-[var(--brand-soft)] text-[var(--brand)]",
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
