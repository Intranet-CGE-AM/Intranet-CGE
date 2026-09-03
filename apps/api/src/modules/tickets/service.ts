import crypto from "node:crypto";
import {
  type TechnicalArea,
  type TicketAnalyticsSummary,
  type TicketApprovalDecisionInput,
  type TicketAssignInput,
  type TicketCancelInput,
  type TicketCategory,
  type TicketCreateInput,
  type TicketDetail,
  type TicketFeedback,
  type TicketFeedbackInput,
  type TicketMessage,
  type TicketRecategorizeInput,
  type TicketReopenInput,
  type TicketStatus,
  type TicketSummary,
  type TicketTransitionInput,
} from "@cge/contracts";
import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNull,
  or,
  sql,
} from "drizzle-orm";

import type { Database } from "../../db/client.js";
import { userAccounts } from "../auth/schema.js";
import {
  employmentRelationships,
  organizationUnits,
  people,
} from "../people/schema.js";
import {
  ticketApprovals,
  ticketCategories,
  ticketCounters,
  ticketEvents,
  ticketFeedbacks,
  ticketMessages,
  tickets,
  ticketSubcategories,
} from "./schema.js";

export class TicketError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

// Matriz de transições permitidas para técnicos
const VALID_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  open: ["viewed", "cancelled"],
  viewed: ["en_route", "in_service", "paused", "maintenance", "cancelled"],
  en_route: ["in_service", "paused", "maintenance", "cancelled"],
  in_service: ["completed", "paused", "maintenance", "cancelled"],
  completed: [],
  cancelled: [],
  paused: ["viewed", "en_route", "in_service", "cancelled"],
  maintenance: ["viewed", "en_route", "in_service", "cancelled"],
};

export class TicketService {
  constructor(private readonly db: Database) {}

