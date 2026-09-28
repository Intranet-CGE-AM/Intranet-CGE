import { clientHeaders, expect, test } from "./fixtures";

test("capacitação tem validação por unidade, rejeição justificada e histórico no dossiê", async ({
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
    expect((await worker.get("/api/training?scope=mine")).status()).toBe(200);
    const input = {
      title: "Formação em gestão pública",
      institution: "Instituição de homologação",
      startDate: "2026-08-01",
      endDate: "2026-08-10",
      hours: 24,
    };
    expect((await worker.post("/api/training", { data: input })).status()).toBe(
      403,
    );
    for (const [index, permission] of [
      [1, "training.create"],
      [2, "training.review"],
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
    expect(
      (
        await worker.post("/api/training", { data: { ...input, hours: 0 } })
      ).status(),
    ).toBe(400);
    expect(
      (
        await worker.post("/api/training", {
          data: { ...input, endDate: "2026-07-01" },
        })
      ).status(),
    ).toBe(400);
    const create = async () => {
      const result = await worker.post("/api/training", { data: input });
      expect(result.status()).toBe(201);
      return result.json();
    };
    const record = await create();
    expect(record).toMatchObject({
      status: "submitted",
      version: 1,
      hours: 24,
    });
    expect((await other.get(`/api/training/${record.id}`)).status()).toBe(404);
    expect(
      (
        await other.post(`/api/training/${record.id}/transition`, {
          data: { action: "validate", version: 1 },
        })
      ).status(),
    ).toBe(403);
    const validatedUrl = `/api/training?scope=validated&personId=${users[1].person.id}`;
    expect(
      (await (await worker.get(validatedUrl)).json()).records.some(
        (row: { id: string }) => row.id === record.id,
      ),
    ).toBe(false);
    const decisions = await Promise.all(
      [0, 1].map(() =>
        admin.post(`/api/training/${record.id}/transition`, {
          data: { action: "validate", version: 1 },
        }),
      ),
    );
    expect(decisions.map((response) => response.status()).sort()).toEqual([
      200, 409,
    ]);
    expect((await (await worker.get(validatedUrl)).json()).records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: record.id, status: "validated" }),
      ]),
    );
    const notices = (
      await (await worker.get("/api/notifications")).json()
    ).notifications.filter((item: { href: string }) =>
      item.href.includes(record.id),
    );
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({
      type: "training.updated",
      message: "Consulte o andamento na intranet.",
    });
    expect(JSON.stringify(notices)).not.toContain(input.title);
    const rejected = await create();
    expect(
      (
        await admin.post(`/api/training/${rejected.id}/transition`, {
          data: { action: "reject", version: 1 },
        })
      ).status(),
    ).toBe(400);
    expect(
      (
        await admin.post(`/api/training/${rejected.id}/transition`, {
          data: {
            action: "reject",
            version: 1,
            reason: "Informações insuficientes para validação",
          },
        })
      ).status(),
    ).toBe(200);
    expect(
      (await (await worker.get(`/api/training/${rejected.id}`)).json()).events,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "rejected",
          reason: "Informações insuficientes para validação",
        }),
      ]),
    );
    expect(
      (
        await admin.post(`/api/training/${record.id}/transition`, {
          data: {
            action: "archive",
            version: 2,
            reason: "Registro substituído após conferência",
          },
        })
      ).status(),
    ).toBe(200);
    expect(
      (await (await worker.get(validatedUrl)).json()).records.some(
        (row: { id: string }) => row.id === record.id,
      ),
    ).toBe(false);
    const audit = await (
      await admin.get("/api/audit-events?action=training.validated")
    ).json();
    expect(audit.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ objectId: record.id }),
      ]),
    );
  } finally {
    for (const id of grants)
      await admin.delete(`/api/admin/permission-overrides/${id}`);
    await Promise.all(contexts.map((context) => context.dispose()));
  }
});
