import { Card, Skeleton } from "@cge/ui";
import type { ReactNode } from "react";

/** Row of counters used by the visits home, agenda and reports. */
export function VisitStats({
  className = "grid-cols-3",
  items,
  label,
  loading = false,
}: {
  className?: string;
  items: Array<{ label: string; value: number }>;
  label: string;
  loading?: boolean;
}) {
  return (
    <Card className="overflow-hidden">
      <dl aria-label={label} className={`-mt-px -ml-px grid ${className}`}>
        {items.map((item) => (
          <div
            className="border-t border-l border-[var(--border)] px-5 py-4"
            key={item.label}
          >
            <dt className="text-xs font-semibold text-[var(--text-muted)]">
              {item.label}
            </dt>
            <dd className="mt-1 text-2xl font-extrabold tabular-nums">
              {loading ? <Skeleton className="h-8 w-12" /> : item.value}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

/** Label/value pair; render inside a `<dl>`. */
export function VisitDetail({
  className,
  label,
  children,
}: {
  className?: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <dt className="text-xs font-semibold text-[var(--text-faint)]">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm">{children}</dd>
    </div>
  );
}
