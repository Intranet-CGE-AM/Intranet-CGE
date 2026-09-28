import { clientHeaders, expect, test } from "./fixtures";

test("substituto do RH recebe apenas os fluxos selecionados da unidade e conclui as cinco filas", async ({
  playwright,
}) => {
  const clients = await Promise.all(
    [0, 1, 2, 3].map(() =>
      playwright.request.newContext({
        baseURL: "http://127.0.0.1:4173",
        extraHTTPHeaders: clientHeaders(),
      }),
    ),
  );
  const [admin, worker, chief, substitute] = clients;
  const grants: string[] = [];
  let substitutionId = "";
  try {
    const users = [];
    for (const [index, email] of [
      "admin-e2e@local.invalid",
      "caio.nascimento@homolog.cge.am.gov.br",
      "helena.monteiro@homolog.cge.am.gov.br",
      "leonardo.araujo@homolog.cge.am.gov.br",
    ].entries()) {
      const login = await clients[index].post("/api/auth/login", {
        data: {
          email,
          password: index ? "Homolog-Password-2026" : "Admin-E2E-Password-123",
        },
      });
      expect(login.status()).toBe(200);
      users.push((await login.json()).user);
    }
    const unitId = users[1].employment.unit.id;
    for (const permission of [
      "hr_requests.create",
      "occurrences.create",
      "training.create",
    ]) {
      const grant = await admin.post("/api/admin/permission-overrides", {
        data: {
          accountId: users[1].account.id,
          permission,
          effect: "allow",
          unitId,
        },
      });
      expect(grant.status()).toBe(201);
      grants.push((await grant.json()).id);
    }
    const created = await admin.post("/api/substitutions", {
      data: {
        originalAccountId: users[0].account.id,
        substituteAccountId: users[3].account.id,
        unitId,
        startsOn: "2026-01-01",
        endsOn: "2040-12-31",
        reason: "Cobertura temporária do atendimento da unidade.",
        flows: [
          "hr_requests.manage",
          "vacations.review.final",
          "occurrences.review.final",
          "training.review",
          "onboarding.manage",
        ],
      },
    });
    expect(created.status()).toBe(201);
    substitutionId = (await created.json()).id;
    const request = await worker.post("/api/hr-requests", {
      data: {
        type: "other",
        description: "Atendimento administrativo da unidade.",
      },
    });
    expect(request.status()).toBe(201);
    const requestId = (await request.json()).id;
    const vacation = await worker.post("/api/vacation-requests", {
      data: { startDate: "2044-01-01", endDate: "2044-01-05", submit: true },
    });
    expect(vacation.status()).toBe(201);
    const vacationId = (await vacation.json()).id;
    expect(
      (
        await chief.post(
          `/api/vacation-requests/${vacationId}/supervisor-decision`,
          { data: { version: 1, decision: "approve" } },
        )
      ).status(),
    ).toBe(200);
    const type = await admin.post("/api/occurrence-types", {
      data: {
        name: "Atendimento substituto do RH",
        active: true,
        requiresSupervisor: false,
        requiresRH: true,
        requiresDocument: false,
        affectsAvailability: false,
        documentTypeId: null,
      },
    });
    expect(type.status()).toBe(201);
    const occurrence = await worker.post("/api/occurrences", {
      data: {
        typeId: (await type.json()).id,
        startDate: "2044-02-01",
        endDate: "2044-02-02",
        justification: "Justificativa confidencial da ocorrência.",
        submit: true,
      },
    });
    expect(occurrence.status()).toBe(201);
    const occurrenceId = (await occurrence.json()).id;
    const training = await worker.post("/api/training", {
      data: {
        title: "Formação da unidade",
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
        name: "Conferência da unidade",
        kind: "entry",
        active: true,
        items: [
          {
            title: "Conferir cadastro",
            area: "RH",
            active: true,
            required: true,
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
    const ids = [
      `request:${requestId}`,
      `vacation:${vacationId}`,
      `occurrence:${occurrenceId}`,
      `training:${trainingId}`,
      `checklist:${execution.id}`,
    ];
    const inbox = await (await substitute.get("/api/inbox")).json();
    for (const id of ids)
      expect(inbox.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id,
            unitId,
            delegation: expect.objectContaining({ id: substitutionId }),
          }),
        ]),
      );
    const original = await (await admin.get("/api/inbox")).json();
    expect(
      original.items.filter((item: { id: string }) => ids.includes(item.id)),
    ).toEqual([]);
    expect(
      JSON.stringify(
        await (await substitute.get(`/api/occurrences/${occurrenceId}`)).json(),
      ),
    ).not.toContain("Justificativa confidencial");
    expect(
      (
        await substitute.get(`/api/documents?personId=${users[1].person.id}`)
      ).status(),
    ).toBe(403);
    expect(
      (await substitute.get("/api/vacation-requests?scope=final")).status(),
    ).toBe(200);
    expect(
      (
        await substitute.post(`/api/hr-requests/${requestId}/transition`, {
          data: { version: 1, action: "start" },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await substitute.post(`/api/hr-requests/${requestId}/transition`, {
          data: {
            version: 2,
            action: "complete",
            message: "Atendimento concluído pelo substituto.",
          },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await substitute.post(
          `/api/vacation-requests/${vacationId}/hr-decision`,
          { data: { version: 2, decision: "approve" } },
        )
      ).status(),
    ).toBe(200);
    expect(
      (
        await substitute.post(`/api/occurrences/${occurrenceId}/transition`, {
          data: { version: 1, action: "approve" },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await substitute.post(`/api/training/${trainingId}/transition`, {
          data: { version: 1, action: "validate" },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await substitute.post(
          `/api/checklists/${execution.id}/items/${execution.items[0].id}`,
          { data: { version: 1, action: "complete" } },
        )
      ).status(),
    ).toBe(200);
    expect(
      (await (await substitute.get("/api/inbox")).json()).items.filter(
        (item: { id: string }) => ids.includes(item.id),
      ),
    ).toEqual([]);
    for (const [action, id] of [
      ["hr-request.complete", requestId],
      ["vacation.final-approve", vacationId],
      ["occurrence.final-approved", occurrenceId],
      ["training.validated", trainingId],
      ["checklist.item-updated", execution.id],
    ]) {
      const events = await (
        await admin.get(`/api/audit-events?action=${action}`)
      ).json();
      expect(events.events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            objectId: id,
            actor: expect.objectContaining({ accountId: users[3].account.id }),
            metadata: expect.objectContaining({
              delegation: expect.objectContaining({
                id: substitutionId,
                originalAccountId: users[0].account.id,
              }),
            }),
          }),
        ]),
      );
    }
  } finally {
    if (substitutionId)
      await admin.post(`/api/substitutions/${substitutionId}/cancel`, {
        data: { version: 1 },
      });
    for (const id of grants)
      await admin.delete(`/api/admin/permission-overrides/${id}`);
    await Promise.all(clients.map((client) => client.dispose()));
  }
});
