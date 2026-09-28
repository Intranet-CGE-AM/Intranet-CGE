import type {
  AuthenticatedUser,
} from "@cge/contracts";

import {
  CalendarDots,
  ClipboardText,
  GearSix,
  Headset,
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

  tickets: {
    anyOf: [
      "tickets.create",
      "tickets.read",
      "tickets.attend",
      "tickets.approve",
      "tickets.manage",
    ],
  },
  ticketsCreate: { anyOf: ["tickets.create"] },
  ticketsAttend: { anyOf: ["tickets.attend", "tickets.manage"] },
  ticketsApprove: { anyOf: ["tickets.approve", "tickets.manage"] },
  ticketsManage: { anyOf: ["tickets.manage", "tickets.attend"] },
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
    {
      label: "Relatórios",

      href: "/patrimonio/relatorios",

      icon: ClipboardText,

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
  
  {
    id: "tickets",
    access: accessRules.tickets,
    label: "Suporte e Chamados TI",
    description: "Abertura, acompanhamento e atendimento técnico de TI",
    href: "/suporte",
    icon: Headset,
    routes: [
      {
        access: accessRules.tickets,
        label: "Painel de Chamados",
        href: "/suporte",
        icon: SquaresFour,
        end: true,
      },
      {
        access: accessRules.ticketsCreate,
        label: "Novo Chamado",
        href: "/suporte/novo",
        icon: PlusCircle,
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