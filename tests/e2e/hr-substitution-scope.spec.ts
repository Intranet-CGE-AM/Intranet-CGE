import { clientHeaders, expect, test } from "./fixtures";

test("gestão de substituições restringe registros e busca de pessoas à unidade autorizada", async ({
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
  const [admin, worker, scoped] = clients;
  let grantId = "";
  const records: string[] = [];
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
    const unitId = users[1].employment.unit.id;
    const otherUnitId = users[2].employment.unit.id;
    const grant = await admin.post("/api/admin/permission-overrides", {
      data: {
        accountId: users[2].account.id,
        permission: "workflows.manage_substitutions",
        effect: "allow",
        unitId,
      },
    });
    expect(grant.status()).toBe(201);
    grantId = (await grant.json()).id;
    const input = {
      originalAccountId: users[0].account.id,
      substituteAccountId: users[1].account.id,
      unitId,
      startsOn: "2045-01-01",
      endsOn: "2045-12-31",
      reason: "Cobertura administrativa autorizada para a unidade.",
      flows: ["hr_requests.manage"],
    };
    for (const destination of [unitId, otherUnitId]) {
      const response = await admin.post("/api/substitutions", {
        data: { ...input, unitId: destination },
      });
      expect(response.status()).toBe(201);
      records.push((await response.json()).id);
    }
    const list = await scoped.get("/api/substitutions");
    expect(list.status()).toBe(200);
    expect(list.headers()["cache-control"]).toBe("no-store");
    const body = await list.json();
    expect(body.units.map((unit: { id: string }) => unit.id)).toEqual([unitId]);
    expect(
      body.substitutions.map((record: { id: string }) => record.id),
    ).toContain(records[0]);
    expect(
      body.substitutions.map((record: { id: string }) => record.id),
    ).not.toContain(records[1]);
    const accounts = await scoped.get(
      `/api/substitution-accounts?unitId=${unitId}&query=Helena`,
    );
    expect(accounts.status()).toBe(200);
    const found = await accounts.json();
    expect(found.accounts[0]).toMatchObject({ name: "Helena Monteiro" });
    expect(Object.keys(found.accounts[0]).sort()).toEqual(["id", "name"]);
    expect(
      (
        await scoped.get(
          `/api/substitution-accounts?unitId=${otherUnitId}&query=Helena`,
        )
      ).status(),
    ).toBe(403);
    expect(
      (
        await worker.get(
          `/api/substitution-accounts?unitId=${unitId}&query=Helena`,
        )
      ).status(),
    ).toBe(403);
    expect(
      (
        await scoped.post("/api/substitutions", {
          data: { ...input, unitId: otherUnitId },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await scoped.put(`/api/substitutions/${records[1]}`, {
          data: { ...input, version: 1 },
        })
      ).status(),
    ).toBe(404);
    expect(
      (
        await scoped.post(`/api/substitutions/${records[1]}/cancel`, {
          data: { version: 1 },
        })
      ).status(),
    ).toBe(404);
    expect((await scoped.get("/api/substitutions?page=0")).status()).toBe(400);
    expect(
      (await (await scoped.get("/api/substitutions?page=2")).json())
        .substitutions,
    ).toEqual([]);
  } finally {
    for (const id of records)
      await admin.post(`/api/substitutions/${id}/cancel`, {
        data: { version: 1 },
      });
    if (grantId)
      await admin.delete(`/api/admin/permission-overrides/${grantId}`);
    await Promise.all(clients.map((client) => client.dispose()));
  }
});
