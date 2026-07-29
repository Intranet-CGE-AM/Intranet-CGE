import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { useState, type ReactElement } from "react";

import { Button } from "./button";

export function ConfirmDialog({
  busyLabel = "Processando…",
  cancelLabel = "Cancelar",
  children,
  confirmLabel,
  description,
  onConfirm,
  title,
}: {
  busyLabel?: string;
  cancelLabel?: string;
  children: ReactElement;
  confirmLabel: string;
  description: string;
  onConfirm: () => Promise<void> | void;
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function runConfirmation() {
    setBusy(true);
    setError("");
    try {
      await onConfirm();
      setOpen(false);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível concluir esta ação.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialogPrimitive.Root
      onOpenChange={(nextOpen) => {
        if (!busy) {
          setOpen(nextOpen);
          if (!nextOpen) setError("");
        }
      }}
      open={open}
    >
      <AlertDialogPrimitive.Trigger asChild>
        {children}
      </AlertDialogPrimitive.Trigger>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/40" />
        <AlertDialogPrimitive.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_24px_70px_rgb(16_35_38/18%)] focus:outline-none">
          <AlertDialogPrimitive.Title className="text-lg font-semibold tracking-[-0.02em] text-[var(--text)]">
            {title}
          </AlertDialogPrimitive.Title>
          <AlertDialogPrimitive.Description className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
            {description}
          </AlertDialogPrimitive.Description>
          {error ? (
            <p
              className="mt-4 rounded-[10px] bg-[var(--danger-soft)] px-3 py-2 text-sm font-medium text-[var(--danger-strong)]"
              role="alert"
            >
              {error}
            </p>
          ) : null}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialogPrimitive.Cancel asChild>
              <Button disabled={busy} type="button" variant="quiet">
                {cancelLabel}
              </Button>
            </AlertDialogPrimitive.Cancel>
            <Button
              disabled={busy}
              onClick={() => void runConfirmation()}
              type="button"
              variant="danger"
            >
              {busy ? busyLabel : confirmLabel}
            </Button>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}
