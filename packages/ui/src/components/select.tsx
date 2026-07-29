import * as PopoverPrimitive from "@radix-ui/react-popover";
import * as SelectPrimitive from "@radix-ui/react-select";
import {
  CaretDown,
  CaretUpDown,
  Check,
  MagnifyingGlass,
} from "@phosphor-icons/react";
import { Command } from "cmdk";
import { useEffect, useRef, useState } from "react";

import { cn } from "../lib/cn";

export type SelectOption = {
  disabled?: boolean;
  keywords?: string[];
  label: string;
  value: string;
};

type CommonSelectProps = {
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  className?: string;
  defaultValue?: string;
  disabled?: boolean;
  id: string;
  name: string;
  onValueChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  required?: boolean;
  value?: string;
};

const triggerClassName =
  "flex min-h-10 w-full items-center justify-between gap-3 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 text-left text-sm text-[var(--text)] transition-[border-color,box-shadow,background-color,transform] focus-visible:border-[var(--brand)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)] aria-invalid:border-[var(--danger)] disabled:cursor-not-allowed disabled:bg-[var(--surface-subtle)] disabled:text-[var(--text-faint)] data-[placeholder]:text-[var(--text-faint)] active:scale-[0.995]";

export function Select({
  className,
  defaultValue,
  disabled,
  id,
  name,
  onValueChange,
  options,
  placeholder = "Selecione",
  required,
  value,
  ...ariaProps
}: CommonSelectProps) {
  return (
    <SelectPrimitive.Root
      defaultValue={defaultValue}
      disabled={disabled}
      name={name}
      onValueChange={onValueChange}
      required={required}
      value={value}
    >
      <SelectPrimitive.Trigger
        className={cn(triggerClassName, className)}
        id={id}
        {...ariaProps}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon asChild>
          <CaretDown aria-hidden="true" className="shrink-0" size={16} />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          align="start"
          className="z-50 max-h-[min(320px,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-1.5 text-[var(--text)] shadow-[0_14px_38px_rgb(16_35_38/14%)]"
          position="popper"
          sideOffset={6}
        >
          <SelectPrimitive.Viewport>
            {options.map((option) => (
              <SelectPrimitive.Item
                className="relative flex min-h-10 cursor-default select-none items-center rounded-[9px] py-2 pr-9 pl-3 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-45 data-[highlighted]:bg-[var(--surface-subtle)]"
                disabled={option.disabled}
                key={option.value}
                value={option.value}
              >
                <SelectPrimitive.ItemText>
                  {option.label}
                </SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="absolute right-3 inline-flex">
                  <Check aria-hidden="true" size={16} weight="bold" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

export function SearchableSelect({
  className,
  defaultValue = "",
  disabled,
  id,
  name,
  onValueChange,
  options,
  placeholder = "Selecione",
  required,
  value,
  ...ariaProps
}: CommonSelectProps) {
  const [open, setOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [invalid, setInvalid] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selectedValue = value ?? internalValue;
  const selected = options.find((option) => option.value === selectedValue);

  useEffect(() => {
    const form = triggerRef.current?.form;
    if (!form || !required) return;

    function validate(event: SubmitEvent) {
      if (selectedValue) return;
      event.preventDefault();
      event.stopPropagation();
      setInvalid(true);
      triggerRef.current?.focus();
    }

    form.addEventListener("submit", validate, true);
    return () => form.removeEventListener("submit", validate, true);
  }, [required, selectedValue]);

  function select(nextValue: string) {
    if (value === undefined) setInternalValue(nextValue);
    onValueChange?.(nextValue);
    setInvalid(false);
    setOpen(false);
  }

  return (
    <div className="relative">
      <input name={name} type="hidden" value={selectedValue} />
      <PopoverPrimitive.Root onOpenChange={setOpen} open={open}>
        <PopoverPrimitive.Trigger asChild>
          <button
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-invalid={ariaProps["aria-invalid"] || invalid}
            aria-required={required}
            className={cn(triggerClassName, className)}
            disabled={disabled}
            id={id}
            ref={triggerRef}
            role="combobox"
            type="button"
            aria-describedby={ariaProps["aria-describedby"]}
          >
            <span
              className={cn(
                "truncate",
                !selected && "text-[var(--text-faint)]",
              )}
            >
              {selected?.label ?? placeholder}
            </span>
            <CaretUpDown aria-hidden="true" className="shrink-0" size={16} />
          </button>
        </PopoverPrimitive.Trigger>
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            align="start"
            className="z-50 w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-1.5 text-[var(--text)] shadow-[0_14px_38px_rgb(16_35_38/14%)]"
            sideOffset={6}
          >
            <Command loop>
              <div className="flex items-center gap-2 border-b border-[var(--border)] px-2">
                <MagnifyingGlass
                  aria-hidden="true"
                  className="shrink-0 text-[var(--text-faint)]"
                  size={16}
                />
                <Command.Input
                  aria-label="Pesquisar opções"
                  autoFocus
                  className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--text-faint)]"
                  placeholder="Pesquisar…"
                />
              </div>
              <Command.List className="max-h-64 overflow-y-auto py-1">
                <Command.Empty className="px-3 py-6 text-center text-sm text-[var(--text-muted)]">
                  Nenhum resultado encontrado.
                </Command.Empty>
                {options.map((option) => (
                  <Command.Item
                    className="flex min-h-10 cursor-default select-none items-center gap-3 rounded-[9px] px-3 py-2 text-sm outline-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-45 data-[selected=true]:bg-[var(--surface-subtle)]"
                    disabled={option.disabled}
                    key={option.value}
                    onSelect={() => select(option.value)}
                    value={[option.label, ...(option.keywords ?? [])].join(" ")}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {option.label}
                    </span>
                    {selectedValue === option.value ? (
                      <Check
                        aria-hidden="true"
                        className="shrink-0"
                        size={16}
                        weight="bold"
                      />
                    ) : null}
                  </Command.Item>
                ))}
              </Command.List>
            </Command>
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
      {invalid ? (
        <p
          className="mt-1.5 text-xs font-medium text-[var(--danger)]"
          role="alert"
        >
          Selecione uma opção.
        </p>
      ) : null}
    </div>
  );
}