  // ── Semente de categorias e subcategorias padrão do Helpdesk ─────────────
  async ensureDefaultCategories(): Promise<void> {
    const existing = await this.db
      .select({ count: count() })
      .from(ticketCategories);
    if (existing[0]?.count && existing[0].count > 0) {
      return;
    }

    const defaultCategories = [
      {
        code: "HARDWARE",
        name: "Computador",
        icon: "Desktop",
        color: "blue",
        sortOrder: 1,
        allowsFreeText: false,
        allowsBeneficiary: true,
        defaultPriority: "medium" as const,
        slaHours: 4,
        n1Tips:
          "Verifique se todos os cabos de energia e vídeo estão firmemente conectados. Se o computador estiver travado, pressione o botão liga/desliga por 10 segundos.",
        subcategories: [
          {
            name: "Computador não liga",
            code: "HARDWARE_WONT_TURN_ON",
            requiresPresential: true,
            sortOrder: 1,
            slaHours: 4,
            areaResponsavel: "manutencao" as const,
          },
          {
            name: "Computador travado",
            code: "HARDWARE_FROZEN",
            requiresPresential: true,
            sortOrder: 2,
            slaHours: 4,
            areaResponsavel: "manutencao" as const,
          },
          {
            name: "Monitor sem imagem",
            code: "HARDWARE_NO_IMAGE",
            requiresPresential: true,
            sortOrder: 3,
            slaHours: 4,
            areaResponsavel: "manutencao" as const,
          },
          {
            name: "Mouse/Teclado não funciona",
            code: "HARDWARE_INPUT",
            requiresPresential: true,
            sortOrder: 4,
            slaHours: 2,
            areaResponsavel: "manutencao" as const,
          },
          {
            name: "Outro problema de computador",
            code: "HARDWARE_OTHER",
            requiresPresential: true,
            sortOrder: 5,
            slaHours: 4,
            allowsFreeText: true,
            areaResponsavel: "manutencao" as const,
          },
        ],
      },
      {
        code: "NETWORK",
        name: "Internet e Conexão",
        icon: "WifiHigh",
        color: "emerald",
        sortOrder: 2,
        allowsFreeText: false,
        allowsBeneficiary: true,
        defaultPriority: "medium" as const,
        slaHours: 2,
        n1Tips:
          "Verifique se o cabo de rede azul/amarelo está plugado na parte traseira da CPU e se os leds estão piscando.",
        subcategories: [
          {
            name: "Queda total de internet",
            code: "INTERNET_QUEDA",
            requiresPresential: true,
            sortOrder: 1,
            slaHours: 2,
            areaResponsavel: "redes" as const,
          },
          {
            name: "Lentidão na navegação",
            code: "INTERNET_LENTIDAO",
            requiresPresential: true,
            sortOrder: 2,
            slaHours: 4,
            areaResponsavel: "redes" as const,
          },
          {
            name: "Intermitência ou oscilação",
            code: "INTERNET_INTERMITENCIA",
            requiresPresential: true,
            sortOrder: 3,
            slaHours: 4,
            areaResponsavel: "redes" as const,
          },
        ],
      },
      {
        code: "NETSERVER",
        name: "Rede e Servidores",
        icon: "HardDrives",
        color: "indigo",
        sortOrder: 3,
        allowsFreeText: false,
        allowsBeneficiary: true,
        defaultPriority: "medium" as const,
        slaHours: 8,
        n1Tips:
          "Para criação de usuário ou concessão de acesso a pastas confidenciais, é necessária a aprovação da chefia do setor solicitante.",
        subcategories: [
          {
            name: "Criação de usuário na rede",
            code: "NETSERVER_USER_CREATE",
            requiresApproval: true,
            requiresPresential: false,
            requiresCauseSolution: false,
            sortOrder: 1,
            slaHours: 8,
            areaResponsavel: "redes" as const,
          },
          {
            name: "Exclusão / Desativação de usuário",
            code: "NETSERVER_USER_DELETE",
            requiresPresential: false,
            requiresCauseSolution: false,
            sortOrder: 2,
            slaHours: 8,
            areaResponsavel: "redes" as const,
          },
          {
            name: "Atualização de permissões de usuário",
            code: "NETSERVER_USER_UPDATE",
            requiresApproval: true,
            requiresPresential: false,
            requiresCauseSolution: false,
            sortOrder: 3,
            slaHours: 8,
            areaResponsavel: "redes" as const,
          },
          {
            name: "Reset de senha de rede",
            code: "NETSERVER_PASSWORD_RESET",
            requiresPresential: false,
            requiresCauseSolution: false,
            sortOrder: 4,
            slaHours: 2,
            areaResponsavel: "redes" as const,
          },
          {
            name: "Criação de nova pasta compartilhada",
            code: "NETSERVER_FOLDER_CREATE",
            requiresApproval: true,
            requiresPresential: false,
            requiresCauseSolution: false,
            sortOrder: 5,
            slaHours: 8,
            areaResponsavel: "redes" as const,
          },
          {
            name: "Mapeamento de pasta de rede",
            code: "NETSERVER_FOLDER_MAP",
            requiresPresential: false,
            requiresCauseSolution: false,
            sortOrder: 6,
            slaHours: 4,
            areaResponsavel: "redes" as const,
          },
          {
            name: "Falha de relação de confiança",
            code: "NETSERVER_TRUST_FAIL",
            requiresPresential: true,
            sortOrder: 7,
            slaHours: 2,
            areaResponsavel: "redes" as const,
          },
          {
            name: "Acesso VPN institucional",
            code: "NETSERVER_VPN",
            requiresApproval: true,
            requiresPresential: false,
            requiresCauseSolution: false,
            sortOrder: 8,
            slaHours: 8,
            areaResponsavel: "redes" as const,
          },
        ],
      },
      {
        code: "SIGED",
        name: "SIGED e Sistemas",
        icon: "FileText",
        color: "orange",
        sortOrder: 4,
        allowsFreeText: false,
        allowsBeneficiary: true,
        defaultPriority: "medium" as const,
        slaHours: 8,
        n1Tips:
          "Certifique-se de que a pessoa cadastrada possui CPF válido e lotação ativa no órgão.",
        subcategories: [
          {
            name: "Cadastro de usuário no SIGED",
            code: "SIGED_USER_CREATE",
            requiresPresential: false,
            requiresCauseSolution: false,
            sortOrder: 1,
            slaHours: 8,
            areaResponsavel: "sistemas" as const,
          },
          {
            name: "Realocação de setor no SIGED",
            code: "SIGED_SECTOR_MOVE",
            requiresApproval: true,
            dualApproval: true,
            requiresPresential: false,
            requiresCauseSolution: false,
            sortOrder: 2,
            slaHours: 8,
            areaResponsavel: "sistemas" as const,
          },
          {
            name: "Desativação de usuário no SIGED",
            code: "SIGED_USER_DELETE",
            requiresPresential: false,
            requiresCauseSolution: false,
            sortOrder: 3,
            slaHours: 8,
            areaResponsavel: "sistemas" as const,
          },
          {
            name: "Reset de senha do SIGED",
            code: "SIGED_PASSWORD_RESET",
            requiresPresential: false,
            requiresCauseSolution: false,
            sortOrder: 4,
            slaHours: 2,
            areaResponsavel: "sistemas" as const,
          },
          {
            name: "Cadastrar novo setor no SIGED",
            code: "SIGED_SECTOR_CREATE",
            requiresApproval: true,
            requiresPresential: false,
            requiresCauseSolution: false,
            sortOrder: 5,
            slaHours: 8,
            areaResponsavel: "sistemas" as const,
          },
        ],
      },
      {
        code: "PRINTER",
        name: "Impressora e Suprimentos",
        icon: "Printer",
        color: "purple",
        sortOrder: 5,
        allowsFreeText: false,
        allowsBeneficiary: true,
        defaultPriority: "medium" as const,
        slaHours: 4,
        n1Tips:
          "Para troca de toner ou solicitação de papel, tire o relatório de contadores da máquina conforme as instruções do seu modelo.",
        subcategories: [
          {
            name: "Impressora não aparece no computador",
            code: "PRINTER_NOT_VISIBLE",
            requiresPresential: true,
            sortOrder: 1,
            slaHours: 4,
            areaResponsavel: "manutencao" as const,
          },
          {
            name: "Impressora offline / desconectada",
            code: "PRINTER_OFFLINE",
            requiresPresential: true,
            sortOrder: 2,
            slaHours: 4,
            areaResponsavel: "manutencao" as const,
          },
          {
            name: "Impressão travada / Não sai",
            code: "PRINTER_NO_PRINT",
            requiresPresential: true,
            sortOrder: 3,
            slaHours: 4,
            areaResponsavel: "manutencao" as const,
          },
          {
            name: "Papel enroscado / atolamento",
            code: "PRINTER_PAPER_JAM",
            requiresPresential: true,
            sortOrder: 4,
            slaHours: 2,
            areaResponsavel: "manutencao" as const,
          },
          {
            name: "Sem papel (reposição de resmas)",
            code: "PRINTER_NO_PAPER",
            requiresPresential: true,
            formType: "printer_counter",
            sortOrder: 5,
            slaHours: 4,
            areaResponsavel: "manutencao" as const,
          },
          {
            name: "Troca de toner / cartucho",
            code: "PRINTER_TONER",
            requiresPresential: true,
            formType: "printer_counter",
            sortOrder: 6,
            slaHours: 4,
            areaResponsavel: "manutencao" as const,
          },
        ],
      },
      {
        code: "REMOTE",
        name: "Suporte Remoto (AnyDesk)",
        icon: "MonitorArrowUp",
        color: "cyan",
        sortOrder: 6,
        allowsFreeText: true,
        allowsBeneficiary: false,
        defaultPriority: "medium" as const,
        slaHours: 2,
        n1Tips:
          "Abra o aplicativo AnyDesk instalado no seu computador, copie o código numérico de 9 a 10 dígitos e mantenha o aplicativo aberto para aceitar a conexão do técnico da CGE.",
        subcategories: [],
      },
    ];

    await this.db.transaction(async (tx) => {
      for (const cat of defaultCategories) {
        const [createdCat] = await tx
          .insert(ticketCategories)
          .values({
            code: cat.code,
            name: cat.name,
            icon: cat.icon,
            color: cat.color,
            sortOrder: cat.sortOrder,
            allowsFreeText: cat.allowsFreeText,
            allowsBeneficiary: cat.allowsBeneficiary,
            n1Tips: cat.n1Tips,
            slaHours: cat.slaHours,
            defaultPriority: cat.defaultPriority,
          })
          .returning({ id: ticketCategories.id });

        if (createdCat && cat.subcategories.length > 0) {
          for (const sub of cat.subcategories) {
            const s = sub as {
              name: string;
              code: string;
              sortOrder: number;
              slaHours: number;
              areaResponsavel: "manutencao" | "redes" | "sistemas";
              requiresApproval?: boolean;
              dualApproval?: boolean;
              requiresPresential?: boolean;
              requiresCauseSolution?: boolean;
              allowsFreeText?: boolean;
              formType?: string | null;
            };
            await tx.insert(ticketSubcategories).values({
              categoryId: createdCat.id,
              name: s.name,
              code: s.code,
              sortOrder: s.sortOrder,
              slaHours: s.slaHours,
              areaResponsavel: s.areaResponsavel,
              requiresApproval: s.requiresApproval ?? false,
              dualApproval: s.dualApproval ?? false,
              requiresPresential: s.requiresPresential ?? true,
              requiresCauseSolution: s.requiresCauseSolution ?? true,
              allowsFreeText: s.allowsFreeText ?? false,
              formType: s.formType ?? null,
            });
          }
        }
      }
    });
  }

