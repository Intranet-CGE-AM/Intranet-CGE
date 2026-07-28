import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../lib/cn";

export function Alert({
  className,
  title,
  children,
}: HTMLAttributes<HTMLDivElement> & { title: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--warning-border)] bg-[var(--warning-soft)] p-4 text-sm",
        className,
      )}
      role="status"
    >
      <p className="font-semibold text-[var(--warning-strong)]">{title}</p>
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
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="grid min-h-56 place-items-center p-8 text-center">
      <div>
        <div className="mx-auto grid size-11 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
          {icon}
        </div>
        <h3 className="mt-4 font-semibold text-[var(--text)]">{title}</h3>
        <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--text-muted)]">
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
      {...props}
    />
  );
}
