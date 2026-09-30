import { Skeleton } from "@cge/ui";

// Keeps the loading text for screen readers (and for specs that wait on it)
// while showing skeleton rows like the core screens.
export function LoadingState({
  label,
  rows = 3,
}: {
  label: string;
  rows?: number;
}) {
  return (
    <div className="space-y-3" role="status">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, row) => (
        <Skeleton className="h-14 w-full" key={row} />
      ))}
    </div>
  );
}
