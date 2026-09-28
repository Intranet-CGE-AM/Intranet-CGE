import { Select, type SelectOption } from "@cge/ui";
import { useState, type ComponentProps } from "react";

const EMPTY = "__empty__";

// Radix Select cannot hold "" as an item value. `emptyLabel` adds a real
// option for "" (e.g. "Todas as situações") and maps it back, so callers keep
// the same values the native <select> used.
export function FieldSelect({
  defaultValue,
  emptyLabel,
  name,
  onValueChange,
  options,
  value,
  ...props
}: Omit<ComponentProps<typeof Select>, "name"> & {
  emptyLabel?: string;
  name?: string;
}) {
  const [internal, setInternal] = useState(defaultValue ?? "");
  if (!emptyLabel)
    return (
      <Select
        {...props}
        defaultValue={defaultValue}
        name={name ?? ""}
        onValueChange={onValueChange}
        options={options}
        value={value}
      />
    );
  const current = value ?? internal;
  const withEmpty: SelectOption[] = [
    { label: emptyLabel, value: EMPTY },
    ...options,
  ];
  return (
    <>
      {name ? <input name={name} type="hidden" value={current} /> : null}
      <Select
        {...props}
        name=""
        onValueChange={(next) => {
          const real = next === EMPTY ? "" : next;
          if (value === undefined) setInternal(real);
          onValueChange?.(real);
        }}
        options={withEmpty}
        value={current || EMPTY}
      />
    </>
  );
}
