import type {
  AuthenticatedUser,
  LoginRequest,
  TicketCategory,
  TicketDetail,
  TicketFeedback,
  TicketSummary,
} from "@cge/contracts";
import { describe, expect, it } from "vitest";

import { buildApp } from "../../app.js";
import type { AppConfig } from "../../config.js";
import type { Database } from "../../db/client.js";
import type { AccessService } from "../access/service.js";
import type { AuthenticationService } from "../auth/service.js";
import type { TicketService } from "./service.js";

const config: AppConfig = {
  NODE_ENV: "test",
  API_PORT: 3000,
  WEB_ORIGIN: "http://localhost:5173",
  DATABASE_URL: "postgresql://unused",
  SESSION_SECRET: "test-session-secret-with-at-least-32-characters",
  SESSION_TTL_HOURS: 12,
  SECURE_COOKIES: false,
  OBJECT_STORAGE_ENDPOINT: "http://localhost:9000",
  OBJECT_STORAGE_ACCESS_KEY: "test-key",
  OBJECT_STORAGE_SECRET_KEY: "test-secret",
  OBJECT_STORAGE_BUCKET: "test-bucket",
};

const validUnitId = "50000000-0000-4000-8000-000000000001";

const commonUser: AuthenticatedUser = {
  account: {
    id: "00000000-0000-4000-8000-000000000001",
    email: "caio.nascimento@cge.am.gov.br",
    mustChangePassword: false,
  },
  person: {
    id: "00000000-0000-4000-8000-000000000002",
    displayName: "Caio Nascimento",
    avatarUrl: null,
  },
  employment: {
    category: { id: "cat-1", name: "Servidor efetivo" },
    id: "60000000-0000-4000-8000-000000000001",
    jobTitle: "Analista",
    unit: { id: validUnitId, code: "CGTI", name: "CGTI" },
  },
  permissions: [{ effect: "allow", key: "tickets.create", unitId: null }],
};

const technicianUser: AuthenticatedUser = {
  account: {
    id: "00000000-0000-4000-8000-000000000003",
    email: "dandara.ribeiro@cge.am.gov.br",
    mustChangePassword: false,
  },
  person: {
    id: "00000000-0000-4000-8000-000000000004",
    displayName: "Dandara Ribeiro",
    avatarUrl: null,
  },
  employment: {
    category: { id: "cat-2", name: "Colaborador terceirizado" },
    id: "60000000-0000-4000-8000-000000000002",
    jobTitle: "Técnica de TI",
    unit: { id: validUnitId, code: "CGTI", name: "CGTI" },
  },
  permissions: [
    { effect: "allow", key: "tickets.create", unitId: null },
    { effect: "allow", key: "tickets.attend", unitId: null },
  ],
};

const fakeCategories: TicketCategory[] = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    code: "HARDWARE",
    name: "Computador",
    icon: "Desktop",
    color: "blue",
    sortOrder: 1,
    allowsFreeText: false,
    allowsBeneficiary: true,
    n1Tips: "Verifique os cabos.",
    slaHours: 4,
    defaultPriority: "medium",
    active: true,
    subcategories: [
      {
        id: "20000000-0000-4000-8000-000000000001",
        categoryId: "10000000-0000-4000-8000-000000000001",
        name: "Computador não liga",
        code: "HARDWARE_WONT_TURN_ON",
        sortOrder: 1,
        slaHours: 4,
        n1Tips: null,
        defaultPriority: "medium",
        areaResponsavel: "manutencao",
        requiresApproval: false,
        dualApproval: false,
        requiresPresential: true,
        requiresCauseSolution: true,
        allowsFreeText: false,
        freeTextLabel: null,
        formType: null,
        active: true,
      },
    ],
  },
];

const fakeDetail: TicketDetail = {
  id: "30000000-0000-4000-8000-000000000001",
  ticketNumber: "20260902-0001",
  trackToken: "test-track-token-123456",
  status: "open",
  priority: "medium",
  approvalStatus: "not_required",
  categoryId: "10000000-0000-4000-8000-000000000001",
  categoryName: "Computador",
  subcategoryId: "20000000-0000-4000-8000-000000000001",
  subcategoryName: "Computador não liga",
  requesterAccountId: commonUser.account.id,
  requesterName: "Caio Nascimento",
  requesterEmail: "caio.nascimento@cge.am.gov.br",
  requesterEmployeeNumber: "HOM-003",
  beneficiaryName: null,
  unitId: validUnitId,
  unitName: "CGTI",
  technicianName: null,
  assignedTechAccountId: null,
  areaResponsavel: "manutencao",
  isRemote: false,
  presential: true,
  requiresCauseSolution: true,
  hasFeedback: false,
  slaDeadline: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
  openedAt: new Date().toISOString(),
  completedAt: null,
  updatedAt: new Date().toISOString(),
  freeTextDescription: "Computador parou de ligar após queda de energia.",
  anyDeskCode: null,
  extraData: null,
  cause: null,
  solution: null,
  completionNote: null,
  cancelNote: null,
  pauseNote: null,
  pausedAt: null,
  totalPausedMs: 0,
  viewedAt: null,
  enRouteAt: null,
  inServiceAt: null,
  reopenedAt: null,
  messages: [],
  events: [],
  approvals: [],
  feedback: null,
};