  // ── Listar Categorias e Subcategorias ────────────────────────────────────
  async listCategories(activeOnly = true): Promise<TicketCategory[]> {
    await this.ensureDefaultCategories();

    const categoriesQuery = this.db
      .select()
      .from(ticketCategories)
      .orderBy(asc(ticketCategories.sortOrder), asc(ticketCategories.name));

    const allCategories = activeOnly
      ? await categoriesQuery.where(eq(ticketCategories.active, true))
      : await categoriesQuery;

    const subcategoriesQuery = this.db
      .select()
      .from(ticketSubcategories)
      .orderBy(
        asc(ticketSubcategories.sortOrder),
        asc(ticketSubcategories.name),
      );

    const allSubcategories = activeOnly
      ? await subcategoriesQuery.where(eq(ticketSubcategories.active, true))
      : await subcategoriesQuery;

    const subMap = new Map<string, typeof allSubcategories>();
    for (const sub of allSubcategories) {
      const list = subMap.get(sub.categoryId) ?? [];
      list.push(sub);
      subMap.set(sub.categoryId, list);
    }

    return allCategories.map((cat) => ({
      ...cat,
      subcategories: (subMap.get(cat.id) ?? []).map((sub) => ({
        ...sub,
        code: sub.code ?? null,
        n1Tips: sub.n1Tips ?? null,
        freeTextLabel: sub.freeTextLabel ?? null,
        formType: sub.formType ?? null,
      })),
    }));
  }

  // ── Gerar Número Sequencial Diário de Chamado (#YYYYMMDD-XXXX) ───────────
  private async getNextTicketNumber(tx: Database): Promise<string> {
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Manaus",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date()); // Formato YYYY-MM-DD

    const dateKey = today.replace(/-/g, ""); // YYYYMMDD

    const [row] = await tx
      .insert(ticketCounters)
      .values({ date: today, count: 1 })
      .onConflictDoUpdate({
        target: ticketCounters.date,
        set: { count: sql`${ticketCounters.count} + 1` },
      })
      .returning({ count: ticketCounters.count });

    const seq = String(row?.count ?? 1).padStart(4, "0");
    return `${dateKey}-${seq}`;
  }

  // ── Abrir Novo Chamado (Usuário Comum / Solicitante) ─────────────────────
  async createTicket(
    requesterAccountId: string,
    input: TicketCreateInput,
  ): Promise<TicketDetail> {
    const [account] = await this.db
      .select({
        id: userAccounts.id,
        email: userAccounts.email,
        personId: people.id,
        fullName: people.fullName,
      })
      .from(userAccounts)
      .innerJoin(people, eq(userAccounts.personId, people.id))
      .where(eq(userAccounts.id, requesterAccountId))
      .limit(1);

    if (!account) {
      throw new TicketError(
        401,
        "UNAUTHORIZED",
        "Conta de usuário não encontrada.",
      );
    }

    // Busca vínculo funcional ativo
    const [employment] = await this.db
      .select({
        employeeNumber: employmentRelationships.employeeNumber,
        unitId: employmentRelationships.unitId,
        unitName: organizationUnits.name,
      })
      .from(employmentRelationships)
      .leftJoin(
        organizationUnits,
        eq(employmentRelationships.unitId, organizationUnits.id),
      )
      .where(
        and(
          eq(employmentRelationships.personId, account.personId),
          isNull(employmentRelationships.endDate),
        ),
      )
      .limit(1);

    const [category] = await this.db
      .select()
      .from(ticketCategories)
      .where(eq(ticketCategories.id, input.categoryId))
      .limit(1);

    if (!category || !category.active) {
      throw new TicketError(
        400,
        "INVALID_CATEGORY",
        "Categoria inválida ou inativa.",
      );
    }

    let subcategory: typeof ticketSubcategories.$inferSelect | null = null;
    if (input.subcategoryId) {
      const [sub] = await this.db
        .select()
        .from(ticketSubcategories)
        .where(
          and(
            eq(ticketSubcategories.id, input.subcategoryId),
            eq(ticketSubcategories.categoryId, category.id),
          ),
        )
        .limit(1);

      if (!sub || !sub.active) {
        throw new TicketError(
          400,
          "INVALID_SUBCATEGORY",
          "Subcategoria inválida para a categoria selecionada.",
        );
      }
      subcategory = sub;
    } else if (!category.allowsFreeText && category.code !== "REMOTE") {
      throw new TicketError(
        400,
        "SUBCATEGORY_REQUIRED",
        "Selecione uma subcategoria para prosseguir.",
      );
    }

    const isRemote = category.code === "REMOTE";
    if (isRemote) {
      if (!input.anyDeskCode || input.anyDeskCode.trim().length < 3) {
        throw new TicketError(
          400,
          "ANYDESK_REQUIRED",
          "Informe o código do AnyDesk (mínimo de 3 caracteres).",
        );
      }
      if (
        !input.freeTextDescription ||
        input.freeTextDescription.trim().length < 5
      ) {
        throw new TicketError(
          400,
          "DESCRIPTION_REQUIRED",
          "Descreva o problema para atendimento remoto (mínimo de 5 caracteres).",
        );
      }
    } else if (category.allowsFreeText || subcategory?.allowsFreeText) {
      if (
        !input.freeTextDescription ||
        input.freeTextDescription.trim().length < 5
      ) {
        throw new TicketError(
          400,
          "DESCRIPTION_REQUIRED",
          "Descreva o problema com pelo menos 5 caracteres.",
        );
      }
    }

    const unitId = input.unitId ?? employment?.unitId ?? null;
    const priority = subcategory?.defaultPriority ?? category.defaultPriority;
    const slaHours = subcategory?.slaHours ?? category.slaHours ?? 4;
    const slaDeadline = new Date(Date.now() + slaHours * 60 * 60 * 1000);
    const requiresApproval = subcategory?.requiresApproval ?? false;
    const areaResponsavel = subcategory?.areaResponsavel ?? null;
    const presential = isRemote
      ? false
      : (subcategory?.requiresPresential ?? true);
    const requiresCauseSolution = isRemote
      ? true
      : (subcategory?.requiresCauseSolution ?? true);

    const trackToken = crypto.randomBytes(24).toString("hex");

    return await this.db.transaction(async (tx) => {
      const ticketNumber = await this.getNextTicketNumber(
        tx as unknown as Database,
      );

      const [created] = await tx
        .insert(tickets)
        .values({
          ticketNumber,
          trackToken,
          requesterAccountId: account.id,
          requesterPersonId: account.personId,
          requesterName: account.fullName,
          requesterEmail: account.email,
          requesterEmployeeNumber: employment?.employeeNumber ?? null,
          beneficiaryName: input.beneficiaryName || null,
          beneficiaryEmployeeNumber: input.beneficiaryEmployeeNumber || null,
          beneficiaryEmail: input.beneficiaryEmail || null,
          beneficiaryDept: input.beneficiaryDept || null,
          unitId,
          categoryId: category.id,
          subcategoryId: subcategory?.id ?? null,
          freeTextDescription: input.freeTextDescription?.trim() || null,
          anyDeskCode: input.anyDeskCode?.trim() || null,
          extraData: input.extraData ?? null,
          priority,
          areaResponsavel,
          status: "open",
          approvalStatus: requiresApproval ? "pending" : "not_required",
          presential,
          requiresCauseSolution,
          slaDeadline,
        })
        .returning();

      if (!created) {
        throw new TicketError(
          500,
          "CREATE_FAILED",
          "Não foi possível criar o chamado.",
        );
      }

      // Se requer aprovação, cria registro de aprovação para o setor
      if (requiresApproval && unitId) {
        await tx.insert(ticketApprovals).values({
          ticketId: created.id,
          unitId,
          status: "pending",
        });
      }

      // Evento inicial no histórico
      await tx.insert(ticketEvents).values({
        ticketId: created.id,
        actorAccountId: account.id,
        fromStatus: null,
        toStatus: "open",
        note: "Chamado aberto pelo solicitante.",
      });

      return (await this.getTicketByIdInternal(
        tx as unknown as Database,
        created.id,
      ))!;
    });
  }

