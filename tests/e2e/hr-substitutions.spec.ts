import { clientHeaders, expect, test } from "./fixtures";

test("substituição temporária encaminha somente a aprovação delegada e é revogável", async ({
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
  const [admin, chief, substitute, worker] = clients;
  let substitutionId: string | undefined;
  try {
    const users = [];
    for (const [index, email] of [
      "admin-e2e@local.invalid",
      "helena.monteiro@homolog.cge.am.gov.br",
      "leonardo.araujo@homolog.cge.am.gov.br",
      "caio.nascimento@homolog.cge.am.gov.br",
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
    const vacation = await worker.post("/api/vacation-requests", {
      data: { startDate: "2043-03-01", endDate: "2043-03-05", submit: true },
    });
    expect(vacation.status()).toBe(201);
    const record = await vacation.json();
    const payload = {
      originalAccountId: users[1].account.id,
      substituteAccountId: users[2].account.id,
      unitId: users[3].employment.unit.id,
      startsOn: "2026-01-01",
      endsOn: "2040-12-31",
      reason: "Continuidade da análise durante afastamento da chefia.",
      flows: ["vacations.review.supervisor"],
    };
    expect(
      (await worker.post("/api/substitutions", { data: payload })).status(),
    ).toBe(403);
    const created = await admin.post("/api/substitutions", { data: payload });
    expect(created.status()).toBe(201);
    const substitution = await created.json();
    substitutionId = substitution.id;
    const inbox = await (await substitute.get("/api/inbox")).json();
    expect(inbox.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: `vacation:${record.id}`,
          delegation: expect.objectContaining({
            id: substitution.id,
            originalName: users[1].person.displayName,
          }),
        }),
      ]),
    );
    expect((await (await chief.get("/api/inbox")).json()).items).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: `vacation:${record.id}` }),
      ]),
    );
    expect(
      (
        await substitute.get(`/api/documents?personId=${users[3].person.id}`)
      ).status(),
    ).toBe(403);
    expect((await substitute.get("/api/hr-requests?scope=team")).status()).toBe(
      403,
    );
    const queue = await substitute.get(
      "/api/vacation-requests?scope=supervisor",
    );
    expect(queue.status()).toBe(200);
    expect((await queue.json()).requests).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: record.id })]),
    );
    const cancelled = await admin.post(
      `/api/substitutions/${substitution.id}/cancel`,
      { data: { version: 1 } },
    );
    expect(cancelled.status()).toBe(200);
    expect(
      (await (await substitute.get("/api/inbox")).json()).items,
    ).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: `vacation:${record.id}` }),
      ]),
    );
    expect((await (await chief.get("/api/inbox")).json()).items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: `vacation:${record.id}` }),
      ]),
    );
    expect(
      (
        await substitute.post(
          `/api/vacation-requests/${record.id}/supervisor-decision`,
          { data: { decision: "approve", version: 1 } },
        )
      ).status(),
    ).toBe(403);
  } finally {
    if (substitutionId)
      await admin.post(`/api/substitutions/${substitutionId}/cancel`, {
        data: { version: 1 },
      });
    await Promise.all(clients.map((client) => client.dispose()));
  }
});
