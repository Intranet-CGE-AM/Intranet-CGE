import type { AuthenticatedUser } from "@cge/contracts";
import {
  CalendarDots,
  GearSix,
  IdentificationCard,
  SquaresFour,
  UsersFour,
  type Icon,
} from "@phosphor-icons/react";

import { can } from "./lib/permissions";

export type NavigationItem = {
  label: string;
  href: string;
  icon: Icon;
  end?: boolean;
  visible: (user: AuthenticatedUser) => boolean;
};

export type ModuleNavigation = NavigationItem & {
  id: string;
  description: string;
  routes: NavigationItem[];
};

export const homeNavigation: NavigationItem = {
  label: "Início",
  href: "/",
  icon: SquaresFour,
  end: true,
  visible: () => true,
};

const canAccessPeople = (user: AuthenticatedUser) => can(user, "people.read");
const canAccessVacations = (user: AuthenticatedUser) =>
  can(user, "vacations.create") ||
  can(user, "vacations.review.supervisor") ||
  can(user, "vacations.review.final");

export const moduleNavigation: ModuleNavigation[] = [
  {
    id: "hr",
    label: "Recursos Humanos",
    description: "Pessoas, aniversários e fluxo de férias",
    href: "/rh",
    icon: UsersFour,
    visible: (user) => canAccessPeople(user) || canAccessVacations(user),
    routes: [
      {
        label: "Visão geral",
        href: "/rh",
        icon: SquaresFour,
        end: true,
        visible: (user) => canAccessPeople(user) || canAccessVacations(user),
      },
      {
        label: "Colaboradores",
        href: "/rh/colaboradores",
        icon: IdentificationCard,
        visible: canAccessPeople,
      },
      {
        label: "Férias",
        href: "/rh/ferias",
        icon: CalendarDots,
        visible: canAccessVacations,
      },
    ],
  },
];

export const systemNavigation: NavigationItem[] = [
  {
    label: "Administração",
    href: "/sistema/administracao",
    icon: GearSix,
    visible: (user) =>
      can(user, "accounts.manage") ||
      can(user, "access.manage") ||
      can(user, "audit.read"),
  },
];

export function availableModules(user: AuthenticatedUser) {
  return moduleNavigation.filter((module) => module.visible(user));
}

export function availableSystemNavigation(user: AuthenticatedUser) {
  return systemNavigation.filter((item) => item.visible(user));
}
