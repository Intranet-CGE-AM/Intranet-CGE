import { useState } from "react";

import { cn } from "../lib/cn";

const sizes = {
  sm: "size-8 text-[10px]",
  md: "size-9 text-xs",
  lg: "size-14 text-sm",
};

export function Avatar({
  className,
  name,
  size = "md",
  src,
}: {
  className?: string;
  name: string;
  size?: keyof typeof sizes;
  src?: string | null;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] font-extrabold text-[var(--brand)]",
        sizes[size],
        className,
      )}
      data-slot="avatar"
    >
      {src && failedSrc !== src ? (
        <img
          alt=""
          className="size-full object-cover"
          onError={() => setFailedSrc(src)}
          src={src}
        />
      ) : (
        <span aria-hidden="true">{initials || "—"}</span>
      )}
    </span>
  );
}
