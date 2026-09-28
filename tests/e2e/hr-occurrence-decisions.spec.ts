import { clientHeaders, expect, test } from "./fixtures";

test("ocorrência preserva privacidade na chefia e decide com versão e auditoria", async ({
  playwright,
}) => {
  const contexts = await Promise.all(
    ["admin", "worker", "chief", "other"].map(() =>
      playwright.request.newContext({
        baseURL: "http://127.0.0.1:4173",
        extraHTTPHeaders: clientHeaders(),
      }),
    ),
  );
  const [admin, worker, chief, other] = contexts;
  const grants: string[] = [];
  try {
    const users = [];
    for (const [index, email] of [
      "admin-e2e@local.invalid",
      "caio.nascimento@homolog.cge.am.gov.br",
      "helena.monteiro@homolog.cge.am.gov.br",
      "leonardo.araujo@homolog.cge.am.gov.br",
    ].entries()) {
      const response = await contexts[index].post("/api/auth/login", {
        data: {
          email,
          password:
            index === 0 ? "Admin-E2E-Password-123" : "Homolog-Password-2026",
        },
      });
      expect(response.status()).toBe(200);
      users.push((await response.json()).user);
    }
    for (const [index, permission] of [
      [1, "occurrences.create"],
      [2, "occurrences.review.supervisor"],
      [3, "occurrences.review.supervisor"],
    ] as const) {
      const response = await admin.post("/api/admin/permission-overrides", {
        data: {
          accountId: users[index].account.id,
          permission,
          effect: "allow",
          unitId: users[1].employment.unit.id,
        },
      });
      expect(response.status()).toBe(201);
      grants.push((await response.json()).id);
    }
    const typeResponse = await admin.post("/api/occurrence-types", {
      data: {
        name: "Ausência administrativa sem exposição clínica",
        active: true,
        requiresSupervisor: true,
        requiresRH: true,
        requiresDocument: false,
        affectsAvailability: true,
        documentTypeId: null,
      },
    });
    expect(typeResponse.status()).toBe(201);
    const { id: typeId } = await typeResponse.json();
    const create = async () => {
      const response = await worker.post("/api/occurrences", {
        data: {
          typeId,
          startDate: "2031-03-01",
          endDate: "2031-03-03",
          justification:
            "Conteúdo privado de homologação que não deve ir à chefia",
          submit: false,
        },
      });
      expect(response.status()).toBe(201);
      return response.json();
    };
    const item = await create();
    const transition = (
      context: typeof admin,
      id: string,
      action: string,
      version: number,
      comment?: string,
    ) =>
      context.post(`/api/occurrences/${id}/transition`, {
        data: { action, version, comment },
      });
    expect((await transition(worker, item.id, "submit", 1)).status()).toBe(200);
    const queue = await chief.get("/api/occurrences?scope=supervisor");
    expect(queue.status()).toBe(200);
    const queued = (await queue.json()).occurrences.find(
      (row: { id: string }) => row.id === item.id,
    );
    expect(queued).toMatchObject({
      status: "submitted",
      affectsAvailability: true,
    });
    expect(queued).not.toHaveProperty("justification");
    expect(queued).not.toHaveProperty("documentId");
    expect((await other.get(`/api/occurrences/${item.id}`)).status()).toBe(404);
    expect((await transition(other, item.id, "approve", 2)).status()).toBe(403);
    expect((await transition(chief, item.id, "reject", 2)).status()).toBe(400);
    expect((await transition(chief, item.id, "approve", 2)).status()).toBe(200);
    const results = await Promise.all([
      transition(admin, item.id, "approve", 3),
      transition(admin, item.id, "approve", 3),
    ]);
    expect(results.map((response) => response.status()).sort()).toEqual([
      200, 409,
    ]);
    const detail = await (
      await worker.get(`/api/occurrences/${item.id}`)
    ).json();
    expect(detail.status).toBe("final_approved");
    expect(detail.events.map((event: { type: string }) => event.type)).toEqual([
      "created",
      "submitted",
      "supervisor-approved",
      "final-approved",
    ]);
    expect(
      (
        await transition(
          worker,
          item.id,
          "cancel",
          4,
          "Solicitação cancelada pelo titular",
        )
      ).status(),
    ).toBe(200);
    const rejected = await create();
    await transition(worker, rejected.id, "submit", 1);
    expect(
      (
        await transition(
          chief,
          rejected.id,
          "reject",
          2,
          "Período não autorizado pela chefia",
        )
      ).status(),
    ).toBe(200);
    expect(
      (await (await worker.get(`/api/occurrences/${rejected.id}`)).json())
        .status,
    ).toBe("rejected");
    const notices = await (await worker.get("/api/notifications")).json();
    expect(JSON.stringify(notices)).not.toContain("Conteúdo privado");
    const occurrenceNotices = notices.notifications.filter(
      (notice: { href: string }) => notice.href.includes(item.id),
    );
    expect(occurrenceNotices).toHaveLength(2);
    expect(
      occurrenceNotices.every(
        (notice: { message: string }) =>
          notice.message === "Consulte o andamento na intranet.",
      ),
    ).toBe(true);
    expect(notices.notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "occurrence.updated" }),
      ]),
    );
  } finally {
    for (const id of grants)
      await admin.delete(`/api/admin/permission-overrides/${id}`);
    await Promise.all(contexts.map((context) => context.dispose()));
  }
});
