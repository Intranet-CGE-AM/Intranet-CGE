import { ticketStatusLabels, type TicketStatus } from "@cge/contracts";

type BadgeVariant = "neutral" | "success" | "warning" | "danger" | "brand";

const STATUS_VARIANTS: Record<TicketStatus, BadgeVariant> = {
  open: "brand",
  viewed: "brand",
  en_route: "warning",
  in_service: "warning",
  paused: "neutral",
  maintenance: "neutral",
  completed: "success",
  cancelled: "danger",
};

export const TICKET_STATUS = Object.fromEntries(
  Object.entries(STATUS_VARIANTS).map(([status, variant]) => [
    status,
    { label: ticketStatusLabels[status as TicketStatus], variant },
  ]),
) as Record<TicketStatus, { label: string; variant: BadgeVariant }>;

export function ticketStatus(status: string) {
  return (
    TICKET_STATUS[status as TicketStatus] ?? {
      label: status,
      variant: "neutral" as const,
    }
  );
}
