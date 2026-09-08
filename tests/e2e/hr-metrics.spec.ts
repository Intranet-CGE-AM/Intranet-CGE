import { clientHeaders, expect, test } from "./fixtures";

test("indicadores agregam solicitações sem conteúdo privado e respeitam unidade e permissão", async ({
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
  const [admin, worker, other] = contexts;
  const grants: string[] = [];
  try {
    const users = [];
    for (const [index, email] of [
      "admin-e2e@local.invalid",
      "caio.nascimento@homolog.cge.am.gov.br",
      "leonardo.araujo@homolog.cge.am.gov.br",
    ].entries()) {
      const response = await contexts[index].post("/api/auth/login", {
        data: {
          email,
          password: index ? "Homolog-Password-2026" : "Admin-E2E-Password-123",
        },
      });
      expect(response.status()).toBe(200);
      users.push((await response.json()).user);
    }
    const today = new Date().toISOString().slice(0, 10);
    const query = `/api/hr-metrics?startDate=${today}&endDate=${today}`;
    expect((await admin.get(query)).status()).toBe(200);
    expect((await worker.get(query)).status()).toBe(403);
    for (const [index, permission] of [
      [1, "hr_requests.create"],
      [2, "hr_requests.manage"],
    ] as const) {
      const grant = await admin.post("/api/admin/permission-overrides", {
        data: {
          accountId: users[index].account.id,
          permission,
          effect: "allow",
          unitId: users[index].employment.unit.id,
        },
      });
      expect(grant.status()).toBe(201);
      grants.push((await grant.json()).id);
    }
    const scopedQuery = `${query}&unitId=${users[1].employment.unit.id}`;
    const baseline = await (await admin.get(scopedQuery)).json();
    const before =
      baseline.requests.find(
        (row: { type: string; status: string }) =>
          row.type === "declaration" && row.status === "submitted",
      )?.count ?? 0;
    const created = await worker.post("/api/hr-requests", {
      data: {
        type: "declaration",
        description: "Informação privada que nunca deve aparecer no indicador.",
      },
    });
    expect(created.status()).toBe(201);
    const response = await admin.get(scopedQuery);
    expect(response.headers()["cache-control"]).toContain("no-store");
    const result = await response.json();
    expect(result.requests).toEqual(
      expect.arrayContaining([
        { type: "declaration", status: "submitted", count: before + 1 },
      ]),
    );
    expect(JSON.stringify(result)).not.toContain("Informação privada");
    expect((await other.get(scopedQuery)).status()).toBe(403);
    const restricted = await (await other.get(query)).json();
    expect(restricted.units.map((unit: { id: string }) => unit.id)).toEqual([
      users[2].employment.unit.id,
    ]);
    expect(restricted.occurrences).toBeNull();
    expect(restricted.trainingPending).toBeNull();
    expect(restricted.vacations).toBeNull();
    expect(restricted.divergences).toBeNull();
    const empty = await (
      await admin.get("/api/hr-metrics?startDate=2001-01-01&endDate=2001-01-01")
    ).json();
    expect(empty.requests).toEqual([]);
    expect(empty.completion).toEqual({ count: 0, averageHours: null });
    expect(
      (
        await admin.get(
          "/api/hr-metrics?startDate=2026-02-30&endDate=2026-03-01",
        )
      ).status(),
    ).toBe(400);
  } finally {
    for (const id of grants)
      await admin.delete(`/api/admin/permission-overrides/${id}`);
    await Promise.all(contexts.map((context) => context.dispose()));
  }
});