class FakeAuthService implements Partial<AuthenticationService> {
  constructor(private currentUser: AuthenticatedUser = commonUser) {}
  async createAccount() {
    return {
      id: this.currentUser.account.id,
      email: this.currentUser.account.email,
    };
  }
  async authenticate(token: string) {
    return token === "valid-token" ? this.currentUser : null;
  }
  async login(input: LoginRequest) {
    return input.password === "correct-password"
      ? { token: "valid-token", user: this.currentUser }
      : null;
  }
  async logout() {}
}

class FakeAccessService implements Partial<AccessService> {
  async allows() {
    return true;
  }
}

class FakeTicketService implements Partial<TicketService> {
  async listCategories() {
    return fakeCategories;
  }
  async listMyTickets(): Promise<TicketSummary[]> {
    return [fakeDetail];
  }
  async createTicket(): Promise<TicketDetail> {
    return fakeDetail;
  }
  async listQueueTickets(): Promise<TicketSummary[]> {
    return [fakeDetail];
  }
  async getTicket(): Promise<TicketDetail> {
    return fakeDetail;
  }
  async transitionTicket(): Promise<TicketDetail> {
    return { ...fakeDetail, status: "in_service" };
  }
  async submitFeedback(): Promise<TicketFeedback> {
    return {
      id: "40000000-0000-4000-8000-000000000001",
      ticketId: fakeDetail.id,
      rating: 5,
      comment: "Ótimo atendimento!",
      createdAt: new Date().toISOString(),
    };
  }
}

describe("ticket routes", () => {
  it("lists categories for authenticated user", async () => {
    const authService = new FakeAuthService(commonUser);
    const app = await buildApp({
      accessService: new FakeAccessService() as unknown as AccessService,
      authenticationService: authService as unknown as AuthenticationService,
      ticketService: new FakeTicketService() as unknown as TicketService,
      db: {} as unknown as Database,
      config,
      readinessCheck: async () => undefined,
    });

    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: { origin: config.WEB_ORIGIN },
      payload: {
        email: commonUser.account.email,
        password: "correct-password",
      },
    });
    const setCookie = login.headers["set-cookie"];
    const cookie = (Array.isArray(setCookie) ? setCookie[0] : setCookie)!.split(
      ";",
    )[0];

    const res = await app.inject({
      method: "GET",
      url: "/api/tickets/categories",
      headers: { cookie, origin: config.WEB_ORIGIN },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ categories: fakeCategories });
    await app.close();
  });

  it("allows common user with tickets.create to open a ticket", async () => {
    const authService = new FakeAuthService(commonUser);
    const fakeDb = {
      insert: () => ({ values: async () => [] }),
    } as unknown as Database;
    const app = await buildApp({
      accessService: new FakeAccessService() as unknown as AccessService,
      authenticationService: authService as unknown as AuthenticationService,
      ticketService: new FakeTicketService() as unknown as TicketService,
      db: fakeDb,
      config,
      readinessCheck: async () => undefined,
    });

    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: { origin: config.WEB_ORIGIN },
      payload: {
        email: commonUser.account.email,
        password: "correct-password",
      },
    });
    const setCookie = login.headers["set-cookie"];
    const cookie = (Array.isArray(setCookie) ? setCookie[0] : setCookie)!.split(
      ";",
    )[0];

    const res = await app.inject({
      method: "POST",
      url: "/api/tickets",
      headers: { cookie, origin: config.WEB_ORIGIN },
      payload: {
        categoryId: fakeCategories[0]!.id,
        subcategoryId: fakeCategories[0]!.subcategories[0]!.id,
        freeTextDescription: "Computador não está ligando.",
      },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().ticketNumber).toBe("20260902-0001");
    await app.close();
  });

  it("allows technician to view queue and transition status", async () => {
    const authService = new FakeAuthService(technicianUser);
    const fakeDb = {
      insert: () => ({ values: async () => [] }),
    } as unknown as Database;
    const app = await buildApp({
      accessService: new FakeAccessService() as unknown as AccessService,
      authenticationService: authService as unknown as AuthenticationService,
      ticketService: new FakeTicketService() as unknown as TicketService,
      db: fakeDb,
      config,
      readinessCheck: async () => undefined,
    });

    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: { origin: config.WEB_ORIGIN },
      payload: {
        email: technicianUser.account.email,
        password: "correct-password",
      },
    });
    const setCookie = login.headers["set-cookie"];
    const cookie = (Array.isArray(setCookie) ? setCookie[0] : setCookie)!.split(
      ";",
    )[0];

    const queueRes = await app.inject({
      method: "GET",
      url: "/api/tickets/queue",
      headers: { cookie, origin: config.WEB_ORIGIN },
    });
    expect(queueRes.statusCode).toBe(200);

    const transitionRes = await app.inject({
      method: "POST",
      url: `/api/tickets/${fakeDetail.id}/transition`,
      headers: { cookie, origin: config.WEB_ORIGIN },
      payload: {
        toStatus: "in_service",
      },
    });
    expect(transitionRes.statusCode).toBe(200);
    expect(transitionRes.json().status).toBe("in_service");

    await app.close();
  });
});
