import { Camera } from "@phosphor-icons/react";
import { useEffect, useState, type ChangeEvent } from "react";

import { cn } from "../lib/cn";

const sizes = {
  sm: "size-8 text-[10px]",
  md: "size-9 text-xs",
  lg: "size-14 text-sm",
  xl: "size-24 text-xl",
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

export function AvatarPicker({
  description,
  disabled,
  file,
  id,
  name,
  onFileChange,
  src,
}: {
  description?: string;
  disabled?: boolean;
  file: File | null;
  id: string;
  name: string;
  onFileChange: (file: File | null) => void;
  src?: string | null;
}) {
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewSrc(null);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreviewSrc(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    onFileChange(event.currentTarget.files?.[0] ?? null);
  }

  return (
    <div className="flex items-center gap-5">
      <label
        className={[
          "group relative block size-24 shrink-0 rounded-full transition-transform active:scale-[0.98] has-[input:focus-visible]:outline-none has-[input:focus-visible]:ring-3 has-[input:focus-visible]:ring-[var(--focus)]",
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
          file ? "ring-3 ring-[var(--action)]" : "",
        ].join(" ")}
        htmlFor={id}
      >
        <Avatar
          className="size-full bg-white"
          name={name}
          size="xl"
          src={previewSrc ?? src}
        />
        <input
          accept="image/jpeg,image/png,image/webp"
          aria-label={`Selecionar nova foto de ${name}`}
          className="absolute inset-0 z-20 size-full cursor-pointer rounded-full opacity-0 disabled:cursor-not-allowed"
          disabled={disabled}
          id={id}
          name="avatar"
          onChange={selectFile}
          onClick={(event) => {
            event.currentTarget.value = "";
          }}
          type="file"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 grid place-items-center rounded-full bg-[rgb(4_75_78/78%)] text-white opacity-0 transition-[opacity,transform] duration-200 group-hover:opacity-100 group-has-[input:focus-visible]:opacity-100"
        >
          <span className="grid place-items-center gap-1">
            <Camera size={22} weight="bold" />
            <span className="text-[10px] font-extrabold uppercase tracking-[0.08em]">
              {src || file ? "Alterar" : "Adicionar"}
            </span>
          </span>
        </span>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 right-0 grid size-7 place-items-center rounded-full border border-[var(--border)] bg-white text-[var(--brand)] shadow-[0_2px_8px_rgb(16_35_38/12%)] transition-transform group-hover:scale-0 group-has-[input:focus-visible]:scale-0"
        >
          <Camera size={15} weight="bold" />
        </span>
      </label>

      <div className="min-w-0">
        <p className="truncate text-base font-extrabold">{name}</p>
        {description ? (
          <p className="mt-1 truncate text-sm text-[var(--text-muted)]">
            {description}
          </p>
        ) : null}
        <p
          className={[
            "mt-2 truncate text-xs",
            file ? "font-bold text-[var(--brand)]" : "text-[var(--text-faint)]",
          ].join(" ")}
        >
          {file ? file.name : "Clique na foto para selecionar uma imagem"}
        </p>
        <p className="mt-1 text-[11px] text-[var(--text-faint)]">
          JPEG, PNG ou WebP · máximo de 2 MB
        </p>
      </div>
    </div>
  );
}
