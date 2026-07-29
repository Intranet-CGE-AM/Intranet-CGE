import * as PopoverPrimitive from "@radix-ui/react-popover";
import { DayPicker, type ChevronProps, type DateRange } from "@daypicker/react";
import { ptBR } from "@daypicker/react/locale/pt-BR";
import {
  CalendarBlank,
  CaretDown,
  CaretLeft,
  CaretRight,
} from "@phosphor-icons/react";
import { useState } from "react";

import "@daypicker/react/style.css";

import { cn } from "../lib/cn";

export type DateRangeValue = {
  from: string;
  to: string;
};

type DateRangePickerProps = {
  "aria-describedby"?: string;
  className?: string;
  disabled?: boolean;
  fromName?: string;
  id: string;
  min?: string;
  onChange: (value: DateRangeValue) => void;
  placeholder?: string;
  required?: boolean;
  toName?: string;
  value: DateRangeValue;
};

const displayDate = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function DateRangePicker({
  className,
  disabled,
  fromName,
  id,
  min,
  onChange,
  placeholder = "Selecione o período",
  required,
  toName,
  value,
  ...ariaProps
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [previewEnd, setPreviewEnd] = useState<Date>();
  const selected = toDateRange(value);
  const minimum = parseIsoDate(min);
  const complete = Boolean(selected?.from && selected.to);
  const preview =
    selected?.from && !selected.to && previewEnd && previewEnd >= selected.from
      ? { from: selected.from, to: previewEnd }
      : undefined;
  const summary = complete
    ? `${displayDate.format(selected!.from)} – ${displayDate.format(selected!.to)}`
    : selected?.from
      ? `${displayDate.format(selected.from)} – selecione o fim`
      : placeholder;

  function select(next: DateRange | undefined) {
    const nextValue = {
      from: formatIsoDate(next?.from),
      to: formatIsoDate(next?.to),
    };
    onChange(nextValue);
    setPreviewEnd(undefined);
    if (nextValue.from && nextValue.to) setOpen(false);
  }

  return (
    <div className="relative">
      {fromName ? (
        <input name={fromName} type="hidden" value={value.from} />
      ) : null}
      {toName ? <input name={toName} type="hidden" value={value.to} /> : null}
      <PopoverPrimitive.Root
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) setPreviewEnd(undefined);
        }}
        open={open}
      >
        <PopoverPrimitive.Trigger asChild>
          <button
            aria-describedby={ariaProps["aria-describedby"]}
            aria-expanded={open}
            aria-haspopup="dialog"
            aria-required={required}
            className={cn(
              "flex min-h-10 w-full items-center gap-2 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 text-left text-sm text-[var(--text)] transition-[border-color,box-shadow,transform] focus-visible:border-[var(--brand)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)] disabled:cursor-not-allowed disabled:bg-[var(--surface-subtle)] active:scale-[0.995]",
              className,
            )}
            disabled={disabled}
            id={id}
            type="button"
          >
            <CalendarBlank
              aria-hidden="true"
              className="shrink-0 text-[var(--text-faint)]"
              size={16}
            />
            <span
              className={cn(
                "min-w-0 flex-1 truncate",
                !selected?.from && "text-[var(--text-faint)]",
              )}
            >
              {summary}
            </span>
            <CaretDown
              aria-hidden="true"
              className={cn(
                "shrink-0 transition-transform",
                open && "rotate-180",
              )}
              size={15}
            />
          </button>
        </PopoverPrimitive.Trigger>
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            align="start"
            aria-label="Selecionar período"
            className="z-50 max-h-[min(720px,var(--radix-popover-content-available-height))] w-[min(92vw,650px)] overflow-y-auto rounded-[14px] border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] shadow-[0_18px_50px_rgb(16_35_38/16%)]"
            collisionPadding={12}
            role="dialog"
            sideOffset={6}
          >
            <DayPicker
              animate
              className="cge-calendar"
              components={{ Chevron: CalendarChevron }}
              defaultMonth={selected?.from ?? minimum ?? new Date()}
              disabled={minimum ? { before: minimum } : undefined}
              excludeDisabled
              fixedWeeks
              labels={{
                labelDayButton: (day) => `Selecionar ${formatIsoDate(day)}`,
                labelNext: () => "Próximo mês",
                labelPrevious: () => "Mês anterior",
              }}
              locale={ptBR}
              mode="range"
              modifiers={{
                rangePreviewEnd: preview?.to ?? [],
                rangePreviewMiddle: preview
                  ? (day) => day > preview.from && day < preview.to
                  : [],
                rangePreviewStart: preview?.from ?? [],
              }}
              modifiersClassNames={{
                rangePreviewEnd: "cge-range-preview-end",
                rangePreviewMiddle: "cge-range-preview-middle",
                rangePreviewStart: "cge-range-preview-start",
              }}
              numberOfMonths={2}
              onDayFocus={(day) => setPreviewEnd(day)}
              onDayMouseEnter={(day) => setPreviewEnd(day)}
              onDayMouseLeave={() => setPreviewEnd(undefined)}
              onSelect={select}
              resetOnSelect
              selected={selected}
              showOutsideDays
              startMonth={minimum}
            />
            <div className="flex min-h-12 items-center justify-between gap-4 border-t border-[var(--border)] px-4 py-2.5">
              <p
                aria-live="polite"
                className="text-xs text-[var(--text-muted)]"
              >
                {selected?.from
                  ? complete
                    ? summary
                    : "Agora selecione a data final."
                  : "Escolha a data inicial e depois a final."}
              </p>
              {selected?.from ? (
                <button
                  className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-[var(--brand)] hover:bg-[var(--brand-soft)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]"
                  onClick={() => {
                    setPreviewEnd(undefined);
                    onChange({ from: "", to: "" });
                  }}
                  type="button"
                >
                  Limpar
                </button>
              ) : null}
            </div>
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    </div>
  );
}

function CalendarChevron({ className, orientation, size = 16 }: ChevronProps) {
  const Icon = orientation === "right" ? CaretRight : CaretLeft;
  return <Icon aria-hidden="true" className={className} size={size} />;
}

function parseIsoDate(value?: string) {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return undefined;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
}

function formatIsoDate(date?: Date) {
  if (!date) return "";
  return [
    String(date.getFullYear()).padStart(4, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function toDateRange(value: DateRangeValue): DateRange | undefined {
  const from = parseIsoDate(value.from);
  if (!from) return undefined;
  return { from, to: parseIsoDate(value.to) };
}