  // ── Listar Meus Chamados (Usuário Comum) ─────────────────────────────────
  async listMyTickets(accountId: string): Promise<TicketSummary[]> {
    const rows = await this.db
      .select({
        ticket: tickets,
        category: ticketCategories,
        subcategory: ticketSubcategories,
        unit: organizationUnits,
        assignedTechPerson: people,
        feedback: ticketFeedbacks.id,
      })
      .from(tickets)
      .innerJoin(ticketCategories, eq(tickets.categoryId, ticketCategories.id))
      .leftJoin(
        ticketSubcategories,
        eq(tickets.subcategoryId, ticketSubcategories.id),
      )
      .leftJoin(organizationUnits, eq(tickets.unitId, organizationUnits.id))
      .leftJoin(
        userAccounts,
        eq(tickets.assignedTechAccountId, userAccounts.id),
      )
      .leftJoin(people, eq(userAccounts.personId, people.id))
      .leftJoin(ticketFeedbacks, eq(tickets.id, ticketFeedbacks.ticketId))
      .where(eq(tickets.requesterAccountId, accountId))
      .orderBy(desc(tickets.openedAt));

    return rows.map((r) => this.formatTicketSummary(r));
  }

  // ── Listar Fila de Atendimento (Técnico / Administrador) ────────────────
  async listQueueTickets(
    unitIds?: string[] | null,
    statusFilter?: TicketStatus[],
    area?: TechnicalArea,
  ): Promise<TicketSummary[]> {
    const conditions = [];

    if (unitIds && unitIds.length > 0) {
      conditions.push(
        or(inArray(tickets.unitId, unitIds), isNull(tickets.unitId)),
      );
    }

    if (statusFilter && statusFilter.length > 0) {
      conditions.push(inArray(tickets.status, statusFilter));
    }

    if (area) {
      conditions.push(eq(tickets.areaResponsavel, area));
    }

    const rows = await this.db
      .select({
        ticket: tickets,
        category: ticketCategories,
        subcategory: ticketSubcategories,
        unit: organizationUnits,
        assignedTechPerson: people,
        feedback: ticketFeedbacks.id,
      })
      .from(tickets)
      .innerJoin(ticketCategories, eq(tickets.categoryId, ticketCategories.id))
      .leftJoin(
        ticketSubcategories,
        eq(tickets.subcategoryId, ticketSubcategories.id),
      )
      .leftJoin(organizationUnits, eq(tickets.unitId, organizationUnits.id))
      .leftJoin(
        userAccounts,
        eq(tickets.assignedTechAccountId, userAccounts.id),
      )
      .leftJoin(people, eq(userAccounts.personId, people.id))
      .leftJoin(ticketFeedbacks, eq(tickets.id, ticketFeedbacks.ticketId))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(tickets.openedAt))
      .limit(200);

