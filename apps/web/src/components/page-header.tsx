import type { ReactNode } from "react";

export function PageHeader({
  actions,
  description,
  eyebrow = "Recursos Humanos",
  title,
}: {
  actions?: ReactNode;
  description?: ReactNode;
  eyebrow?: string;
  title: ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-faint)]">
          {eyebrow}
        </p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.035em]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-sm text-[var(--text-muted)]">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
