import type { HTMLAttributes } from "react";

import { cn } from "../lib/cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <section
      className={cn(
        "rounded-[14px] border border-[var(--border)] bg-[var(--surface)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 border-b border-[var(--border)] px-5 py-4",
        className,
      )}
      {...props}
    />
  );
}

export function CardContent({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}
