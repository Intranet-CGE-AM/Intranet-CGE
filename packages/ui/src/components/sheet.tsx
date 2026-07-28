import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "@phosphor-icons/react";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "../lib/cn";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;

export function SheetContent({
  children,
  className,
  description,
  title,
}: ComponentProps<typeof DialogPrimitive.Content> & {
  children: ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/40" />
      <DialogPrimitive.Content
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[min(300px,calc(100%-2rem))] overscroll-contain border-r border-[var(--border)] bg-[var(--surface)] p-4 shadow-[16px_0_50px_rgb(16_35_38/16%)] focus:outline-none",
          className,
        )}
      >
        <DialogPrimitive.Title className="sr-only">
          {title}
        </DialogPrimitive.Title>
        {description ? (
          <DialogPrimitive.Description className="sr-only">
            {description}
          </DialogPrimitive.Description>
        ) : null}
        {children}
        <DialogPrimitive.Close
          aria-label="Fechar menu"
          className="absolute right-3 top-3 grid size-10 place-items-center rounded-[10px] text-[var(--text-muted)] hover:bg-[var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]"
        >
          <X aria-hidden="true" size={19} />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
