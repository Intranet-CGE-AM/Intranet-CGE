import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "@phosphor-icons/react";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "../lib/cn";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;

export function DialogContent({
  children,
  className,
  title,
  description,
}: ComponentProps<typeof DialogPrimitive.Content> & {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/40" />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overscroll-contain overflow-y-auto rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_24px_70px_rgb(16_35_38/18%)] focus:outline-none",
          className,
        )}
      >
        <DialogPrimitive.Title className="text-lg font-semibold text-[var(--text)]">
          {title}
        </DialogPrimitive.Title>
        {description ? (
          <DialogPrimitive.Description className="mt-1 text-sm text-[var(--text-muted)]">
            {description}
          </DialogPrimitive.Description>
        ) : null}
        <div className="mt-5">{children}</div>
        <DialogPrimitive.Close
          className="absolute right-4 top-4 grid size-9 place-items-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]"
          aria-label="Fechar"
        >
          <X aria-hidden="true" size={18} />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
