import { CheckCircle, WarningCircle, X } from "@phosphor-icons/react";
import { useEffect, type HTMLAttributes, type ReactNode } from "react";
import { createPortal } from "react-dom";

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

export function Toast({
  description,
  onDismiss,
  title,
  tone = "success",
}: {
  description?: string;
  onDismiss: () => void;
  title: string;
  tone?: "success" | "danger";
}) {
  useEffect(() => {
    const timeout = window.setTimeout(onDismiss, 4_000);
    return () => window.clearTimeout(timeout);
  }, [onDismiss, title]);

  return createPortal(
    <div
      className="fixed bottom-4 right-4 z-[100] flex w-[min(24rem,calc(100vw-2rem))] items-start gap-3 rounded-[12px] border border-[var(--border)] bg-white p-4 text-sm shadow-[0_16px_40px_rgb(16_35_38/14%)]"
      role={tone === "danger" ? "alert" : "status"}
    >
      {tone === "success" ? (
        <CheckCircle
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-[var(--success-strong)]"
          size={20}
          weight="fill"
        />
      ) : (
        <WarningCircle
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-[var(--danger)]"
          size={20}
          weight="fill"
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="font-bold">{title}</p>
        {description ? (
          <p className="mt-1 text-[var(--text-muted)]">{description}</p>
        ) : null}
      </div>
      <button
        aria-label="Fechar notificação"
        className="grid size-8 shrink-0 place-items-center rounded-[8px] text-[var(--text-muted)] hover:bg-[var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)] active:scale-[0.98]"
        onClick={onDismiss}
        type="button"
      >
        <X aria-hidden="true" size={16} />
      </button>
    </div>,
    document.body,
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
