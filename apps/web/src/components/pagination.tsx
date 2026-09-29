import { Button } from "@cge/ui";

export function Pagination({
  disabled,
  hasMore,
  label,
  onPageChange,
  page,
}: {
  disabled?: boolean;
  hasMore: boolean;
  label: string;
  onPageChange: (page: number) => void;
  page: number;
}) {
  if (page === 1 && !hasMore) return null;
  return (
    <nav aria-label={label} className="flex items-center justify-end gap-3">
      <Button
        disabled={disabled || page === 1}
        onClick={() => onPageChange(page - 1)}
        size="sm"
        variant="secondary"
      >
        Anterior
      </Button>
      <span className="text-sm tabular-nums text-[var(--text-muted)]">
        Página {page}
      </span>
      <Button
        disabled={disabled || !hasMore}
        onClick={() => onPageChange(page + 1)}
        size="sm"
        variant="secondary"
      >
        Próxima
      </Button>
    </nav>
  );
}
