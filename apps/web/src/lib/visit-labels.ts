import type {
  VisitLocation,
  VisitStatus,
  VisitType,
  VisitorConfirmationStatus,
} from "@cge/contracts";

import { ApiError } from "./api";

type BadgeVariant = "neutral" | "success" | "warning" | "danger" | "brand";

export const visitTypeLabels: Record<VisitType, string> = {
  institutional_meeting: "Reunião institucional",
  technical_support: "Apoio técnico",
  technical_visit: "Visita técnica",
  alignment_meeting: "Reunião de alinhamento",
  presentation: "Apresentação",
  audit: "Auditoria",
  inspection: "Fiscalização",
  training: "Capacitação",
  external_service: "Atendimento externo",
  other: "Outro",
};

// Single source for status text and badge color on every visits screen.
export const visitStatusMeta: Record<
  VisitStatus,
  { label: string; variant: BadgeVariant }
> = {
  pending: { label: "Pendente", variant: "warning" },
  approved: { label: "Aprovada", variant: "brand" },
  scheduled: { label: "Liberada para recepção", variant: "brand" },
  in_progress: { label: "Em atendimento", variant: "warning" },
  completed: { label: "Concluída", variant: "success" },
  cancelled: { label: "Cancelada", variant: "neutral" },
  rejected: { label: "Recusada", variant: "danger" },
};

// Plain labels, kept for the XLSX/PDF exports and filter options.
export const visitStatusLabels = Object.fromEntries(
  Object.entries(visitStatusMeta).map(([status, meta]) => [status, meta.label]),
) as Record<VisitStatus, string>;

export const visitorConfirmationMeta: Record<
  VisitorConfirmationStatus,
  { label: string; variant: BadgeVariant }
> = {
  not_sent: { label: "Não enviado", variant: "neutral" },
  pending: { label: "Aguardando confirmação", variant: "warning" },
  confirmed: { label: "Presença confirmada", variant: "success" },
  declined: { label: "Não comparecerá", variant: "danger" },
  expired: { label: "Convite expirado", variant: "neutral" },
};

export const visitLocationOptions: Array<{
  value: VisitLocation;
  label: string;
}> = [
  { value: "Sala de Reuniões - Anexo", label: "Sala de Reuniões - Anexo" },
  { value: "Sala de Reuniões - Sede", label: "Sala de Reuniões - Sede" },
  { value: "Auditório", label: "Auditório" },
];

/** `2026-09-28` → `28/09/2026` (date-only values, no timezone shift). */
export function formatVisitDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR").format(new Date(`${value}T12:00:00`));
}

/** `09:00:00`, `18:30:00` → `09:00 às 18:30`. */
export function formatVisitTime(start: string, end: string) {
  return `${start.slice(0, 5)} às ${end.slice(0, 5)}`;
}

export function formatVisitDateTime(
  value: Date | string | null | undefined,
  fallback = "Não informado",
) {
  if (!value) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Manaus",
  }).format(date);
}

export function visitErrorMessage(cause: unknown, fallback: string) {
  return cause instanceof ApiError ? cause.message : fallback;
}
