import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../lib/cn";

export function Alert({
  className,
  title,
  children,
  tone = "warning",
}: HTMLAttributes<HTMLDivElement> & {
  title: string;
  tone?: "warning" | "success" | "danger" | "neutral";
}) {
  const tones = {
    warning:
      "border-[var(--warning-border)] bg-[var(--warning-soft)] text-[var(--warning-strong)]",
    success:
      "border-emerald-200 bg-[var(--success-soft)] text-[var(--success-strong)]",
    danger: "border-rose-200 bg-[var(--danger-soft)] text-[var(--danger)]",
    neutral:
      "border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--text)]",
  };
  return (
    <div
      className={cn(
        "rounded-[12px] border p-4 text-sm",
        tones[tone],
        className,
      )}
      role={tone === "danger" ? "alert" : "status"}
    >
      <p className="font-semibold">{title}</p>
      <div className="mt-1 text-[var(--text-muted)]">{children}</div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div
      className="grid min-h-48 place-items-center p-8 text-center"
      data-slot="empty-state"
    >
      <div>
        {icon ? (
          <div className="mx-auto mb-5 text-[var(--brand)]">{icon}</div>
        ) : (
          <div
            aria-hidden="true"
            className="mx-auto mb-5 h-px w-10 bg-[var(--border)]"
          />
        )}
        <h3 className="font-bold text-[var(--text)]">{title}</h3>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[var(--text-muted)]">
          {description}
        </p>
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
    </div>
  );
}

export function Skeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg bg-[var(--surface-subtle)]",
        className,
      )}
      aria-hidden="true"
      {...props}
    />
  );
}