    return rows.map((r) => this.formatTicketSummary(r));
  }

  // ── Listar Aprovações Pendentes (Chefe de Setor) ─────────────────────────
  async listPendingApprovals(
    unitIds?: string[] | null,
  ): Promise<TicketSummary[]> {
    const conditions = [
      eq(tickets.approvalStatus, "pending"),
      inArray(tickets.status, ["open", "viewed"]),
    ];

    if (unitIds && unitIds.length > 0) {
      conditions.push(inArray(tickets.unitId, unitIds));
    }

    const rows = await this.db
      .select({
        ticket: tickets,
        category: ticketCategories,
        subcategory: ticketSubcategories,
        unit: organizationUnits,
        assignedTechPerson: people,
        feedback: ticketFeedbacks.id,
      })
      .from(tickets)
      .innerJoin(ticketCategories, eq(tickets.categoryId, ticketCategories.id))
      .leftJoin(
        ticketSubcategories,
        eq(tickets.subcategoryId, ticketSubcategories.id),
      )
      .leftJoin(organizationUnits, eq(tickets.unitId, organizationUnits.id))
      .leftJoin(
        userAccounts,
        eq(tickets.assignedTechAccountId, userAccounts.id),
      )
      .leftJoin(people, eq(userAccounts.personId, people.id))
      .leftJoin(ticketFeedbacks, eq(tickets.id, ticketFeedbacks.ticketId))
      .where(and(...conditions))
      .orderBy(desc(tickets.openedAt));

    return rows.map((r) => this.formatTicketSummary(r));
  }

  // ── Obter Detalhes do Chamado ────────────────────────────────────────────
  async getTicket(
    id: string,
    actorAccountId: string,
    isStaffOrAdmin: boolean,
  ): Promise<TicketDetail> {
    const detail = await this.getTicketByIdInternal(this.db, id);
    if (!detail) {
      throw new TicketError(404, "NOT_FOUND", "Chamado não encontrado.");
    }

    if (!isStaffOrAdmin && detail.requesterAccountId !== actorAccountId) {
      throw new TicketError(
        403,
        "FORBIDDEN",
        "Você não tem acesso a este chamado.",
      );
    }

    return detail;
  }

  private async getTicketByIdInternal(
    db: Database,
    id: string,
  ): Promise<TicketDetail | null> {
    const [row] = await db
      .select({
        ticket: tickets,
        category: ticketCategories,
        subcategory: ticketSubcategories,
        unit: organizationUnits,
        assignedTechPerson: people,
        feedback: ticketFeedbacks,
      })
      .from(tickets)
      .innerJoin(ticketCategories, eq(tickets.categoryId, ticketCategories.id))
      .leftJoin(
        ticketSubcategories,
        eq(tickets.subcategoryId, ticketSubcategories.id),
      )
      .leftJoin(organizationUnits, eq(tickets.unitId, organizationUnits.id))
      .leftJoin(
        userAccounts,
        eq(tickets.assignedTechAccountId, userAccounts.id),
      )
      .leftJoin(people, eq(userAccounts.personId, people.id))
      .leftJoin(ticketFeedbacks, eq(tickets.id, ticketFeedbacks.ticketId))
      .where(eq(tickets.id, id))
      .limit(1);

    if (!row) return null;

    const messages = await db
      .select({
        message: ticketMessages,
        authorPerson: people,
      })
      .from(ticketMessages)
      .leftJoin(
        userAccounts,
        eq(ticketMessages.authorAccountId, userAccounts.id),
      )
      .leftJoin(people, eq(userAccounts.personId, people.id))
      .where(eq(ticketMessages.ticketId, id))
      .orderBy(asc(ticketMessages.createdAt));

    const events = await db
      .select({
        event: ticketEvents,
        actorPerson: people,
      })
      .from(ticketEvents)
      .leftJoin(userAccounts, eq(ticketEvents.actorAccountId, userAccounts.id))
      .leftJoin(people, eq(userAccounts.personId, people.id))
      .where(eq(ticketEvents.ticketId, id))
      .orderBy(asc(ticketEvents.createdAt));

    const approvals = await db
      .select({
        approval: ticketApprovals,
        unit: organizationUnits,
        approverPerson: people,
      })
      .from(ticketApprovals)
      .leftJoin(
        organizationUnits,
        eq(ticketApprovals.unitId, organizationUnits.id),
      )
      .leftJoin(
        userAccounts,
        eq(ticketApprovals.approverAccountId, userAccounts.id),
      )
      .leftJoin(people, eq(userAccounts.personId, people.id))
      .where(eq(ticketApprovals.ticketId, id))
      .orderBy(asc(ticketApprovals.createdAt));

    const summary = this.formatTicketSummary(row);

    return {
      ...summary,
      requesterAccountId: row.ticket.requesterAccountId,
      freeTextDescription: row.ticket.freeTextDescription,
      anyDeskCode: row.ticket.anyDeskCode,
      extraData: row.ticket.extraData,
      cause: row.ticket.cause,
      solution: row.ticket.solution,
      completionNote: row.ticket.completionNote,
      cancelNote: row.ticket.cancelNote,
      pauseNote: row.ticket.pauseNote,
      pausedAt: row.ticket.pausedAt?.toISOString() ?? null,
      totalPausedMs: row.ticket.totalPausedMs,
      viewedAt: row.ticket.viewedAt?.toISOString() ?? null,
      enRouteAt: row.ticket.enRouteAt?.toISOString() ?? null,
      inServiceAt: row.ticket.inServiceAt?.toISOString() ?? null,
      reopenedAt: row.ticket.reopenedAt?.toISOString() ?? null,
      messages: messages.map((m) => ({
        id: m.message.id,
        ticketId: m.message.ticketId,
        authorAccountId: m.message.authorAccountId,
        authorName: m.authorPerson?.fullName ?? "Equipe de TI",
        fromUser: m.message.fromUser,
        content: m.message.content,
        createdAt: m.message.createdAt.toISOString(),
      })),
      events: events.map((e) => ({
        id: e.event.id,
        ticketId: e.event.ticketId,
        actorAccountId: e.event.actorAccountId,
        actorName: e.actorPerson?.fullName ?? "Sistema",
        fromStatus: e.event.fromStatus,
        toStatus: e.event.toStatus,
        note: e.event.note,
        createdAt: e.event.createdAt.toISOString(),
      })),
      approvals: approvals.map((a) => ({
        id: a.approval.id,
        ticketId: a.approval.ticketId,
        unitId: a.approval.unitId,
        unitName: a.unit?.name ?? null,
        approverAccountId: a.approval.approverAccountId,
        approverName: a.approverPerson?.fullName ?? null,
        isAtecApproval: a.approval.isAtecApproval,
        status: a.approval.status,
        note: a.approval.note,
        decidedAt: a.approval.decidedAt?.toISOString() ?? null,
        createdAt: a.approval.createdAt.toISOString(),
      })),
      feedback: row.feedback
        ? {
            id: row.feedback.id,
            ticketId: row.feedback.ticketId,
            rating: row.feedback.rating,
            comment: row.feedback.comment,
            technicianAccountId: row.feedback.technicianAccountId,
            technicianName: summary.technicianName,
            createdAt: row.feedback.createdAt.toISOString(),
          }
        : null,
    };
  }

  // ── Deliberação de Aprovação (Chefe de Setor) ─────────────────────────────
  async decideApproval(
    ticketId: string,
    approverAccountId: string,
    input: TicketApprovalDecisionInput,
  ): Promise<TicketDetail> {
    const [ticket] = await this.db
      .select()
      .from(tickets)
      .where(eq(tickets.id, ticketId))
      .limit(1);

    if (!ticket) {
      throw new TicketError(404, "NOT_FOUND", "Chamado não encontrado.");
    }

    if (ticket.approvalStatus !== "pending") {
      throw new TicketError(
        400,
        "INVALID_STATE",
        "Este chamado não está aguardando aprovação.",
      );
    }

    const newApprovalStatus =
      input.decision === "approve" ? "approved" : "rejected";

    await this.db.transaction(async (tx) => {
      await tx
        .update(ticketApprovals)
        .set({
          status: newApprovalStatus,
          approverAccountId,
          note: input.note?.trim() || null,
          decidedAt: new Date(),
        })
        .where(
          and(
            eq(ticketApprovals.ticketId, ticketId),
            eq(ticketApprovals.status, "pending"),
          ),
        );

      await tx
        .update(tickets)
        .set({
          approvalStatus: newApprovalStatus,
          status: input.decision === "reject" ? "cancelled" : ticket.status,
          cancelNote:
            input.decision === "reject"
              ? `Reprovado pela chefia: ${input.note || "Sem justificativa detalhada"}`
              : ticket.cancelNote,
          updatedAt: new Date(),
        })
        .where(eq(tickets.id, ticketId));

      await tx.insert(ticketEvents).values({
        ticketId,
        actorAccountId: approverAccountId,
        fromStatus: ticket.status,
        toStatus: input.decision === "reject" ? "cancelled" : ticket.status,
        note:
          input.decision === "approve"
            ? `Solicitação aprovada pela chefia.${input.note ? ` Observação: ${input.note}` : ""}`
            : `Solicitação rejeitada pela chefia. Motivo: ${input.note || "Não informado"}`,
      });
    });

    return (await this.getTicketByIdInternal(this.db, ticketId))!;
  }

  // ── Transicionar Status (Técnico de TI) ──────────────────────────────────
  async transitionTicket(
    ticketId: string,
    actorAccountId: string,
    input: TicketTransitionInput,
  ): Promise<TicketDetail> {
    const [ticket] = await this.db
      .select()
      .from(tickets)
      .where(eq(tickets.id, ticketId))
      .limit(1);

    if (!ticket) {
      throw new TicketError(404, "NOT_FOUND", "Chamado não encontrado.");
    }

    if (ticket.approvalStatus === "pending" && input.toStatus === "viewed") {
      throw new TicketError(
        400,
        "APPROVAL_PENDING",
        "Este chamado aguarda aprovação da chefia antes de ser atendido.",
      );
    }

    if (ticket.approvalStatus === "rejected") {
      throw new TicketError(
        400,
        "APPROVAL_REJECTED",
        "Este chamado foi rejeitado pela chefia e não pode ser atendido.",
      );
    }

    const allowed = VALID_TRANSITIONS[ticket.status] ?? [];
    if (!allowed.includes(input.toStatus)) {
      throw new TicketError(
        400,
        "INVALID_TRANSITION",
        `Transição não permitida: ${ticket.status} → ${input.toStatus}`,
      );
    }

    const now = new Date();
    const patch: Partial<typeof tickets.$inferInsert> = {
      status: input.toStatus,
      updatedAt: now,
    };

    if (input.toStatus === "viewed") {
      patch.viewedAt = ticket.viewedAt ?? now;
      patch.assignedTechAccountId =
        input.assignedTechAccountId ??
        ticket.assignedTechAccountId ??
        actorAccountId;
      if (input.unitId) patch.unitId = input.unitId;
      if (input.areaResponsavel) patch.areaResponsavel = input.areaResponsavel;
    } else if (input.toStatus === "en_route") {
      patch.enRouteAt = now;
    } else if (input.toStatus === "in_service") {
      patch.inServiceAt = ticket.inServiceAt ?? now;
    } else if (input.toStatus === "completed") {
      if (
        ticket.requiresCauseSolution &&
        (!input.cause?.trim() || !input.solution?.trim())
      ) {
        throw new TicketError(
          400,
          "CAUSE_SOLUTION_REQUIRED",
          "Causa e solução são obrigatórias para concluir o chamado.",
        );
      }
      patch.completedAt = now;
      patch.cause = input.cause?.trim() || null;
      patch.solution = input.solution?.trim() || null;
      patch.completionNote = input.completionNote?.trim() || null;
    }

    await this.db.transaction(async (tx) => {
      await tx.update(tickets).set(patch).where(eq(tickets.id, ticketId));

      await tx.insert(ticketEvents).values({
        ticketId,
        actorAccountId,
        fromStatus: ticket.status,
        toStatus: input.toStatus,
        note: input.note?.trim() || `Status alterado para ${input.toStatus}.`,
      });
    });

    return (await this.getTicketByIdInternal(this.db, ticketId))!;
  }

  // ── Pausar / Manutenção / Retomar ────────────────────────────────────────
  async pauseTicket(
    ticketId: string,
    actorAccountId: string,
    reason: string,
  ): Promise<TicketDetail> {
    const [ticket] = await this.db
      .select()
      .from(tickets)
      .where(eq(tickets.id, ticketId))
      .limit(1);

    if (!ticket) {
      throw new TicketError(404, "NOT_FOUND", "Chamado não encontrado.");
    }

    if (!["viewed", "en_route", "in_service"].includes(ticket.status)) {
      throw new TicketError(
        400,
        "INVALID_STATE",
        "Apenas chamados em atendimento podem ser pausados.",
      );
    }

    await this.db.transaction(async (tx) => {
      await tx
        .update(tickets)
        .set({
          status: "paused",
          pausedAt: new Date(),
          pauseNote: reason.trim(),
          updatedAt: new Date(),
        })
        .where(eq(tickets.id, ticketId));

      await tx.insert(ticketEvents).values({
        ticketId,
        actorAccountId,
        fromStatus: ticket.status,
        toStatus: "paused",
        note: `Chamado pausado. Motivo: ${reason.trim()}`,
      });
    });

    return (await this.getTicketByIdInternal(this.db, ticketId))!;
  }

  async resumeTicket(
    ticketId: string,
    actorAccountId: string,
  ): Promise<TicketDetail> {
    const [ticket] = await this.db
      .select()
      .from(tickets)
      .where(eq(tickets.id, ticketId))
      .limit(1);

    if (!ticket) {
      throw new TicketError(404, "NOT_FOUND", "Chamado não encontrado.");
    }

    if (!["paused", "maintenance"].includes(ticket.status)) {
      throw new TicketError(
        400,
        "INVALID_STATE",
        "O chamado não está pausado ou em manutenção.",
      );
    }

    const pausedMs = ticket.pausedAt
      ? Date.now() - ticket.pausedAt.getTime()
      : 0;

    await this.db.transaction(async (tx) => {
      await tx
        .update(tickets)
        .set({
          status: "in_service",
          pausedAt: null,
          totalPausedMs: ticket.totalPausedMs + Math.max(0, pausedMs),
          updatedAt: new Date(),
        })
        .where(eq(tickets.id, ticketId));

      await tx.insert(ticketEvents).values({
        ticketId,
        actorAccountId,
        fromStatus: ticket.status,
        toStatus: "in_service",
        note: "Atendimento retomado.",
      });
    });

    return (await this.getTicketByIdInternal(this.db, ticketId))!;
  }

  // ── Reatribuir e Recategorizar ───────────────────────────────────────────
  async assignTicket(
    ticketId: string,
    actorAccountId: string,
    input: TicketAssignInput,
  ): Promise<TicketDetail> {
    const [ticket] = await this.db
      .select()
      .from(tickets)
      .where(eq(tickets.id, ticketId))
      .limit(1);

    if (!ticket) {
      throw new TicketError(404, "NOT_FOUND", "Chamado não encontrado.");
    }

    const patch: Partial<typeof tickets.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (input.assignedTechAccountId !== undefined) {
      patch.assignedTechAccountId = input.assignedTechAccountId;
    }
    if (input.unitId !== undefined) {
      patch.unitId = input.unitId;
    }
    if (input.areaResponsavel !== undefined) {
      patch.areaResponsavel = input.areaResponsavel;
    }

    await this.db.transaction(async (tx) => {
      await tx.update(tickets).set(patch).where(eq(tickets.id, ticketId));

      await tx.insert(ticketEvents).values({
        ticketId,
        actorAccountId,
        fromStatus: ticket.status,
        toStatus: ticket.status,
        note:
          input.note?.trim() || "Transferência de técnico/área responsável.",
      });
    });

    return (await this.getTicketByIdInternal(this.db, ticketId))!;
  }

  async recategorizeTicket(
    ticketId: string,
    actorAccountId: string,
    input: TicketRecategorizeInput,
  ): Promise<TicketDetail> {
    const [ticket] = await this.db
      .select()
      .from(tickets)
      .where(eq(tickets.id, ticketId))
      .limit(1);

    if (!ticket) {
      throw new TicketError(404, "NOT_FOUND", "Chamado não encontrado.");
    }

    if (["completed", "cancelled"].includes(ticket.status)) {
      throw new TicketError(
        400,
        "INVALID_STATE",
        "Não é possível alterar a categoria de chamados finalizados.",
      );
    }

    const [category] = await this.db
      .select()
      .from(ticketCategories)
      .where(eq(ticketCategories.id, input.categoryId))
      .limit(1);

    if (!category) {
      throw new TicketError(
        400,
        "INVALID_CATEGORY",
        "Categoria não encontrada.",
      );
    }

    let subcategory: typeof ticketSubcategories.$inferSelect | null = null;
    if (input.subcategoryId) {
      const [sub] = await this.db
        .select()
        .from(ticketSubcategories)
        .where(
          and(
            eq(ticketSubcategories.id, input.subcategoryId),
            eq(ticketSubcategories.categoryId, category.id),
          ),
        )
        .limit(1);
      if (!sub) {
        throw new TicketError(
          400,
          "INVALID_SUBCATEGORY",
          "Subcategoria inválida.",
        );
      }
      subcategory = sub;
    }

    await this.db.transaction(async (tx) => {
      await tx
        .update(tickets)
        .set({
          categoryId: category.id,
          subcategoryId: subcategory?.id ?? null,
          areaResponsavel:
            subcategory?.areaResponsavel ?? ticket.areaResponsavel,
          updatedAt: new Date(),
        })
        .where(eq(tickets.id, ticketId));

      await tx.insert(ticketEvents).values({
        ticketId,
        actorAccountId,
        fromStatus: ticket.status,
        toStatus: ticket.status,
        note: `Categoria alterada para "${category.name}"${subcategory ? ` › "${subcategory.name}"` : ""}.${input.note ? ` Observação: ${input.note}` : ""}`,
      });
    });

    return (await this.getTicketByIdInternal(this.db, ticketId))!;
  }

  // ── Cancelar e Reabrir Chamado (Solicitante / Técnico) ───────────────────
  async cancelTicket(
    ticketId: string,
    actorAccountId: string,
    input: TicketCancelInput,
  ): Promise<TicketDetail> {
    const [ticket] = await this.db
      .select()
      .from(tickets)
      .where(eq(tickets.id, ticketId))
      .limit(1);

    if (!ticket) {
      throw new TicketError(404, "NOT_FOUND", "Chamado não encontrado.");
    }

    if (ticket.status === "completed") {
      throw new TicketError(
        400,
        "ALREADY_COMPLETED",
        "Não é possível cancelar um chamado já concluído.",
      );
    }

    if (ticket.status === "cancelled") {
      throw new TicketError(400, "ALREADY_CANCELLED", "Chamado já cancelado.");
    }

    await this.db.transaction(async (tx) => {
      await tx
        .update(tickets)
        .set({
          status: "cancelled",
          cancelNote: input.reason.trim(),
          updatedAt: new Date(),
        })
        .where(eq(tickets.id, ticketId));

      await tx.insert(ticketEvents).values({
        ticketId,
        actorAccountId,
        fromStatus: ticket.status,
        toStatus: "cancelled",
        note: `Chamado cancelado. Justificativa: ${input.reason.trim()}`,
      });
    });

    return (await this.getTicketByIdInternal(this.db, ticketId))!;
  }

  async reopenTicket(
    ticketId: string,
    actorAccountId: string,
    input: TicketReopenInput,
  ): Promise<TicketDetail> {
    const [ticket] = await this.db
      .select()
      .from(tickets)
      .where(eq(tickets.id, ticketId))
      .limit(1);

    if (!ticket) {
      throw new TicketError(404, "NOT_FOUND", "Chamado não encontrado.");
    }

    if (!["completed", "cancelled"].includes(ticket.status)) {
      throw new TicketError(
        400,
        "CANNOT_REOPEN",
        "Apenas chamados concluídos ou cancelados podem ser reabertos.",
      );
    }

    await this.db.transaction(async (tx) => {
      await tx
        .update(tickets)
        .set({
          status: "open",
          completedAt: null,
          cause: null,
          solution: null,
          cancelNote: null,
          reopenedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(tickets.id, ticketId));

      await tx.insert(ticketEvents).values({
        ticketId,
        actorAccountId,
        fromStatus: ticket.status,
        toStatus: "open",
        note: `Chamado reaberto. Motivo: ${input.reason.trim()}`,
      });
    });

    return (await this.getTicketByIdInternal(this.db, ticketId))!;
  }

  // ── Mensagens / Chat ─────────────────────────────────────────────────────
  async sendMessage(
    ticketId: string,
    authorAccountId: string,
    content: string,
    fromUser: boolean,
  ): Promise<TicketMessage> {
    const [ticket] = await this.db
      .select()
      .from(tickets)
      .where(eq(tickets.id, ticketId))
      .limit(1);

    if (!ticket) {
      throw new TicketError(404, "NOT_FOUND", "Chamado não encontrado.");
    }

    const [authorPerson] = await this.db
      .select({ fullName: people.fullName })
      .from(userAccounts)
      .innerJoin(people, eq(userAccounts.personId, people.id))
      .where(eq(userAccounts.id, authorAccountId))
      .limit(1);

    const [created] = await this.db
      .insert(ticketMessages)
      .values({
        ticketId,
        authorAccountId,
        fromUser,
        content: content.trim(),
      })
      .returning();

    if (!created) {
      throw new TicketError(
        500,
        "MESSAGE_FAILED",
        "Não foi possível enviar a mensagem.",
      );
    }

    return {
      id: created.id,
      ticketId: created.ticketId,
      authorAccountId: created.authorAccountId,
      authorName:
        authorPerson?.fullName ?? (fromUser ? "Solicitante" : "Técnico"),
      fromUser: created.fromUser,
      content: created.content,
      createdAt: created.createdAt.toISOString(),
    };
  }

  // ── Avaliação de Satisfação ──────────────────────────────────────────────
  async submitFeedback(
    ticketId: string,
    requesterAccountId: string,
    input: TicketFeedbackInput,
  ): Promise<TicketFeedback> {
    const [ticket] = await this.db
      .select()
      .from(tickets)
      .where(eq(tickets.id, ticketId))
      .limit(1);

    if (!ticket) {
      throw new TicketError(404, "NOT_FOUND", "Chamado não encontrado.");
    }

    if (ticket.requesterAccountId !== requesterAccountId) {
      throw new TicketError(
        403,
        "FORBIDDEN",
        "Apenas o solicitante pode avaliar o atendimento.",
      );
    }

    if (ticket.status !== "completed") {
      throw new TicketError(
        400,
        "NOT_COMPLETED",
        "O chamado precisa estar concluído para ser avaliado.",
      );
    }

    const [existing] = await this.db
      .select()
      .from(ticketFeedbacks)
      .where(eq(ticketFeedbacks.ticketId, ticketId))
      .limit(1);

    if (existing) {
      throw new TicketError(400, "ALREADY_EVALUATED", "Avaliação já enviada.");
    }

    const [created] = await this.db
      .insert(ticketFeedbacks)
      .values({
        ticketId,
        rating: input.rating,
        comment: input.comment?.trim() || null,
        technicianAccountId: ticket.assignedTechAccountId,
      })
      .returning();

    if (!created) {
      throw new TicketError(
        500,
        "FEEDBACK_FAILED",
        "Não foi possível salvar a avaliação.",
      );
    }

    return {
      id: created.id,
      ticketId: created.ticketId,
      rating: created.rating,
      comment: created.comment,
      technicianAccountId: created.technicianAccountId,
      createdAt: created.createdAt.toISOString(),
    };
  }

  // ── Métricas e Analytics (Gestores / Administradores) ────────────────────
  async getAnalyticsSummary(
    unitIds?: string[] | null,
  ): Promise<TicketAnalyticsSummary> {
    const conditions = [];
    if (unitIds && unitIds.length > 0) {
      conditions.push(inArray(tickets.unitId, unitIds));
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const allTickets = await this.db
      .select({
        id: tickets.id,
        status: tickets.status,
        slaDeadline: tickets.slaDeadline,
        completedAt: tickets.completedAt,
        categoryId: tickets.categoryId,
        unitId: tickets.unitId,
        assignedTechAccountId: tickets.assignedTechAccountId,
      })
      .from(tickets)
      .where(whereClause);

    let openCount = 0;
    let inServiceCount = 0;
    let completedCount = 0;
    let cancelledCount = 0;
    let pausedCount = 0;
    let slaBreachedCount = 0;

    const now = new Date();
    for (const t of allTickets) {
      if (t.status === "open" || t.status === "viewed") openCount++;
      else if (t.status === "in_service" || t.status === "en_route")
        inServiceCount++;
      else if (t.status === "completed") completedCount++;
      else if (t.status === "cancelled") cancelledCount++;
      else if (t.status === "paused" || t.status === "maintenance")
        pausedCount++;

      if (t.slaDeadline) {
        const compareDate = t.completedAt ?? now;
        if (compareDate > t.slaDeadline) {
          slaBreachedCount++;
        }
      }
    }

    const total = allTickets.length;
    const slaCompliancePercentage =
      total > 0 ? Math.round(((total - slaBreachedCount) / total) * 100) : 100;

    const feedbacks = await this.db.select().from(ticketFeedbacks);
    const totalFeedbacks = feedbacks.length;
    const averageRating =
      totalFeedbacks > 0
        ? Number(
            (
              feedbacks.reduce((acc, f) => acc + f.rating, 0) / totalFeedbacks
            ).toFixed(1),
          )
        : null;

    // Agrupamento por categoria
    const categories = await this.listCategories();
    const categoryMap = new Map<string, string>();
    for (const c of categories) categoryMap.set(c.id, c.name);

    const catCounts = new Map<string, number>();
    for (const t of allTickets) {
      catCounts.set(t.categoryId, (catCounts.get(t.categoryId) ?? 0) + 1);
    }
    const byCategory = Array.from(catCounts.entries()).map(
      ([categoryId, count]) => ({
        categoryId,
        categoryName: categoryMap.get(categoryId) ?? "Outro",
        count,
      }),
    );

    // Agrupamento por unidade
    const allUnits = await this.db.select().from(organizationUnits);
    const unitMap = new Map<string, string>();
    for (const u of allUnits) unitMap.set(u.id, u.name);

    const unitCounts = new Map<string | null, number>();
    for (const t of allTickets) {
      unitCounts.set(t.unitId, (unitCounts.get(t.unitId) ?? 0) + 1);
    }
    const byUnit = Array.from(unitCounts.entries()).map(([unitId, count]) => ({
      unitId,
      unitName: unitId ? (unitMap.get(unitId) ?? "Sem unidade") : "Sem unidade",
      count,
    }));

    return {
      total,
      open: openCount,
      inService: inServiceCount,
      completed: completedCount,
      cancelled: cancelledCount,
      paused: pausedCount,
      slaBreachedCount,
      slaCompliancePercentage,
      averageRating,
      totalFeedbacks,
      byCategory,
      byUnit,
      byTechnician: [],
    };
  }

  // ── Auxiliares de Formatação ─────────────────────────────────────────────
  private formatTicketSummary(row: {
    ticket: typeof tickets.$inferSelect;
    category: typeof ticketCategories.$inferSelect;
    subcategory: typeof ticketSubcategories.$inferSelect | null;
    unit: typeof organizationUnits.$inferSelect | null;
    assignedTechPerson: typeof people.$inferSelect | null;
    feedback: unknown;
  }): TicketSummary {
    const t = row.ticket;
    return {
      id: t.id,
      ticketNumber: t.ticketNumber,
      trackToken: t.trackToken,
      status: t.status,
      priority: t.priority,
      approvalStatus: t.approvalStatus,
      categoryName: row.category.name,
      categoryId: row.category.id,
      subcategoryName: row.subcategory?.name ?? null,
      subcategoryId: row.subcategory?.id ?? null,
      requesterAccountId: t.requesterAccountId,
      requesterName: t.requesterName,
      requesterEmail: t.requesterEmail,
      requesterEmployeeNumber: t.requesterEmployeeNumber,
      beneficiaryName: t.beneficiaryName,
      unitName: row.unit?.name ?? null,
      unitId: t.unitId,
      technicianName: row.assignedTechPerson?.fullName ?? null,
      assignedTechAccountId: t.assignedTechAccountId,
      areaResponsavel: t.areaResponsavel,
      isRemote: row.category.code === "REMOTE" || Boolean(t.anyDeskCode),
      presential: t.presential,
      requiresCauseSolution: t.requiresCauseSolution,
      hasFeedback: Boolean(row.feedback),
      slaDeadline: t.slaDeadline?.toISOString() ?? null,
      openedAt: t.openedAt.toISOString(),
      completedAt: t.completedAt?.toISOString() ?? null,
      updatedAt: t.updatedAt.toISOString(),
    };
  }
}
