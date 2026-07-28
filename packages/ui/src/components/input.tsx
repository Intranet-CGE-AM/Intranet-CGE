import type {
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

import { cn } from "../lib/cn";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "min-h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] placeholder:text-[var(--text-faint)] focus-visible:border-[var(--brand)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)] disabled:cursor-not-allowed disabled:bg-[var(--surface-subtle)]",
        className,
      )}
      {...props}
    />
  );
}

export function Label({
  className,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("text-sm font-semibold text-[var(--text)]", className)}
      {...props}
    />
  );
}

export function Select({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "min-h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] focus-visible:border-[var(--brand)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)] disabled:cursor-not-allowed disabled:bg-[var(--surface-subtle)]",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-faint)] focus-visible:border-[var(--brand)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)] disabled:cursor-not-allowed disabled:bg-[var(--surface-subtle)]",
        className,
      )}
      {...props}
    />
  );
}

export function FormField({
  children,
  error,
  hint,
  htmlFor,
  label,
}: {
  children: ReactNode;
  error?: string;
  hint?: string;
  htmlFor: string;
  label: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs font-medium text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-[var(--text-faint)]">{hint}</p>
      ) : null}
    </div>
  );
}
