import type { AuthenticatedUser } from "@cge/contracts";
import {
  CalendarDots,
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
    anyOf: ["accounts.manage", "access.manage", "audit.read"],
    global: true,
  },
  hr: {
    anyOf: [
      "people.read",
      "vacations.create",
      "vacations.review.supervisor",
      "vacations.review.final",
    ],
  },
  people: { anyOf: ["people.read"] },
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
    access: accessRules.administration,
    label: "Administração",
    href: "/sistema/administracao",
    icon: GearSix,
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
