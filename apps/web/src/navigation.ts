import type {
  AuthenticatedUser,
} from "@cge/contracts";

import {
  CalendarDots,
  ClipboardText,
  GearSix,
  IdentificationCard,
  PlusCircle,
  SquaresFour,
  UsersFour,
  Package,
  Buildings,
  type Icon,
} from "@phosphor-icons/react";

import {
  canAccess,
  type AccessRule,
} from "./lib/permissions";



export type NavigationItem = {
  label: string;

  href: string;

  icon: Icon;

  end?: boolean;

  access:
    AccessRule;
};

export type ModuleNavigation =
  NavigationItem & {
    id: string;

    description:
      string;

    routes:
      NavigationItem[];
  };

export const homeNavigation:
  NavigationItem = {
  access: {
    anyOf: [],
  },

  label:
    "Início",

  href:
    "/",

  icon:
    SquaresFour,

  end:
    true,
};

export const accessRules = {
  administration: {
    anyOf: [
      "accounts.manage",
      "access.manage",
    ],

    global:
      true,
  },

  audit: {
    anyOf: [
      "audit.read",
    ],

    global:
      true,
  },

  hr: {
    anyOf: [
      "people.read",
      "vacations.create",
      "vacations.review.supervisor",
      "vacations.review.final",
    ],
  },

  people: {
    anyOf: [
      "people.read",
    ],
  },

  vacations: {
    anyOf: [
      "vacations.create",
      "vacations.review.supervisor",
      "vacations.review.final",
    ],
  },

  visits: {
    anyOf: [
      "visits.read",
      "visits.create",
      "visits.manage",
      "visits.approve",
    ],
  },

  visitsCreate: {
    anyOf: [
      "visits.create",
      "visits.manage",
    ],
  },

  visitsManage: {
    anyOf: [
      "visits.manage",
    ],
  },

  patrimony:{
    anyOf: [
      "assets.read",
      "assets.manage",
    ],
  },
} as const satisfies Record<
  string,
  AccessRule
>;

export const moduleNavigation:
  ModuleNavigation[] = [
  {
    id:
      "hr",

    access:
      accessRules.hr,

    label:
      "Recursos Humanos",

    description:
      "Pessoas, aniversários e fluxo de férias",

    href:
      "/rh",

    icon:
      UsersFour,

    routes: [
      {
        access:
          accessRules.hr,

        label:
          "Visão geral",

        href:
          "/rh",

        icon:
          SquaresFour,

        end:
          true,
      },

      {
        access:
          accessRules.people,

        label:
          "Colaboradores",

        href:
          "/rh/colaboradores",

        icon:
          IdentificationCard,
      },

      {
        access:
          accessRules.vacations,

        label:
          "Férias",

        href:
          "/rh/ferias",

        icon:
          CalendarDots,
      },
    ],
  },

  {
    id:
      "visits",

    access:
      accessRules.visits,

    label:
      "Agendamento de Visitas",

    description:
      "Visitas institucionais, reuniões e apoio técnico",

    href:
      "/visitas",

    icon:
      CalendarDots,

    routes: [
      {
        access:
          accessRules.visits,

        label:
          "Visão geral",

        href:
          "/visitas",

        icon:
          SquaresFour,

        end:
          true,
      },

      {
        access:
          accessRules.visitsCreate,

        label:
          "Nova visita",

        href:
          "/visitas/nova",

        icon:
          PlusCircle,
      },

      {
        access:
          accessRules.visits,

        label:
          "Agenda",

        href:
          "/visitas/agenda",

        icon:
          CalendarDots,
      },

      {
        access:
          accessRules.visits,

        label:
          "Histórico",

        href:
          "/visitas/historico",

        icon:
          ClipboardText,
      },
    ],
  },

{
    id: "patrimony",

  label: "Controle de Patrimônio",

  description:
    "Gerenciamento dos bens patrimoniais da instituição.",

  href: "/patrimonio",

  icon: Package,

  access: {
    anyOf: [
      "assets.read",
      "assets.manage",
    ],
  },

  routes: [
    {
      label: "Visão Geral",

      href: "/patrimonio",

      icon: SquaresFour,

      end: true,

      access: {
        anyOf: [
          "assets.read",
          "assets.manage",
        ],
      },
    },

    {
      label: "Bens",

      href: "/patrimonio/bens",

      icon: Package,
      end: true,
      access: {
        anyOf: [
          "assets.read",
          "assets.manage",
        ],
      },
    },

    {
      label: "Novo Bem",

      href: "/patrimonio/bens/novo",

      icon: PlusCircle,

      access: {
        anyOf: [
          "assets.manage",
        ],
      },
    },

    {
      label: "Setores",
      href: "/patrimonio/setores",
      icon: Buildings,
      end: true,
      access: {
        anyOf: [
          "assets.read",
          "assets.manage",
        ],
      },
    },


  ],

},
  
];

export const systemNavigation:
  NavigationItem[] = [
  {
    access:
      accessRules.administration,

    label:
      "Administração",

    href:
      "/sistema/administracao",

    icon:
      GearSix,
  },

  {
    access:
      accessRules.audit,

    label:
      "Auditoria",

    href:
      "/sistema/auditoria",

    icon:
      ClipboardText,
  },
];

export function canNavigate(
  user:
    AuthenticatedUser,

  item:
    NavigationItem,
) {
  return (
    item.access.anyOf
      .length === 0 ||
    canAccess(
      user,
      item.access,
    )
  );
}

export function availableModules(
  user:
    AuthenticatedUser,
) {
  return moduleNavigation.filter(
    (module) =>
      canNavigate(
        user,
        module,
      ),
  );
}

export function availableSystemNavigation(
  user:
    AuthenticatedUser,
) {
  return systemNavigation.filter(
    (item) =>
      canNavigate(
        user,
        item,
      ),
  );
}