import { clientHeaders, expect, test } from "./fixtures";

test("decisão substituta registra ator real e origem, sem permitir aprovar as próprias férias", async ({
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
  const active: string[] = [];
  try {
    const users = [];
    for (const [index, email] of [
      "admin-e2e@local.invalid",
      "helena.monteiro@homolog.cge.am.gov.br",
      "leonardo.araujo@homolog.cge.am.gov.br",
      "caio.nascimento@homolog.cge.am.gov.br",
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
    const payload = {
      originalAccountId: users[1].account.id,
      substituteAccountId: users[2].account.id,
      unitId: users[3].employment.unit.id,
      startsOn: "2026-01-01",
      endsOn: "2040-12-31",
      reason: "Continuidade do atendimento da chefia.",
      flows: ["vacations.review.supervisor"],
    };
    const created = await admin.post("/api/substitutions", { data: payload });
    expect(created.status()).toBe(201);
    const delegation = await created.json();
    active.push(delegation.id);
    const vacation = await worker.post("/api/vacation-requests", {
      data: { startDate: "2043-04-01", endDate: "2043-04-05", submit: true },
    });
    expect(vacation.status()).toBe(201);
    const record = await vacation.json();
    const response = await substitute.post(
      `/api/vacation-requests/${record.id}/supervisor-decision`,
      { data: { decision: "approve", version: 1 } },
    );
    expect(response.status()).toBe(200);
    const mine = await (
      await worker.get("/api/vacation-requests?scope=mine")
    ).json();
    expect(
      mine.requests.find((item: { id: string }) => item.id === record.id),
    ).toMatchObject({
      status: "supervisor_approved",
      events: expect.arrayContaining([
        expect.objectContaining({
          actorAccountId: users[2].account.id,
          type: "supervisor-approved",
          metadata: {
            delegation: expect.objectContaining({
              id: delegation.id,
              originalAccountId: users[1].account.id,
            }),
          },
        }),
      ]),
    });
    expect(
      (
        await admin.post(`/api/substitutions/${delegation.id}/cancel`, {
          data: { version: 1 },
        })
      ).status(),
    ).toBe(200);
    active.pop();
    const self = await admin.post("/api/substitutions", {
      data: { ...payload, substituteAccountId: users[3].account.id },
    });
    expect(self.status()).toBe(201);
    active.push((await self.json()).id);
    const another = await worker.post("/api/vacation-requests", {
      data: { startDate: "2043-05-01", endDate: "2043-05-05", submit: true },
    });
    const own = await another.json();
    expect(
      (
        await worker.post(
          `/api/vacation-requests/${own.id}/supervisor-decision`,
          { data: { decision: "approve", version: 1 } },
        )
      ).status(),
    ).toBe(403);
    expect(
      (
        await (
          await worker.get("/api/vacation-requests?scope=supervisor")
        ).json()
      ).requests,
    ).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: own.id })]),
    );
    expect((await (await worker.get("/api/inbox")).json()).items).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: `vacation:${own.id}` }),
      ]),
    );
    expect((await (await chief.get("/api/inbox")).json()).items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: `vacation:${own.id}` }),
      ]),
    );
  } finally {
    for (const id of active)
      await admin.post(`/api/substitutions/${id}/cancel`, {
        data: { version: 1 },
      });
    await Promise.all(clients.map((client) => client.dispose()));
  }
});
