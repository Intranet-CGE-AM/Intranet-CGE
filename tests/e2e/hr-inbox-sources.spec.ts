import { clientHeaders, expect, test } from "./fixtures";

test("caixa reúne férias, ocorrências, capacitações e checklists somente na etapa acionável", async ({
  playwright,
}) => {
  const contexts = await Promise.all(
    [0, 1, 2].map(() =>
      playwright.request.newContext({
        baseURL: "http://127.0.0.1:4173",
        extraHTTPHeaders: clientHeaders(),
      }),
    ),
  );
  const [admin, worker, chief] = contexts;
  const grants: string[] = [];
  try {
    const users = [];
    for (const [index, email] of [
      "admin-e2e@local.invalid",
      "caio.nascimento@homolog.cge.am.gov.br",
      "helena.monteiro@homolog.cge.am.gov.br",
    ].entries()) {
      const login = await contexts[index].post("/api/auth/login", {
        data: {
          email,
          password: index ? "Homolog-Password-2026" : "Admin-E2E-Password-123",
        },
      });
      expect(login.status()).toBe(200);
      users.push((await login.json()).user);
    }
    for (const [index, permission] of [
      [1, "occurrences.create"],
      [1, "training.create"],
      [2, "occurrences.review.supervisor"],
    ] as const) {
      const grant = await admin.post("/api/admin/permission-overrides", {
        data: {
          accountId: users[index].account.id,
          permission,
          effect: "allow",
          unitId: users[1].employment.unit.id,
        },
      });
      expect(grant.status()).toBe(201);
      grants.push((await grant.json()).id);
    }
    const vacation = await worker.post("/api/vacation-requests", {
      data: { startDate: "2042-01-01", endDate: "2042-01-05", submit: true },
    });
    expect(vacation.status()).toBe(201);
    const vacationId = (await vacation.json()).id;
    const type = await admin.post("/api/occurrence-types", {
      data: {
        name: "Ocorrência para caixa",
        active: true,
        requiresSupervisor: true,
        requiresRH: true,
        requiresDocument: false,
        affectsAvailability: true,
        documentTypeId: null,
      },
    });
    expect(type.status()).toBe(201);
    const occurrence = await worker.post("/api/occurrences", {
      data: {
        typeId: (await type.json()).id,
        startDate: "2042-02-01",
        endDate: "2042-02-02",
        justification: "Justificativa reservada fora da caixa de pendências.",
        submit: true,
      },
    });
    expect(occurrence.status()).toBe(201);
    const occurrenceId = (await occurrence.json()).id;
    const training = await worker.post("/api/training", {
      data: {
        title: "Formação para caixa",
        institution: "Instituição de teste",
        startDate: "2026-08-01",
        endDate: "2026-08-02",
        hours: 4,
      },
    });
    expect(training.status()).toBe(201);
    const trainingId = (await training.json()).id;
    const template = await admin.post("/api/onboarding-templates", {
      data: {
        name: "Orientações da caixa",
        kind: "entry",
        active: true,
        items: [
          {
            title: "Ler orientações",
            area: "RH",
            required: true,
            active: true,
          },
        ],
      },
    });
    expect(template.status()).toBe(201);
    const checklist = await admin.post("/api/checklists", {
      data: {
        personId: users[1].person.id,
        employmentId: users[1].employment.id,
        templateId: (await template.json()).id,
        assignments: [{ itemIndex: 0, accountId: users[1].account.id }],
      },
    });
    expect(checklist.status()).toBe(201);
    const execution = await checklist.json();
    const chiefInbox = await (await chief.get("/api/inbox")).json();
    expect(chiefInbox.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: `vacation:${vacationId}`,
          type: "vacation",
        }),
        expect.objectContaining({
          id: `occurrence:${occurrenceId}`,
          type: "occurrence",
        }),
      ]),
    );
    expect(JSON.stringify(chiefInbox)).not.toContain("Justificativa reservada");
    const adminInbox = await (await admin.get("/api/inbox")).json();
    expect(adminInbox.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: `training:${trainingId}` }),
      ]),
    );
    expect(adminInbox.items).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: `vacation:${vacationId}` }),
      ]),
    );
    const workerInbox = await worker.get("/api/inbox?type=checklist");
    expect(workerInbox.status()).toBe(200);
    expect((await workerInbox.json()).items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: `checklist:${execution.id}`,
          href: `/rh/checklists?checklistId=${execution.id}`,
        }),
      ]),
    );
    expect(
      (
        await chief.post(
          `/api/vacation-requests/${vacationId}/supervisor-decision`,
          { data: { version: 1, decision: "approve" } },
        )
      ).status(),
    ).toBe(200);
    expect(
      (
        await chief.post(`/api/occurrences/${occurrenceId}/transition`, {
          data: { version: 1, action: "approve" },
        })
      ).status(),
    ).toBe(200);
    const nextChief = await (await chief.get("/api/inbox")).json();
    expect(nextChief.items).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: `vacation:${vacationId}` }),
      ]),
    );
    expect(nextChief.items).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: `occurrence:${occurrenceId}` }),
      ]),
    );
    const nextAdmin = await (await admin.get("/api/inbox")).json();
    expect(nextAdmin.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: `vacation:${vacationId}` }),
        expect.objectContaining({ id: `occurrence:${occurrenceId}` }),
      ]),
    );
    expect(
      (
        await admin.post(`/api/training/${trainingId}/transition`, {
          data: { version: 1, action: "validate" },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await worker.post(
          `/api/checklists/${execution.id}/items/${execution.items[0].id}`,
          { data: { version: 1, action: "complete" } },
        )
      ).status(),
    ).toBe(200);
    expect(
      (await (await admin.get("/api/inbox?type=training")).json()).items,
    ).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: `training:${trainingId}` }),
      ]),
    );
    expect(
      (await (await worker.get("/api/inbox?type=checklist")).json()).items,
    ).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: `checklist:${execution.id}` }),
      ]),
    );
    const filtered = await (
      await admin.get(
        `/api/inbox?type=vacation&unitId=${users[1].employment.unit.id}&pageSize=1`,
      )
    ).json();
    expect(filtered.items).toHaveLength(1);
    expect(filtered.total).toBeGreaterThanOrEqual(1);
    expect(filtered.items[0]).toMatchObject({
      type: "vacation",
      unitId: users[1].employment.unit.id,
    });
  } finally {
    for (const id of grants)
      await admin.delete(`/api/admin/permission-overrides/${id}`);
    await Promise.all(contexts.map((context) => context.dispose()));
  }
});
