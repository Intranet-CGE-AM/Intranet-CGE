import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../lib/cn";

type DashboardBannerProps = Omit<HTMLAttributes<HTMLElement>, "title"> & {
  action?: ReactNode;
  artwork?: ReactNode;
  description: string;
  eyebrow: string;
  title: ReactNode;
};

export function DashboardBanner({
  action,
  artwork,
  className,
  description,
  eyebrow,
  title,
  ...props
}: DashboardBannerProps) {
  return (
    <section
      className={cn(
        "relative isolate overflow-hidden rounded-[14px] bg-[var(--brand-soft)]",
        className,
      )}
      {...props}
    >
      <div className="relative z-10 flex min-h-[176px] flex-col justify-center px-6 py-7 sm:px-8 lg:max-w-[60%]">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--brand)]">
          {eyebrow}
        </p>
        <h2 className="mt-2 text-2xl font-extrabold leading-tight tracking-[-0.04em] text-[var(--brand-strong)]">
          {title}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
          {description}
        </p>
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
      {artwork ? (
        <div className="absolute inset-y-0 right-0 hidden w-[52%] overflow-hidden lg:flex">
          {artwork}
        </div>
      ) : null}
    </section>
  );
}
