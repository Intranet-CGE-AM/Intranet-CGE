import type { AuthenticatedUser } from "@cge/contracts";
import {
  CalendarDots,
  ClipboardText,
  GearSix,
  IdentificationCard,
  SquaresFour,
  UsersFour,
  type Icon,
} from "@phosphor-icons/react";

import { canAccess, type AccessRule } from "./lib/permissions";

export type NavigationItem = {
  label: string;
  href: string;
  icon: Icon;
  end?: boolean;
  access: AccessRule;
};

export type ModuleNavigation = NavigationItem & {
  id: string;
  description: string;
  routes: NavigationItem[];
};

export const homeNavigation: NavigationItem = {
  access: { anyOf: [] },
  label: "Início",
  href: "/",
  icon: SquaresFour,
  end: true,
};

export const accessRules = {
  administration: {
    anyOf: ["accounts.manage", "access.manage"],
    global: true,
  },
  audit: {
    anyOf: ["audit.read"],
    global: true,
  },
  hr: {
    anyOf: [
      "people.read",
      "people.manage",
      "vacations.create",
      "vacations.review.supervisor",
      "vacations.review.final",
      "hr_requests.create",
      "hr_requests.manage",
      "documents.read",
      "documents.manage",
      "employment.manage_history",
      "occurrences.create",
      "occurrences.review.supervisor",
      "occurrences.review.final",
      "occurrences.manage_types",
      "training.create",
      "training.review",
      "onboarding.manage",
      "onboarding.manage_templates",
      "workflows.manage_substitutions",
      "organization.read",
      "organization.manage_positions",
    ],
  },
  people: { anyOf: ["people.read"] },
  metrics: {
    anyOf: [
      "hr_requests.manage",
      "occurrences.review.final",
      "vacations.review.final",
      "training.review",
      "people.manage",
    ],
  },
  availability: {
    anyOf: [
      "people.manage",
      "vacations.review.supervisor",
      "occurrences.review.supervisor",
    ],
  },
  occurrences: {
    anyOf: [
      "occurrences.create",
      "occurrences.review.supervisor",
      "occurrences.review.final",
      "occurrences.manage_types",
    ],
  },
  vacations: {
    anyOf: [
      "vacations.create",
      "vacations.review.supervisor",
      "vacations.review.final",
    ],
  },
} as const satisfies Record<string, AccessRule>;

export const moduleNavigation: ModuleNavigation[] = [
  {
    id: "hr",
    access: accessRules.hr,
    label: "Recursos Humanos",
    description: "Pessoas, aniversários e fluxo de férias",
    href: "/rh",
    icon: UsersFour,
    routes: [
      {
        access: {
          anyOf: ["organization.read", "organization.manage_positions"],
        },
        label: "Estrutura e cargos",
        href: "/rh/estrutura",
        icon: UsersFour,
      },
      {
        access: { anyOf: ["workflows.manage_substitutions"] },
        label: "Substituições",
        href: "/rh/substituicoes",
        icon: UsersFour,
      },
      {
        access: { anyOf: [] },
        label: "Minhas pendências",
        href: "/rh/pendencias",
        icon: ClipboardText,
      },
      {
        access: { anyOf: [] },
        label: "Checklists",
        href: "/rh/checklists",
        icon: ClipboardText,
      },
      {
        access: accessRules.metrics,
        label: "Indicadores",
        href: "/rh/indicadores",
        icon: SquaresFour,
      },
      {
        access: { anyOf: [] },
        label: "Capacitações",
        href: "/rh/capacitacoes",
        icon: ClipboardText,
      },
      {
        access: accessRules.availability,
        label: "Disponibilidade",
        href: "/rh/disponibilidade",
        icon: CalendarDots,
      },
      {
        access: accessRules.occurrences,
        label: "Ocorrências",
        href: "/rh/ocorrencias",
        icon: ClipboardText,
      },
      {
        access: { anyOf: ["employment.manage_history"] },
        label: "Histórico funcional",
        href: "/rh/historico",
        icon: IdentificationCard,
      },
      {
        access: { anyOf: ["documents.read", "documents.manage"] },
        label: "Documentos",
        href: "/rh/documentos",
        icon: ClipboardText,
      },
      {
        access: { anyOf: ["hr_requests.create", "hr_requests.manage"] },
        label: "Solicitações",
        href: "/rh/solicitacoes",
        icon: ClipboardText,
      },
      {
        access: { anyOf: [] },
        label: "Meu dossiê",
        href: "/rh/meu-dossie",
        icon: IdentificationCard,
      },
      {
        access: accessRules.hr,
        label: "Visão geral",
        href: "/rh",
        icon: SquaresFour,
        end: true,
      },
      {
        access: accessRules.people,
        label: "Colaboradores",
        href: "/rh/colaboradores",
        icon: IdentificationCard,
      },
      {
        access: accessRules.vacations,
        label: "Férias",
        href: "/rh/ferias",
        icon: CalendarDots,
      },
    ],
  },
];

export const systemNavigation: NavigationItem[] = [
  {
    access: { anyOf: [] },
    label: "Políticas e formulários",
    href: "/biblioteca",
    icon: ClipboardText,
  },
  {
    access: { anyOf: [] },
    label: "Comunicados",
    href: "/comunicados",
    icon: ClipboardText,
  },
  {
    access: accessRules.administration,
    label: "Administração",
    href: "/sistema/administracao",
    icon: GearSix,
  },
  {
    access: accessRules.audit,
    label: "Auditoria",
    href: "/sistema/auditoria",
    icon: ClipboardText,
  },
];

export function canNavigate(user: AuthenticatedUser, item: NavigationItem) {
  return item.access.anyOf.length === 0 || canAccess(user, item.access);
}

export function availableModules(user: AuthenticatedUser) {
  return moduleNavigation.filter((module) => canNavigate(user, module));
}

export function availableSystemNavigation(user: AuthenticatedUser) {
  return systemNavigation.filter((item) => canNavigate(user, item));
}
