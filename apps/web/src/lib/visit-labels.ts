import type {
  VisitLocation,
  VisitStatus,
  VisitType,
} from "@cge/contracts";

/* =========================================================
 * TIPOS DE VISITA
 * ======================================================= */

export const visitTypeLabels: Record<
  VisitType,
  string
> = {
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

/* =========================================================
 * STATUS
 * ======================================================= */

export const visitStatusLabels: Record<
  VisitStatus,
  string
> = {
  pending: "Pendente",
  approved: "Aprovada",
  scheduled: "Liberada para recepção",
  in_progress: "Em atendimento",
  completed: "Concluída",
  cancelled: "Cancelada",
  rejected: "Recusada",
};

/* =========================================================
 * SALAS / LOCAIS DA VISITA
 * ======================================================= */

export const visitLocationOptions: Array<{
  value: VisitLocation;
  label: string;
}> = [
  {
    value: "Sala de Reuniões - Anexo",
    label: "Sala de Reuniões - Anexo",
  },
  {
    value: "Sala de Reuniões - Sede",
    label: "Sala de Reuniões - Sede",
  },
  {
    value: "Auditório",
    label: "Auditório",
  },
];

/* =========================================================
 * LABEL DAS SALAS
 * ======================================================= */

export const visitLocationLabels: Record<
  VisitLocation,
  string
> = {
  "Sala de Reuniões - Anexo":
    "Sala de Reuniões - Anexo",

  "Sala de Reuniões - Sede":
    "Sala de Reuniões - Sede",

  "Auditório":
    "Auditório",
};