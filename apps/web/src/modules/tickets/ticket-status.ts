import type { TicketStatus } from "@cge/contracts";

type BadgeVariant = "neutral" | "success" | "warning" | "danger" | "brand";

export const TICKET_STATUS: Record<
  TicketStatus,
  { label: string; variant: BadgeVariant }
> = {
  open: { label: "Aberto", variant: "brand" },
  viewed: { label: "Visualizado", variant: "brand" },
  en_route: { label: "A caminho", variant: "warning" },
  in_service: { label: "Em atendimento", variant: "warning" },
  paused: { label: "Pausado", variant: "neutral" },
  maintenance: { label: "Manutenção externa", variant: "neutral" },
  completed: { label: "Concluído", variant: "success" },
  cancelled: { label: "Cancelado", variant: "danger" },
};

export function ticketStatus(status: string) {
  return (
    TICKET_STATUS[status as TicketStatus] ?? {
      label: status,
      variant: "neutral" as const,
    }
  );
}
