import { clientHeaders, expect, test } from "./fixtures";

test("atendimento protege escopo, etapas, campos obrigatórios e rejeição concorrente", async ({
  playwright,
}) => {
  const clients = await Promise.all(
    [0, 1, 2].map(() =>
      playwright.request.newContext({
        baseURL: "http://127.0.0.1:4173",
        extraHTTPHeaders: clientHeaders(),
      }),
    ),
  );
  const [admin, worker, other] = clients;
  const grants: string[] = [];
  try {
    const users = [];
    for (const [index, email] of [
      "admin-e2e@local.invalid",
      "caio.nascimento@homolog.cge.am.gov.br",
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
    const input = {
      type: "other",
      description:
        "Informação particular para atendimento da Gestão de Pessoas.",
    };
    expect(
      (await worker.post("/api/hr-requests", { data: input })).status(),
    ).toBe(403);
    for (const [index, permission] of [
      [1, "hr_requests.create"],
      [2, "hr_requests.manage"],
    ] as const) {
      const response = await admin.post("/api/admin/permission-overrides", {
        data: {
          accountId: users[index].account.id,
          permission,
          effect: "allow",
          unitId: users[index].employment.unit.id,
        },
      });
      expect(response.status()).toBe(201);
      grants.push((await response.json()).id);
    }
    for (const data of [
      { ...input, description: "curto" },
      { ...input, description: "a".repeat(2001) },
      { ...input, type: "correction" },
      { ...input, requesterAccountId: users[0].account.id },
    ])
      expect((await worker.post("/api/hr-requests", { data })).status()).toBe(
        400,
      );
    const created = await worker.post("/api/hr-requests", { data: input });
    expect(created.status()).toBe(201);
    const record = await created.json();
    const url = `/api/hr-requests/${record.id}`;
    expect((await other.get(url)).status()).toBe(404);
    expect(
      JSON.stringify(
        await (await other.get("/api/hr-requests?scope=team")).json(),
      ),
    ).not.toContain(record.id);
    expect(
      (
        await other.post(`${url}/transition`, {
          data: { action: "start", version: 1 },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await other.post(`${url}/transition`, {
          data: { action: "cancel", version: 1 },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await admin.post(`${url}/transition`, {
          data: {
            action: "complete",
            version: 1,
            message: "Conclusão prematura.",
          },
        })
      ).status(),
    ).toBe(409);
    expect(
      (
        await admin.post(`${url}/transition`, {
          data: { action: "start", version: 1 },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await worker.post(`${url}/transition`, {
          data: { action: "cancel", version: 2 },
        })
      ).status(),
    ).toBe(409);
    expect(
      (
        await worker.post(`${url}/transition`, {
          data: {
            action: "provide_information",
            version: 2,
            message: "Complemento não solicitado.",
          },
        })
      ).status(),
    ).toBe(409);
    for (const data of [
      { action: "complete", version: 2 },
      {
        action: "request_information",
        version: 2,
        message: "Precisamos da referência.",
      },
      {
        action: "request_information",
        version: 2,
        message: "Precisamos da referência.",
        deadline: "2000-01-01",
      },
    ])
      expect((await admin.post(`${url}/transition`, { data })).status()).toBe(
        400,
      );
    const untouched = await (await worker.get(url)).json();
    expect(untouched.version).toBe(2);
    expect(
      untouched.events.map((event: { type: string }) => event.type),
    ).toEqual(["submitted", "start"]);
    const decisions = await Promise.all(
      [0, 1].map(() =>
        admin.post(`${url}/transition`, {
          data: {
            action: "reject",
            version: 2,
            message: "Demanda não se enquadra no atendimento solicitado.",
          },
        }),
      ),
    );
    expect(decisions.map((response) => response.status()).sort()).toEqual([
      200, 409,
    ]);
    expect(
      (
        await admin.post(`${url}/transition`, {
          data: {
            action: "complete",
            version: 3,
            message: "Tentativa após encerramento.",
          },
        })
      ).status(),
    ).toBe(409);
    const rejected = await (await worker.get(url)).json();
    expect(rejected.status).toBe("rejected");
    expect(
      rejected.events.map((event: { type: string }) => event.type),
    ).toEqual(["submitted", "start", "reject"]);
    const second = await worker.post("/api/hr-requests", { data: input });
    expect(second.status()).toBe(201);
    const secondId = (await second.json()).id;
    expect(
      (
        await worker.post(`/api/hr-requests/${secondId}/transition`, {
          data: { action: "cancel", version: 1 },
        })
      ).status(),
    ).toBe(200);
    expect(
      (await (await worker.get(`/api/hr-requests/${secondId}`)).json()).status,
    ).toBe("cancelled");
  } finally {
    for (const id of grants)
      await admin.delete(`/api/admin/permission-overrides/${id}`);
    await Promise.all(clients.map((client) => client.dispose()));
  }
});
