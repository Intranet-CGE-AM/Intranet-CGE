import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { ComponentProps } from "react";

import { cn } from "../lib/cn";

export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export function TooltipContent({
  className,
  sideOffset = 6,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        className={cn(
          "z-50 max-w-64 rounded-lg bg-[var(--brand-strong)] px-3 py-2 text-xs leading-5 text-white shadow-[0_6px_18px_rgb(4_75_78/18%)] transition-[opacity,transform] duration-150 data-[state=closed]:scale-95 data-[state=closed]:opacity-0",
          className,
        )}
        sideOffset={sideOffset}
        {...props}
      >
        {props.children}
        <TooltipPrimitive.Arrow className="fill-[var(--brand-strong)]" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}
