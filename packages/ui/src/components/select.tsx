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
  group?: string;
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

type SearchableSelectProps = CommonSelectProps & {
  listClassName?: string;
  onSearchChange?: (query: string) => void;
  searchPlaceholder?: string;
  searching?: boolean;
};

type SearchableMultiSelectProps = {
  "aria-describedby"?: string;
  className?: string;
  disabled?: boolean;
  emptyText?: string;
  id: string;
  name: string;
  onValuesChange: (values: string[]) => void;
  options: SelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  values: string[];
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
  listClassName,
  name,
  onSearchChange,
  onValueChange,
  options,
  placeholder = "Selecione",
  required,
  searchPlaceholder = "Pesquisar…",
  searching = false,
  value,
  ...ariaProps
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [invalid, setInvalid] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selectedValue = value ?? internalValue;
  const selected = options.find((option) => option.value === selectedValue);
  const optionGroups = Array.from(
    options.reduce((groups, option) => {
      const group = option.group ?? "";
      groups.set(group, [...(groups.get(group) ?? []), option]);
      return groups;
    }, new Map<string, SelectOption[]>()),
  );

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
            <Command loop shouldFilter={!onSearchChange}>
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
                  onValueChange={onSearchChange}
                  placeholder={searchPlaceholder}
                />
              </div>
              <Command.List
                className={cn("max-h-64 overflow-y-auto py-1", listClassName)}
              >
                <Command.Empty className="px-3 py-6 text-center text-sm text-[var(--text-muted)]">
                  {searching ? "Buscando…" : "Nenhum resultado encontrado."}
                </Command.Empty>
                {optionGroups.map(([group, groupOptions]) => (
                  <Command.Group
                    className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.12em] [&_[cmdk-group-heading]]:text-[var(--text-faint)]"
                    heading={group || undefined}
                    key={group}
                  >
                    {groupOptions.map((option) => (
                      <Command.Item
                        className="flex min-h-10 cursor-default select-none items-center gap-3 rounded-[9px] px-3 py-2 text-sm outline-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-45 data-[selected=true]:bg-[var(--surface-subtle)]"
                        disabled={option.disabled}
                        key={option.value}
                        onSelect={() => select(option.value)}
                        value={[
                          option.group ?? "",
                          option.label,
                          ...(option.keywords ?? []),
                        ].join(" ")}
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
                  </Command.Group>
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

export function SearchableMultiSelect({
  className,
  disabled,
  emptyText = "Nenhuma opção encontrada.",
  id,
  name,
  onValuesChange,
  options,
  placeholder = "Selecione",
  searchPlaceholder = "Pesquisar…",
  values,
  ...ariaProps
}: SearchableMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedOptions = options.filter((option) =>
    values.includes(option.value),
  );
  const normalizedQuery = normalizeSearch(query);
  const filteredOptions = normalizedQuery
    ? options.filter((option) =>
        normalizeSearch(
          [option.label, ...(option.keywords ?? [])].join(" "),
        ).includes(normalizedQuery),
      )
    : options;
  const summary =
    selectedOptions.length === 1
      ? selectedOptions[0]!.label
      : selectedOptions.length > 1
        ? `${selectedOptions.length} opções`
        : placeholder;

  function toggle(nextValue: string) {
    onValuesChange(
      values.includes(nextValue)
        ? values.filter((value) => value !== nextValue)
        : [...values, nextValue],
    );
  }

  return (
    <div className="relative">
      <input name={name} type="hidden" value={values.join(",")} />
      <PopoverPrimitive.Root
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) setQuery("");
        }}
        open={open}
      >
        <PopoverPrimitive.Trigger asChild>
          <button
            aria-describedby={ariaProps["aria-describedby"]}
            aria-expanded={open}
            aria-haspopup="dialog"
            className={cn(triggerClassName, className)}
            disabled={disabled}
            id={id}
            type="button"
          >
            <span
              className={cn(
                "truncate",
                !selectedOptions.length && "text-[var(--text-faint)]",
              )}
            >
              {summary}
            </span>
            <CaretUpDown aria-hidden="true" className="shrink-0" size={16} />
          </button>
        </PopoverPrimitive.Trigger>
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            align="start"
            className="z-50 w-[var(--radix-popover-trigger-width)] min-w-64 overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-1.5 text-[var(--text)] shadow-[0_14px_38px_rgb(16_35_38/14%)]"
            aria-label={`Selecionar ${placeholder.toLowerCase()}`}
            role="dialog"
            sideOffset={6}
          >
            <div className="flex items-center gap-2 border-b border-[var(--border)] px-2">
              <MagnifyingGlass
                aria-hidden="true"
                className="shrink-0 text-[var(--text-faint)]"
                size={16}
              />
              <input
                aria-label={`Pesquisar ${placeholder.toLowerCase()}`}
                autoFocus
                className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--text-faint)]"
                onChange={(event) => setQuery(event.target.value)}
                placeholder={searchPlaceholder}
                type="search"
                value={query}
              />
            </div>
            <div
              aria-label={`Opções de ${placeholder.toLowerCase()}`}
              className="max-h-64 overflow-y-auto py-1"
              role="group"
            >
              {filteredOptions.length ? (
                filteredOptions.map((option) => {
                  const checked = values.includes(option.value);
                  return (
                    <label
                      className={cn(
                        "flex min-h-10 cursor-pointer select-none items-center gap-3 rounded-[9px] px-3 py-2 text-sm hover:bg-[var(--surface-subtle)] has-[input:focus-visible]:outline-none has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-inset has-[input:focus-visible]:ring-[var(--focus)]",
                        option.disabled &&
                          "pointer-events-none cursor-not-allowed opacity-45",
                      )}
                      key={option.value}
                    >
                      <input
                        checked={checked}
                        className="sr-only"
                        disabled={option.disabled}
                        onChange={() => toggle(option.value)}
                        type="checkbox"
                      />
                      <span
                        aria-hidden="true"
                        className={cn(
                          "grid size-4 shrink-0 place-items-center rounded-[4px] border",
                          checked
                            ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                            : "border-[var(--border)] bg-white",
                        )}
                      >
                        {checked ? (
                          <Check aria-hidden="true" size={11} weight="bold" />
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        {option.label}
                      </span>
                    </label>
                  );
                })
              ) : (
                <p className="px-3 py-6 text-center text-sm text-[var(--text-muted)]">
                  {emptyText}
                </p>
              )}
            </div>
            {values.length ? (
              <div className="border-t border-[var(--border)] p-1 pt-1.5">
                <button
                  className="min-h-9 w-full rounded-[8px] px-3 text-left text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus)]"
                  onClick={() => onValuesChange([])}
                  type="button"
                >
                  Limpar seleção
                </button>
              </div>
            ) : null}
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    </div>
  );
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR");
}
