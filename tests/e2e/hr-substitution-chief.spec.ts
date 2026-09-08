import { clientHeaders, expect, test } from "./fixtures";

test("chefia substituta de ocorrências acessa somente sua fila e perde autoridade quando a origem é revogada", async ({
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
      const response = await clients[index].post("/api/auth/login", {
        data: {
          email,
          password: index ? "Homolog-Password-2026" : "Admin-E2E-Password-123",
        },
      });
      expect(response.status()).toBe(200);
      users.push((await response.json()).user);
    }
    const unitId = users[1].employment.unit.id;
    for (const [index, permission] of [
      [1, "occurrences.create"],
      [2, "occurrences.review.supervisor"],
    ] as const) {
      const grant = await admin.post("/api/admin/permission-overrides", {
        data: {
          accountId: users[index].account.id,
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
        originalAccountId: users[2].account.id,
        substituteAccountId: users[3].account.id,
        unitId,
        startsOn: "2026-01-01",
        endsOn: "2040-12-31",
        reason: "Continuidade temporária da análise de ocorrências.",
        flows: ["occurrences.review.supervisor"],
      },
    });
    expect(created.status()).toBe(201);
    substitutionId = (await created.json()).id;
    const type = await admin.post("/api/occurrence-types", {
      data: {
        name: "Ocorrência com chefia substituta",
        active: true,
        requiresSupervisor: true,
        requiresRH: true,
        requiresDocument: false,
        affectsAvailability: false,
        documentTypeId: null,
      },
    });
    expect(type.status()).toBe(201);
    const typeId = (await type.json()).id;
    const request = await worker.post("/api/occurrences", {
      data: {
        typeId,
        startDate: "2044-03-01",
        endDate: "2044-03-02",
        justification: "Informação privada para o RH e titular.",
        submit: true,
      },
    });
    expect(request.status()).toBe(201);
    const record = await request.json();
    const inbox = await (await substitute.get("/api/inbox")).json();
    expect(inbox.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: `occurrence:${record.id}`,
          delegation: expect.objectContaining({ id: substitutionId }),
        }),
      ]),
    );
    expect((await (await chief.get("/api/inbox")).json()).items).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: `occurrence:${record.id}` }),
      ]),
    );
    const queue = await substitute.get("/api/occurrences?scope=supervisor");
    expect(queue.status()).toBe(200);
    expect((await queue.json()).occurrences).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: record.id })]),
    );
    expect(
      JSON.stringify(
        await (await substitute.get(`/api/occurrences/${record.id}`)).json(),
      ),
    ).not.toContain("Informação privada");
    expect(
      (
        await substitute.post(`/api/occurrences/${record.id}/transition`, {
          data: { version: 1, action: "approve" },
        })
      ).status(),
    ).toBe(200);
    const audit = await (
      await admin.get("/api/audit-events?action=occurrence.supervisor-approved")
    ).json();
    expect(audit.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          objectId: record.id,
          actor: expect.objectContaining({ accountId: users[3].account.id }),
          metadata: expect.objectContaining({
            delegation: expect.objectContaining({ id: substitutionId }),
          }),
        }),
      ]),
    );
    const second = await worker.post("/api/occurrences", {
      data: {
        typeId,
        startDate: "2044-04-01",
        endDate: "2044-04-02",
        justification: "Outra ocorrência para análise.",
        submit: true,
      },
    });
    expect(second.status()).toBe(201);
    const other = await second.json();
    expect(
      (
        await admin.delete(`/api/admin/permission-overrides/${grants[1]}`)
      ).status(),
    ).toBe(204);
    grants.pop();
    expect(
      (await (await substitute.get("/api/inbox")).json()).items,
    ).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: `occurrence:${other.id}` }),
      ]),
    );
    expect(
      (
        await substitute.post(`/api/occurrences/${other.id}/transition`, {
          data: { version: 1, action: "approve" },
        })
      ).status(),
    ).toBe(403);
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
